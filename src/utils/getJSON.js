'use strict';

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

module.exports = { getJSON };