// Date e orari nei formati italiani usati in tutta l'app (gg/mm/aaaa, hh:mm).

export const pad = (n) => String(n).padStart(2, '0');

// data locale come "2026-10-22"
export const dayString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// "2026-10-22" -> "22/10/2026"
export function formatDay(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

// "14:32:05", oppure "14:32" senza i secondi
export function formatTime(d, withSeconds = true) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}` + (withSeconds ? `:${pad(d.getSeconds())}` : '');
}

// "22/10/2026 14:32"
export function formatDate(d, withSeconds = false) {
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${formatTime(d, withSeconds)}`;
}
