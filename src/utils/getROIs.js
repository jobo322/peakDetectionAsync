'use strict';

const getBase = (data, path = []) => {
    let first = path.splice(0, 1);
    if (first.length === 0) return data;
    return getBase(data[first], path);
};

function getROIs(data, mapping) {
    let rois = [];

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

module.exports = { getROIs };