import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Facebook, Instagram, Linkedin, MessageCircle, Pin, Share2 } from 'lucide-react';
import { Link } from '../../types';
import { postUrl, shareTargets, ShareTarget } from '../../lib/share';

const targetIcons: Record<ShareTarget['id'], React.ComponentType<{ className?: string }> | null> = {
  facebook: Facebook,
  linkedin: Linkedin,
  x: null,
  whatsapp: MessageCircle,
  pinterest: Pin,
  instagram: Instagram,
};

// Téléphone ou tablette : on ouvre directement le menu de partage du système (WhatsApp, Instagram…)
function prefersNativeShare() {
  return typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

interface ShareButtonProps {
  link: Pick<Link, 'id' | 'title' | 'imageUrl'>;
}

export function ShareButton({ link }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const url = postUrl(link);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const handleClick = async () => {
    if (prefersNativeShare()) {
      try {
        await navigator.share({ title: link.title, url });
        return;
      } catch (err) {
        // Partage annulé par l'utilisateur : on ne fait rien
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    setNotice('');
    setOpen((value) => !value);
  };

  const copyLink = async (message: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setNotice(message);
    } catch {
      setNotice(url);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={handleClick}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Partager « ${link.title} »`}
        title="Partager"
        className="text-gray-500 hover:text-blue-700"
      >
        <Share2 className="w-5 h-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-60 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
        >
          {shareTargets(link).map((target) => {
            const Icon = targetIcons[target.id];
            const content = (
              <>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white text-xs font-bold"
                  style={{ backgroundColor: target.color }}
                >
                  {Icon ? <Icon className="w-4 h-4" /> : 'X'}
                </span>
                {target.label}
              </>
            );
            const className =
              'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100';
            return target.href ? (
              <a
                key={target.id}
                role="menuitem"
                href={target.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
                onClick={() => setOpen(false)}
              >
                {content}
              </a>
            ) : (
              <button
                key={target.id}
                role="menuitem"
                type="button"
                className={className}
                onClick={() => copyLink('Lien copié : collez-le dans votre story, votre bio ou un message Instagram.')}
              >
                {content}
              </button>
            );
          })}
          <button
            role="menuitem"
            type="button"
            className="mt-1 flex w-full items-center gap-3 rounded-md border-t border-gray-100 px-2 py-1.5 pt-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => copyLink('Lien copié.')}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-700 text-white">
              {notice === 'Lien copié.' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </span>
            Copier le lien
          </button>
          {notice && (
            <p role="status" className="px-2 pt-2 text-xs text-green-700 break-words">
              {notice}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
