import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { Link, LinkStatus } from '../types';

// Firestore limite un batch à 500 écritures
const BATCH_LIMIT = 500;

export async function addLink(data: Omit<Link, 'id' | 'createdAt' | 'updatedAt'>) {
  return addDoc(collection(db, 'links'), {
    title: data.title,
    url: data.url,
    description: data.description,
    imageUrl: data.imageUrl,
    category: data.category,
    iconName: data.iconName || 'FolderOpen',
    priority: data.priority ?? 0,
    status: data.status ?? 'pending',
    keywords: data.keywords ?? [],
    altText: data.altText ?? '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function updateLink(
  id: string,
  data: Partial<Omit<Link, 'id' | 'createdAt' | 'updatedAt'>>
) {
  const linkRef = doc(db, 'links', id);
  return updateDoc(linkRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateLinkStatus(id: string, status: LinkStatus) {
  return updateLink(id, { status });
}

export async function deleteLink(id: string) {
  const linkRef = doc(db, 'links', id);
  return deleteDoc(linkRef);
}

export async function reorderLinks(links: Link[]) {
  for (let start = 0; start < links.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db);
    links.slice(start, start + BATCH_LIMIT).forEach((link, offset) => {
      batch.update(doc(db, 'links', link.id), {
        priority: start + offset,
        updatedAt: new Date().toISOString(),
      });
    });
    await batch.commit();
  }
}

// Les liens créés avant l'ajout des statuts n'ont pas de champ `status` :
// on les passe en public pour qu'ils restent visibles sur le site.
export async function migrateLinksWithoutStatus(): Promise<number> {
  const snapshot = await getDocs(collection(db, 'links'));
  const missing = snapshot.docs.filter((d) => !d.data().status);

  for (let start = 0; start < missing.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db);
    missing.slice(start, start + BATCH_LIMIT).forEach((d) => {
      batch.update(d.ref, { status: 'public' });
    });
    await batch.commit();
  }

  return missing.length;
}
