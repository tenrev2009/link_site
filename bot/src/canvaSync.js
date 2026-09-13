// Surveillance du dossier Canva « Site » : chaque publication devient un lien « À valider »
// Le format d'export dépend du sous-dossier : Site/Images, Site/Vidéos, Site/PDF
import { config } from './config.js';
import { downloadToMedia, removeMedia } from './media.js';
import { shareLinkId } from './links.js';

const DEFAULT_TITLE = 'Design Canva';
const MAX_ATTEMPTS = 3;
const MAX_REPORTED_ERRORS = 20;

const SUBFOLDER_FORMATS = { images: 'image', image: 'image', videos: 'video', video: 'video', pdf: 'pdf', pdfs: 'pdf' };
const SUBFOLDER_LABELS = { image: 'Images', video: 'Vidéos', pdf: 'PDF' };

const EXPORTS = {
  image: { extension: 'png', format: () => ({ type: 'png', pages: [1] }) },
  video: {
    extension: 'mp4',
    format: (design) => {
      const { width = 16, height = 9 } = design.thumbnail ?? {};
      return { type: 'mp4', quality: height > width ? 'vertical_1080p' : 'horizontal_1080p' };
    },
  },
  pdf: { extension: 'pdf', format: () => ({ type: 'pdf' }) },
};

// « Vidéos », « videos », « VIDEO » → video
export function subfolderFormat(name) {
  const normalized = String(name ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
  return SUBFOLDER_FORMATS[normalized] ?? null;
}

const errorMessage = (err) => (err instanceof Error ? err.message : String(err));

export function createCanvaSync({ db, canva }) {
  const imports = db.collection('canvaImports');
  const links = db.collection('links');
  const syncDoc = db.collection('integrations').doc('canvaSync');
  let running = null;

  async function collectPublications() {
    const rootId = config.canva.folderId;
    const [subfolders, rootDesigns] = await Promise.all([
      canva.listFolderItems(rootId, 'folder'),
      canva.listFolderItems(rootId, 'design'),
    ]);

    const publications = new Map();
    // Publications rangées directement dans « Site » : exportées en image
    for (const design of rootDesigns) publications.set(design.id, { design, kind: 'image' });

    const foundKinds = new Set();
    for (const folder of subfolders) {
      const kind = subfolderFormat(folder.name);
      if (!kind) continue;
      foundKinds.add(kind);
      for (const design of await canva.listFolderItems(folder.id, 'design')) {
        publications.set(design.id, { design, kind });
      }
    }

    const warnings = Object.entries(SUBFOLDER_LABELS)
      .filter(([kind]) => !foundKinds.has(kind))
      .map(([, label]) => `Sous-dossier « ${label} » introuvable dans « Site »`);

    return { publications: [...publications.values()], warnings };
  }

  async function exportMedia(design, kind) {
    const version = design.updated_at ?? Math.floor(Date.now() / 1000);
    const base = `${design.id}-${version}`;
    const { extension, format } = EXPORTS[kind];
    const files = [];

    try {
      // Miniature de la carte : l'adresse fournie par Canva expire, on la copie sur le VPS
      let imageUrl = '';
      if (design.thumbnail?.url) {
        imageUrl = await downloadToMedia(design.thumbnail.url, `${base}-miniature.png`);
        files.push(`${base}-miniature.png`);
      }

      // Une vidéo ou un PDF sort en un seul fichier ; une image ne garde que la première page
      const [exportUrl] = await canva.exportDesign(design.id, format(design));
      const url = await downloadToMedia(exportUrl, `${base}.${extension}`);
      files.push(`${base}.${extension}`);

      return { url, imageUrl: imageUrl || (kind === 'image' ? url : ''), files };
    } catch (err) {
      await removeMedia(files);
      throw err;
    }
  }

  async function processPublication({ design, kind }) {
    const importRef = imports.doc(design.id);
    const record = (await importRef.get()).data();
    const version = design.updated_at ?? null;
    const sameVersion = record?.version === version && record?.kind === kind;

    if (record && sameVersion) {
      if (!record.error) return 'unchanged';
      if ((record.attempts ?? 0) >= MAX_ATTEMPTS) return 'skipped';
    }

    // Réutilise le lien si cette publication avait déjà été ajoutée par partage
    const legacyId = shareLinkId(`canva:${design.id}`);
    const linkId =
      record?.linkId ?? ((await links.doc(legacyId).get()).exists ? legacyId : `canva-${design.id}`);
    const linkRef = links.doc(linkId);
    const linkExists = (await linkRef.get()).exists;

    // Lien supprimé dans l'admin après import : on respecte ce choix
    if (record?.linkId && !linkExists) return 'unchanged';

    try {
      const media = await exportMedia(design, kind);
      const now = new Date().toISOString();
      const mediaFields = {
        url: media.url,
        imageUrl: media.imageUrl,
        mediaType: kind,
        canvaDesignId: design.id,
        updatedAt: now,
      };

      if (linkExists) {
        // Titre, catégorie et statut choisis dans l'admin sont conservés
        await linkRef.update(mediaFields);
      } else {
        const count = (await links.count().get()).data().count;
        await linkRef.set({
          title: design.title?.trim() || DEFAULT_TITLE,
          description: '',
          category: 'Canva',
          iconName: kind === 'pdf' ? 'FileText' : 'Image',
          priority: count,
          status: 'pending',
          source: 'canva-folder',
          createdAt: now,
          ...mediaFields,
        });
      }

      await importRef.set({ linkId, version, kind, title: design.title ?? '', mediaFiles: media.files, importedAt: now });
      if (record?.mediaFiles) {
        await removeMedia(record.mediaFiles.filter((file) => !media.files.includes(file)));
      }
      return linkExists ? 'updated' : 'imported';
    } catch (err) {
      const previousAttempts = record?.error && sameVersion ? record.attempts ?? 0 : 0;
      await importRef.set({
        ...(record ?? {}),
        version,
        kind,
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
      const summary = { designs: 0, imported: 0, updated: 0, unchanged: 0, skipped: 0, errors: [], warnings: [] };
      try {
        const { publications, warnings } = await collectPublications();
        summary.designs = publications.length;
        summary.warnings = warnings;

        for (const publication of publications) {
          try {
            summary[await processPublication(publication)] += 1;
          } catch (err) {
            const { design } = publication;
            console.error(`[canva] « ${design.title ?? design.id} » : ${errorMessage(err)}`);
            if (summary.errors.length < MAX_REPORTED_ERRORS) {
              summary.errors.push({ designId: design.id, title: design.title ?? '', message: errorMessage(err) });
            }
          }
        }

        await syncDoc.set({ lastSyncAt: new Date().toISOString(), lastResult: summary, lastError: null }, { merge: true });
        console.log(
          `[canva] synchro ${trigger} : ${summary.designs} publication(s), ${summary.imported} importée(s), ` +
            `${summary.updated} mise(s) à jour, ${summary.errors.length} erreur(s)`
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
