import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, FolderSync, Loader2, RefreshCw } from 'lucide-react';
import { CanvaStatus, connectCanva, getCanvaStatus, syncCanva } from '../lib/botApi';

const SYNC_POLL_MS = 3000;

function formatAgo(isoDate: string | null) {
  if (!isoDate) return 'jamais';
  const minutes = Math.round((Date.now() - new Date(isoDate).getTime()) / 60_000);
  if (minutes < 1) return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `le ${new Date(isoDate).toLocaleDateString('fr-FR')}`;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Une erreur est survenue.');

// Import automatique du dossier Canva « Site » (service links-bot)
export function CanvaPanel() {
  const [status, setStatus] = useState<CanvaStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getCanvaStatus());
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Pendant une synchro (exports vidéo possibles), on suit l'avancement
  useEffect(() => {
    if (!status?.syncing) return;
    const timer = setInterval(refresh, SYNC_POLL_MS);
    return () => clearInterval(timer);
  }, [status?.syncing, refresh]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const { url } = await connectCanva();
      window.location.href = url;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setBusy(true);
    try {
      await syncCanva();
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const result = status?.lastResult;
  const buttonClass =
    'flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50';

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
            <FolderSync className="w-5 h-5 text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">Import automatique Canva</p>
            <p className="text-sm text-gray-500">
              {!status && !error && 'Chargement…'}
              {status && !status.configured && 'Pas encore activé sur le serveur (secret Canva manquant).'}
              {status?.configured && !status.connected && 'Non connecté.'}
              {status?.connected &&
                (status.syncing
                  ? 'Synchronisation en cours… (les vidéos peuvent prendre quelques minutes)'
                  : `Dossier « Site » vérifié toutes les ${status.syncMinutes} min · dernière vérification ${formatAgo(status.lastSyncAt)}`)}
            </p>
          </div>
        </div>

        {status?.configured && !status.connected && (
          <button
            onClick={handleConnect}
            disabled={busy}
            className={`${buttonClass} text-white bg-violet-600 hover:bg-violet-700`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Connecter Canva
          </button>
        )}
        {status?.connected && (
          <button
            onClick={handleSync}
            disabled={busy || status.syncing}
            className={`${buttonClass} text-gray-700 bg-white border border-gray-300 hover:bg-gray-50`}
          >
            {status.syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Synchroniser maintenant
          </button>
        )}
      </div>

      {status?.connected && result && !status.syncing && (
        <p className="mt-3 text-sm text-gray-600">
          Dernière vérification : {result.designs} publication{result.designs > 1 ? 's' : ''} ·{' '}
          {result.imported} nouvelle{result.imported > 1 ? 's' : ''} · {result.updated} mise{result.updated > 1 ? 's' : ''} à
          jour
          {status.aiEnabled
            ? ` · ${result.described ?? 0} fiche${(result.described ?? 0) > 1 ? 's' : ''} rédigée${(result.described ?? 0) > 1 ? 's' : ''} par Claude`
            : ' · fiches Claude désactivées (clé API absente)'}
        </p>
      )}

      {status?.connected && (result?.warnings?.length ?? 0) > 0 && (
        <div className="mt-3 p-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
          {result?.warnings?.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}

      {(error || status?.lastError || (result?.errors.length ?? 0) > 0) && (
        <div className="mt-3 flex items-start gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            {error && <p>{error}</p>}
            {status?.lastError && <p>{status.lastError}</p>}
            {result?.errors.map((item) => (
              <p key={item.designId}>
                <span className="font-medium">{item.title || item.designId}</span> : {item.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {status?.connected && (
        <p className="mt-3 text-xs text-gray-400">
          Rangez vos publications dans <span className="font-medium">Site/Images</span>,{' '}
          <span className="font-medium">Site/Vidéos</span> ou <span className="font-medium">Site/PDF</span> : le format
          d'export suit le sous-dossier.
        </p>
      )}
    </div>
  );
}
