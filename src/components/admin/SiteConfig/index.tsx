import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useSiteConfig } from '../../../hooks/useSiteConfig';
import { SiteConfigForm } from './SiteConfigForm';
import { Spinner } from '../../ui/Spinner';

export function SiteConfig() {
  const { config, loading, error } = useSiteConfig();
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (data: any) => {
    try {
      await setDoc(doc(db, 'config', 'site'), data);
    } catch (err) {
      setSaveError('Erreur lors de l\'enregistrement de la configuration');
      console.error('Error saving site config:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-lg font-medium mb-6">Configuration du site</h2>
      {saveError && (
        <div className="mb-4 text-sm text-red-600">{saveError}</div>
      )}
      <SiteConfigForm config={config} onSubmit={handleSubmit} />
    </div>
  );
}