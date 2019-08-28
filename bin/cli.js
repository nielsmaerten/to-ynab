#!/usr/bin/env node
// eslint-disable no-console
// @ts-check

"use strict";

const ynab_generator = require('../index.js');
const program = require('commander');
const fs = require("fs");
const util = require("../util")

const options = {};
let files;
let exitCode = 0;

program
    .version('0.1.0')
    .description('Convert csv files from different sources, like banks to YNAB ( youneedabudget.com ) ready csv files')
    .usage('[options] [path | filename.csv | csvstring]')
    .arguments('[path]')
    .option('-s, --source [value]', 'Source to use for reading the provided csv. Default: nordea', 'nordea')
    .option('-o, --output [value]', 'Output filename (with or without .csv extension). Default: ynab', 'ynab')
    .option('-l, --lastdate [value]', 'Last date for a transaction to be added to generated csv.')
    .option('-p, --payees [payees]', 'List of payees to match in description, comma separated.', (v) => v.split(','), [])
    .option('-d, --delimitor [value]', 'Cell delimitor in source file ( same one will be used in generated file). Default: ;', ';')
    .option('-c, --csvstring', 'Provide a csv string instead of file')
    .option('-n, --no-write', 'Does not write the generated file, it just outputs it.')
    .option('-f, --dateformat [value]', 'Date format for the generated csv. Default: DD/MM/YYYY', 'DD/MM/YYYY')
    .action(p => options.path = p)
    .parse(process.argv);

//Loop options and add them to the options obj
['source', 'output', 'lastdate', 'payees', 'delimitor', 'csvstring', 'write', 'dateformat']
    .forEach((opt) => {
        if (program.hasOwnProperty(opt)) {
            options[opt] = program[opt];
        }
    });

// Use current working dir if no path was provided
options.path = options.path || process.cwd();

if (!fs.existsSync(options.path)) {
    console.log(options.path, "does not exist")
    program.outputHelp();
    process.exit(1);
}

// If path is a dir, select all CSV files
if (fs.lstatSync(options.path).isDirectory()) {
    files = fs.readdirSync(options.path)
        .filter(file => file.toLowerCase().endsWith(".csv"))
        .map(file => require("path").join(options.path, file))
    options.preserveFilename = true
} else {
    files = [options.path]
}

(async () => {
    // Process all selected files
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const result =
                await util
                    .detectSource(file, options)
                    .then(d => ynab_generator(d.file, d.opts))
            console.log(result)
        } catch (error) {
            console.log("\n", error.toString());
            exitCode = 1;
        }
    }

    if (files.length === 0) {
        console.log("No CSV files found in", options.path)
        exitCode = 1;
    }

    if (exitCode !== 0) program.outputHelp();
    process.exit(exitCode)

})();

