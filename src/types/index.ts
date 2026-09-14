// pending : en attente de validation (admin uniquement)
// private : visible uniquement par l'admin connecté
// public  : visible par tout le monde
export type LinkStatus = 'pending' | 'private' | 'public';

export const LINK_STATUSES: LinkStatus[] = ['pending', 'private', 'public'];

export interface Link {
  id: string;
  title: string;
  url: string;
  description: string;
  imageUrl: string;
  category: string;
  iconName: string;
  priority: number;
  status: LinkStatus;
  // Fiche rédigée par Claude pour les publications Canva
  keywords?: string[];
  altText?: string;
  descriptionSource?: 'ai' | 'manual' | null;
  aiError?: string | null;
  source?: string;
  mediaType?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SocialLink {
  platform: string;
  url: string;
  iconName: string;
}

export interface CustomIcon {
  name: string;
  url: string;
}

export interface SiteConfig {
  id?: string;
  title: string;
  description: string;
  logoUrl?: string;
  copyright?: string;
  socialLinks: SocialLink[];
  customIcons?: CustomIcon[];
}
