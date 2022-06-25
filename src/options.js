

const process2DOptions = {
  zonesPicking: {
    tolerances: [5, 100],
    nuclei: ['1H', '1H'],
    realTopDetection: false,
  },
  jResAnalyzer: { reference: 0, getZones: true },
};

const gsdOptions = {
  minMaxRatio: 0.01,
  broadRatio: 0.00025,
  smoothY: true,
  realTopDetection: true,
};

const converterOptions = {
  converter: { xy: true },
  filter: {
    // experimentNumber: [120, 121, 122],
    onlyFirstProcessedData: true,
    ignoreFID: true,
    ignore2D: false,
  },
};

let optimizationOptions = {
  groupingFactor: 8,
  factorLimits: 2,
  shape: {
    kind: 'pseudoVoigt',
  },
  optimization: {
    kind: 'lm',
    parameters: {
      x: {
        max: (peak) => peak.x + peak.width * 2,
        min: (peak) => peak.x - peak.width * 2,
      },
      y: {
        max: () => 1.05,
      },
    },
    options: {
      maxIterations: 300,
    },
  },
};

let alignmentOptions = {
  // reference peaks is the pattern to use only relative intensity import
  referencePeaks: [
    { x: 1.4594310568750366, y: 1 },
    { x: 1.4739230927913445, y: 1 },
  ],
  // the expected delta of reference signal,
  delta: 1.47,
  // the region to make the PP and search the reference signal
  fromTo: { from: 5.1, to: 5.4 },
};

function getNameNormal(data, index) {
  const sourceName = data.source.name;
  const expno = data.source.expno;
  return `${sourceName}_${expno}`;
}

function getName(data) {
  const sourceName = data.meta.USERA2;

  const name = sourceName.replace(/<(.*)\>/, '$1')
  return name;
}

function groupExperiments(experiments) {
  if (experiments.length < 2) return [experiments];

  experiments.sort((exp1, exp2) => exp1.expno - exp2.expno);

  let groups = [];
  let group = [experiments[0]];
  for (let i = 1; i < experiments.length; i++) {
    const experiment = experiments[i];
    // console.log('expno', experiment.expno, i, experiments.length);
    if (experiment.expno < 10000) {
      const diff = Math.abs(experiment.expno - group[0].expno);
      if (diff < 2) {
        group.push(experiment);
      } else if (diff > 4) {
        groups.push([...group]);
        group = [experiments[i]];
      }
    }
    if (i === experiments.length - 1) {
      groups.push([...group]);
    }
  }

  if (groups[groups.length - 1].length !== group.length) {
    groups.push(group);
  }

  return groups;
}

module.exports = {
  getName,
  groupExperiments,
  alignmentOptions,
  process2DOptions,
  gsdOptions,
  converterOptions,
  optimizationOptions
  ,
}