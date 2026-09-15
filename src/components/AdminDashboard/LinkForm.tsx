import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from '../../types';
import { joinCategories } from '../../lib/categories';

const linkSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  url: z.string().min(1, 'L\'URL est requise'),
  description: z.string().optional().default(''),
  imageUrl: z.string().optional().default(''),
  category: z.string().min(1, 'La catégorie est requise'),
  iconName: z.string().optional().default('FolderOpen'),
  priority: z.number().int().optional().default(0),
  status: z.enum(['pending', 'private', 'public']),
  keywordsText: z.string().optional().default(''),
  altText: z.string().optional().default(''),
});

type LinkFormData = z.infer<typeof linkSchema>;

export type LinkFormValues = Omit<LinkFormData, 'keywordsText'> & { keywords: string[] };

interface LinkFormProps {
  link?: Link;
  onSubmit: (data: LinkFormValues) => Promise<void>;
  onCancel: () => void;
}

const iconOptions = [
  'FolderOpen',
  'FileText',
  'Youtube',
  'Github',
  'Image',
  'Music2',
  'Link',
];

export function LinkForm({ link, onSubmit, onCancel }: LinkFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LinkFormData>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      title: link?.title ?? '',
      url: link?.url ?? '',
      description: link?.description ?? '',
      imageUrl: link?.imageUrl ?? '',
      category: link?.category ?? '',
      iconName: link?.iconName ?? 'FolderOpen',
      priority: link?.priority ?? 0,
      status: link?.status ?? 'public',
      keywordsText: (link?.keywords ?? []).join(', '),
      altText: link?.altText ?? '',
    },
  });

  const submit = ({ keywordsText, ...values }: LinkFormData) =>
    onSubmit({
      ...values,
      category: joinCategories(values.category),
      keywords: keywordsText
        .split(',')
        .map((keyword) => keyword.trim().toLowerCase())
        .filter(Boolean),
    });

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Titre
        </label>
        <input
          type="text"
          {...register('title')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          URL
        </label>
        <input
          type="text"
          {...register('url')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
        {errors.url && (
          <p className="mt-1 text-sm text-red-600">{errors.url.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          {...register('description')}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Mots-clés (séparés par des virgules)
        </label>
        <input
          type="text"
          {...register('keywordsText')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Texte alternatif de l'image
        </label>
        <input
          type="text"
          {...register('altText')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          URL de l'image (optionnel)
        </label>
        <input
          type="text"
          {...register('imageUrl')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Catégories (séparées par des virgules)
        </label>
        <input
          type="text"
          {...register('category')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
        {errors.category && (
          <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Icône
        </label>
        <select
          {...register('iconName')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        >
          {iconOptions.map((icon) => (
            <option key={icon} value={icon}>{icon}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Statut
        </label>
        <select
          {...register('status')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        >
          <option value="public">Public : visible par tout le monde</option>
          <option value="private">Privé : visible uniquement par vous</option>
          <option value="pending">À valider</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Priorité (ordre d'affichage)
        </label>
        <input
          type="number"
          {...register('priority', { valueAsNumber: true })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
