// @ts-check
const path = require("path");
const fs = require("fs");

const baseSources = require("./sources")
let extendedSources;

module.exports = {
    detectSource,
    getCSVRows,
    headerMatchesSource,
    getSources,
    loadFile,
    getHeaderCells
}

function detectSource(file, options) {
    return new Promise(async (resolve, reject) => {
        const data = await loadFile(file, options).catch(reject)

        const rows = await this.getCSVRows(data);
        const headerCells = getHeaderCells(rows, options.delimitor)
        const sources = this.getSources(options.ignoreCustomSources)
        let detectedSource;

        for (const key in sources) {
            if (sources.hasOwnProperty(key)) {
                const sourceConfig = sources[key];
                if (headerMatchesSource(headerCells, sourceConfig)) {
                    detectedSource = key;
                    break;
                }
            }
        }

        if (!detectedSource) {
            reject(new Error(`${file} - No matching source found. List of valid sources: [${Object.keys(sources)}]`))
        }


        let output;
        if (!options.preserveFilename) {
            output = options.output
        } else {
            output = `${options.output}_${path.basename(file)}`
        }


        // Update options with csvstring and detected source
        const newOptions = {
            ...options,
            csvstring: true,
            source: detectedSource,
            output,
            path: path.dirname(file)
        }

        resolve({ file: data, opts: newOptions })
    })
}

function headerMatchesSource(headerCells, sourceConfig) {
    return sourceConfig.headers.length === headerCells.length && sourceConfig.headers.every((h, i) => h == headerCells[i])
}

function getSources(ignoreCustomSources) {
    if (ignoreCustomSources) {
        return baseSources;
    }

    if (!extendedSources) {
        // Extend base sources with user provided sources
        extendedSources = { ...baseSources };
        Object.assign(extendedSources, getCustomSources());
    }
    return extendedSources
}

function getHeaderCells(rows, delimiter) {
    return rows[0].split(delimiter).filter(cell => !!cell);
}

function getCSVRows(data) {
    return new Promise((resolve, reject) => {
        //Check if any data
        if (!data.toString()) {
            reject(Error('CSV file is empty')); return;
        }

        const rows = data.toString().replace(/\r/g, '\n').replace(/\n\n/g, '\n').split('\n').filter(row => !!row);


        resolve(rows);
    });
}

function getCustomSources() {
    const homedir = require("os").homedir();
    const sourcesPath = path.join(homedir, "to-ynab-sources.json");
    if (!fs.existsSync(sourcesPath)) {
        return {};
    }
    return require(sourcesPath);
}

function loadFile(file, options) {
    return new Promise((resolve, reject) => {

        //Check if we have a csv string provided
        if (options.csvstring && !file) {
            reject(Error('A valid csv string needs to be provided')); return;
        }

        //Check if we have a csv string provided
        if (options.csvstring && file) {
            resolve(file); return;
        }

        //Check if file provided
        if (!file) {
            reject(Error('A valid .csv file needs to be provided')); return;
        }

        //Validate csv file
        if (!/.*\.csv$/i.test(file)) {
            reject(Error('File provided is does not have a .csv extension')); return;
        }

        fs.readFile(file, 'utf8', (err, data) => {
            if (err) {
                reject(err); return;
            }

            resolve(data);
        });
    });
}