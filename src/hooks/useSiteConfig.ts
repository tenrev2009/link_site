import { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs, query, limit, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SiteConfig, SocialLink, CustomIcon } from '../types';

function extractConfig(snapshot: QuerySnapshot<DocumentData>): SiteConfig | null {
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  const data = docSnap.data();

  const socialLinks: SocialLink[] = (data.socialLinks ?? []).map((s: any) => ({
    platform: s.platform ?? s.mapValue?.fields?.platform?.stringValue ?? '',
    url: s.url ?? s.mapValue?.fields?.url?.stringValue ?? '',
    iconName: s.iconName ?? s.mapValue?.fields?.iconName?.stringValue ?? '',
  }));

  const customIcons: CustomIcon[] = (data.customIcons ?? []).map((c: any) => ({
    name: c.name ?? c.mapValue?.fields?.name?.stringValue ?? '',
    url: c.url ?? c.mapValue?.fields?.url?.stringValue ?? '',
  }));

  return {
    id: docSnap.id,
    title: data.title ?? '',
    description: data.description ?? '',
    logoUrl: data.logoUrl ?? '',
    copyright: data.copyright ?? '',
    socialLinks,
    customIcons,
  } as SiteConfig;
}

export function useSiteConfig() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const colRef = query(collection(db, 'settings'), limit(1));

    unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (timedOut) return;
        // Le temps réel répond : on garde l'écoute ouverte et on annule le plan B
        clearTimeout(timeout);
        setConfig(extractConfig(snapshot));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching site config:', err);
        clearTimeout(timeout);
        setError('Erreur lors du chargement de la configuration');
        setLoading(false);
      }
    );

    // Plan B uniquement si le temps réel n'a rien renvoyé en 5 s
    timeout = setTimeout(async () => {
      timedOut = true;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      try {
        const snapshot = await getDocs(colRef);
        setConfig(extractConfig(snapshot));
      } catch (e) {
        console.error('Fallback config fetch also failed:', e);
      }
      setLoading(false);
    }, 5000);

    return () => {
      clearTimeout(timeout);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return { config, loading, error };
}
