// Images d'aperçu 1200 × 630 pour le partage (Facebook, WhatsApp, LinkedIn…), hébergées sur le VPS
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from './config.js';
import { mediaPath } from './media.js';
import { mediaDuration } from './ai/mediaInputs.js';
import { youTubeId } from './postPage.js';

export const PREVIEW_WIDTH = 1200;
export const PREVIEW_HEIGHT = 630;
// WhatsApp n'affiche pas les images d'aperçu trop lourdes
const MAX_PREVIEW_BYTES = 280_000;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const previewsDir = () => path.join(config.mediaDir, 'apercus');
const generating = new Map();

// Change dès que le lien change : les réseaux sociaux rechargent alors l'image
export function previewVersion(link) {
  return createHash('sha1')
    .update(`${link.url}|${link.imageUrl ?? ''}|${link.updatedAt ?? ''}`)
    .digest('hex')
    .slice(0, 10);
}

export function previewFile(id, link) {
  return path.join(previewsDir(), `${id}-${previewVersion(link)}.jpg`);
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-2000);
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg a échoué : ${stderr.trim().split('\n').pop() ?? code}`))
    );
  });
}

// Fichier déjà présent sur le VPS (exports Canva servis par /media)
function localMediaFile(url) {
  const prefix = `${config.publicUrl}/media/`;
  if (!url?.startsWith(prefix)) return null;
  const name = url.slice(prefix.length);
  return /^[A-Za-z0-9_-]+\.(mp4|png)$/.test(name) ? mediaPath(name) : null;
}

async function download(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    headers: { 'user-agent': USER_AGENT, accept: 'image/*' },
  });
  const type = response.headers.get('content-type') ?? '';
  if (!response.ok || !type.startsWith('image/') || !response.body) {
    await response.body?.cancel();
    throw new Error(`image indisponible (HTTP ${response.status}, ${type || 'type inconnu'})`);
  }
  if (Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES) {
    await response.body.cancel();
    throw new Error('image source trop lourde');
  }
  const file = path.join(previewsDir(), `.source-${randomBytes(6).toString('hex')}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
  return file;
}

// Meilleure source disponible : image nette de la vidéo, export en haute définition, miniature YouTube HD…
async function resolveSource(link) {
  const video = /\.mp4(\?|$)/i.test(link.url) ? localMediaFile(link.url) : null;
  if (video) {
    const duration = await mediaDuration(video).catch(() => 0);
    return { file: video, seekSeconds: Math.min(1, duration * 0.1) };
  }

  const image = localMediaFile(link.url) ?? localMediaFile(link.imageUrl);
  if (image) return { file: image };

  const candidates = [];
  const youtube = youTubeId(link.url);
  if (youtube) {
    candidates.push(`https://img.youtube.com/vi/${youtube}/maxresdefault.jpg`, `https://img.youtube.com/vi/${youtube}/hqdefault.jpg`);
  }
  if (link.imageUrl) candidates.push(link.imageUrl);

  let lastError = new Error('aucune image pour ce lien');
  for (const url of candidates) {
    try {
      return { file: await download(url), temporary: true };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function encode(source, output, quality) {
  // Image entière centrée sur un fond flou de la même image : rien n'est coupé
  const filter =
    `[0:v]scale=${PREVIEW_WIDTH}:${PREVIEW_HEIGHT}:force_original_aspect_ratio=increase,` +
    `crop=${PREVIEW_WIDTH}:${PREVIEW_HEIGHT},boxblur=20:3,eq=brightness=-0.06[fond];` +
    `[0:v]scale=${PREVIEW_WIDTH}:${PREVIEW_HEIGHT}:force_original_aspect_ratio=decrease[image];` +
    `[fond][image]overlay=(W-w)/2:(H-h)/2,format=yuvj420p`;
  await runFfmpeg([
    ...(source.seekSeconds ? ['-ss', source.seekSeconds.toFixed(2)] : []),
    '-i', source.file,
    '-frames:v', '1',
    '-filter_complex', filter,
    '-q:v', String(quality),
    '-f', 'image2',
    output,
  ]);
}

async function generate(id, link, target) {
  await mkdir(previewsDir(), { recursive: true });
  const source = await resolveSource(link);
  const temporary = `${target}.part`;
  try {
    for (const quality of [3, 5, 8]) {
      await encode(source, temporary, quality);
      if ((await stat(temporary)).size <= MAX_PREVIEW_BYTES) break;
    }
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
    if (source.temporary) await rm(source.file, { force: true });
  }

  // Anciennes versions de l'aperçu de ce lien
  const current = path.basename(target);
  for (const name of await readdir(previewsDir())) {
    if (name.startsWith(`${id}-`) && name !== current) await rm(path.join(previewsDir(), name), { force: true });
  }
  return target;
}

// Crée l'aperçu s'il n'existe pas encore (une seule génération à la fois par lien)
export async function ensurePreview(id, link) {
  const target = previewFile(id, link);
  try {
    await stat(target);
    return target;
  } catch {
    // À générer
  }
  if (!generating.has(target)) {
    generating.set(
      target,
      generate(id, link, target).finally(() => generating.delete(target))
    );
  }
  return generating.get(target);
}

// Prépare les aperçus des liens publics, pour que les réseaux les trouvent tout de suite
export async function warmPreviews(db) {
  const snapshot = await db.collection('links').where('status', '==', 'public').get();
  let created = 0;
  for (const doc of snapshot.docs) {
    const link = doc.data();
    try {
      await stat(previewFile(doc.id, link));
    } catch {
      try {
        await ensurePreview(doc.id, link);
        created += 1;
      } catch (err) {
        console.error(`[aperçu] « ${link.title} » : ${err.message}`);
      }
    }
  }
  if (created > 0) console.log(`[aperçu] ${created} image(s) d'aperçu créée(s)`);
}
