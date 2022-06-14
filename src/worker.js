const { isAnyArray } = require('is-any-array');
const { gsd, optimizePeaks } = require('ml-gsd');
const { xyExtract } = require('ml-spectra-processing');
const { xyzAutoZonesPicking, xyzJResAnalyzer } = require('nmr-processing');

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

function processROI(data) {
  const { roi, xyData, gsdOptions } = data;
  const { from, to } = roi;
  let experimental = xyExtract(xyData, {
    zones: [{ from: from - 0.1, to: to + 0.1 }],
  });

  let peaks = gsd(experimental, gsdOptions);
  let optimizedPeaks = optimizePeaks(experimental, peaks, optimizationOptions);

  return {
    roi,
    peaks,
    optimizedPeaks,
  };
}

function process2D(options) {
  const { zonesPicking, jResAnalyzer, data } = options;

  const frequency = data.meta.observeFrequency;
  const minMax = data.minMax;
  const zones = xyzAutoZonesPicking(minMax, {
    observedFrequencies: [frequency, frequency],
    ...zonesPicking,
  });

  const newZones = [];
  for (let zone of zones) {
    newZones.push(
      xyzJResAnalyzer(zone.signals, {
        observedFrequencies: [frequency, frequency],
        ...jResAnalyzer,
      }),
    );
  }

  return {
    isTwoD: true,
    name: data.source.name,
    expno: data.source.expno,
    zones: newZones,
    experimental: {
      ...minMax,
      z: ensureArray(minMax.z),
    },
  };
}

module.exports = {
  process2D,
  processROI,
};

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
