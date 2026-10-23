// Indirizzo del cliente dalla posizione del telefono (OpenStreetMap: serve internet).

import { getPosition, geoErrorMessage, reverseGeocode } from '../../lib/geo.js';
import { $, showBoxMsg } from '../../ui/util.js';
import { session, touch } from './session.js';

export function initAddress() {
    $('btn-geo').addEventListener('click', async () => {
        const btn = $('btn-geo');
        btn.disabled = true;
        try {
            showBoxMsg('geo-msg', 'Rilevo la posizione…');
            let pos;
            try {
                pos = await getPosition();
            } catch (e) {
                showBoxMsg('geo-msg', geoErrorMessage(e), 'error');
                return;
            }
            const { latitude, longitude, accuracy } = pos.coords;
            showBoxMsg('geo-msg', 'Cerco l\'indirizzo…');
            try {
                const address = await reverseGeocode(latitude.toFixed(6), longitude.toFixed(6));
                if (!session.doc) return;
                $('c-address').value = address;
                touch();
                showBoxMsg('geo-msg', `Indirizzo trovato (precisione circa ${Math.round(accuracy)} m). Controllalo prima di creare il PDF.`, 'success');
            } catch {
                showBoxMsg('geo-msg', `Posizione trovata (${latitude.toFixed(5)}, ${longitude.toFixed(5)}) ma non riesco a ricavare l'indirizzo (serve internet). Inseriscilo a mano.`, 'error');
            }
        } finally {
            btn.disabled = false;
        }
    });
}
