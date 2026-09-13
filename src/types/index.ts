export interface Link {
  id: string;
  title: string;
  url: string;
  description: string;
  imageUrl: string;
  category: string;
  iconName: string;
  priority: number;
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
