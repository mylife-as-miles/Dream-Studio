import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { glob } from 'glob';
import { getPineconeIndex } from './pineconeClient.js';
import { embedDocument } from './embedGemini.js';
import { chunkCode } from './chunkCode.js';

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/.next/**',
  '**/.vercel/**',
  '**/package-lock.json',
  '**/pnpm-lock.yaml',
  '**/yarn.lock'
];

const EXTENSIONS = ['.html', '.css', '.js', '.ts', '.tsx'];

interface IngestOptions {
  directory: string;
  metadata?: Record<string, string>;
}

export const ingestDirectory = async (options: IngestOptions) => {
  const { directory, metadata = {} } = options;
  console.log(`Ingesting directory: ${directory}`);

  try {
    await fs.access(directory);
  } catch (error) {
    console.error(`Directory not found: ${directory}`);
    return;
  }

  const files = await glob(`**/*{${EXTENSIONS.join(',')}}`, {
    cwd: directory,
    ignore: IGNORE_PATTERNS,
    absolute: true
  });

  console.log(`Found ${files.length} files to ingest.`);

  const index = getPineconeIndex();
  let totalChunks = 0;

  for (const file of files) {
    console.log(`Processing ${file}`);
    try {
      const content = await fs.readFile(file, 'utf-8');
      const chunks = chunkCode(content, file);
      console.log(`  - Split into ${chunks.length} chunks`);

      const ext = path.extname(file).slice(1);
      const fileTypeMap: Record<string, string> = {
        'js': 'JavaScript',
        'ts': 'TypeScript',
        'tsx': 'TypeScript React',
        'html': 'HTML',
        'css': 'CSS'
      };

      const baseMetadata = {
        language: fileTypeMap[ext] || ext,
        file_type: ext,
        framework: 'Vanilla', // Default
        genre: metadata.genre || 'Unknown',
        mechanics: metadata.mechanics || 'Unknown',
        source_game: metadata.source_game || path.basename(directory),
        path: path.relative(directory, file),
        quality_score: metadata.quality_score || '1.0',
        version: metadata.version || '1.0',
        title: path.basename(file)
      };

      const recordsToUpsert = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        const chunkMetadata = {
          ...baseMetadata,
          chunk_type: chunk.chunkType,
          content: chunk.content,
        };

        const embedding = await embedDocument(chunk.content, chunkMetadata);

        // Create deterministic ID
        const id = crypto.createHash('sha256')
          .update(`${file}-${chunk.startLine}-${chunk.endLine}`)
          .digest('hex');

        recordsToUpsert.push({
          id,
          values: embedding,
          metadata: chunkMetadata
        });
      }

      if (recordsToUpsert.length > 0) {
        // Upsert in batches to avoid payload size limits
        const batchSize = 100;
        for (let i = 0; i < recordsToUpsert.length; i += batchSize) {
          const batch = recordsToUpsert.slice(i, i + batchSize);
          await index.upsert(batch);
        }
        totalChunks += recordsToUpsert.length;
        console.log(`  - Upserted ${recordsToUpsert.length} records to Pinecone`);
      }

    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  }

  console.log(`Ingestion complete! Successfully processed ${totalChunks} chunks.`);
};
