import { Link } from '../../../types';
import { Edit, Trash2 } from 'lucide-react';
import { Button } from '../../ui/Button';

interface LinkListItemProps {
  link: Link;
  onEdit: (link: Link) => void;
  onDelete: (link: Link) => void;
  dragHandleProps?: any;
}

export function LinkListItem({ 
  link, 
  onEdit, 
  onDelete,
  dragHandleProps 
}: LinkListItemProps) {
  return (
    <div
      {...dragHandleProps}
      className="flex items-center justify-between p-4 bg-white rounded-lg shadow"
    >
      <div className="flex items-center space-x-4">
        <img
          src={link.imageUrl}
          alt={link.title}
          className="w-16 h-16 object-cover rounded"
        />
        <div>
          <h3 className="font-medium">{link.title}</h3>
          <p className="text-sm text-gray-500">{link.category}</p>
        </div>
      </div>
      <div className="flex space-x-2">
        <Button
          onClick={() => onEdit(link)}
          className="p-2 text-gray-600 hover:text-blue-600 bg-transparent"
        >
          <Edit className="w-5 h-5" />
        </Button>
        <Button
          onClick={() => onDelete(link)}
          className="p-2 text-gray-600 hover:text-red-600 bg-transparent"
        >
          <Trash2 className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}