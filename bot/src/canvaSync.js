// Surveillance du dossier Canva : chaque nouveau design devient un lien « À valider »
import { config } from './config.js';
import { downloadToMedia, removeMedia } from './media.js';
import { shareLinkId } from './links.js';

// Repère dans le nom du design pour l'exporter en vidéo : « [vidéo] », « [video] » ou « 🎬 »
const VIDEO_MARKER = /\[\s*vid[ée]o\s*\]|🎬/giu;
const DEFAULT_TITLE = 'Design Canva';
const MAX_ATTEMPTS = 3;
const MAX_REPORTED_ERRORS = 20;

export function parseDesignTitle(rawTitle) {
  const raw = String(rawTitle ?? '');
  const isVideo = raw.search(VIDEO_MARKER) !== -1;
  const title = raw.replace(VIDEO_MARKER, '').replace(/\s{2,}/g, ' ').trim();
  return { isVideo, title: title || DEFAULT_TITLE };
}

const errorMessage = (err) => (err instanceof Error ? err.message : String(err));

export function createCanvaSync({ db, canva }) {
  const imports = db.collection('canvaImports');
  const links = db.collection('links');
  const syncDoc = db.collection('integrations').doc('canvaSync');
  let running = null;

  async function exportMedia(design, isVideo) {
    const version = design.updated_at ?? Math.floor(Date.now() / 1000);
    const base = `${design.id}-${version}`;
    const files = [];

    try {
      // Miniature de la carte : l'adresse fournie par Canva expire, on la copie sur le VPS
      let imageUrl = '';
      if (design.thumbnail?.url) {
        imageUrl = await downloadToMedia(design.thumbnail.url, `${base}-miniature.png`);
        files.push(`${base}-miniature.png`);
      }

      let url;
      if (isVideo) {
        const { width = 16, height = 9 } = design.thumbnail ?? {};
        const quality = height > width ? 'vertical_1080p' : 'horizontal_1080p';
        const [videoUrl] = await canva.exportDesign(design.id, { type: 'mp4', quality });
        url = await downloadToMedia(videoUrl, `${base}.mp4`);
        files.push(`${base}.mp4`);
      } else {
        const [imageExportUrl] = await canva.exportDesign(design.id, { type: 'png', pages: [1] });
        url = await downloadToMedia(imageExportUrl, `${base}.png`);
        files.push(`${base}.png`);
        imageUrl ||= url;
      }

      return { url, imageUrl, files };
    } catch (err) {
      await removeMedia(files);
      throw err;
    }
  }

  async function processDesign(design) {
    const importRef = imports.doc(design.id);
    const record = (await importRef.get()).data();
    const version = design.updated_at ?? null;

    if (record && record.version === version) {
      if (!record.error) return 'unchanged';
      if ((record.attempts ?? 0) >= MAX_ATTEMPTS) return 'skipped';
    }

    // Réutilise le lien si ce design avait déjà été ajouté par partage
    const legacyId = shareLinkId(`canva:${design.id}`);
    const linkId =
      record?.linkId ?? ((await links.doc(legacyId).get()).exists ? legacyId : `canva-${design.id}`);
    const linkRef = links.doc(linkId);
    const linkExists = (await linkRef.get()).exists;

    // Lien supprimé dans l'admin après import : on respecte ce choix
    if (record?.linkId && !linkExists) return 'unchanged';

    const { isVideo, title } = parseDesignTitle(design.title);

    try {
      const media = await exportMedia(design, isVideo);
      const now = new Date().toISOString();
      const mediaFields = {
        url: media.url,
        imageUrl: media.imageUrl,
        mediaType: isVideo ? 'video' : 'image',
        canvaDesignId: design.id,
        updatedAt: now,
      };

      if (linkExists) {
        // Titre, catégorie et statut choisis dans l'admin sont conservés
        await linkRef.update(mediaFields);
      } else {
        const count = (await links.count().get()).data().count;
        await linkRef.set({
          title,
          description: '',
          category: 'Canva',
          iconName: 'Image',
          priority: count,
          status: 'pending',
          source: 'canva-folder',
          createdAt: now,
          ...mediaFields,
        });
      }

      await importRef.set({ linkId, version, title: design.title ?? '', isVideo, mediaFiles: media.files, importedAt: now });
      if (record?.mediaFiles) {
        await removeMedia(record.mediaFiles.filter((file) => !media.files.includes(file)));
      }
      return linkExists ? 'updated' : 'imported';
    } catch (err) {
      const previousAttempts = record?.error && record.version === version ? record.attempts ?? 0 : 0;
      await importRef.set({
        ...(record ?? {}),
        version,
        title: design.title ?? '',
        error: errorMessage(err),
        attempts: previousAttempts + 1,
        failedAt: new Date().toISOString(),
      });
      throw err;
    }
  }

  function runSync(trigger) {
    running ??= (async () => {
      const summary = { designs: 0, imported: 0, updated: 0, unchanged: 0, skipped: 0, errors: [] };
      try {
        const designs = await canva.listFolderDesigns(config.canva.folderId);
        summary.designs = designs.length;

        for (const design of designs) {
          try {
            summary[await processDesign(design)] += 1;
          } catch (err) {
            console.error(`[canva] « ${design.title ?? design.id} » : ${errorMessage(err)}`);
            if (summary.errors.length < MAX_REPORTED_ERRORS) {
              summary.errors.push({ designId: design.id, title: design.title ?? '', message: errorMessage(err) });
            }
          }
        }

        await syncDoc.set({ lastSyncAt: new Date().toISOString(), lastResult: summary, lastError: null }, { merge: true });
        console.log(
          `[canva] synchro ${trigger} : ${summary.designs} design(s), ${summary.imported} importé(s), ` +
            `${summary.updated} mis à jour, ${summary.errors.length} erreur(s)`
        );
        return summary;
      } catch (err) {
        await syncDoc.set({ lastSyncAt: new Date().toISOString(), lastError: errorMessage(err) }, { merge: true });
        console.error(`[canva] synchro ${trigger} impossible : ${errorMessage(err)}`);
        throw err;
      } finally {
        running = null;
      }
    })();
    return running;
  }

  async function status() {
    const data = (await syncDoc.get()).data() ?? {};
    return {
      syncing: Boolean(running),
      lastSyncAt: data.lastSyncAt ?? null,
      lastResult: data.lastResult ?? null,
      lastError: data.lastError ?? null,
    };
  }

  function startScheduler() {
    const tick = async () => {
      try {
        if ((await canva.status()).connected) await runSync('automatique');
      } catch {
        // Erreur déjà journalisée et enregistrée pour l'admin
      }
    };
    setTimeout(tick, 20_000);
    setInterval(tick, config.canva.syncMinutes * 60_000);
  }

  return { runSync, status, startScheduler };
}
