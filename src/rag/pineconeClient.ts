import { Pinecone } from '@pinecone-database/pinecone';
import { getEnv, PINECONE_NAMESPACE } from './ragConfig.js';

let pineconeClient: Pinecone | null = null;

export const getPineconeClient = (): Pinecone => {
  if (!pineconeClient) {
    const { PINECONE_API_KEY } = getEnv();
    pineconeClient = new Pinecone({
      apiKey: PINECONE_API_KEY,
    });
  }
  return pineconeClient;
};

export const getPineconeIndex = () => {
  const pc = getPineconeClient();
  const { PINECONE_HOST } = getEnv();

  // Use the host to connect directly to the index instance
  return pc.index('dream-studio-code-rag', PINECONE_HOST).namespace(PINECONE_NAMESPACE);
};
