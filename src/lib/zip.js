// File ZIP senza librerie: compressione e decompressione le fa il browser (CompressionStream).
// Basta per il backup: pochi file, niente cifratura, niente ZIP64.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

export function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

async function pipe(bytes, stream) {
    const out = new Blob([bytes]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(out).arrayBuffer());
}

const MAX_ENTRY = 256 * 1024 * 1024; // un file più grande non è un nostro backup

// entries: [{ name, data: Uint8Array | string, store?: true }] (store = senza compressione, per i JPEG)
export async function createZip(entries) {
    const parts = [];
    const central = [];
    let offset = 0;
    for (const entry of entries) {
        const name = encoder.encode(entry.name);
        const raw = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
        let data = raw;
        let method = 0;
        if (!entry.store && raw.length > 64 && typeof CompressionStream === 'function') {
            data = await pipe(raw, new CompressionStream('deflate-raw'));
            method = 8;
        }
        const crc = crc32(raw);
        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true); // versione necessaria
        local.setUint16(6, 0x0800, true); // nomi in UTF-8
        local.setUint16(8, method, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, data.length, true);
        local.setUint32(22, raw.length, true);
        local.setUint16(26, name.length, true);
        parts.push(local, name, data);

        const dir = new DataView(new ArrayBuffer(46));
        dir.setUint32(0, 0x02014b50, true);
        dir.setUint16(4, 20, true);
        dir.setUint16(6, 20, true);
        dir.setUint16(8, 0x0800, true);
        dir.setUint16(10, method, true);
        dir.setUint32(16, crc, true);
        dir.setUint32(20, data.length, true);
        dir.setUint32(24, raw.length, true);
        dir.setUint16(28, name.length, true);
        dir.setUint32(42, offset, true);
        central.push(dir, name);
        offset += 30 + name.length + data.length;
    }
    if (entries.length > 65535 || offset > 0xfffffff0) throw new Error('Backup troppo grande per un file ZIP');
    const size = central.reduce((n, p) => n + (p.byteLength ?? p.length), 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, size, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

// Restituisce una Map nome -> Uint8Array. Lancia un Error se il file non è uno ZIP leggibile.
export async function readZip(source) {
    const bytes = new Uint8Array(source instanceof Blob ? await source.arrayBuffer() : source);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            end = i;
            break;
        }
    }
    if (end < 0) throw new Error('Il file non è un backup ZIP valido');
    const count = view.getUint16(end + 10, true);
    let pos = view.getUint32(end + 16, true);
    const files = new Map();
    for (let n = 0; n < count; n++) {
        if (pos + 46 > bytes.length || view.getUint32(pos, true) !== 0x02014b50) throw new Error('Il file ZIP è danneggiato');
        const method = view.getUint16(pos + 10, true);
        const crc = view.getUint32(pos + 16, true);
        const csize = view.getUint32(pos + 20, true);
        const usize = view.getUint32(pos + 24, true);
        const nlen = view.getUint16(pos + 28, true);
        const elen = view.getUint16(pos + 30, true);
        const clen = view.getUint16(pos + 32, true);
        const local = view.getUint32(pos + 42, true);
        const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nlen));
        pos += 46 + nlen + elen + clen;
        if (name.endsWith('/')) continue; // cartella
        if (usize > MAX_ENTRY || csize > MAX_ENTRY) throw new Error('Il file ZIP contiene un elemento troppo grande');
        if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) throw new Error('Il file ZIP è danneggiato');
        const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        const packed = bytes.subarray(start, start + csize);
        let data;
        if (method === 0) data = packed;
        else if (method === 8) {
            try {
                data = await pipe(packed, new DecompressionStream('deflate-raw'));
            } catch {
                throw new Error(`Il file ZIP è danneggiato (${name})`);
            }
        }
        else throw new Error('Il file ZIP usa una compressione non supportata');
        if (data.length !== usize || crc32(data) !== crc) throw new Error(`Il file ZIP è danneggiato (${name})`);
        files.set(name, data);
    }
    return files;
}
