import { useLinks } from '../hooks/useLinks';
import { useSiteConfig } from '../hooks/useSiteConfig';
import { useAuth } from '../hooks/useAuth';
import { splitCategories } from '../lib/categories';
import { Layout } from './layout/Layout';
import { LinkCard } from './ui/LinkCard';
import { CategoryFilter } from './ui/CategoryFilter';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Lock, Link as LinkIcon, Eye } from 'lucide-react';

const LOCAL_LOGO = '/logo.png';

export function PublicLinks() {
  const { user, loading: authLoading } = useAuth();
  const { links: allLinks, loading: linksLoading, error: linksError } = useLinks({
    includeHidden: !!user,
  });
  const { config, loading: configLoading, error: configError } = useSiteConfig();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // Logo hébergé par le site (public/logo.png) ; l'adresse des réglages Firebase sert de secours,
  // et le logo est masqué si aucune image ne se charge
  const [logoSrc, setLogoSrc] = useState<string | null>(LOCAL_LOGO);

  // Connecté : aperçu des liens privés en plus des publics. Les liens à valider restent dans l'admin.
  const links = allLinks.filter(
    (link) => link.status === 'public' || (user && link.status === 'private')
  );
  const privateCount = links.filter((link) => link.status === 'private').length;

  if (authLoading || linksLoading || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const categories = Array.from(new Set(links.flatMap((link) => splitCategories(link.category))));
  const filteredLinks = selectedCategory
    ? links.filter((link) => splitCategories(link.category).includes(selectedCategory))
    : links;

  const hasError = linksError || configError;

  return (
    <Layout>
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          {config && (
            <div className="text-center mb-12">
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt="biblio3d"
                  className="h-32 sm:h-40 w-auto mx-auto mb-6"
                  onError={() => setLogoSrc(logoSrc === LOCAL_LOGO && config.logoUrl ? config.logoUrl : null)}
                />
              )}
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                {config.title}
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto whitespace-pre-line">
                {config.description}
              </p>
            </div>
          )}

          {!config && !configError && (
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-6">
                <LinkIcon className="w-8 h-8 text-blue-600" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Mes Liens
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Retrouvez tous mes liens en un seul endroit
              </p>
            </div>
          )}

          {user && (
            <div className="max-w-2xl mx-auto mb-8 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center gap-2 text-sm text-slate-700">
              <Eye className="w-4 h-4 flex-shrink-0" />
              <span>
                Aperçu administrateur : {privateCount} lien{privateCount > 1 ? 's' : ''} privé
                {privateCount > 1 ? 's' : ''} visible{privateCount > 1 ? 's' : ''} uniquement par vous.
              </span>
              <RouterLink to="/admin" className="font-medium text-blue-600 hover:text-blue-800">
                Gérer
              </RouterLink>
            </div>
          )}

          {hasError && (
            <div className="max-w-md mx-auto mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <p className="text-amber-800 text-sm">
                Certains éléments n'ont pas pu être chargés.
              </p>
            </div>
          )}

          {links.length > 0 && (
            <>
              <CategoryFilter
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredLinks.map((link) => (
                  <LinkCard key={link.id} link={link} />
                ))}
              </div>
            </>
          )}

          {links.length === 0 && !linksError && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                Aucun lien pour le moment.
              </p>
            </div>
          )}
        </div>

        <div className="text-center pb-8">
          <RouterLink
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-blue-600 transition-colors"
          >
            <Lock className="w-4 h-4" />
            Admin
          </RouterLink>
        </div>
      </div>
    </Layout>
  );
}
