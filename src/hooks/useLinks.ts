import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  getDocs,
  query,
  where,
  Query,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Link, LinkStatus, LINK_STATUSES } from '../types';

function toStatus(value: unknown): LinkStatus {
  return LINK_STATUSES.includes(value as LinkStatus) ? (value as LinkStatus) : 'public';
}

function snapshotToLinks(snapshot: QuerySnapshot<DocumentData>): Link[] {
  const linksData = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title ?? '',
      url: data.url ?? '',
      description: data.description ?? '',
      imageUrl: data.imageUrl ?? '',
      category: data.category ?? '',
      iconName: data.iconName ?? '',
      priority: data.priority ?? 0,
      status: toStatus(data.status),
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    } as Link;
  });
  return linksData.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

interface UseLinksOptions {
  // true : tous les liens (admin connecté) ; false : uniquement les liens publics.
  // Les règles Firestore refusent aux visiteurs toute requête non filtrée sur `public`.
  includeHidden?: boolean;
}

export function useLinks({ includeHidden = false }: UseLinksOptions = {}) {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const colRef: Query<DocumentData> = includeHidden
      ? collection(db, 'links')
      : query(collection(db, 'links'), where('status', '==', 'public'));

    setError(null);

    unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (timedOut) return;
        // Le temps réel répond : on garde l'écoute ouverte et on annule le plan B
        clearTimeout(timeout);
        setLinks(snapshotToLinks(snapshot));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching links:', err);
        clearTimeout(timeout);
        setError('Erreur lors du chargement des liens');
        setLoading(false);
      }
    );

    // Plan B uniquement si le temps réel n'a rien renvoyé en 5 s (réseau qui bloque les WebSockets…)
    timeout = setTimeout(async () => {
      timedOut = true;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      try {
        const snapshot = await getDocs(colRef);
        setLinks(snapshotToLinks(snapshot));
      } catch (e) {
        console.error('Fallback fetch also failed:', e);
      }
      setLoading(false);
    }, 5000);

    return () => {
      clearTimeout(timeout);
      if (unsubscribe) unsubscribe();
    };
  }, [includeHidden]);

  const updateLinksOrder = useCallback((newOrder: Link[]) => {
    setLinks(newOrder);
  }, []);

  return { links, loading, error, updateLinksOrder };
}
