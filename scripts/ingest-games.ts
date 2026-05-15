import { ingestDirectory } from '../src/rag/ingestGameCode.js';
import path from 'path';

const run = async () => {
  const targetDir = process.argv[2];

  if (!targetDir) {
    console.error("Usage: npm run rag:ingest <directory>");
    console.error("Example: npm run rag:ingest ./game-library");
    process.exit(1);
  }

  const absoluteDir = path.resolve(process.cwd(), targetDir);

  try {
    await ingestDirectory({
      directory: absoluteDir
    });
    console.log("Ingestion script completed successfully.");
  } catch (error) {
    console.error("Ingestion failed:", error);
    process.exit(1);
  }
};

run();
