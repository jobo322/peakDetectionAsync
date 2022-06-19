'use strict';

'use strict';

const { readFileSync, writeFileSync } = require('fs');
const { join, resolve } = require('path');

const { convertFileList } = require('brukerconverter');
const { fileListFromPath } = require('filelist-utils');
const { isAnyArray } = require('is-any-array');
const {
  solventSuppression,
  xyAutoPeaksPicking,
} = require('nmr-processing');
const { getName, process2DOptions, converterOptions, gsdOptions, alignmentOptions } = require('./options');
const { Piscina } = require('piscina');

const path = '/data/airwaveProject/decompressed/testData';
const pathToWrite = './';

const csvData = readFileSync('./src/annotationDB.csv', 'utf-8');
const database = getJSON(csvData);
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

// hacer la exportacion solo de -0.1 - 10 ppm
async function main() {
  const fileList = fileListFromPath(path);
  const pdata = await convertFileList(fileList, converterOptions);
  const groups = {};
  console.log('pdata.length', pdata.length)
  for (let i = 0; i < pdata.length; i++) {
    const data = pdata[i];
    const name = getName(data, i);
    if (!groups[name]) groups[name] = [];
    groups[name].push(data);
  }

  const piscina = new Piscina({
    filename: resolve(join(__dirname, 'worker.js')),
  });

  for (const group in groups) {
    let promises = [];
    for (const data of groups[group]) {
      if (data.twoD) {
        promises.push(
          piscina.run({ data, ...process2DOptions }, { name: 'process2D' }),
        );
      } else {
        promises.push(process1D(data, piscina, { gsdOptions }));
      }
    }

    await Promise.all(promises).then((result) => {
      writeFileSync(
        join(pathToWrite, `result_${result[0].name}_${result[0].expno}.json`),
        JSON.stringify(result),
      );
    });
  }
}

main();

function getROIs(data, mapping) {
  let rois = [];
  const getBase = (data, path = []) => {
    let first = path.splice(0, 1);
    if (first.length === 0) return data;
    return getBase(data[first], path);
  };
  for (let roi of data) {
    let tmp = {};
    for (let map of mapping) {
      const { name, saveAs = map.name } = map;
      const targetData = getBase(roi, [...(map.path || [])]);
      tmp[saveAs] = targetData[name];
    }
    rois.push(tmp);
  }

  return rois;
}

function getJSON(data) {
  const lines = data.split('\n');
  let headers = [];
  let secondHeaders = [];
  let secondHeadersData = lines[1].split(',');
  const firstHeadersData = lines[0].split(',');
  for (let i = 0; i < firstHeadersData.length; i++) {
    const cell = firstHeadersData[i];
    if (cell.length > 0) {
      headers.push({
        fromIndex: i,
        name: cell,
      });
    }
  }

  for (let i = 1; i < headers.length - 1; i++) {
    headers[i - 1].toIndex = headers[i].fromIndex - 1;
  }

  for (let cell of secondHeadersData) {
    secondHeaders.push({
      name: cell.replace('\r', ''),
    });
  }

  const getHeaderName = (headers, index) => {
    for (const header of headers) {
      const { fromIndex, toIndex } = header;
      if (index >= fromIndex && index <= toIndex) return header.name;
    }
    return 'null';
  };

  const getValue = (str) => {
    if (str.length === 0) return str;
    return !isNaN(Number(str)) ? Number(str) : str;
  };

  const checkLine = (line) => !line.trim().match(/\w+/g);

  let metabolites = [];
  for (let i = 2; i < lines.length; i++) {
    if (checkLine(lines[i])) continue;
    const cells = lines[i].split(',');
    let metabolite = {};
    for (let j = 0; j < secondHeaders.length; j++) {
      let headerName = getHeaderName(headers, j);
      if (!metabolite[headerName]) metabolite[headerName] = {};
      metabolite[headerName][secondHeaders[j].name] = getValue(
        cells[j] ? cells[j].replace('\r', '') : '',
      );
    }
    metabolite = { ...metabolite.null, ...metabolite };
    delete metabolite.null;
    metabolites.push(metabolite);
  }

  return metabolites;
}

function align(input) {
  const { spectrum, referencePeaks, delta, fromTo } = input;

  const xyData = { x: spectrum.x, y: spectrum.re };
  const peaks = xyAutoPeaksPicking(xyData, {
    ...fromTo,
    optimize: true,
    shape: { kind: 'lorentzian' },
    groupingFactor: 2.5,
  });

  const marketPeaks = solventSuppression(
    peaks,
    [
      {
        delta,
        peaks: referencePeaks,
      },
    ],
    { markSolventPeaks: true },
  );

  if (peaks.length > 0) {
    const glucosePeaks = marketPeaks.filter((peak) => peak.kind === 'solvent');
    if (glucosePeaks.length < 1) {
      throw new Error('glucose peaks had not been found');
    }
    const shift =
      delta - glucosePeaks.reduce((a, b) => a + b.x, 0) / glucosePeaks.length;
    xyData.x.forEach((e, i, arr) => (arr[i] += shift));
  }

  return xyData;
}

async function process1D(data, piscina, options = {}) {
  const { optimizationOptions, gsdOptions } = options;

  let spectrum = data.spectra[0].data;
  if (spectrum.x[0] > spectrum.x[1]) {
    spectrum.x = spectrum.x.reverse();
    spectrum.re = spectrum.re.reverse();
  }

  //const xyData = align({
  //   spectrum,
  //   ...alignmentOptions,
  // });

  const xyData = { x: spectrum.x, y: spectrum.re };

  const promises = [];
  for (let roi of ROI) {
    promises.push(
      piscina.run(
        { xyData, roi, optimizationOptions, gsdOptions },
        { name: 'processROI' },
      ),
    );
  }
  return Promise.all(promises).then((fit) => {
    return {
      name: data.source.name,
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
