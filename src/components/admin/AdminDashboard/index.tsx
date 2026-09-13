import { useState } from 'react';
import { useLinks } from '../../../hooks/useLinks';
import { Link } from '../../../types';
import { LinkList } from '../LinkList/LinkList';
import { LinkForm } from '../LinkEditor/LinkForm';
import { SiteConfig } from '../SiteConfig';
import { Plus, Settings } from 'lucide-react';
import { addLink, updateLink, deleteLink, reorderLinks } from '../../../lib/api';
import { Button } from '../../ui/Button';

export function AdminDashboard() {
  const { links, loading, error } = useLinks();
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  const handleSubmit = async (data: Omit<Link, 'id' | 'order' | 'createdAt' | 'updatedAt'>) => {
    if (editingLink) {
      await updateLink(editingLink.id, data);
    } else {
      await addLink({ ...data, order: links.length });
    }
    setIsFormOpen(false);
    setEditingLink(null);
  };

  const handleEdit = (link: Link) => {
    setEditingLink(link);
    setIsFormOpen(true);
    setShowConfig(false);
  };

  const handleDelete = async (link: Link) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce lien ?')) {
      await deleteLink(link.id);
    }
  };

  const handleReorder = async (reorderedLinks: Link[]) => {
    await reorderLinks(reorderedLinks);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {showConfig ? 'Configuration du site' : 'Gestion des liens'}
          </h1>
          <div className="flex gap-4">
            <Button
              onClick={() => {
                setShowConfig(!showConfig);
                setIsFormOpen(false);
                setEditingLink(null);
              }}
              className="flex items-center"
            >
              <Settings className="w-5 h-5 mr-2" />
              {showConfig ? 'Gérer les liens' : 'Configuration'}
            </Button>
            {!showConfig && (
              <Button
                onClick={() => setIsFormOpen(true)}
                className="flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                Ajouter un lien
              </Button>
            )}
          </div>
        </div>

        {showConfig ? (
          <SiteConfig />
        ) : (
          <>
            {isFormOpen ? (
              <div className="bg-white p-6 rounded-lg shadow mb-8">
                <h2 className="text-lg font-medium mb-4">
                  {editingLink ? 'Modifier le lien' : 'Ajouter un lien'}
                </h2>
                <LinkForm
                  link={editingLink || undefined}
                  onSubmit={handleSubmit}
                  onCancel={() => {
                    setIsFormOpen(false);
                    setEditingLink(null);
                  }}
                />
              </div>
            ) : (
              <LinkList
                links={links}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReorder={handleReorder}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}