import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { Link } from '../types';

export async function addLink(data: Omit<Link, 'id' | 'createdAt' | 'updatedAt'>) {
  return addDoc(collection(db, 'links'), {
    title: data.title,
    url: data.url,
    description: data.description,
    imageUrl: data.imageUrl,
    category: data.category,
    iconName: data.iconName || 'FolderOpen',
    priority: data.priority ?? 0,
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

export async function deleteLink(id: string) {
  const linkRef = doc(db, 'links', id);
  return deleteDoc(linkRef);
}

export async function reorderLinks(links: Link[]) {
  const batch = writeBatch(db);

  links.forEach((link, index) => {
    const linkRef = doc(db, 'links', link.id);
    batch.update(linkRef, {
      priority: index,
      updatedAt: new Date().toISOString(),
    });
  });

  return batch.commit();
}
