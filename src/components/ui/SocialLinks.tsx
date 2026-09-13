import {
  Twitter,
  Facebook,
  Linkedin,
  Youtube,
  Globe,
  Instagram,
  Image as ImageIcon,
  Github,
  Home,
  Music2,
  Link as LinkIcon,
  FileText,
  FolderOpen,
  X,
} from 'lucide-react';
import { SocialLink, CustomIcon } from '../types';

interface SocialLinksProps {
  socialLinks: SocialLink[];
  customIcons?: CustomIcon[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Twitter,
  X,
  Facebook,
  Linkedin,
  Youtube,
  Globe,
  Home,
  Instagram,
  Music2,
  Github,
  FileText,
  FolderOpen,
  Image: ImageIcon,
};

export function SocialLinks({ socialLinks, customIcons = [] }: SocialLinksProps) {
  const customIconMap = new Map(customIcons.map((c) => [c.name.toLowerCase(), c.url]));

  const cleanUrl = (url?: string) => {
    if (!url) return '';
    return url.replace(/\\/g, '/');
  };

  return (
    <div className="flex flex-wrap gap-6 justify-center">
      {socialLinks.map((social, index) => {
        const url = cleanUrl(social.url);
        if (!url) return null;

        const customIcon = customIconMap.get((social.iconName || '').toLowerCase());
        const Icon = iconMap[social.iconName] || iconMap[social.iconName?.toLowerCase()] || LinkIcon;

        return (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-blue-600 transition-colors"
            title={social.platform}
          >
            {customIcon ? (
              <img src={customIcon} alt={social.platform} className="w-8 h-8" />
            ) : (
              <Icon className="w-8 h-8" />
            )}
          </a>
        );
      })}
    </div>
  );
}
