// Lettura dei QR: fotocamera dal vivo e lettura da una foto (zxing-wasm, in locale).
// Restituisce i byte grezzi del QR: il QR del Testo contiene dati binari, non testo.

// il file .wasm è servito in locale, così funziona offline
const zxingReady = ZXingWASM.prepareZXingModule({
    overrides: {
        locateFile: (path, prefix) => (path.endsWith('.wasm') ? new URL(`vendor/${path}`, document.baseURI).href : prefix + path),
    },
    fireImmediately: true,
});
zxingReady.catch(() => {});

const LIVE_OPTIONS = { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 1 };
const PHOTO_OPTIONS = { formats: ['QRCode'], tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true, maxNumberOfSymbols: 8 };

export function cameraError(e) {
    switch (e?.name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return 'Permesso fotocamera negato. Abilitalo dalle impostazioni del sito (icona a sinistra dell\'indirizzo) e riprova.';
        case 'NotFoundError':
        case 'OverconstrainedError':
            return 'Nessuna fotocamera trovata.';
        case 'NotReadableError':
            return 'La fotocamera è usata da un\'altra app. Chiudila e riprova.';
        default:
            return `Impossibile avviare la fotocamera: ${e?.message || e}`;
    }
}

function joinBytes(chunks) {
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let pos = 0;
    for (const c of chunks) {
        out.set(c, pos);
        pos += c.length;
    }
    return out;
}

// Raccoglie i risultati di una lettura. Se il QR è diviso in più parti (structured append)
// attende le altre. Restituisce { bytes, text } quando è completo, altrimenti { partial, size }.
function collect(results, state) {
    const valid = results.filter((r) => r.isValid && r.bytes?.length);
    if (!valid.length) return null;
    if (valid[0].sequenceSize > 1) {
        for (const r of valid) {
            if (!state.parts || state.parts.id !== r.sequenceId) state.parts = { id: r.sequenceId, size: r.sequenceSize, data: {} };
            state.parts.data[r.sequenceIndex] = r.bytes;
        }
        const have = Object.keys(state.parts.data).length;
        if (have < state.parts.size) return { partial: have, size: state.parts.size };
        return { bytes: joinBytes(Array.from({ length: state.parts.size }, (_, i) => state.parts.data[i])), text: valid[0].text };
    }
    return { bytes: valid[0].bytes, text: valid[0].text };
}

// Fotocamera dal vivo. onStatus(testo) per i messaggi; onBytes(bytes, text) alla lettura
// (la fotocamera si ferma da sola). Restituisce { stop, hasTorch, setTorch(on) }.
export async function startCamera({ video, onStatus, onBytes }) {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Fotocamera non disponibile. Apri l\'app da Chrome con indirizzo https, oppure usa "Da foto".');
    }
    onStatus('Avvio fotocamera…');
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
    } catch (e) {
        throw new Error(cameraError(e));
    }
    let stopped = false;
    let timer = null;
    const stop = () => {
        stopped = true;
        clearTimeout(timer);
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
    };
    video.srcObject = stream;
    await video.play().catch(() => {});

    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities?.() || {};
    if (caps.focusMode?.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});

    try {
        await zxingReady;
    } catch {
        stop();
        throw new Error('Impossibile caricare il lettore QR. Apri l\'app almeno una volta con internet attivo.');
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const state = { parts: null };
    onStatus('Inquadra il QR code');

    const loop = async () => {
        if (stopped) return;
        if (video.readyState >= 2 && video.videoWidth) {
            // si analizza il quadrato centrale del fotogramma (dove c'è il riquadro)
            const w = video.videoWidth;
            const h = video.videoHeight;
            const side = Math.min(w, h);
            canvas.width = side;
            canvas.height = side;
            ctx.drawImage(video, (w - side) / 2, (h - side) / 2, side, side, 0, 0, side, side);
            try {
                const found = collect(await ZXingWASM.readBarcodes(ctx.getImageData(0, 0, side, side), LIVE_OPTIONS), state);
                if (found?.bytes && !stopped) {
                    stop();
                    await onBytes(found.bytes, found.text);
                    return;
                }
                if (found?.partial) onStatus(`Parte ${found.partial} di ${found.size} letta: inquadra le altre`);
            } catch (e) {
                console.error(e);
            }
        }
        if (!stopped) timer = setTimeout(loop, 80);
    };
    loop();

    return {
        stop,
        hasTorch: !!caps.torch,
        async setTorch(on) {
            await track.applyConstraints({ advanced: [{ torch: on }] });
        },
    };
}

// Lettura da una foto (utile con QR molto densi o riflessi sul display). Lancia un Error col motivo.
export async function readImage(file) {
    await zxingReady.catch(() => {
        throw new Error('Impossibile caricare il lettore QR. Apri l\'app almeno una volta con internet attivo.');
    });
    const state = { parts: null };
    const found = collect(await ZXingWASM.readBarcodes(file, PHOTO_OPTIONS), state);
    if (!found) throw new Error('Nessun QR code trovato nella foto. Riprova avvicinandoti e tenendo il QR a fuoco, senza riflessi.');
    if (!found.bytes) throw new Error(`La foto contiene solo ${found.partial} parti su ${found.size} del QR.`);
    return found;
}
