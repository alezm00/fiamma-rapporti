// Dove va un rapporto nella cartella di salvataggio.

import { dayString } from '../../lib/dates.js';
import { slug } from '../../model/index.js';

// le prime 8 lettere o cifre dell'identificativo: chiudono il nome della cartella di ogni rapporto
export const id8 = (id) => String(id).replace(/[^A-Za-z0-9]/g, '').slice(0, 8);

// Dove va il rapporto nella cartella di salvataggio: rapporti/<anno>/<dir>/
// ("2026-012_Mario-Rossi_ab12cd34", per le bozze "BOZZA_2026-10-22_Mario-Rossi_ab12cd34")
export function folderPath(doc) {
    const who = slug(doc.customer?.name).slice(0, 30);
    const year = (doc.number || doc.date || dayString(new Date())).slice(0, 4);
    const head = doc.number ? doc.number.replace('/', '-') : `BOZZA_${doc.date}`;
    return { year, dir: [head, who, id8(doc.id)].filter(Boolean).join('_') };
}
