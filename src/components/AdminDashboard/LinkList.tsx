import { DragDropContext, Droppable, Draggable, type DropResult } from 'react-beautiful-dnd';
import { Link, LinkStatus, LINK_STATUSES } from '../../types';
import { Edit, Trash2, GripVertical, FolderOpen, FileText, Youtube, Github, Image as ImageIcon, Music2, Link as LinkIcon, Sparkles, Loader2 } from 'lucide-react';
import { getYouTubeThumbnail } from '../../lib/utils';
import { statusMeta } from '../../lib/linkStatus';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FolderOpen,
  FileText,
  Youtube,
  Github,
  Image: ImageIcon,
  Music2,
};

interface LinkListProps {
  links: Link[];
  onEdit: (link: Link) => void;
  onDelete: (link: Link) => void;
  onReorder: (links: Link[]) => void;
  onStatusChange: (link: Link, status: LinkStatus) => void;
  onRedescribe: (link: Link) => void;
  redescribingIds: Set<string>;
}

export function LinkList({
  links,
  onEdit,
  onDelete,
  onReorder,
  onStatusChange,
  onRedescribe,
  redescribingIds,
}: LinkListProps) {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || result.destination.index === result.source.index) return;

    const items = Array.from(links);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onReorder(items);
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <GripVertical className="w-4 h-4" />
        <span>Glissez-déposez les liens pour les réordonner</span>
      </div>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="links">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`space-y-2 transition-colors rounded-lg p-2 ${snapshot.isDraggingOver ? 'bg-blue-50' : ''}`}
            >
              {links.map((link, index) => {
                const Icon = iconMap[link.iconName] || LinkIcon;
                const ytThumb = getYouTubeThumbnail(link.url);
                const thumb = link.imageUrl || ytThumb || '';
                return (
                  <Draggable key={link.id} draggableId={link.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-lg shadow transition-all ${
                          snapshot.isDragging
                            ? 'shadow-lg ring-2 ring-blue-400 scale-[1.02]'
                            : 'hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <button
                            {...provided.dragHandleProps}
                            className="flex-shrink-0 p-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
                            aria-label="Glisser pour réordonner"
                          >
                            <GripVertical className="w-5 h-5" />
                          </button>
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={link.title}
                              className="w-16 h-16 object-cover rounded flex-shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-8 h-8 text-blue-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="font-medium truncate">{link.title}</h3>
                            <p className="text-sm text-gray-500">
                              {link.category} · priorité {link.priority}
                              {link.descriptionSource === 'ai' && ' · ✨ fiche rédigée par Claude'}
                            </p>
                            {link.aiError && (
                              <p className="text-xs text-red-600 truncate" title={link.aiError}>
                                Fiche non rédigée : {link.aiError}
                              </p>
                            )}
                          </div>
                        </div>
                        <div
                          className="flex rounded-md border border-gray-200 overflow-hidden flex-shrink-0"
                          role="group"
                          aria-label="Statut du lien"
                        >
                          {LINK_STATUSES.map((status) => {
                            const { label, icon: StatusIcon, activeClass } = statusMeta[status];
                            const isActive = link.status === status;
                            return (
                              <button
                                key={status}
                                onClick={() => !isActive && onStatusChange(link, status)}
                                aria-pressed={isActive}
                                title={label}
                                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                                  isActive
                                    ? activeClass
                                    : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                                }`}
                              >
                                <StatusIcon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex space-x-2 flex-shrink-0">
                          {link.source === 'canva-folder' && (
                            <button
                              onClick={() => onRedescribe(link)}
                              disabled={redescribingIds.has(link.id)}
                              title="Régénérer la fiche avec Claude"
                              aria-label="Régénérer la fiche avec Claude"
                              className="p-2 text-gray-600 hover:text-violet-600 transition-colors disabled:opacity-50"
                            >
                              {redescribingIds.has(link.id) ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Sparkles className="w-5 h-5" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => onEdit(link)}
                            className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => onDelete(link)}
                            className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
