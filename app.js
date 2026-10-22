// Avvio dell'app: classi di stile, service worker, schermate e navigazione.

import * as nav from './nav.js';
import { registerClasses } from './ui.js';
import * as home from './screens/home.js';
import * as editor from './screens/editor.js';
import * as scan from './screens/scan.js';
import * as measure from './screens/measure.js';
import * as quick from './screens/quick.js';
import * as settings from './screens/settings.js';

registerClasses(); // le classi Tailwind create dal JS

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

const SCREENS = { home, editor, scan, measure, quick, settings };
for (const [name, screen] of Object.entries(SCREENS)) {
    screen.init?.();
    nav.register(name, { el: `view-${name}`, enter: screen.enter, leave: screen.leave });
}

nav.start();
