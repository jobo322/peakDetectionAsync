'use strict';

const {
    solventSuppression,
    xyAutoPeaksPicking,
} = require('nmr-processing');

function align(input) {
    const { spectrum, referencePeaks, delta, ppOptions } = input;

    const xyData = { x: spectrum.x, y: spectrum.re };

    const peaks = xyAutoPeaksPicking(xyData, ppOptions);

    const marketPeaks = solventSuppression(
        peaks,
        [
            {
                delta,
                peaks: referencePeaks,
            },
        ],
        { markSolventPeaks: true, solventZoneExtension: 0.1 },
    );

    if (peaks.length > 0) {

        const solventPeaks = marketPeaks.filter((peak) => peak.kind === 'solvent');
        if (solventPeaks.length < 1) {
            throw new Error('glucose peaks had not been found');
        }
        const shift =
            delta - solventPeaks.reduce((a, b) => a + b.x, 0) / solventPeaks.length;
        xyData.x.forEach((e, i, arr) => (arr[i] += shift));
    }

    return xyData;
}

module.exports = { align }