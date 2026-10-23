// Valori di base del modello: identificativi e lettura di valori di tipo incerto (dati letti da fuori).

export function newId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// identificativo valido di un rapporto o di un apparecchio (anche letto da fuori: cartella, backup)
export const isId = (v) => /^[A-Za-z0-9_-]{8,64}$/.test(v ?? '');

export const text = (v, max = 20000) => (typeof v === 'string' ? v.slice(0, max) : '');
export const time = (v, fallback) => (Number.isFinite(v) && v > 0 ? v : fallback);
export const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
export const labelIn = (list, id) => list.find((i) => i.id === id)?.label ?? '';
