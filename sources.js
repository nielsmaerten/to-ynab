"use strict";

const sources = {
    nordea: {
        headers: ['Bogført', 'Tekst', 'Rentedato', 'Beløb', 'Saldo'],
        map: {
            date: 0,
            payee: null,
            category: null,
            memo: 1,
            outflow: 3,
            inflow: 3
        },
        dateformat: 'DD-MM-YYYY',
        delimitor: ';'
    },
    be_kbc: {
        headers: [
            'Rekeningnummer',
            'Rubrieknaam',
            'Naam',
            'Munt', 'Afschriftnummer', 'Datum', 'Omschrijving', 'Valuta', 'Bedrag', 'Saldo', 'credit', 
            'debet', 'rekeningnummer tegenpartij', 'BIC tegenpartij', 'Naam tegenpartij', 'Adres tegenpartij', 
            'gestructureerde mededeling', 'Vrije mededeling'

        ],
        map: {
            date: 7,
            payee: null,
            category: null,
            memo: 6,
            outflow: 8,
            inflow: 8
        },
        dateformat: 'DD/MM/YYYY',
        delimitor: ';'
    }
};

module.exports = sources;
