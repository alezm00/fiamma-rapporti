// Lettura e scrittura di file e cartelle in una cartella scelta (FileSystemDirectoryHandle).

export const ROOT = 'Fiamma';

export async function dir(parent, names, create = true) {
    let d = parent;
    for (const name of names) d = await d.getDirectoryHandle(name, { create });
    return d;
}

export async function writeFile(parent, name, data) {
    const handle = await parent.getFileHandle(name, { create: true });
    const w = await handle.createWritable();
    try {
        await w.write(data);
        await w.close();
    } catch (e) {
        await w.abort().catch(() => {});
        throw e;
    }
}

export async function readFile(parent, name) {
    return (await parent.getFileHandle(name)).getFile();
}

// Un File preso dalla cartella dipende dal file che sta nella cartella: se poi lo riscrivi (o cambia) non si legge più.
// Quello che si tiene sul telefono (foto, logo) si copia quindi in memoria.
export async function memoryCopy(file) {
    return new Blob([await file.arrayBuffer()], { type: 'image/jpeg' });
}

export const missing = (e) => e?.name === 'NotFoundError' || e?.name === 'TypeMismatchError';

export async function removeDir(parent, name) {
    try {
        await parent.removeEntry(name, { recursive: true });
    } catch (e) {
        if (!missing(e)) throw e;
    }
}

export async function subdirs(parent) {
    const out = [];
    for await (const [name, handle] of parent.entries()) if (handle.kind === 'directory') out.push([name, handle]);
    return out;
}
