import { useEffect, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useLinks } from '../../hooks/useLinks';
import { Link, LinkStatus, LINK_STATUSES } from '../../types';
import { LinkList } from './LinkList';
import { LinkForm } from './LinkForm';
import { Plus, LogOut, AlertCircle, Eye } from 'lucide-react';
import {
  addLink,
  updateLink,
  updateLinkStatus,
  deleteLink,
  reorderLinks,
  migrateLinksWithoutStatus,
} from '../../lib/api';
import { auth } from '../../lib/firebase';
import { statusMeta } from '../../lib/linkStatus';

export function AdminDashboard() {
  const { links, loading, error, updateLinksOrder } = useLinks({ includeHidden: true });
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [reorderError, setReorderError] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const [activeTab, setActiveTab] = useState<LinkStatus>('pending');
  const [tabChosen, setTabChosen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    migrateLinksWithoutStatus()
      .then((count) => {
        if (count > 0) console.info(`${count} lien(s) existant(s) passé(s) en public`);
      })
      .catch((err) => console.error('Erreur lors de la migration des statuts:', err));
  }, []);

  const counts = LINK_STATUSES.reduce(
    (acc, status) => ({ ...acc, [status]: links.filter((l) => l.status === status).length }),
    {} as Record<LinkStatus, number>
  );

  // À l'ouverture : onglet « À valider » s'il y a quelque chose à traiter, sinon « Publics »
  useEffect(() => {
    if (loading || tabChosen) return;
    setActiveTab(counts.pending > 0 ? 'pending' : 'public');
  }, [loading, tabChosen, counts.pending]);

  const selectTab = (status: LinkStatus) => {
    setTabChosen(true);
    setActiveTab(status);
  };

  const visibleLinks = links.filter((l) => l.status === activeTab);

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
    selectTab(data.status);
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

  const handleStatusChange = async (link: Link, status: LinkStatus) => {
    setStatusError(false);
    try {
      await updateLinkStatus(link.id, status);
    } catch (err) {
      console.error('Erreur lors du changement de statut:', err);
      setStatusError(true);
    }
  };

  // L'onglet n'affiche qu'une partie des liens : on replace le nouvel ordre
  // dans les mêmes positions de la liste complète, puis on renumérote tout.
  const handleReorder = async (reorderedSubset: Link[]) => {
    setReorderError(false);
    const subsetIds = new Set(reorderedSubset.map((l) => l.id));
    const queue = [...reorderedSubset];
    const fullOrder = links.map((l) => (subsetIds.has(l.id) ? queue.shift()! : l));
    const renumbered = fullOrder.map((l, index) => ({ ...l, priority: index }));

    updateLinksOrder(renumbered);
    try {
      await reorderLinks(renumbered);
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
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Gestion des liens
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <RouterLink
              to="/"
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Eye className="w-5 h-5 mr-2" />
              Voir le site
            </RouterLink>
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

        {statusError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm font-medium">
              Le changement de statut n'a pas pu être enregistré.
            </p>
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
          <>
            <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200" role="tablist">
              {LINK_STATUSES.map((status) => {
                const { tabLabel, icon: Icon } = statusMeta[status];
                const isActive = status === activeTab;
                return (
                  <button
                    key={status}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => selectTab(status)}
                    className={`-mb-px flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      isActive
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tabLabel}
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        status === 'pending' && counts.pending > 0
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {counts[status]}
                    </span>
                  </button>
                );
              })}
            </div>

            {visibleLinks.length === 0 ? (
              <p className="py-12 text-center text-gray-500">
                {activeTab === 'pending'
                  ? 'Rien à valider pour le moment.'
                  : `Aucun lien ${statusMeta[activeTab].label.toLowerCase()}.`}
              </p>
            ) : (
              <LinkList
                links={visibleLinks}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReorder={handleReorder}
                onStatusChange={handleStatusChange}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
