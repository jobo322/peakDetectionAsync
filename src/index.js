'use strict';

const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join, resolve } = require('path');


const { convertFileList, groupByExperiments } = require('brukerconverter');
const { fileListFromPath } = require('filelist-utils');
const { isAnyArray } = require('is-any-array');
const { Piscina } = require('piscina');

const { process2DOptions, converterOptions, gsdOptions, alignmentOptions, getName, groupExperiments } = require('./options');
const { align } = require('./utils/align');
const { getJSON } = require('./utils/getJSON');
const { getROIs } = require('./utils/getROIs');

// const path = '/IVDR05/data/gemma_C1_URI_NMR-URI-LONG_IVDR05_GMAp04_290422';
const path = '/IVDR02/data/covid19_heidelberg_URI_NMR_URINE_IVDR02_COVp96_181121';
const pathToWrite = '/home/centos/result_peakpicking';

if (!existsSync(pathToWrite)) {
  mkdirSync(pathToWrite);
}

processPath(path);
// hacer la exportacion solo de -0.1 - 10 ppm
async function processPath(path) {
  const xlsxData = readFileSync('./src/annotationDB.xlsx');
  const database = await getJSON(xlsxData, 0);

  const ROI = getROIs(database, [
    { name: 'name' },
    { name: 'smiles' },
    { name: 'diaID' },
    { name: 'multiplicity' },
    { name: 'inchi key', saveAs: 'inchi' },
    { path: ['urine'], name: 'delta [ppm]', saveAs: 'delta' },
    { path: ['urine'], name: 'from [ppm]', saveAs: 'from' },
    { path: ['urine'], name: 'to [ppm]', saveAs: 'to' },
  ]);

  const fileList = fileListFromPath(path);
  const experiments = groupByExperiments(fileList, converterOptions.filter);

  // group the experiments to avoid reaching the memory limit
  const groupsOfExperiments = groupExperiments(experiments);
  const piscina = new Piscina({
    filename: join(__dirname, 'worker.js'),
  });

  for (const goe of groupsOfExperiments) {
    const groupFileList = [];
    for (const experiment of goe) {
      groupFileList.push(...experiment.fileList);
    }

    const pdata = await convertFileList(groupFileList, converterOptions);
    const groups = {};

    for (let i = 0; i < pdata.length; i++) {
      const data = pdata[i];
      const name = getName(data, i);
      if (!groups[name]) groups[name] = [];
      groups[name].push(data);
    }

    for (const groupName in groups) {
      let promises = [];
      for (const data of groups[groupName]) {
        if (data.twoD) {
          const { zonesPicking, jResAnalyzer } = process2DOptions;
          promises.push(
            piscina.run({ data, zonesPicking, jResAnalyzer }, { name: 'process2D' }),
          );
        } else {
          promises.push(process1D(data, piscina, { gsdOptions, ROI }));
        }

      }

      await Promise.all(promises).then((result) => {
        for (const spectrum of result) {
          spectrum.name = groupName;
        }
        writeFileSync(
          join(pathToWrite, `result_${result[0].name}_${result[0].expno}.json`),
          JSON.stringify(result),
        );
      });
    }
  }
}

async function process1D(data, piscina, options = {}) {
  const { optimizationOptions, gsdOptions, ROI } = options;

  let spectrum = data.spectra[0].data;
  if (spectrum.x[0] > spectrum.x[1]) {
    spectrum.x = spectrum.x.reverse();
    spectrum.re = spectrum.re.reverse();
  }

  const xyData = align({
    spectrum,
    ...alignmentOptions,
  });

  // const xyData = { x: spectrum.x, y: spectrum.re };

  const promises = [];
  for (let roi of ROI) {

    if (roi.from === roi.to) continue;

    promises.push(
      piscina.run(
        { xyData, roi, optimizationOptions, gsdOptions },
        { name: 'processROI' }, // transferList: [xyData, roi, optimizationOptions, gsdOptions]
      ),
    );
  }
  return Promise.all(promises).then((fit) => {
    return {
      folderName: data.source.name,
      expno: data.source.expno,
      fit,
      xyData: ensureArray(xyData),
    };
  });
}

function ensureArray(obj) {
  let result;
  if (isAnyArray(obj)) {
    result = obj.map((arr) => Array.from(arr));
  } else {
    result = {};
    for (let key in obj) {
      if (isAnyArray(obj[key])) {
        result[key] = Array.from(obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
  }

  return result;
}
