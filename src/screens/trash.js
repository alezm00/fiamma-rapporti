// Cestino: i rapporti eliminati restano 30 giorni, poi vanno via per sempre (con misure e foto).

import * as nav from '../ui/nav.js';
import * as store from '../data/store.js';
import { trashDaysLeft, describeReport } from '../model/index.js';
import { CLS } from '../ui/classes.js';
import { $, el, toast, explainSaveError } from '../ui/util.js';

async function render() {
    const list = await store.listTrash();
    const ul = $('trash-list');
    ul.replaceChildren();
    for (const doc of list) {
        const li = el('li', CLS.trashRow);
        const { number, customer, meta } = describeReport(doc);
        const head = el('div', CLS.reportHead);
        const days = trashDaysLeft(doc);
        head.append(
            el('span', CLS.reportNum, number),
            el('span', CLS.reportMeta, `${days} ${days === 1 ? 'giorno' : 'giorni'} rimasti`),
        );
        li.append(head, el('div', CLS.reportName, customer), el('div', CLS.reportMeta, meta));

        const actions = el('div', CLS.trashActions);
        const restore = el('button', CLS.trashBtn, 'Ripristina');
        restore.type = 'button';
        restore.addEventListener('click', () => act(async () => {
            await store.restoreReport(doc.id);
            toast('Rapporto ripristinato');
        }));
        const purge = el('button', CLS.trashBtnDel, 'Elimina per sempre');
        purge.type = 'button';
        purge.addEventListener('click', () => act(async () => {
            if (!confirm('Eliminare per sempre questo rapporto, con misure e foto? Non si potrà recuperare.')) return;
            await store.purgeReport(doc.id);
        }));
        actions.append(restore, purge);
        li.append(actions);
        ul.append(li);
    }
    $('trash-empty').hidden = list.length > 0;
    $('t-empty').hidden = list.length === 0;
}

async function act(action) {
    try {
        await action();
    } catch (e) {
        console.error(e);
        toast(`Operazione non riuscita: ${explainSaveError(e)}`, 'error');
    }
    await render();
}

export async function enter() {
    await store.purgeExpired(); // quello che ha superato i 30 giorni va via
    await render();
}

export function init() {
    $('t-back').addEventListener('click', () => nav.back());
    $('t-empty').addEventListener('click', () => act(async () => {
        const list = await store.listTrash();
        if (!list.length || !confirm(`Eliminare per sempre ${list.length === 1 ? 'il rapporto' : `i ${list.length} rapporti`} nel cestino, con misure e foto? Non si potrà recuperare.`)) return;
        for (const doc of list) await store.purgeReport(doc.id);
    }));
}

