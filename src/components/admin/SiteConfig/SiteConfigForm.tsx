{
  // Ajout des nouveaux champs dans le schéma de validation
  const siteConfigSchema = z.object({
    titre: z.string().min(1, 'Le titre est requis'),
    description: z.string().min(1, 'La description est requise'),
    logo: z.string().url('URL du logo invalide').optional().or(z.literal('')),
    lienssociaux: z.object({
      twitter: z.string().url('URL Twitter invalide').optional().or(z.literal('')),
      facebook: z.string().url('URL Facebook invalide').optional().or(z.literal('')),
      linkedin: z.string().url('URL LinkedIn invalide').optional().or(z.literal('')),
      youtube: z.string().url('URL YouTube invalide').optional().or(z.literal('')),
      site: z.string().url('URL du site invalide').optional().or(z.literal('')),
      instagram: z.string().url('URL Instagram invalide').optional().or(z.literal('')),
      pinterest: z.string().url('URL Pinterest invalide').optional().or(z.literal(''))
    }).optional()
  });

  // ... reste du code ...

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ... autres champs ... */}
      
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Réseaux sociaux</h3>
        
        {/* ... autres réseaux sociaux ... */}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Instagram
          </label>
          <Input
            type="url"
            {...register('lienssociaux.instagram')}
            className="w-full"
            placeholder="https://instagram.com/votre-compte"
          />
          {errors.lienssociaux?.instagram && (
            <p className="mt-1 text-sm text-red-600">{errors.lienssociaux.instagram.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pinterest
          </label>
          <Input
            type="url"
            {...register('lienssociaux.pinterest')}
            className="w-full"
            placeholder="https://pinterest.com/votre-compte"
          />
          {errors.lienssociaux?.pinterest && (
            <p className="mt-1 text-sm text-red-600">{errors.lienssociaux.pinterest.message}</p>
          )}
        </div>
      </div>

      {/* ... reste du formulaire ... */}
    </form>
  );
}