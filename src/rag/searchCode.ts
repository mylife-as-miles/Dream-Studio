import { getPineconeIndex } from './pineconeClient.js';
import { embedQuery } from './embedGemini.js';
import { TOP_K } from './ragConfig.js';

export interface SearchFilters {
  language?: string;
  framework?: string;
  genre?: string;
  mechanics?: string;
  quality_score?: string;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
  formattedContext: string;
}

export const searchCode = async (userPrompt: string, filters?: SearchFilters): Promise<SearchResult[]> => {
  console.log(`Searching for: "${userPrompt}"`);

  const queryEmbedding = await embedQuery(userPrompt);
  const index = getPineconeIndex();

  let filterObj: Record<string, any> = {};
  if (filters) {
    if (filters.language) filterObj.language = filters.language;
    if (filters.framework) filterObj.framework = filters.framework;
    if (filters.genre) filterObj.genre = filters.genre;
    if (filters.mechanics) filterObj.mechanics = filters.mechanics;
    if (filters.quality_score) filterObj.quality_score = { $gte: filters.quality_score }; // Example condition
  }

  const queryOptions: any = {
    vector: queryEmbedding,
    topK: TOP_K,
    includeMetadata: true,
  };

  if (Object.keys(filterObj).length > 0) {
    queryOptions.filter = filterObj;
  }

  const response = await index.query(queryOptions);

  if (!response.matches) {
    return [];
  }

  return response.matches.map((match: any) => {
    const metadata = match.metadata || {};

    // Format for Gemma 4 context injection
    const formattedContext = `
File: ${metadata.path || 'Unknown'}
Language: ${metadata.language || 'Unknown'}
Type: ${metadata.chunk_type || 'Unknown'}
Source: ${metadata.source_game || 'Unknown'}

\`\`\`${(metadata.language as string)?.toLowerCase() || ''}
${metadata.content || ''}
\`\`\`
`.trim();

    return {
      id: match.id,
      score: match.score || 0,
      metadata,
      formattedContext
    };
  });
};
