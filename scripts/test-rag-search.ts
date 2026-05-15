import { searchCode } from '../src/rag/searchCode.js';

const run = async () => {
  const query = process.argv.slice(2).join(' ');

  if (!query) {
    console.error('Usage: npm run rag:search "your search query"');
    console.error('Example: npm run rag:search "make a 2D platformer with enemies and a health bar"');
    process.exit(1);
  }

  try {
    const results = await searchCode(query);

    console.log(`\nFound ${results.length} results.\n`);

    results.forEach((result, index) => {
      console.log(`--- Result ${index + 1} (Score: ${result.score.toFixed(4)}) ---`);
      console.log(result.formattedContext);
      console.log('\n');
    });

  } catch (error) {
    console.error("Search failed:", error);
    process.exit(1);
  }
};

run();
