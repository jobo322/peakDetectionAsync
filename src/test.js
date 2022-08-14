'use strict';

const { optimizeROI } = require('./optimization/optimizeROI');
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
const { xyExtract } = require('ml-spectra-processing');
const { generateSpectrum } = require('spectrum-generator');
const exp = require('constants');
const { isAnyArray } = require('is-any-array');

// const data = JSON.parse(readFileSync(join('/home/abolanos/result_peakpicking/result_COV09213_391-1_100.json'), 'utf-8'))
const data = JSON.parse(readFileSync(join('/home/abolanos/result_peakpicking/result_COV09113_317-1_50.json'), 'utf-8'))

const xyData = data[0].xyData;

// const fromTo = { from: 0, to: 0.4 };
const fromTo = { from: 6.27 - 0.1, to: 6.32 + 0.1 };
const experimental = xyExtract(xyData, {
  zones: [fromTo],
});

// const experimental = generateSpectrum([{
//   x: 0,
//   y: 1,
//   shape: {
//     kind: 'gaussian',
//     fwhm: 0.1,
//   }
// }], { generator: { nbPoints: 1024, from: 0, to: 0.4 } });

// const signals = [{
//   x: 0.04,
//   y: 1e6,
//   shape: {
//     kind: 'pseudoVoigt',
//     fwhm: 0.85 / frequency, mu: 0.5,
//   },
//   pattern: [{ x: 0, y: 1 }],
//   parameters: {
//     x: {
//       min: -0.05,
//       max: 0.1,
//     },
//     y: {
//       min: 0,
//       max: 2,
//     },
//     fwhm: {
//       min: 0.001,
//       max: 0.2,
//     }
//   }
// }]

const frequency = 600.31;

const js = 2.255;

const signals = [
  {
    x: 6.314,
    y: 1e6,
    shape: {
      kind: 'pseudoVoigt',
      fwhm: 0.85 / frequency, mu: 0.5,
    },
    pattern: [{ x: -js / 2, y: 1 }, { x: js / 2, y: 1 }],
    parameters: {
      x: {
        min: 6.311,
        max: 6.316,
      },
      y: {
        min: 0,
        max: 1.5e6,
      },
      fwhm: {
        min: 0,
        max: js / frequency * 2
      }
    }
  },
{
  x: 6.285,
  y: 1e6,
  shape: {
    kind: 'pseudoVoigt',
    fwhm: 0.85 / frequency, mu: 0.5,
  },
  pattern: [{ x: -js / 2, y: 1 }, { x: js / 2, y: 1 }],
  parameters: {
    x: {
      min: 6.283,
      max: 6.288,
    },
    y: {
      min: 0,
      max: 1.5e6,
    },
    fwhm: {
      min: 0,
      max: js / frequency * 2
    }
  }
},
{
  x: 6.285,
  y: 1e6,
  shape: {
    kind: 'pseudoVoigt',
    fwhm: 0.85 / frequency, mu: 0.5,
  },
  pattern: [{ x: -js / 2, y: 1 }, { x: js / 2, y: 1 }],
  parameters: {
    x: {
      min: 6.283,
      max: 6.288,
    },
    y: {
      min: 0,
      max: 1.5e6,
    },
    fwhm: {
      min: 0,
      max: js / frequency * 2
    }
  }
}
]

signals.forEach((signal, i, arr) => {
  arr[i].pattern = signal.pattern.map((peak) => {
    peak.x /= frequency;
    return peak;
  })
})

const newSignals = optimizeROI(experimental, signals, {
  optimization: {
    maxIterations: 1000,
  }
});

const peaks = newSignals.flatMap((signal) => {
  const delta = signal.x;
  const intensity = signal.y;
  const pattern = signal.pattern;
  delete signal.pattern;
  return pattern.map((peak) => {
    return {
      ...signal,
      x: delta + peak.x,
      y: intensity * peak.y,
    }
  })
})

const fit = generateSpectrum(peaks, { generator: { nbPoints: experimental.x.length, ...fromTo } })
const residual = experimental.y.map((e, i) => e - fit.y[i]);
writeFileSync(join(__dirname, `resultFit2_${js}.json`), JSON.stringify([{
  name: 'COV09213_391-1',
  expno: '100',
  fit: [
    {
      roi: fromTo,
      fit: Array.from(fit.y),
      residual: Array.from(residual),
      peaks: [],
      optimizedPeaks: peaks,
      signals
    }
  ],
  xyData: ensureArray(experimental),
  frequency
}]));

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
