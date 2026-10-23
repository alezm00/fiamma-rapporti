// Cliente, impianto (una scheda per ogni apparecchio), intervento e lavori eseguiti.

import { formatDay } from '../lib/dates.js';
import { typeLabel, outcomeLabel, unitsSummary, unitTitle, unitValues, durationMinutes, formatDuration } from '../model/index.js';
import { code, oneLine } from './text.js';

export function drawParties(sheet, r) {
    const { fieldsBox, textBox, lines } = sheet;
    const customer = r.customer ?? {};
    const plant = r.plant ?? {};
    const work = r.intervention ?? {};
    fieldsBox('Cliente', [
        { label: 'Nome e cognome', value: customer.name },
        { label: 'Codice fiscale', value: code(customer.fiscalCode) },
        { label: 'Indirizzo', value: oneLine(customer.address) },
        { label: 'Telefono', value: customer.phone },
    ], 2);
    // l'impianto (targa, riepilogo) e una scheda per ogni apparecchio: caldaie, pompe di calore, condizionatori
    const units = plant.units ?? [];
    fieldsBox('Impianto', [
        { label: 'Targa impianto', value: code(plant.plateCode) },
        { label: 'Apparecchi', value: unitsSummary(plant) },
    ], 2);
    for (const unit of units) fieldsBox(unitTitle(unit, units), unitValues(unit), 4);

    // --- intervento: tipo, esito, orari e durata -------------------------------

    const minutes = durationMinutes(work.startTime, work.endTime);
    const what = [
        { label: 'Tipo di intervento', value: typeLabel(work.type) },
        { label: 'Esito', value: outcomeLabel(work.outcome) },
        { label: 'Data', value: formatDay(r.date) },
    ];
    if (work.startTime || work.endTime) {
        what.push(
            { label: 'Arrivo', value: work.startTime },
            { label: 'Partenza', value: work.endTime },
            { label: 'Durata', value: formatDuration(minutes) },
        );
    }
    fieldsBox('Intervento', what, 3);

    const workLines = lines(work.work);
    if (workLines.join('')) textBox('LAVORI ESEGUITI', workLines);
}
