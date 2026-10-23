// Apparecchi dell'impianto: quante caldaie, pompe di calore e condizionatori si vuole.

import { UNIT_KINDS, newUnit, unitKind, unitTitle } from '../../model/index.js';
import { CLS } from '../../ui/classes.js';
import { $, el, fieldElement } from '../../ui/util.js';
import { session, touch } from './session.js';

const UNIT_CAPS = { brand: 'words', model: 'characters', serial: 'characters' };

function unitField(unit, i, f) {
    const label = fieldElement({ ...f, capitalize: UNIT_CAPS[f.key] }, `u${i}-${f.key}`);
    const input = label.querySelector('select, input');
    input.value = unit[f.key] ?? '';
    const changed = () => {
        unit[f.key] = input.value;
        touch();
    };
    input.addEventListener('input', changed);
    input.addEventListener('change', changed);
    return label;
}

export function renderUnits() {
    const box = $('e-units');
    box.replaceChildren();
    const units = session.doc.plant.units;
    units.forEach((unit, i) => {
        const kind = unitKind(unit.kind);
        const card = el('section', CLS.unitCard);
        card.dataset.unit = String(i);
        card.dataset.kind = unit.kind;
        const head = el('div', CLS.unitHead);
        const title = unitTitle(unit, units);
        const del = el('button', CLS.unitDel, '✕');
        del.type = 'button';
        del.id = `u${i}-del`;
        del.setAttribute('aria-label', `Togli: ${title}`);
        del.addEventListener('click', () => {
            const filled = kind.fields.some((f) => String(unit[f.key] ?? '').trim());
            if (filled && !confirm(`Togliere «${title}» dal rapporto?`)) return;
            units.splice(i, 1);
            renderUnits();
            touch();
        });
        head.append(el('h4', CLS.unitTitle, title), del);
        const grid = el('div', CLS.unitGrid);
        for (const f of kind.fields) grid.append(unitField(unit, i, f));
        card.append(head, grid);
        box.append(card);
    });
    $('e-units-empty').hidden = units.length > 0;
}

function addUnit(kindId) {
    session.doc.plant.units.push(newUnit(kindId));
    renderUnits();
    $('e-units').lastElementChild.querySelector('input, select').focus();
    touch();
}

export function initUnits() {
    for (const kind of UNIT_KINDS) $(`e-add-${kind.id}`).addEventListener('click', () => addUnit(kind.id));
}
