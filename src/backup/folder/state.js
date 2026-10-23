// Cosa si ricorda sul telefono della cartella collegata: la cartella, la coda delle modifiche e cosa è già scritto.

import * as db from '../../data/db.js';

export const loadLink = async () => (await db.get(db.META, 'folder')) ?? null;
export const loadQueue = async () => (await db.get(db.META, 'folderQueue'))?.items ?? {};
export const saveQueue = (items) => db.put(db.META, { key: 'folderQueue', items });
export const freshIndex = () => ({ key: 'folderIndex', reports: {}, logo: '' });
export const loadIndex = async () => (await db.get(db.META, 'folderIndex')) ?? freshIndex();
export const saveIndex = (index) => db.put(db.META, index);
