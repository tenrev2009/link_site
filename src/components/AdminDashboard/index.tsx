import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useLinks } from '../../hooks/useLinks';
import { Link } from '../../types';
import { LinkList } from './LinkList';
import { LinkForm } from './LinkForm';
import { Plus, LogOut, AlertCircle } from 'lucide-react';
import { addLink, updateLink, deleteLink, reorderLinks } from '../../lib/api';
import { auth } from '../../lib/firebase';

export function AdminDashboard() {
  const { links, loading, error, updateLinksOrder } = useLinks();
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [reorderError, setReorderError] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error('Erreur lors de la déconnexion:', err);
    }
  };

  const handleSubmit = async (data: Omit<Link, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingLink) {
      await updateLink(editingLink.id, data);
    } else {
      await addLink({ ...data, priority: links.length });
    }
    setIsFormOpen(false);
    setEditingLink(null);
  };

  const handleEdit = (link: Link) => {
    setEditingLink(link);
    setIsFormOpen(true);
  };

  const handleDelete = async (link: Link) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce lien ?')) {
      await deleteLink(link.id);
    }
  };

  const handleReorder = async (reorderedLinks: Link[]) => {
    setReorderError(false);
    updateLinksOrder(reorderedLinks);
    try {
      await reorderLinks(reorderedLinks);
    } catch (err) {
      console.error('Erreur lors du réordonnancement:', err);
      setReorderError(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Gestion des liens
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsFormOpen(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Ajouter un lien
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Déconnexion
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-800 text-sm font-medium">
                {error}
              </p>
              <p className="text-amber-700 text-xs mt-1">
                Vérifiez que vos règles Firestore autorisent la lecture des données.
              </p>
            </div>
          </div>
        )}

        {reorderError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 text-sm font-medium">
                Le réordonnancement n'a pas pu être sauvegardé.
              </p>
              <p className="text-red-700 text-xs mt-1">
                Vérifiez que vos règles Firestore autorisent la mise à jour de la collection « links » pour les utilisateurs connectés.
              </p>
            </div>
          </div>
        )}

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
      </div>
    </div>
  );
}
