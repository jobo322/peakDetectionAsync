'use strict';

const {
    solventSuppression,
    xyAutoPeaksPicking,
} = require('nmr-processing');

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

module.exports = { align }