import { auth } from './firebase';
import { Link, LinkStatus } from '../types';

// Service links-bot (dossier bot/ du dépôt), déployé à part dans Coolify
export const BOT_API_URL: string = import.meta.env.VITE_BOT_API_URL ?? 'https://links-api.biblio3d.net';

export interface AddFromUrlResult {
  created: boolean;
  metadataError?: string | null;
  link: Pick<Link, 'id' | 'title' | 'url' | 'imageUrl' | 'category' | 'status'>;
}

export async function addLinkFromUrl(input: {
  text: string;
  category?: string;
  status?: LinkStatus;
}): Promise<AddFromUrlResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('Vous devez être connecté.');

  const token = await user.getIdToken();

  let response: Response;
  try {
    response = await fetch(`${BOT_API_URL}/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error('Le service d\'ajout automatique est injoignable.');
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? `Erreur ${response.status}`);
  }
  return body as AddFromUrlResult;
}
