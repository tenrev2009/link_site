// Un lien peut avoir plusieurs catégories, séparées par des virgules : « AI, Sketchup »
export function splitCategories(value: string | null | undefined): string[] {
  const seen = new Set<string>();
  return String(value ?? '')
    .split(',')
    .map((category) => category.trim())
    .filter((category) => {
      const key = category.toLowerCase();
      if (!category || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function joinCategories(value: string | null | undefined): string {
  return splitCategories(value).join(', ');
}
