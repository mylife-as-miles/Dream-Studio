import dotenv from 'dotenv';
dotenv.config();

// Hardcoded configurations
export const PINECONE_INDEX_NAME = "dream-studio-code-rag";
export const PINECONE_NAMESPACE = "global-html-js-games-v1";
export const EMBEDDING_MODEL = "gemini-embedding-2";
export const EMBEDDING_DIMENSION = 1536;
export const PINECONE_METRIC = "cosine";
export const TOP_K = 10;

// Environment variables
export const getEnv = () => {
  const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
  const PINECONE_HOST = process.env.PINECONE_HOST;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!PINECONE_API_KEY) throw new Error("Missing PINECONE_API_KEY environment variable.");
  if (!PINECONE_HOST) throw new Error("Missing PINECONE_HOST environment variable.");
  if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY environment variable.");

  return {
    PINECONE_API_KEY,
    PINECONE_HOST,
    GEMINI_API_KEY,
  };
};
