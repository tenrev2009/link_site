import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Link } from '../../../types';
import { LinkListItem } from './LinkListItem';

interface LinkListProps {
  links: Link[];
  onEdit: (link: Link) => void;
  onDelete: (link: Link) => void;
  onReorder: (links: Link[]) => void;
}

export function LinkList({ links, onEdit, onDelete, onReorder }: LinkListProps) {
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(links);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const reorderedLinks = items.map((item, index) => ({
      ...item,
      order: index,
    }));

    onReorder(reorderedLinks);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="links">
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="space-y-2"
          >
            {links.map((link, index) => (
              <Draggable key={link.id} draggableId={link.id} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                  >
                    <LinkListItem
                      link={link}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      dragHandleProps={provided.dragHandleProps}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}