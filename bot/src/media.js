// Fichiers exportés depuis Canva : téléchargement sur le VPS et diffusion (avec lecture partielle pour les vidéos)
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from './config.js';

const CONTENT_TYPES = { '.mp4': 'video/mp4', '.png': 'image/png', '.pdf': 'application/pdf' };
const SAFE_NAME = /^[A-Za-z0-9_-]+\.(mp4|png|pdf)$/;
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

export async function ensureMediaDir() {
  await mkdir(config.mediaDir, { recursive: true });
  const probe = path.join(config.mediaDir, '.test-ecriture');
  await writeFile(probe, 'ok');
  await rm(probe);
}

export function mediaUrl(name) {
  return `${config.publicUrl}/media/${name}`;
}

export async function downloadToMedia(url, name) {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok || !response.body) throw new Error(`Téléchargement impossible (HTTP ${response.status})`);

  const target = path.join(config.mediaDir, name);
  const temporary = `${target}.part`;
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
    await rename(temporary, target);
  } catch (err) {
    await rm(temporary, { force: true });
    throw err;
  }
  return mediaUrl(name);
}

export async function removeMedia(names) {
  await Promise.all(
    names.filter((name) => SAFE_NAME.test(name)).map((name) => rm(path.join(config.mediaDir, name), { force: true }))
  );
}

// Renvoie false si le fichier n'existe pas (le serveur répond alors 404)
export async function serveMedia(req, res, name) {
  if (!SAFE_NAME.test(name)) return false;

  const file = path.join(config.mediaDir, name);
  let info;
  try {
    info = await stat(file);
  } catch {
    return false;
  }

  const headers = {
    'Content-Type': CONTENT_TYPES[path.extname(name)],
    'Accept-Ranges': 'bytes',
    // Le nom contient la version du design : le fichier ne change jamais
    'Cache-Control': 'public, max-age=31536000, immutable',
  };

  let start = 0;
  let end = info.size - 1;
  let statusCode = 200;

  const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), info.size - 1);
    } else {
      start = Math.max(info.size - Number(range[2]), 0);
    }
    if (start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
      res.end();
      return true;
    }
    statusCode = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
  }

  res.writeHead(statusCode, { ...headers, 'Content-Length': end - start + 1 });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  createReadStream(file, { start, end })
    .on('error', () => res.destroy())
    .pipe(res);
  return true;
}
