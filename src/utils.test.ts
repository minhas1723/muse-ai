import { describe, it, expect } from 'vitest';
import { messagesToApiHistory, MAX_HISTORY_MESSAGES } from './utils';
import type { Message } from './types';

describe('messagesToApiHistory', () => {
  it('should correctly map user and assistant messages to API format', () => {
    const input: Message[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];

    const result = messagesToApiHistory(input);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      role: 'user',
      parts: [{ text: 'Hello' }],
    });
    expect(result[1]).toEqual({
      role: 'model',
      parts: [{ text: 'Hi there' }],
    });
  });

  it('should filter out messages with empty content', () => {
    const input: Message[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: '' },
      { role: 'user', content: ' ' }, // Assuming strict empty string check, but code uses `m.content` which is truthy check?
      // filter(m => m.content) checks for truthy value. Empty string is falsy.
      // String with space is truthy.
      { role: 'assistant', content: 'Response' },
    ];

    const result = messagesToApiHistory(input);

    // ' ' is truthy so it should be kept.
    // '' is falsy so it should be removed.
    expect(result).toHaveLength(3);
    expect(result[0].parts[0].text).toBe('Hello');
    expect(result[1].parts[0].text).toBe(' ');
    expect(result[2].parts[0].text).toBe('Response');
  });

  it('should only return the last MAX_HISTORY_MESSAGES', () => {
    const input: Message[] = [];
    // Create more messages than the limit
    const totalMessages = MAX_HISTORY_MESSAGES + 5;
    for (let i = 0; i < totalMessages; i++) {
      input.push({ role: 'user', content: `Message ${i}` });
    }

    const result = messagesToApiHistory(input);

    expect(result).toHaveLength(MAX_HISTORY_MESSAGES);
    // The last message should be the last one from input
    expect(result[result.length - 1].parts[0].text).toBe(`Message ${totalMessages - 1}`);
    // The first message in result should be the one at index 5 of input (since we skip first 5)
    expect(result[0].parts[0].text).toBe('Message 5');
  });

  it('should handle mixed scenarios of filtering and sliding window', () => {
    const input: Message[] = [];
    // Add 5 empty messages
    for (let i = 0; i < 5; i++) {
      input.push({ role: 'user', content: '' });
    }
    // Add MAX_HISTORY_MESSAGES + 5 valid messages
    const totalValid = MAX_HISTORY_MESSAGES + 5;
    for (let i = 0; i < totalValid; i++) {
      input.push({ role: 'user', content: `Valid ${i}` });
    }

    const result = messagesToApiHistory(input);

    expect(result).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(result[result.length - 1].parts[0].text).toBe(`Valid ${totalValid - 1}`);
    expect(result[0].parts[0].text).toBe('Valid 5');
  });
});
