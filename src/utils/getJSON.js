'use strict';

const { fromDataAsync } = require('xlsx-populate');

async function getJSON(data, sheetNumber = 0) {
    const xlsx = await fromDataAsync(data);
    const sheet = xlsx.sheet(sheetNumber);
    const minCol = sheet.row(2).minUsedColumnNumber();
    const maxCol = sheet.row(2).maxUsedColumnNumber() + 1;

    const headers = [];
    const secondHeaders = [];
    const headerData = sheet.row(1);
    const secondHeaderData = sheet.row(2);

    for (let i = 1; i < maxCol; i++) {
        const cell = headerData._cells[i];
        if (!cell) continue;
        const headerName = cell._value;
        if (
            headers.length > 0 &&
            !('toIndex' in headers[headers.length - 1])
        ) {
            headers[headers.length - 1].toIndex = i - 1;
        }

        if (!cell._value) continue;

        headers.push({
            fromIndex: i,
            name: headerName,
        });
    }

    for (let i = 1; i < secondHeaderData._cells.length; i++) {
        const cell = secondHeaderData.cell(i);
        secondHeaders[i] = {
            name: cell.value().replace('\r', ''),
        };
    }

    const getHeaderName = (headers, index) => {
        for (const header of headers) {
            const { fromIndex, toIndex } = header;
            if (index >= fromIndex && index <= toIndex) return header.name;
        }
        return '_noParentPresent_';
    };

    const checkRow = (row) => {
        const minCol = row.minUsedColumnNumber();
        const maxCol = row.maxUsedColumnNumber();
        for (let i = minCol; i <= maxCol; i++) {
            if (row.cell(i).value() !== undefined) {
                return false;
            }
        }
        return true;
    }
    const metabolites = [];
    for (let i = 3; i < sheet._rows.length; i++) {
        const row = sheet.row(i);

        if (checkRow(row)) continue;
        
        const metabolite = {};
        for (let j = minCol; j < maxCol - 1; j++) {
            const cellValue = row.cell(j).value();
            const headerName = getHeaderName(headers, j);
            if (!metabolite[headerName]) metabolite[headerName] = {};
            metabolite[headerName][secondHeaders[j].name] = cellValue || ''
        }
        const { _noParentPresent_, ...rest } = metabolite;
        metabolites.push({ ..._noParentPresent_, ...rest });
    }

    return metabolites;
}

module.exports = { getJSON };