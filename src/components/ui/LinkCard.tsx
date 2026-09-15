import { Link } from '../../types';
import { ExternalLink, FolderOpen, FileText, Youtube, Github, Image as ImageIcon, Music2, Link as LinkIcon, Lock, Play } from 'lucide-react';
import { getYouTubeThumbnail, isYouTubeUrl } from '../../lib/utils';
import { useState } from 'react';
import { ShareButton } from './ShareButton';
import { splitCategories } from '../../lib/categories';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FolderOpen,
  FileText,
  Youtube,
  Github,
  Image: ImageIcon,
  Music2,
};

interface LinkCardProps {
  link: Link;
}

export function LinkCard({ link }: LinkCardProps) {
  const Icon = iconMap[link.iconName] || LinkIcon;
  const ytThumb = getYouTubeThumbnail(link.url);
  const [imgError, setImgError] = useState(false);
  const showImage = (link.imageUrl || ytThumb) && !imgError;
  const imageUrl = link.imageUrl || ytThumb || '';
  const isYouTube = isYouTubeUrl(link.url);

  return (
    // Pas d'overflow-hidden sur la carte : le menu de partage doit pouvoir déborder
    <div className="group relative bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
      {link.status === 'private' && (
        <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-slate-800/80 rounded-full">
          <Lock className="w-3 h-3" />
          Privé
        </span>
      )}
      {/* La vignette et le titre ouvrent directement la vidéo, l'image, le PDF ou le lien */}
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={-1}
        aria-hidden="true"
        className="aspect-video overflow-hidden rounded-t-lg bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center"
      >
        {showImage ? (
          <img
            src={imageUrl}
            alt={link.altText || link.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <Icon className="w-16 h-16 text-blue-400" />
        )}
      </a>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900">
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-700 hover:underline">
              {link.title}
            </a>
          </h3>
          <div className="flex items-center gap-3 flex-shrink-0">
            {link.status === 'public' && <ShareButton link={link} />}
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ouvrir « ${link.title} »`}
              title="Ouvrir"
              className="text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </div>
        {link.description && (
          <p className="mt-2 text-sm text-gray-600 line-clamp-3">{link.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {splitCategories(link.category).map((category) => (
            <span
              key={category}
              className="inline-block px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-full"
            >
              {category}
            </span>
          ))}
          {/\.mp4(\?|$)/i.test(link.url) && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-violet-700 bg-violet-50 rounded-full">
              <Play className="w-3 h-3" />
              Vidéo
            </span>
          )}
          {/\.pdf(\?|$)/i.test(link.url) && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-700 bg-orange-50 rounded-full">
              <FileText className="w-3 h-3" />
              PDF
            </span>
          )}
          {isYouTube && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-full">
              <Youtube className="w-3 h-3" />
              YouTube
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
