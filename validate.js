// Controlli sui dati del cliente: codice fiscale italiano e numero di telefono.
// Servono solo per avvisare chi scrive: non bloccano mai la creazione del PDF.

// ---------------------------------------------------------------------------
// Codice fiscale
// ---------------------------------------------------------------------------

const CF_ODD = {
    0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
    A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
    N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
const OMOCODIA = 'LMNPQRSTUV'; // lettere che sostituiscono le cifre 0-9 nei casi di omocodia
const MONTH_DAYS = { A: 31, B: 29, C: 31, D: 30, E: 31, H: 30, L: 31, M: 31, P: 30, R: 31, S: 30, T: 31 };
const CF_FORMAT = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-MZ][0-9LMNPQRSTUV]{3}[A-Z]$/;

const bad = (value, error) => ({ empty: false, ok: false, value, error });

function checkLetter(code15) {
    let sum = 0;
    [...code15].forEach((ch, i) => {
        sum += i % 2 === 0 ? CF_ODD[ch] : /\d/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 65;
    });
    return String.fromCharCode(65 + (sum % 26));
}

// partita IVA / codice fiscale numerico delle aziende (11 cifre)
function vatCheckDigit(code10) {
    let sum = 0;
    [...code10].forEach((ch, i) => {
        let d = Number(ch);
        if (i % 2 === 1) {
            d *= 2;
            if (d > 9) d -= 9;
        }
        sum += d;
    });
    return (10 - (sum % 10)) % 10;
}

export function checkFiscalCode(input) {
    const value = String(input ?? '').replace(/\s+/g, '').toUpperCase();
    if (!value) return { empty: true, ok: true, value };

    if (/^\d+$/.test(value) && value.length === 11) {
        return vatCheckDigit(value.slice(0, 10)) === Number(value[10])
            ? { empty: false, ok: true, value }
            : bad(value, 'Codice numerico non valido: la cifra di controllo (l\'ultima) è errata.');
    }
    if (value.length !== 16) {
        return bad(value, `Un codice fiscale ha 16 caratteri (11 cifre per le aziende): ne hai scritti ${value.length}.`);
    }
    if (!/^[A-Z0-9]+$/.test(value)) return bad(value, 'Il codice fiscale può contenere solo lettere e cifre.');
    if (!CF_FORMAT.test(value)) {
        return bad(value, 'Formato non valido: controlla lettere e cifre (cognome e nome, anno, mese, giorno, comune).');
    }
    // giorno di nascita: 1-31 per gli uomini, 41-71 per le donne (anche con le lettere dell'omocodia)
    const digit = (i) => (OMOCODIA.includes(value[i]) ? OMOCODIA.indexOf(value[i]) : value[i]);
    let day = Number(`${digit(9)}${digit(10)}`);
    if (day > 40) day -= 40;
    if (day < 1 || day > MONTH_DAYS[value[8]]) return bad(value, 'Data di nascita non valida nel codice (giorno e mese non corrispondono).');
    if (checkLetter(value.slice(0, 15)) !== value[15]) {
        return bad(value, 'Carattere di controllo errato (l\'ultima lettera): controlla che il codice sia scritto bene.');
    }
    return { empty: false, ok: true, value };
}

// ---------------------------------------------------------------------------
// Telefono: mostrato come "123 456 7890"
// ---------------------------------------------------------------------------

const group = (d) => [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(' ');

export function checkPhone(input) {
    const raw = String(input ?? '').trim();
    if (!raw) return { empty: true, ok: true, value: '' };
    if (/[^\d\s+().\-/]/.test(raw)) return bad(raw, 'Il numero può contenere solo cifre, spazi e il prefisso internazionale (+39).');
    if (raw.lastIndexOf('+') > 0) return bad(raw, 'Il simbolo + va scritto solo all\'inizio, come prefisso internazionale.');

    let digits = raw.replace(/\D/g, '');
    let prefix = '';
    if (raw.startsWith('+') || digits.startsWith('00')) {
        if (!raw.startsWith('+')) digits = digits.slice(2); // 0039… come +39…
        if (digits.startsWith('39')) {
            prefix = '+39';
            digits = digits.slice(2);
        } else {
            // altro Paese: non si conosce la lunghezza del prefisso, si controlla solo il totale
            return digits.length >= 8 && digits.length <= 15
                ? { empty: false, ok: true, value: `+${group(digits)}` }
                : bad(raw, 'Numero internazionale non valido: deve avere da 8 a 15 cifre.');
        }
    }
    if (!/^(3\d{8,9}|0\d{5,10})$/.test(digits)) {
        return bad(raw, 'Numero non riconosciuto: un cellulare inizia con 3 (9-10 cifre), un fisso con 0 (6-11 cifre).');
    }
    return { empty: false, ok: true, value: `${prefix ? `${prefix} ` : ''}${group(digits)}` };
}
