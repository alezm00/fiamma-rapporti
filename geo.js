// Posizione del telefono -> indirizzo (OpenStreetMap Nominatim, serve internet)

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';

export function getPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject({ code: 0 });
            return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
    });
}

export function geoErrorMessage(e) {
    switch (e?.code) {
        case 1:
            return 'Permesso di posizione negato. Abilitalo dalle impostazioni del sito (icona a sinistra dell\'indirizzo) e riprova.';
        case 2:
            return 'Posizione non disponibile. Controlla che il GPS sia attivo e riprova.';
        case 3:
            return 'Tempo scaduto: riprova all\'aperto o con il GPS attivo.';
        default:
            return 'La posizione non è disponibile su questo dispositivo.';
    }
}

// Risposta di Nominatim -> "Via Roma 12, 33100 Udine (UD)"
export function formatAddress(data) {
    const a = data?.address;
    if (!a) throw new Error('Indirizzo non trovato');
    const road = a.road || a.pedestrian || a.footway || a.path || a.cycleway || a.square || '';
    const street = [road, a.house_number].filter(Boolean).join(' ');
    const place = a.city || a.town || a.village || a.municipality || a.hamlet || a.suburb || '';
    const province = /^IT-(\w{2})$/.exec(a['ISO3166-2-lvl6'] || '')?.[1] || '';
    const town = [a.postcode, place && province ? `${place} (${province})` : place].filter(Boolean).join(' ');
    const text = [street, town].filter(Boolean).join(', ');
    if (text) return text;
    const fallback = String(data.display_name || '').split(',').slice(0, 3).join(',').trim();
    if (!fallback) throw new Error('Indirizzo non trovato');
    return fallback;
}

export async function reverseGeocode(lat, lon, fetchFn = fetch) {
    const url = `${NOMINATIM}?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=it`;
    // il sito ha referrer "no-referrer": per questa sola richiesta si invia l'origine,
    // come richiesto dalle regole d'uso di Nominatim
    const res = await fetchFn(url, { referrerPolicy: 'origin', signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Errore ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return formatAddress(data);
}
