// Avvio dell'app: classi di stile, service worker, schermate e navigazione.

import * as nav from './ui/nav.js';
import { registerClasses } from './ui/classes.js';
import * as folder from './backup/folder/index.js';
import * as home from './screens/home.js';
import * as editor from './screens/editor/index.js';
import * as scan from './screens/scan.js';
import * as measure from './screens/measure.js';
import * as quick from './screens/quick.js';
import * as trash from './screens/trash.js';
import * as settings from './screens/settings.js';
import * as store from './data/store.js';

registerClasses(); // le classi Tailwind create dal JS

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

const SCREENS = { home, editor, scan, measure, quick, trash, settings };
for (const [name, screen] of Object.entries(SCREENS)) {
    screen.init?.();
    nav.register(name, { el: `view-${name}`, enter: screen.enter, leave: screen.leave });
}

folder.start(); // la copia nella cartella di salvataggio (se collegata)

// Scorciatoie dell'icona (manifest.json): ?azione=nuovo | scansione
async function runShortcut() {
    const action = new URLSearchParams(location.search).get('azione');
    if (!action) return;
    history.replaceState(history.state, '', location.pathname); // un ricaricamento non la ripete
    if (action === 'nuovo') {
        const doc = await store.createReport();
        await nav.go('editor', { id: doc.id, isNew: true });
    } else if (action === 'scansione') {
        await nav.go('scan', { mode: 'quick' });
    }
}

await nav.start();
await runShortcut();
