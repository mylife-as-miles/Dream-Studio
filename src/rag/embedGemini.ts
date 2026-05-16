import { GoogleGenAI } from '@google/genai';
import { getEnv, EMBEDDING_MODEL, EMBEDDING_DIMENSION } from './ragConfig.js';

let genAI: GoogleGenAI | null = null;
const EMBEDDING_RETRY_DELAYS_MS = [1500, 3000, 6000];

const getGenAI = () => {
  if (!genAI) {
    const { GEMINI_API_KEY } = getEnv();
    genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return genAI;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /resource_exhausted|quota|429|rate[- ]limit/i.test(message);
}

async function embedWithRetry(text: string): Promise<number[]> {
  const ai = getGenAI();
  let lastError: unknown;

  for (let attempt = 0; attempt <= EMBEDDING_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: {
          outputDimensionality: EMBEDDING_DIMENSION,
        }
      });

      if (!response.embeddings || response.embeddings.length === 0 || !response.embeddings[0].values) {
        throw new Error("Failed to generate embedding for document");
      }

      return response.embeddings[0].values;
    } catch (error) {
      lastError = error;

      if (!isQuotaError(error) || attempt === EMBEDDING_RETRY_DELAYS_MS.length) {
        break;
      }

      await sleep(EMBEDDING_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError instanceof Error
    ? new Error(`Gemini embedding failed after retries: ${lastError.message}`)
    : new Error("Gemini embedding failed after retries.");
}

interface Metadata {
  title?: string;
  source_game?: string;
  language: string;
  file_type: string;
  framework: string;
  genre: string;
  mechanics: string;
  path?: string;
  [key: string]: any;
}

export const embedDocument = async (content: string, metadata: Metadata): Promise<number[]> => {
  const textToEmbed = `Document for retrieval:
This is a Dream Studio HTML/CSS/JavaScript game-code chunk.
Retrieve this when the user needs similar mechanics, systems, UI, rendering, input handling, collision, animation, physics, dialogue, inventory, enemy AI, camera, level design, or game logic.

Metadata:
Title: ${metadata.title || 'Unknown'}
Source game: ${metadata.source_game || 'Unknown'}
Language: ${metadata.language || 'Unknown'}
File type: ${metadata.file_type || 'Unknown'}
Framework: ${metadata.framework || 'Unknown'}
Genre: ${metadata.genre || 'Unknown'}
Mechanics: ${metadata.mechanics || 'Unknown'}
Path: ${metadata.path || 'Unknown'}

Code:
${content}`;

  return embedWithRetry(textToEmbed);
};

export const embedQuery = async (userPrompt: string): Promise<number[]> => {
  const textToEmbed = `Query for retrieval:
Find Dream Studio HTML/CSS/JavaScript game-code examples relevant to this request:

${userPrompt}`;

  return embedWithRetry(textToEmbed);
};
