import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '../../../types';
import { Button } from '../../ui/Button';
import { LinkFormFields } from './LinkFormFields';
import { linkSchema, LinkFormData } from './types';

interface LinkFormProps {
  link?: Link;
  onSubmit: (data: LinkFormData) => Promise<void>;
  onCancel: () => void;
}

export function LinkForm({ link, onSubmit, onCancel }: LinkFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LinkFormData>({
    resolver: zodResolver(linkSchema),
    defaultValues: link,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <LinkFormFields register={register} errors={errors} />

      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          onClick={onCancel}
          className="bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        >
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}