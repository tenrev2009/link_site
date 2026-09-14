// Prépare les fichiers exportés pour Claude et Whisper avec ffmpeg : images réduites, images extraites, piste audio
import { spawn } from 'node:child_process';

const MAX_OUTPUT_BYTES = 512 * 1024 * 1024;
const SILENCE_RMS = 0.003;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let size = 0;
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_OUTPUT_BYTES) child.kill('SIGKILL');
      else chunks.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-2000);
    });
    child.on('error', (err) => reject(new Error(`${command} impossible à lancer : ${err.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`${command} a échoué (code ${code}) : ${stderr.trim().split('\n').pop() ?? ''}`));
    });
  });
}

// Image JPEG qui tient dans un carré de `box` pixels (Claude n'a pas besoin de plus)
function fitFilter(box) {
  return `scale='min(${box},iw)':'min(${box},ih)':force_original_aspect_ratio=decrease`;
}

export async function mediaDuration(file) {
  const output = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ]);
  const seconds = Number.parseFloat(output.toString());
  return Number.isFinite(seconds) ? seconds : 0;
}

export function imageForClaude(file) {
  return run('ffmpeg', [
    '-v', 'error', '-i', file, '-frames:v', '1', '-vf', fitFilter(1568), '-c:v', 'mjpeg', '-q:v', '3', '-f', 'image2', 'pipe:1',
  ]);
}

// Images réparties régulièrement dans la vidéo
export async function extractFrames(file, count) {
  const duration = await mediaDuration(file);
  const frames = [];
  for (let index = 0; index < count; index += 1) {
    const seconds = duration > 0 ? (duration * (index + 0.5)) / count : 0;
    const jpeg = await run('ffmpeg', [
      '-v', 'error', '-ss', seconds.toFixed(2), '-i', file,
      '-frames:v', '1', '-vf', fitFilter(1280), '-c:v', 'mjpeg', '-q:v', '4', '-f', 'image2', 'pipe:1',
    ]);
    if (jpeg.length > 0) frames.push({ seconds, jpeg });
    if (duration <= 0) break;
  }
  return frames;
}

// Piste audio en 16 kHz mono (format attendu par Whisper) ; null si la vidéo n'a pas de son
export async function audioSamples(file, maxSeconds) {
  const streams = await run('ffprobe', [
    '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file,
  ]);
  if (!streams.toString().trim()) return null;

  const pcm = await run('ffmpeg', [
    '-v', 'error', '-i', file, '-t', String(maxSeconds), '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1',
  ]);
  const length = Math.floor(pcm.byteLength / 4);
  return new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + length * 4));
}

export function isMostlySilent(samples) {
  if (samples.length === 0) return true;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length) < SILENCE_RMS;
}
