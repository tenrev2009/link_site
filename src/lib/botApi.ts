import { auth } from './firebase';
import { Link, LinkStatus } from '../types';

// Service links-bot (dossier bot/ du dépôt), déployé à part dans Coolify
export const BOT_API_URL: string = import.meta.env.VITE_BOT_API_URL ?? 'https://links-api.biblio3d.net';

async function callBot<T>(path: string, { method = 'GET', body }: { method?: string; body?: unknown } = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Vous devez être connecté.');

  const token = await user.getIdToken();

  let response: Response;
  try {
    response = await fetch(`${BOT_API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Le service d\'ajout automatique est injoignable.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? `Erreur ${response.status}`);
  }
  return data as T;
}

export interface AddFromUrlResult {
  created: boolean;
  metadataError?: string | null;
  link: Pick<Link, 'id' | 'title' | 'url' | 'imageUrl' | 'category' | 'status'>;
}

export function addLinkFromUrl(input: {
  text: string;
  category?: string;
  status?: LinkStatus;
}): Promise<AddFromUrlResult> {
  return callBot('/links', { method: 'POST', body: input });
}

export interface CanvaStatus {
  configured: boolean;
  connected: boolean;
  connectedAt: string | null;
  folderId: string;
  syncMinutes: number;
  syncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  aiEnabled?: boolean;
  lastResult: {
    designs: number;
    imported: number;
    updated: number;
    described?: number;
    unchanged: number;
    skipped: number;
    errors: { designId: string; title: string; message: string }[];
    warnings?: string[];
  } | null;
}

export function getCanvaStatus(): Promise<CanvaStatus> {
  return callBot('/canva/status');
}

export function connectCanva(): Promise<{ url: string }> {
  return callBot('/canva/connect', { method: 'POST' });
}

export interface GeneratedFiche {
  description: string;
  keywords: string[];
  altText: string;
  category?: string;
}

// Demande à Claude de réécrire la fiche d'une publication importée depuis Canva
export function redescribeLink(linkId: string): Promise<GeneratedFiche> {
  return callBot(`/links/${encodeURIComponent(linkId)}/describe`, { method: 'POST' });
}

export function syncCanva(): Promise<{ started: boolean }> {
  return callBot('/canva/sync', { method: 'POST' });
}
