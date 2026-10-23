// Materiali usati: righe di descrizione e quantità.

import { CLS } from '../../ui/classes.js';
import { $, el } from '../../ui/util.js';
import { session, touch } from './session.js';

export function renderMaterials() {
    const box = $('e-materials');
    box.replaceChildren();
    session.doc.intervention.materials.forEach((m, i) => {
        const row = el('div', CLS.matRow);
        const text = el('input', CLS.matText);
        text.type = 'text';
        text.value = m.text;
        text.placeholder = 'Descrizione';
        text.autocomplete = 'off';
        text.setAttribute('autocapitalize', 'sentences');
        text.setAttribute('aria-label', `Materiale ${i + 1}`);
        text.addEventListener('input', () => {
            m.text = text.value;
            touch();
        });
        const qty = el('input', CLS.matQty);
        qty.type = 'text';
        qty.value = m.qty;
        qty.placeholder = 'Quantità';
        qty.autocomplete = 'off';
        qty.setAttribute('aria-label', `Quantità del materiale ${i + 1}`);
        qty.addEventListener('input', () => {
            m.qty = qty.value;
            touch();
        });
        const del = el('button', CLS.matDel, '✕');
        del.type = 'button';
        del.setAttribute('aria-label', `Togli il materiale ${i + 1}`);
        del.addEventListener('click', () => {
            session.doc.intervention.materials.splice(i, 1);
            renderMaterials();
            touch();
        });
        row.append(text, qty, del);
        box.append(row);
    });
}

// all'uscita: via le righe rimaste vuote
export function dropEmptyMaterials() {
    const work = session.doc.intervention;
    const before = work.materials.length;
    work.materials = work.materials.filter((m) => m.text.trim() || m.qty.trim());
    if (work.materials.length !== before) touch();
}

export function initMaterials() {
    $('e-mat-add').addEventListener('click', () => {
        session.doc.intervention.materials.push({ text: '', qty: '' });
        renderMaterials();
        $('e-materials').lastElementChild.querySelector('input').focus();
        touch();
    });
}
