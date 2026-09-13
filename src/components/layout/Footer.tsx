import { SocialLinks } from '../ui/SocialLinks';
import { useSiteConfig } from '../../hooks/useSiteConfig';

export function Footer() {
  const { config } = useSiteConfig();

  return (
    <footer className="bg-gray-50 border-t">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4">
          {config?.socialLinks && config.socialLinks.length > 0 && (
            <SocialLinks
              socialLinks={config.socialLinks}
              customIcons={config.customIcons}
            />
          )}
          {config?.copyright && (
            <p className="text-sm text-gray-400 text-center">
              {config.copyright}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
