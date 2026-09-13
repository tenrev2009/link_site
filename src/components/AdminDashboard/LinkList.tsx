import { DragDropContext, Droppable, Draggable, type DropResult } from 'react-beautiful-dnd';
import { Link } from '../../types';
import { Edit, Trash2, GripVertical, FolderOpen, FileText, Youtube, Github, Image as ImageIcon, Music2, Link as LinkIcon } from 'lucide-react';
import { getYouTubeThumbnail } from '../../lib/utils';

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
}

export function LinkList({ links, onEdit, onDelete, onReorder }: LinkListProps) {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || result.destination.index === result.source.index) return;

    const items = Array.from(links);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const reorderedLinks = items.map((item, index) => ({
      ...item,
      priority: index,
    }));

    onReorder(reorderedLinks);
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
                        className={`flex items-center justify-between p-4 bg-white rounded-lg shadow transition-all ${
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
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2 flex-shrink-0">
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
