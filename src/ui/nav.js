// Navigazione tra le schermate. Ogni schermata si registra con il suo elemento e le funzioni
// enter(params) / leave(). Il tasto indietro di Android torna alla schermata precedente.

const screens = new Map();
let currentName = null;

export const current = () => currentName;

export function register(name, { el, enter, leave }) {
    screens.set(name, { el: document.getElementById(el), enter, leave });
}

let renderId = 0;

// la nuova schermata compare quando i suoi dati sono pronti (nessun lampo di modulo vuoto)
async function render(name, params) {
    const id = ++renderId;
    const prev = screens.get(currentName);
    currentName = name;
    if (prev?.leave) await prev.leave();
    const next = screens.get(name);
    for (const [n, s] of screens) if (n !== name) s.el.hidden = true;
    await next.enter?.(params);
    if (id !== renderId) return; // nel frattempo si è passati a un'altra schermata
    next.el.hidden = false;
    window.scrollTo(0, 0);
}

const depth = () => history.state?.depth ?? 0;

// va a una schermata nuova (il tasto indietro torna a quella attuale)
export function go(name, params = {}) {
    history.pushState({ view: name, params, depth: depth() + 1 }, '');
    return render(name, params);
}

// sostituisce la schermata attuale (es. dalla scansione alla misura letta)
export function replace(name, params = {}) {
    history.replaceState({ view: name, params, depth: depth() }, '');
    return render(name, params);
}

export const back = () => history.back();

// torna alla pagina principale, qualunque sia la profondità
export function home() {
    if (depth() > 0) history.go(-depth());
    else replace('home');
}

export function start() {
    history.replaceState({ view: 'home', params: {}, depth: 0 }, '');
    window.addEventListener('popstate', (e) => render(e.state?.view ?? 'home', e.state?.params ?? {}));
    return render('home', {});
}
