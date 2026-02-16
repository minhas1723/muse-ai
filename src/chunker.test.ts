import { describe, it, expect } from 'vitest';
import { splitIntoChunks } from './chunker';

describe('splitIntoChunks', () => {
  it('should return empty array for empty string', () => {
    expect(splitIntoChunks('')).toEqual([]);
    // @ts-expect-error testing invalid input
    expect(splitIntoChunks(null)).toEqual([]);
    // @ts-expect-error testing invalid input
    expect(splitIntoChunks(undefined)).toEqual([]);
  });

  it('should return single chunk if text fits in chunk size', () => {
    const text = 'Hello world';
    expect(splitIntoChunks(text, 20)).toEqual([text]);
  });

  it('should split text into multiple chunks', () => {
    const text = '1234567890';
    // Chunk size 5, overlap 0
    expect(splitIntoChunks(text, 5, 0)).toEqual(['12345', '67890']);
  });

  it('should handle overlap correctly', () => {
    const text = '1234567890';
    // Chunk size 6, overlap 2
    // 1. 0-6: "123456". Step = 6-0-2 = 4. Start=4.
    // 2. 4-10: "567890". Step = 10-4-2 = 4. Start=8.
    // 3. 8-10: "90". Step = max(10-8-2, 1) = 1. Start=9.
    // 4. 9-10: "0". Step = max(10-9-2, 1) = 1. Start=10.

    const chunks = splitIntoChunks(text, 6, 2);
    expect(chunks).toEqual(['123456', '567890', '90', '0']);
  });

  it('should respect max chunks limit', () => {
    // MAX_CHUNKS is 30
    const text = 'a'.repeat(100);
    const chunks = splitIntoChunks(text, 1, 0);
    expect(chunks.length).toBe(30);
  });

  it('should prioritize splitting at double newlines (paragraphs)', () => {
    // We want \n\n at index > 50% of chunk.
    // Chunk size 20. 50% is 10.
    // "0123456789012\n\n4567" -> \n\n starts at 13.
    // Split should happen at 13 + 2 = 15.

    const text = '0123456789012\n\n45678901234567890';

    const chunks = splitIntoChunks(text, 20, 0);
    // slice(0, 15) includes \n\n. trim() removes it.
    expect(chunks[0]).toBe('0123456789012');

    // Check next chunk starts after the split
    // start becomes 15.
    // "45678901234567890" (remaining)
    expect(chunks[1].startsWith('456')).toBe(true);
  });

  it('should prioritize splitting at single newlines if no paragraph', () => {
     const chunkSize = 20;
     const overlap = 0;
     // \n at 13.
     const text = '0123456789012\n45678901234567890';

     const chunks = splitIntoChunks(text, chunkSize, overlap);
     expect(chunks[0]).toBe('0123456789012');

     // Next chunk starts after \n.
     // start = 13 + 1 = 14.
     expect(chunks[1].startsWith('456')).toBe(true);
  });

  it('should fallback to hard split if no newlines found', () => {
    const text = '01234567890123456789012345';
    // Chunk size 10. No newlines.
    const chunks = splitIntoChunks(text, 10, 0);
    expect(chunks[0]).toBe('0123456789');
    expect(chunks[1]).toBe('0123456789');
    expect(chunks[2]).toBe('012345');
  });
});
