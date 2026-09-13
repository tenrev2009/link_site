import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getYouTubeThumbnail(url: string): string | null {
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
    }
  }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return /youtu\.be\/|youtube\.com\/watch|youtube\.com\/embed/.test(url);
}
