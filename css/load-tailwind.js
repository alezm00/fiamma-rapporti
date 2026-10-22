// Carica Tailwind (build "browser" in vendor/) con il tema dell'app (css/tailwind.css) e tiene
// la pagina nascosta (<html hidden>) finché gli stili non sono pronti.
//
// Il build "browser" legge solo blocchi <style type="text/tailwindcss"> e non file esterni:
// questo script legge css/tailwind.css, ne fa un blocco <style> e solo dopo avvia Tailwind,
// così la prima compilazione ha già tema e componenti.
(() => {
    const src = document.currentScript.src;
    const html = document.documentElement;

    // sicurezza: qualunque cosa succeda, dopo 3 secondi la pagina si mostra
    const start = performance.now();
    setTimeout(() => (html.hidden = false), 3000);

    // si mostra appena il body ha lo sfondo di Tailwind
    const reveal = () => {
        if (getComputedStyle(document.body).backgroundColor === 'rgb(18, 18, 18)') html.hidden = false;
        else if (performance.now() - start < 3000) requestAnimationFrame(reveal);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reveal);
    else reveal();

    const startTailwind = () => {
        const script = document.createElement('script');
        script.src = new URL('../vendor/tailwindcss-browser.js', src);
        document.head.append(script);
    };

    fetch(new URL('tailwind.css', src))
        .then((res) => {
            if (!res.ok) throw new Error(`${res.status}`);
            return res.text();
        })
        .then((css) => {
            const style = document.createElement('style');
            style.type = 'text/tailwindcss';
            style.textContent = css;
            document.head.append(style);
        })
        .catch((e) => console.error(`Impossibile caricare css/tailwind.css (${e.message})`))
        .finally(startTailwind);
})();
