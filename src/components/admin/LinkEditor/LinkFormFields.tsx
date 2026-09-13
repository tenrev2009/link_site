import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Input } from '../../ui/Input';
import { LinkFormData } from './types';

interface LinkFormFieldsProps {
  register: UseFormRegister<LinkFormData>;
  errors: FieldErrors<LinkFormData>;
}

export function LinkFormFields({ register, errors }: LinkFormFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Titre
        </label>
        <Input
          type="text"
          {...register('title')}
          className="w-full"
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL
        </label>
        <Input
          type="url"
          {...register('url')}
          className="w-full"
        />
        {errors.url && (
          <p className="mt-1 text-sm text-red-600">{errors.url.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          {...register('description')}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm 
                     focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL de l'image
        </label>
        <Input
          type="url"
          {...register('imageUrl')}
          className="w-full"
        />
        {errors.imageUrl && (
          <p className="mt-1 text-sm text-red-600">{errors.imageUrl.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Catégorie
        </label>
        <Input
          type="text"
          {...register('category')}
          className="w-full"
        />
        {errors.category && (
          <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
        )}
      </div>
    </>
  );
}