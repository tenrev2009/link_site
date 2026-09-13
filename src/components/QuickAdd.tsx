import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Link as LinkIcon, Loader2 } from 'lucide-react';
import { LinkStatus } from '../types';
import { addLinkFromUrl, AddFromUrlResult } from '../lib/botApi';
import { statusMeta } from '../lib/linkStatus';

interface QuickAddProps {
  initialText?: string;
  // Envoi immédiat à l'ouverture (page de partage Android)
  autoSubmit?: boolean;
  onAdded?: (result: AddFromUrlResult) => void;
}

export function QuickAdd({ initialText = '', autoSubmit = false, onAdded }: QuickAddProps) {
  const [text, setText] = useState(initialText);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<LinkStatus>('pending');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<AddFromUrlResult | null>(null);
  const [error, setError] = useState('');
  const autoSubmitted = useRef(false);

  const submit = useCallback(async () => {
    if (!text.trim()) return;
    setSending(true);
    setError('');
    setResult(null);
    try {
      const added = await addLinkFromUrl({ text, category: category || undefined, status });
      setResult(added);
      if (added.created) setText('');
      onAdded?.(added);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setSending(false);
    }
  }, [text, category, status, onAdded]);

  useEffect(() => {
    if (autoSubmit && initialText && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit();
    }
  }, [autoSubmit, initialText, submit]);

  const inputClass =
    'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-3 md:flex-row md:items-end"
      >
        <label className="flex-1">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Ajouter depuis un lien
          </span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Lien public Canva, vidéo YouTube, site web…"
            className={inputClass}
          />
        </label>
        <label className="md:w-40">
          <span className="block text-sm font-medium text-gray-700 mb-1">Catégorie</span>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Automatique"
            className={inputClass}
          />
        </label>
        <label className="md:w-36">
          <span className="block text-sm font-medium text-gray-700 mb-1">Statut</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as LinkStatus)}
            className={inputClass}
          >
            <option value="pending">{statusMeta.pending.label}</option>
            <option value="private">{statusMeta.private.label}</option>
            <option value="public">{statusMeta.public.label}</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
          {sending ? 'Récupération…' : 'Ajouter'}
        </button>
      </form>

      {error && (
        <div className="mt-3 flex items-start gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div
          className={`mt-3 flex items-center gap-3 p-3 text-sm rounded-md border ${
            result.created
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {result.link.imageUrl ? (
            <img
              src={result.link.imageUrl}
              alt=""
              className="w-20 h-12 object-cover rounded flex-shrink-0 bg-white"
            />
          ) : result.created ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <Info className="w-5 h-5 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-medium truncate">{result.link.title}</p>
            <p>
              {result.created
                ? `Ajouté dans « ${statusMeta[result.link.status].label} ».`
                : `Déjà présent (statut : ${statusMeta[result.link.status].label}).`}
              {result.metadataError && ' Page illisible : complétez le titre et l\'image à la main.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
