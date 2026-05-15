import { GoogleGenAI } from '@google/genai';
import { getEnv, EMBEDDING_MODEL, EMBEDDING_DIMENSION } from './ragConfig.js';

let genAI: GoogleGenAI | null = null;

const getGenAI = () => {
  if (!genAI) {
    const { GEMINI_API_KEY } = getEnv();
    genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return genAI;
};

interface Metadata {
  language: string;
  file_type: string;
  framework: string;
  genre: string;
  mechanics: string;
  [key: string]: any;
}

export const embedDocument = async (content: string, metadata: Metadata): Promise<number[]> => {
  const ai = getGenAI();

  const textToEmbed = `Document for retrieval:
This is a Dream Studio HTML/CSS/JavaScript game-code chunk.
Retrieve this when the user needs similar mechanics, systems, UI, rendering, input handling, collision, animation, or game logic.

Metadata:
Language: ${metadata.language || 'Unknown'}
File type: ${metadata.file_type || 'Unknown'}
Framework: ${metadata.framework || 'Unknown'}
Genre: ${metadata.genre || 'Unknown'}
Mechanics: ${metadata.mechanics || 'Unknown'}

Code:
${content}`;

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: textToEmbed,
    config: {
      outputDimensionality: EMBEDDING_DIMENSION,
    }
  });

  if (!response.embeddings || response.embeddings.length === 0 || !response.embeddings[0].values) {
    throw new Error("Failed to generate embedding for document");
  }

  return response.embeddings[0].values;
};

export const embedQuery = async (userPrompt: string): Promise<number[]> => {
  const ai = getGenAI();

  const textToEmbed = `Query for retrieval:
Find Dream Studio HTML/CSS/JavaScript game-code examples relevant to this request:

${userPrompt}`;

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: textToEmbed,
    config: {
      outputDimensionality: EMBEDDING_DIMENSION,
    }
  });

  if (!response.embeddings || response.embeddings.length === 0 || !response.embeddings[0].values) {
    throw new Error("Failed to generate embedding for query");
  }

  return response.embeddings[0].values;
};
