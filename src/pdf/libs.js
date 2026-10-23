// Caricamento delle librerie del PDF (pdf-lib, fontkit) e dei font: solo quando serve il PDF.

let libsPromise = null;

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Impossibile caricare ${src}`));
        document.head.append(s);
    });
}

async function fetchBytes(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Impossibile caricare ${url}`);
    return new Uint8Array(await res.arrayBuffer());
}

export function preloadPdfLibs() {
    if (!libsPromise) {
        libsPromise = Promise.all([
            window.PDFLib ? null : loadScript('vendor/pdf-lib.min.js'),
            window.fontkit ? null : loadScript('vendor/fontkit.umd.min.js'),
            fetchBytes('vendor/LiberationSans-Regular.ttf'),
            fetchBytes('vendor/LiberationSans-Bold.ttf'),
        ]).then(([, , regular, bold]) => ({ regular, bold }));
        libsPromise.catch(() => (libsPromise = null));
    }
    return libsPromise;
}
