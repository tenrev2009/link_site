import { Link } from '../types';
import { BOT_API_URL } from './botApi';

// Les pages /p/<id> sont servies par links-bot : les réseaux sociaux y lisent l'aperçu (image, titre, descriptif)
export const SHARE_BASE_URL: string = import.meta.env.VITE_SHARE_BASE_URL ?? BOT_API_URL;

export function postUrl(link: Pick<Link, 'id'>): string {
  return `${SHARE_BASE_URL}/p/${encodeURIComponent(link.id)}`;
}

export interface ShareTarget {
  id: 'facebook' | 'linkedin' | 'x' | 'whatsapp' | 'pinterest' | 'instagram';
  label: string;
  color: string;
  // null : pas de lien de partage web (Instagram), on copie le lien
  href: string | null;
}

export function shareTargets(link: Pick<Link, 'id' | 'title' | 'imageUrl'>): ShareTarget[] {
  const url = postUrl(link);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(link.title);
  return [
    { id: 'facebook', label: 'Facebook', color: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { id: 'x', label: 'X', color: '#000000', href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { id: 'whatsapp', label: 'WhatsApp', color: '#25D366', href: `https://wa.me/?text=${encodeURIComponent(`${link.title} ${url}`)}` },
    {
      id: 'pinterest',
      label: 'Pinterest',
      color: '#E60023',
      href: `https://pinterest.com/pin/create/button/?url=${u}&description=${t}${
        link.imageUrl ? `&media=${encodeURIComponent(link.imageUrl)}` : ''
      }`,
    },
    { id: 'instagram', label: 'Instagram', color: '#C13584', href: null },
  ];
}
