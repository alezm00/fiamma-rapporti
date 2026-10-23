// Impostazioni: ditta e tecnico, logo, numerazione, email, cartella di salvataggio, backup.

import * as nav from '../ui/nav.js';
import { loadSettings, updateSettings } from '../data/settings.js';
import { formatReportNumber, nextNumber, setNextNumber } from '../model/index.js';
import { checkRecipients } from '../model/mail.js';
import { getLogo, setLogo, removeLogo } from '../data/photos.js';
import * as folder from '../backup/folder/index.js';
import { createBackup, restoreBackup } from '../backup/zip-backup.js';
import { fillMail, readMail, initMail } from './settings-mail.js';
import { $, fieldElement, showBoxMsg, debounce, downloadFile } from '../ui/util.js';

// wide = il campo occupa tutta la riga, gli altri stanno in due colonne
const COMPANY_DEFS = [
    { key: 'name', label: 'Ragione sociale', capitalize: 'words', wide: true },
    { key: 'vat', label: 'Partita IVA', inputmode: 'numeric' },
    { key: 'phone', label: 'Telefono', type: 'tel' },
    { key: 'address', label: 'Indirizzo', rows: 2, capitalize: 'words', wide: true },
    { key: 'email', label: 'Email', type: 'email', capitalize: 'none', wide: true },
    { key: 'technician', label: 'Nome del tecnico', capitalize: 'words', wide: true },
];

function buildFields(boxId, prefix, defs) {
    $(boxId).append(...defs.map((def) => fieldElement(def, `${prefix}${def.key}`)));
}

const year = () => new Date().getFullYear();

function fillNumbering(counters) {
    const y = year();
    $('s-next-label').textContent = `Prossimo numero del ${y}`;
    $('s-next').value = nextNumber(counters, y);
    $('s-next-hint').textContent = `Il prossimo rapporto chiuso con data nel ${y} sarà il n. ${formatReportNumber(y, nextNumber(counters, y))}.`;
}

let logoUrl = null;
async function showLogo() {
    const logo = await getLogo();
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    logoUrl = logo ? URL.createObjectURL(logo.blob) : null;
    if (logoUrl) $('s-logo-img').src = logoUrl;
    $('s-logo-img').hidden = !logo;
    $('s-logo-del').hidden = !logo;
}

function fill() {
    const s = loadSettings();
    $('s-email').value = s.email;
    for (const radio of document.querySelectorAll('input[name="s-method"]')) radio.checked = radio.value === s.method;
    for (const def of COMPANY_DEFS) $(`s-co-${def.key}`).value = s.company[def.key] || '';
    $('s-email-hint').hidden = true;
    fillNumbering(s.counters);
    fillMail(s.mail);
}

function persist() {
    const company = {};
    for (const def of COMPANY_DEFS) company[def.key] = $(`s-co-${def.key}`).value.trim();
    updateSettings({
        email: $('s-email').value.trim(),
        method: document.querySelector('input[name="s-method"]:checked')?.value === 'mailto' ? 'mailto' : 'share',
        company,
        mail: readMail(),
    });
}

const persistLater = debounce(persist, 300);

// ---------------------------------------------------------------------------
// Cartella di salvataggio e backup
// ---------------------------------------------------------------------------

const when = (ms) => new Date(ms).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

async function renderFolder() {
    const st = await folder.status();
    const lines = [];
    if (!st.linked) lines.push(st.supported ? 'Non collegata.' : 'Non disponibile in questo browser (serve Chrome recente su Android). Usa il backup in un file qui sotto.');
    else {
        lines.push(st.permission === 'granted' ? `Collegata: «${st.name}».` : `Sospesa: «${st.name}». Il telefono chiede di nuovo il permesso.`);
        if (st.lastWrite) lines.push(`Ultima copia: ${when(st.lastWrite)}.`);
        if (st.pending) lines.push(`${st.pending} ${st.pending === 1 ? 'modifica in attesa' : 'modifiche in attesa'} di essere copiate.`);
    }
    $('s-folder-status').textContent = lines.join(' ');
    $('s-folder-link').hidden = st.linked || !st.supported;
    $('s-folder-reactivate').hidden = !(st.linked && st.permission !== 'granted');
    $('s-folder-tools').hidden = !st.linked;
    if (st.error) showBoxMsg('s-folder-msg', st.error, 'error');
    const last = loadSettings().lastBackup;
    $('s-backup-last').textContent = last ? `Ultima copia di sicurezza (cartella o file): ${when(last)}.` : 'Nessuna copia di sicurezza fatta finora.';
}

// esegue un'azione sul pulsante, con il messaggio dell'esito
async function runFolder(button, action) {
    button.disabled = true;
    showBoxMsg('s-folder-msg', '');
    try {
        await action();
    } catch (e) {
        showBoxMsg('s-folder-msg', folder.explain(e), 'error');
    } finally {
        button.disabled = false;
        await renderFolder();
    }
}

// la domanda quando la cartella scelta contiene già delle impostazioni
function askSettings(handle, { settings, modified }) {
    const who = [settings.company.name, settings.email].filter(Boolean).join(', ');
    return `Nella cartella «${handle.name}» ci sono impostazioni salvate${modified ? ` il ${when(modified)}` : ''}${who ? ` (${who})` : ''}.\n\nCaricarle al posto di quelle di questo telefono? Valgono ditta, email (destinatario e testo), logo e numerazione; il numero progressivo dei rapporti non torna mai indietro.`;
}

function initFolder() {
    folder.events.addEventListener('state', () => nav.current() === 'settings' && renderFolder());

    // Scegli cartella: se dentro ci sono già delle impostazioni, si chiede se prenderle e ricaricarle
    $('s-folder-link').addEventListener('click', () => runFolder($('s-folder-link'), async () => {
        const handle = await folder.pick();
        if (!handle) return; // annullato
        const found = await folder.peekSettings(handle);
        const take = !!found && confirm(askSettings(handle, found));
        await folder.linkHandle(handle, { fromFolder: take });
        if (take) {
            fill();
            await showLogo();
        }
        showBoxMsg('s-folder-msg', `${take ? 'Impostazioni caricate dalla cartella. ' : ''}Cartella collegata: sto copiando i rapporti. Tocca "Prova cartella" per controllare che funzioni.`, 'success');
    }));
    $('s-folder-reactivate').addEventListener('click', () => runFolder($('s-folder-reactivate'), async () => {
        if ((await folder.reactivate()) !== 'granted') showBoxMsg('s-folder-msg', 'Permesso non concesso: senza, la copia non può partire.', 'warn');
    }));
    $('s-folder-sync').addEventListener('click', () => runFolder($('s-folder-sync'), async () => {
        await folder.reactivate();
        await folder.syncAll();
        const st = await folder.status();
        if (!st.error) showBoxMsg('s-folder-msg', st.permission === 'granted' ? 'Copia completata.' : 'Cartella sospesa: riattivala per copiare.', st.permission === 'granted' ? 'success' : 'warn');
    }));
    $('s-folder-test').addEventListener('click', () => runFolder($('s-folder-test'), async () => {
        await folder.test();
        showBoxMsg('s-folder-msg', 'Prova riuscita: ho scritto e riletto un file nella cartella.', 'success');
    }));
    $('s-folder-restore').addEventListener('click', () => runFolder($('s-folder-restore'), async () => {
        if (!confirm('Ripristinare dalla cartella? I rapporti trovati si uniscono a quelli del telefono: a parità di rapporto vince la modifica più recente.')) return;
        const r = await folder.restore();
        showBoxMsg('s-folder-msg', `Ripristinati ${r.reports} rapporti e ${r.photos} foto${r.skipped ? ` (${r.skipped} cartelle non leggibili)` : ''}.`, r.skipped ? 'warn' : 'success');
    }));
    $('s-folder-unlink').addEventListener('click', () => runFolder($('s-folder-unlink'), async () => {
        if (!confirm('Scollegare la cartella? I file già copiati restano dove sono; le nuove modifiche non vengono più copiate.')) return;
        await folder.unlink();
    }));

    $('s-backup-save').addEventListener('click', async () => {
        const button = $('s-backup-save');
        button.disabled = true;
        try {
            const r = await createBackup({ withPhotos: $('s-backup-photos').checked });
            downloadFile(new File([r.blob], r.name, { type: 'application/zip' }));
            showBoxMsg('s-backup-msg', `Backup scaricato: ${r.name} (${r.reports} rapporti${$('s-backup-photos').checked ? `, ${r.photos} foto` : ', senza foto'}).`, 'success');
        } catch (e) {
            showBoxMsg('s-backup-msg', `Backup non riuscito: ${e.message || e}`, 'error');
        } finally {
            button.disabled = false;
            renderFolder();
        }
    });
    $('s-backup-in').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        if (!confirm('Ripristinare dal backup? I rapporti si uniscono a quelli del telefono: a parità di rapporto vince la modifica più recente.')) return;
        try {
            const r = await restoreBackup(file);
            showBoxMsg('s-backup-msg', `Ripristinati ${r.reports} rapporti e ${r.photos} foto${r.skipped ? ` (${r.skipped} non leggibili)` : ''}.`, r.skipped ? 'warn' : 'success');
            fill();
            await showLogo();
        } catch (err) {
            showBoxMsg('s-backup-msg', `Ripristino non riuscito: ${err.message || err}`, 'error');
        }
    });
}

export async function enter() {
    fill();
    for (const id of ['s-logo-msg', 's-folder-msg', 's-backup-msg']) showBoxMsg(id, '');
    await Promise.all([showLogo(), renderFolder()]);
}

export function leave() {
    persistLater.flush();
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    logoUrl = null;
}

export function init() {
    buildFields('s-company', 's-co-', COMPANY_DEFS);
    initMail();

    $('btn-settings-back').addEventListener('click', () => nav.back());
    initFolder();

    $('view-settings').addEventListener('input', (e) => {
        if (e.target.id === 's-next' || e.target.id === 's-logo-in') return;
        $('s-email-hint').hidden = true; // l'avviso riappare a campo finito
        persistLater();
    });
    $('view-settings').addEventListener('change', (e) => {
        if (e.target.id === 's-next' || e.target.id === 's-logo-in') return;
        persist();
        const r = checkRecipients($('s-email').value);
        $('s-email-hint').hidden = r.ok;
        $('s-email-hint').textContent = r.ok ? '' : r.error;
    });

    // numero del prossimo rapporto (a campo finito, non a ogni cifra)
    $('s-next').addEventListener('change', () => {
        const value = Math.floor(Number($('s-next').value));
        const counters = setNextNumber(loadSettings().counters, year(), value >= 1 ? value : 1);
        updateSettings({ counters });
        fillNumbering(counters);
    });

    $('s-logo-in').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
            await setLogo(file);
            showBoxMsg('s-logo-msg', '');
        } catch (err) {
            showBoxMsg('s-logo-msg', `Logo non aggiunto: ${err.message || err}`, 'error');
        }
        await showLogo();
    });
    $('s-logo-del').addEventListener('click', async () => {
        await removeLogo();
        await showLogo();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && nav.current() === 'settings') persistLater.flush();
    });
}
