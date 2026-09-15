// Rédaction des fiches par Claude : descriptif, mots-clés, catégorie suggérée et texte alternatif
import { readFile, stat } from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { splitCategories } from '../links.js';
import { mediaPath } from '../media.js';
import { audioSamples, extractFrames, imageForClaude, isMostlySilent } from './mediaInputs.js';
import { releaseTranscriber, transcribe } from './transcribe.js';

const VIDEO_FRAMES = 5;
// Au-delà, le PDF encodé dépasserait la taille maximale d'une requête : on envoie sa miniature
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const KIND_LABELS = { image: 'image', video: 'vidéo', pdf: 'document PDF' };

const SYSTEM_PROMPT = `Tu rédiges les fiches des publications d'un site de liens. Chaque publication a été créée dans Canva, puis exportée en image, en vidéo ou en PDF. Tu reçois son contenu (l'image, des images extraites de la vidéo ou le PDF), éventuellement la transcription automatique de l'audio, son titre et les catégories déjà utilisées sur le site.

Rédige en français :
- description : un seul paragraphe de 3 à 5 phrases, au ton neutre et informatif, qui explique ce que présente la publication et ce qu'on y trouve. Pas de formule promotionnelle, pas d'emoji, et ne commence pas par « Cette publication ».
- keywords : de 3 à 8 mots-clés en minuscules, du plus pertinent au moins pertinent.
- category : de 1 à 3 catégories courtes, séparées par des virgules (par exemple « AI, Sketchup »). Reprends de préférence les catégories existantes qui conviennent, et propose une nouvelle catégorie de 1 à 3 mots seulement si aucune ne convient.
- altText : le texte alternatif de l'image principale, une phrase de moins de 150 caractères qui décrit ce qu'on voit.

La transcription est produite automatiquement et peut contenir des erreurs. Sers-t'en uniquement si c'est un commentaire ou une interview. Ignore-la si ce sont des paroles de chanson ou une phrase sans rapport avec les images : la transcription automatique invente parfois des phrases sur de la musique ou du silence. Ne mentionne jamais la transcription elle-même.

N'invente aucune information absente du contenu fourni.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } },
    category: { type: 'string' },
    altText: { type: 'string' },
  },
  required: ['description', 'keywords', 'category', 'altText'],
  additionalProperties: false,
};

function jpegBlock(jpeg) {
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } };
}

function formatTime(seconds) {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function normalize(data) {
  const keywords = [
    ...new Set((Array.isArray(data.keywords) ? data.keywords : []).map((k) => String(k).trim().toLowerCase()).filter(Boolean)),
  ].slice(0, 8);
  return {
    description: String(data.description ?? '').trim(),
    keywords,
    category: splitCategories(data.category).slice(0, 3).join(', ').slice(0, 120),
    altText: String(data.altText ?? '').trim().slice(0, 200),
  };
}

// Traduit les erreurs du SDK en messages lisibles dans l'admin
function explainApiError(err) {
  if (err instanceof Anthropic.AuthenticationError) return new Error('Clé API Anthropic invalide (ANTHROPIC_API_KEY)');
  if (err instanceof Anthropic.PermissionDeniedError) return new Error('Clé API Anthropic sans accès à ce modèle');
  if (err instanceof Anthropic.RateLimitError) return new Error('Limite d\'utilisation de l\'API Claude atteinte, nouvel essai plus tard');
  if (err instanceof Anthropic.APIError) return new Error(`Erreur de l'API Claude (${err.status ?? 'réseau'}) : ${err.message}`);
  return err;
}

export function createDescriber({ client = new Anthropic(), transcribeAudio = transcribe, release = releaseTranscriber } = {}) {
  async function buildContent({ kind, mainFile, thumbnailFile, title, categories }) {
    const content = [];

    if (kind === 'video' && mainFile) {
      for (const { seconds, jpeg } of await extractFrames(mediaPath(mainFile), VIDEO_FRAMES)) {
        content.push({ type: 'text', text: `Image extraite à ${formatTime(seconds)} :` }, jpegBlock(jpeg));
      }
      const samples = await audioSamples(mediaPath(mainFile), config.ai.maxAudioSeconds);
      if (samples && !isMostlySilent(samples)) {
        const transcript = await transcribeAudio(samples);
        if (transcript) {
          content.push({ type: 'text', text: `Transcription automatique de l'audio :\n${transcript}` });
        }
      }
    } else if (kind === 'pdf' && mainFile && (await stat(mediaPath(mainFile))).size <= MAX_PDF_BYTES) {
      const data = (await readFile(mediaPath(mainFile))).toString('base64');
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
    } else {
      const imageFile = kind === 'image' ? mainFile : thumbnailFile;
      if (imageFile) content.push(jpegBlock(await imageForClaude(mediaPath(imageFile))));
    }

    content.push({
      type: 'text',
      text: [
        `Titre dans Canva : « ${title} »`,
        `Type de publication : ${KIND_LABELS[kind] ?? kind}`,
        `Catégories existantes sur le site : ${categories.length > 0 ? categories.join(', ') : 'aucune'}`,
      ].join('\n'),
    });
    return content;
  }

  async function describe(input) {
    const content = await buildContent(input);

    let response;
    try {
      response = await client.beta.messages.create({
        model: config.ai.model,
        max_tokens: 16000,
        // Si Claude Opus 5 refuse une demande, l'API la relance sur le modèle de repli recommandé
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM_PROMPT,
        output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        messages: [{ role: 'user', content }],
      });
    } catch (err) {
      throw explainApiError(err);
    }

    if (response.stop_reason === 'refusal') throw new Error('Claude a refusé de décrire cette publication');
    if (response.stop_reason === 'max_tokens') throw new Error('Réponse de Claude incomplète');

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
    try {
      return normalize(JSON.parse(text));
    } catch {
      throw new Error('Réponse de Claude illisible');
    }
  }

  return { describe, release };
}
