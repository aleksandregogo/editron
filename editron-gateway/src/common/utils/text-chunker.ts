export async function chunkTextWithLangchain(
  text: string,
  chunkSize: number = 400,
  chunkOverlap: number = 80
): Promise<string[]> {
  // Simple text chunking implementation until langchain is added
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  let currentChunk = '';
  
  for (const word of words) {
    if ((currentChunk + ' ' + word).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Create overlap by starting next chunk with some words from previous
      const wordsInChunk = currentChunk.split(/\s+/);
      const overlapWords = wordsInChunk.slice(-Math.floor(chunkOverlap / 10)).join(' ');
      currentChunk = overlapWords + ' ' + word;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + word;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.trim().length > 0);
} 