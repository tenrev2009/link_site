import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { QuickAdd } from './QuickAdd';

// Cible du menu « Partager » d'Android (voir share_target dans public/manifest.webmanifest)
export function SharePage() {
  const [params] = useSearchParams();
  const shared = ['url', 'text', 'title']
    .map((key) => params.get(key))
    .filter(Boolean)
    .join(' ');

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Share2 className="w-5 h-5 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Envoyer un lien au site</h1>
        </div>

        <QuickAdd initialText={shared} autoSubmit={Boolean(shared)} />

        <div className="flex gap-3 text-sm">
          <RouterLink
            to="/admin"
            className="flex-1 text-center px-4 py-2 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Ouvrir l'admin
          </RouterLink>
          <RouterLink
            to="/"
            className="flex-1 text-center px-4 py-2 font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Voir le site
          </RouterLink>
        </div>
      </div>
    </div>
  );
}
