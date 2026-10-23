// Cliente, impianto (una scheda per ogni apparecchio), intervento e lavori eseguiti.

import { typeLabel, outcomeLabel, unitsSummary, unitTitle, unitValues, durationMinutes, formatDuration } from '../model/index.js';
import { code, oneLine } from './text.js';

export function drawParties(sheet, r) {
    const { fieldsBox, textBox, lines } = sheet;
    const customer = r.customer ?? {};
    const plant = r.plant ?? {};
    const work = r.intervention ?? {};
    fieldsBox('Cliente', [
        { label: 'Nome e cognome', value: customer.name, span: 2 },
        { label: 'Codice fiscale', value: code(customer.fiscalCode) },
        { label: 'Telefono', value: customer.phone },
        { label: 'Indirizzo', value: oneLine(customer.address), span: 4 },
    ], 4);
    // l'impianto (targa, riepilogo) e una scheda per ogni apparecchio: caldaie, pompe di calore, condizionatori
    const units = plant.units ?? [];
    fieldsBox('Impianto', [
        { label: 'Targa impianto', value: code(plant.plateCode) },
        { label: 'Apparecchi', value: unitsSummary(plant), span: 3 },
    ], 4);
    // il modello occupa due colonne se è lungo (Beretta Luna Duo-Tec MP 24)
    for (const unit of units) fieldsBox(unitTitle(unit, units), unitValues(unit).map((f) => ({ ...f, grow: f.key === 'model' })), 5);

    // intervento: tipo, esito, orari e durata su una riga (la data è già nell'intestazione)
    const minutes = durationMinutes(work.startTime, work.endTime);
    const what = [
        { label: 'Tipo di intervento', value: typeLabel(work.type), span: 2 },
        { label: 'Esito', value: outcomeLabel(work.outcome), span: 2 },
    ];
    if (work.startTime || work.endTime) {
        what.push(
            { label: 'Arrivo', value: work.startTime },
            { label: 'Partenza', value: work.endTime },
            { label: 'Durata', value: formatDuration(minutes) },
        );
    }
    fieldsBox('Intervento', what, 7);

    const workLines = lines(work.work);
    if (workLines.join('')) textBox('LAVORI ESEGUITI', workLines);
}
