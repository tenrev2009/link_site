import { z } from 'zod';

export const linkSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  url: z.string().url('URL invalide'),
  description: z.string().min(1, 'La description est requise'),
  imageUrl: z.string().url('URL de l\'image invalide'),
  category: z.string().min(1, 'La catégorie est requise'),
});

export type LinkFormData = z.infer<typeof linkSchema>;