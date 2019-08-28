"use strict";
// @ts-check
const fs = require("fs");
const moment = require("moment");
const path = require("path");
const util = require("./util");
const YNABHeadings = ["Date", "Payee", "Category", "Memo", "Outflow", "Inflow"];

//Default options
let options;
let sourceConfig;
let sources;
let file;

function generate(_file, opts) {
  if (typeof opts === "undefined") {
    opts = {};
  }

  options = {
    source: "nordea",
    delimitor: ";",
    dateformat: "DD/MM/YYYY",
    payees: [],
    path: ".",
    output: "ynab",
    csvstring: false,
    write: true,
    ignoreCustomSources: false
  };

  file = _file;
  sources = util.getSources(opts.ignoreCustomSources);

  return new Promise((resolve, reject) => {
    validateOptions(opts)
      .then(opts => {
        Object.assign(options, opts);
        sourceConfig = sources[options.source];

        //Check if the source provides a delimitor and not overwritten by a provided option
        if (!opts.delimitor && sourceConfig.delimitor) {
          options.delimitor = sourceConfig.delimitor;
        }
      })
      .then(loadFile)
      .then(validateCSV)
      .then(generateCSV)
      .then(writeCSV)
      .then(resolve)
      .catch(reject);
  });
}

function validateOptions(opts) {
  return new Promise((resolve, reject) => {
    //Validate source
    if (opts.source && !sources.hasOwnProperty(opts.source)) {
      reject(
        Error(
          `Source ${
            opts.source
          } is not valid. List of valid sources: [ ${Object.keys(sources)} ]`
        )
      );
      return;
    }

    //Validate dateformat
    const allowedDateFormats = [
      "DD/MM/YYYY",
      "YYYY/MM/DD",
      "YYYY-MM-DD",
      "DD-MM-YYYY",
      "DD.MM.YYYY",
      "MM/DD/YYYY",
      "YYYY.MM.DD"
    ];
    if (opts.dateformat && allowedDateFormats.indexOf(opts.dateformat) === -1) {
      reject(
        Error(
          `Date format ${opts.dateformat} is not valid. List of valid dateformats: [ ${allowedDateFormats} ]`
        )
      );
      return;
    }

    //Validate last date
    const dateformat = opts.dateformat || options.dateformat;
    if (opts.lastdate && !moment(opts.lastdate, dateformat, true).isValid()) {
      reject(
        Error(
          `${opts.lastdate} is not a valid date for ${dateformat} date format`
        )
      );
      return;
    }

    //Validate output
    if (opts.output) {
      opts.output = opts.output.replace(/\.csv$/i, "");

      //Directory
      try {
        const stats = fs.lstatSync(opts.output);
        if (stats.isDirectory()) {
          opts.path = opts.output;
          delete opts.output;
        }
      } catch (e) {
        //Files should be ignored
      }
    }

    resolve(opts);
  });
}

function loadFile() {
  return util.loadFile(file, options);
}

function validateCSV(data) {
  return util.getCSVRows(data).then(rows => {
    const headerCells = util.getHeaderCells(rows, options.delimitor);

    // Check if any data rows
    if (rows.length < 2 && headerCells.length) {
      throw new Error("CSV file only contains the header row");
    }

    //Check if the csv heading cells are the same as the source config
    if (!util.headerMatchesSource(headerCells, sourceConfig)) {
      throw new Error(
        `CSV headers are not the same as the source config headers. Expected header rows: [ ${sourceConfig.headers.join(
          options.delimitor
        )} ]`
      );
    }

    // Discard header row, we no longer need it
    rows.shift();

    return rows;
  });
}

function generateCSV(rows) {
  return new Promise(resolve => {
    let newData = YNABHeadings.join(";") + "\n";

    rows.forEach((row, y) => {
      const cells = row.split(options.delimitor).filter(c => !!c);

      //Check if we're exceeding the last date
      const date = moment(
        cells[sourceConfig.map.date],
        sourceConfig.dateformat
      );
      const lastDate = options.lastdate
        ? moment(options.lastdate, options.dateformat)
        : false;
      const renderRow = !options.lastdate || date.isSameOrBefore(lastDate);

      if (renderRow) {
        YNABHeadings.forEach((h, i) => {
          const heading = h.toLowerCase();

          newData += createField[heading](
            cells[sourceConfig.map[heading]],
            cells
          );

          if (i !== YNABHeadings.length - 1) {
            newData += ";";
          }
        });

        if (y !== rows.length - 1) {
          newData += "\n";
        }
      }
    });

    resolve(newData);
  });
}

function writeCSV(data) {
  return new Promise((resolve, reject) => {
    //If no write, output file
    if (!options.write) {
      resolve(data);
      return;
    }

    const filename = path.join(options.path, options.output + ".csv");

    fs.writeFile(filename, data, err => {
      if (err) {
        reject(err);
        return;
      }
      resolve(`File ${filename} written successfully!`);
    });
  });
}

class createField {
  static date(val) {
    if (sourceConfig.map.date === null) {
      return "";
    }

    let date = moment(val, sourceConfig.dateformat).format(options.dateformat);

    //For invalid date return today's date
    if (date == "Invalid date") {
      date = moment().format(options.dateformat);
    }

    return date;
  }

  static payee(val, cells) {
    if (sourceConfig.map.payee == null && options.payees.length) {
      let payee = "";

      for (let i = 0; i < options.payees.length; i++) {
        if (payee) {
          break;
        }

        const regexp = new RegExp(options.payees[i], "i");

        if (regexp.test(cells[sourceConfig.map.memo])) {
          payee = options.payees[i];
        }
      }

      return payee;
    }

    if (sourceConfig.map.payee == null) {
      return "";
    }

    return val;
  }

  static category(val) {
    if (sourceConfig.map.category == null) {
      return "";
    }

    return val;
  }

  static memo(val) {
    if (sourceConfig.map.memo == null) {
      return "";
    }

    return val.replace(/\s{2,100}/g, " ");
  }

  static inflow(val) {
    if (sourceConfig.map.inflow == null) {
      return "";
    }

    val = val.replace(",", ".");

    if (
      sourceConfig.map.outflow == sourceConfig.map.inflow &&
      val.indexOf("-") == 0
    ) {
      return "";
    }

    return Math.abs(parseFloat(val));
  }

  static outflow(val) {
    if (sourceConfig.map.outflow == null) {
      return "";
    }

    val = val.replace(",", ".");

    if (
      sourceConfig.map.outflow == sourceConfig.map.inflow &&
      val.indexOf("-") == -1
    ) {
      return "";
    }

    return Math.abs(parseFloat(val));
  }
}

module.exports = generate;
