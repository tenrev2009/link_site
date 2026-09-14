// Transcription locale avec Whisper (transformers.js) : l'audio ne quitte pas le VPS
import { mkdir } from 'node:fs/promises';
import { config } from '../config.js';

let transcriberPromise = null;

async function loadTranscriber() {
  const { pipeline, env } = await import('@huggingface/transformers');
  await mkdir(config.ai.modelCacheDir, { recursive: true });
  env.cacheDir = config.ai.modelCacheDir;
  // Le modèle est téléchargé une seule fois puis gardé dans le volume /data
  return pipeline('automatic-speech-recognition', config.ai.whisperModel, { dtype: 'q8' });
}

export async function transcribe(samples) {
  transcriberPromise ??= loadTranscriber().catch((err) => {
    transcriberPromise = null;
    throw err;
  });
  const transcriber = await transcriberPromise;
  const result = await transcriber(samples, {
    language: 'french',
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  return String(result.text ?? '').trim();
}

// Libère la mémoire du modèle (le VPS a peu de RAM) ; il sera rechargé au besoin
export async function releaseTranscriber() {
  if (!transcriberPromise) return;
  const transcriber = await transcriberPromise.catch(() => null);
  transcriberPromise = null;
  await transcriber?.dispose?.();
}
