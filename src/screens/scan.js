// Lettura del QR del Testo con la fotocamera, da una foto o da un file.
// Due modi: 'quick' (scansione rapida) e 'attach' (aggiunge la misura a un rapporto).

import * as nav from '../ui/nav.js';
import * as store from '../data/store.js';
import * as scanner from '../qr/scanner.js';
import { bytesToJson, buildReport } from '../qr/tjf/index.js';
import { addMeasure } from '../model/index.js';
import { addScan } from '../data/quickscans.js';
import { $, showBoxMsg, toast, vibrate } from '../ui/util.js';

let params = {};
let camera = null;
let session = 0; // si alza a ogni avvio/arresto, per ignorare le fotocamere ormai superate
let picking = false; // il selettore di file di Android mette la pagina in secondo piano

function stopCamera() {
    session++;
    camera?.stop();
    camera = null;
}

const setStatus = (text) => ($('scan-status').textContent = text);

async function begin() {
    stopCamera();
    const mine = session;
    $('btn-torch').hidden = true;
    $('btn-torch').setAttribute('aria-pressed', 'false');
    try {
        const cam = await scanner.startCamera({ video: $('video'), onStatus: (t) => mine === session && setStatus(t), onBytes: handleBytes });
        if (mine !== session) {
            cam.stop();
            return;
        }
        camera = cam;
        $('btn-torch').hidden = !cam.hasTorch;
    } catch (e) {
        if (mine !== session) return;
        // la schermata resta aperta: "Da foto" e "Importa file" si possono usare lo stesso
        setStatus('Fotocamera non disponibile');
        showBoxMsg('scan-msg', e.message || String(e), 'error');
    }
}

// un QR che non è del Testo: messaggio e si riprende a leggere
function invalid(text) {
    const preview = text && /^[\x20-\x7e -￿\s]+$/.test(text) ? ` Contenuto letto: "${text.slice(0, 200)}"` : '';
    showBoxMsg('scan-msg', `Il QR letto non contiene dati Testo validi.${preview}`, 'error');
    if (nav.current() === 'scan') setTimeout(() => nav.current() === 'scan' && !camera && !picking && begin(), 1500);
}

async function handleBytes(bytes, text) {
    camera = null; // la fotocamera si è già fermata
    vibrate(120);
    let json, report;
    try {
        json = await bytesToJson(bytes);
        report = buildReport(json);
    } catch {
        invalid(text);
        return;
    }
    try {
        await keep(json, report);
    } catch (e) {
        showBoxMsg('scan-msg', `Impossibile salvare la misura: ${e.message || e}`, 'error');
    }
}

// salva la misura (nel rapporto o tra le scansioni rapide) e ne mostra i valori
async function keep(json, report) {
    if (params.mode === 'attach') {
        const doc = await store.getReport(params.reportId);
        if (!doc) {
            nav.home();
            return;
        }
        const same = doc.measures.find((m) => report.uuid && buildReport(m.json).uuid === report.uuid);
        if (same) {
            toast('Questa misura è già nel rapporto');
            nav.replace('measure', { source: 'report', reportId: doc.id, measureId: same.id });
            return;
        }
        const measure = addMeasure(doc, json);
        await store.saveReport(doc);
        nav.replace('measure', { source: 'report', reportId: doc.id, measureId: measure.id, isNew: true });
    } else {
        const entry = addScan(json, report);
        nav.replace('measure', { source: 'quick', id: entry.id });
    }
}

export function enter(p) {
    params = p;
    picking = false;
    showBoxMsg('scan-msg', '');
    setStatus('Avvio fotocamera…');
    begin(); // senza attendere: la schermata si vede subito, anche mentre il telefono chiede il permesso
}

export const leave = stopCamera;

export function init() {
    $('btn-cancel').addEventListener('click', () => nav.back());

    $('btn-torch').addEventListener('click', async () => {
        if (!camera) return;
        const on = $('btn-torch').getAttribute('aria-pressed') !== 'true';
        try {
            await camera.setTorch(on);
            $('btn-torch').setAttribute('aria-pressed', String(on));
        } catch {}
    });

    // Da foto / Importa file: la fotocamera si ferma mentre si sceglie il file
    for (const id of ['in-photo', 'in-file']) {
        const input = $(id);
        input.addEventListener('click', () => {
            picking = true;
            stopCamera();
            setStatus('Scegli un file');
        });
        input.addEventListener('cancel', () => {
            picking = false;
            if (nav.current() === 'scan') begin();
        });
        input.addEventListener('change', async () => {
            const file = input.files[0];
            input.value = '';
            picking = false;
            if (!file) {
                if (nav.current() === 'scan') begin();
                return;
            }
            showBoxMsg('scan-msg', id === 'in-photo' ? 'Analisi della foto…' : 'Lettura del file…', 'info');
            try {
                if (id === 'in-photo') {
                    const found = await scanner.readImage(file);
                    await handleBytes(found.bytes, found.text);
                } else {
                    await handleBytes(new Uint8Array(await file.arrayBuffer()));
                }
            } catch (e) {
                showBoxMsg('scan-msg', e.message || String(e), 'error');
                if (nav.current() === 'scan') setTimeout(() => nav.current() === 'scan' && !camera && begin(), 2500);
            }
        });
    }

    // l'app va in secondo piano: la fotocamera si spegne da sola, si torna alla schermata precedente
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && nav.current() === 'scan' && !picking) nav.back();
    });
}
