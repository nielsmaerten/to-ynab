"use strict";

const sources = {
  nordea: {
    headers: ["Bogført", "Tekst", "Rentedato", "Beløb", "Saldo"],
    map: {
      date: 0,
      payee: null,
      category: null,
      memo: 1,
      outflow: 3,
      inflow: 3
    },
    dateformat: "DD-MM-YYYY",
    delimitor: ";"
  },
  be_kbc: {
    headers: [
      "Rekeningnummer",
      "Rubrieknaam",
      "Naam",
      "Munt",
      "Afschriftnummer",
      "Datum",
      "Omschrijving",
      "Valuta",
      "Bedrag",
      "Saldo",
      "credit",
      "debet",
      "rekeningnummer tegenpartij",
      "BIC tegenpartij",
      "Naam tegenpartij",
      "Adres tegenpartij",
      "gestructureerde mededeling",
      "Vrije mededeling"
    ],
    map: {
      date: 5,
      payee: 14,
      category: null,
      memo: 6,
      outflow: 8,
      inflow: 8
    },
    dateformat: "DD/MM/YYYY",
    delimitor: ";"
  },
  be_kbc_creditcard: {
    headers: [
      "kredietkaart",
      "kaarthouder",
      "uitgavenstaat",
      "datum verrichting",
      "Datum verrekening",
      "bedrag",
      "credit",
      "debet",
      "munt",
      "koers",
      "bedrag in EUR",
      "Kosten op verrichting",
      "Handelaar",
      "locatie",
      "land",
      "toelichting"
    ],
    map: {
      date: 3,
      payee: null,
      category: null,
      memo: 12,
      outflow: 10,
      inflow: 10
    },
    dateformat: "DD/MM/YYYY",
    delimitor: ";"
  }
};

module.exports = sources;
