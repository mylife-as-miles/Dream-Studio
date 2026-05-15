export interface Chunk {
  content: string;
  chunkType: string;
  startLine: number;
  endLine: number;
}

export const chunkJavaScript = (content: string): Chunk[] => {
  // Simple heuristic-based chunking for JS/TS
  // Chunking by functions, classes, exports, imports
  const chunks: Chunk[] = [];
  const lines = content.split('\n');
  let currentChunk: string[] = [];
  let chunkType = "misc";
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isStartOfBlock = line.match(/^(export )?(class|function|const|let|var)\s+\w+/) || line.match(/^import /);

    if (isStartOfBlock && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        chunkType,
        startLine,
        endLine: i
      });
      currentChunk = [];
      startLine = i + 1;

      if (line.includes('class')) chunkType = 'class';
      else if (line.includes('function') || line.match(/const\s+\w+\s*=\s*(\(|function)/)) chunkType = 'function';
      else if (line.includes('import')) chunkType = 'import';
      else chunkType = 'variable';
    }

    currentChunk.push(line);

    // Safety check for very large chunks
    if (currentChunk.length > 150) {
      chunks.push({
        content: currentChunk.join('\n'),
        chunkType,
        startLine,
        endLine: i + 1
      });
      currentChunk = [];
      startLine = i + 2;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join('\n'),
      chunkType,
      startLine,
      endLine: lines.length
    });
  }

  // Filter out empty or whitespace-only chunks
  return chunks.filter(c => c.content.trim().length > 0);
};

export const chunkHTML = (content: string): Chunk[] => {
  // Chunking by canvas sections, menus, HUDs, game screens, script blocks, UI sections
  const chunks: Chunk[] = [];
  const lines = content.split('\n');
  let currentChunk: string[] = [];
  let chunkType = "html_section";
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isStartOfBlock = line.match(/<(script|style|canvas|div id="menu"|div id="hud"|div id="ui")/i);

    if (isStartOfBlock && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        chunkType,
        startLine,
        endLine: i
      });
      currentChunk = [];
      startLine = i + 1;

      if (line.includes('<script')) chunkType = 'script';
      else if (line.includes('<style')) chunkType = 'style';
      else if (line.includes('<canvas')) chunkType = 'canvas';
      else if (line.includes('menu')) chunkType = 'menu';
      else if (line.includes('hud')) chunkType = 'hud';
      else chunkType = 'ui';
    }

    currentChunk.push(line);

    if (currentChunk.length > 150) {
      chunks.push({
        content: currentChunk.join('\n'),
        chunkType,
        startLine,
        endLine: i + 1
      });
      currentChunk = [];
      startLine = i + 2;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join('\n'),
      chunkType,
      startLine,
      endLine: lines.length
    });
  }

  return chunks.filter(c => c.content.trim().length > 0);
};

export const chunkCSS = (content: string): Chunk[] => {
  // Chunking by selector groups, animations, layouts
  const chunks: Chunk[] = [];
  const lines = content.split('\n');
  let currentChunk: string[] = [];
  let chunkType = "css_rule";
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isStartOfBlock = line.match(/^(@keyframes|#menu|#hud|\.ui-)/i);

    if (isStartOfBlock && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        chunkType,
        startLine,
        endLine: i
      });
      currentChunk = [];
      startLine = i + 1;

      if (line.includes('@keyframes')) chunkType = 'animation';
      else if (line.includes('menu')) chunkType = 'menu_style';
      else if (line.includes('hud')) chunkType = 'hud_style';
      else chunkType = 'ui_style';
    }

    currentChunk.push(line);

    if (currentChunk.length > 150) {
      chunks.push({
        content: currentChunk.join('\n'),
        chunkType,
        startLine,
        endLine: i + 1
      });
      currentChunk = [];
      startLine = i + 2;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join('\n'),
      chunkType,
      startLine,
      endLine: lines.length
    });
  }

  return chunks.filter(c => c.content.trim().length > 0);
};

export const chunkCode = (content: string, filePath: string): Chunk[] => {
  if (filePath.endsWith('.js') || filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    return chunkJavaScript(content);
  } else if (filePath.endsWith('.html')) {
    return chunkHTML(content);
  } else if (filePath.endsWith('.css')) {
    return chunkCSS(content);
  }

  // Default fallback
  return [{ content, chunkType: 'text', startLine: 1, endLine: content.split('\n').length }];
};
