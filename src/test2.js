'use strict';

const { optimizeROI, getInternalSignals, getSumOfShapes } = require('./optimization/optimizeROI');
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
const { xyExtract, xMinMaxValues } = require('ml-spectra-processing');
const { generateSpectrum } = require('spectrum-generator');
const { isAnyArray } = require('is-any-array');
const { xyAutoPeaksPicking } = require('nmr-processing');

// const data = JSON.parse(readFileSync(join('/home/abolanos/result_peakpicking/result_COV09213_391-1_100.json'), 'utf-8'))
// const data = JSON.parse(readFileSync(join('/home/abolanos/result_peakpicking/result_COV09113_317-1_50.json'), 'utf-8'))
const path = join('/home/abolanos/result_peakpicking/result_COV09090_302-1_40.json');
// const path = '/home/abolanos/result_peakpicking/result_COV09213_391-1_100.json';
// const path = '/home/abolanos/result_peakpicking/result_COV09113_317-1_50.json';
const pathToWrite = '/home/abolanos/result_peakpicking';
const data = JSON.parse(readFileSync(path, 'utf-8'))
const pathParts = path.split('/');
const name = pathParts[pathParts.length - 1].replace('.json', '');
const xyData = data[0].xyData;

// const fromTo = { from: 0, to: 0.4 };
const fromTo = { from: 6.28, to: 6.3 };
const experimental = xyExtract(xyData, {
  zones: [fromTo],
});

const minMaxY = xMinMaxValues(experimental.y);
const range = minMaxY.max - minMaxY.min;
minMaxY.range = range;
const normalized = experimental.y.map((e) => e / range);

const frequency = 600.31;

const js = 2.34 / frequency; // in Hz

const widthGuess = 0.97 / frequency; //in Hz
const signals = [
  {
    x: 6.290,
    y: 0.5,
    coupling: js,
    pattern: [{ x: -js / 2, y: 1 }, { x: js / 2, y: 1 }],
    parameters: {
      x: {
        min: 6.285,
        max: 6.295,
        gradientDifference: 0.0001
      },
      y: {
        min: 0,
        max: 1,
        gradientDifference: 0.001
      },
      fwhm: {
        min: widthGuess / 2,
        max: widthGuess * 1.5,
      },
      coupling: {
        min: js * 0.9,
        max: js * 1.2,
      }
    }
  },
  {
    x: 6.283,
    y: 0.5,
    coupling: js,
    pattern: [{ x: -js / 2, y: 1 }, { x: js / 2, y: 1 }],
    parameters: {
      x: {
        min: 6.285,
        max: 6.295,
        gradientDifference: 0.0005
      },
      y: {
        min: 0,
        max: 1,
        gradientDifference: 0.001
      },
      fwhm: {
        min: widthGuess / 2,
        max: widthGuess * 1.5,
      },
      coupling: {
        min: js * 0.9,
        max: js * 1.2,
      }
    }
  },
];

// const internalSignals = getInternalSignals(signals, minMaxY, { baseline: 0, shape: { kind: 'gaussian' } });
// const sumOfShapes = getSumOfShapes(internalSignals);
// const fct = sumOfShapes([0, 1, 0.001, 0.5, 0.0003, 0.2, 1, 0.001, 0.5, 0.0003])
// const yData = [];
// const xData = [];
// for (let i = -0.1; i < 0.3; i += 0.0001) {
//   xData.push(i);
//   yData.push(fct(i))
// }
// writeFileSync('yData.json', JSON.stringify({ x: xData, y: yData }));
// console.log(sumOfShapes(6.291))
// return
console.time('optimization')
const tempSignals = optimizeROI({ x: experimental.x, y: normalized }, signals, {
  baseline: 0,
  shape: { kind: 'gaussian' },
  optimization: {
    kind: 'direct',
    options: {
      iterations: 200,
    }
  }
});
tempSignals.forEach((signal, i, arr) => {
  const fwhm = signal.shape.fwhm;
  arr[i].shape = {
    kind: 'pseudoVoigt',
    fwhm,
    mu: 1,
  }
  arr[i].parameters.coupling = {
    min: js * 0.9,
    max: js * 1.2,
  }
});
const newSignals = optimizeROI({ x: experimental.x, y: normalized }, tempSignals, {
  baseline: 0,
  optimization: {
    kind: 'lm',
    options: {
      maxIterations: 3000,
    }
  }
});
console.timeEnd('optimization')

console.log(newSignals.map(s => s.x))
writeFileSync('signals.json', JSON.stringify(newSignals));
const peaks = newSignals.flatMap((signal) => {
  const { x: delta, y: intensity, coupling, pattern } = signal;
  delete signal.pattern;
  const halfCoupling = coupling / 2;
  return pattern.map((peak) => {
    const { x, y } = peak;
    return {
      ...signal,
      x: delta + (x / Math.abs(x) * halfCoupling),
      y: intensity * y,
    }
  })
})

peaks.forEach((peak, i, arr) => {
  arr[i].y *= range;
})


const fit = generateSpectrum(peaks, { generator: { nbPoints: experimental.x.length, ...fromTo } })
const residual = experimental.y.map((e, i) => e - fit.y[i]);
writeFileSync(join(pathToWrite, `${name}_FIT.json`), JSON.stringify([{
  name: 'name',
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
