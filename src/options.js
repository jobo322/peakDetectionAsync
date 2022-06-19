

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
    processingNumber: [1],
    ignoreFID: true,
    ignore2D: true,
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

function getName(data, index) {
  const sourceName = data.source.name;
  const expno = data.source.expno;
  return `${sourceName}_${expno}`;
}

module.exports = {
  getName,
  alignmentOptions,
  process2DOptions,
  gsdOptions,
  converterOptions,
  optimizationOptions
}