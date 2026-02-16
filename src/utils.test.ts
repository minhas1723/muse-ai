import { describe, it, expect } from 'vitest';
import { messagesToApiHistory, MAX_HISTORY_MESSAGES } from './utils';
import type { Message } from './types';

describe('messagesToApiHistory', () => {
  it('should convert user messages correctly', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello' }
    ];
    const result = messagesToApiHistory(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: 'user',
      parts: [{ text: 'Hello' }]
    });
  });

  it('should convert assistant messages to model messages', () => {
    const messages: Message[] = [
      { role: 'assistant', content: 'Hi there' }
    ];
    const result = messagesToApiHistory(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: 'model',
      parts: [{ text: 'Hi there' }]
    });
  });

  it('should filter out messages with empty content', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Valid' },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'Also valid' }
    ];
    const result = messagesToApiHistory(messages);
    expect(result).toHaveLength(2);
    expect(result[0].parts[0].text).toBe('Valid');
    expect(result[1].parts[0].text).toBe('Also valid');
  });

  it('should apply sliding window (limit to MAX_HISTORY_MESSAGES)', () => {
    const messages: Message[] = Array.from({ length: MAX_HISTORY_MESSAGES + 5 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`
    }));

    const result = messagesToApiHistory(messages);

    expect(result).toHaveLength(MAX_HISTORY_MESSAGES);
    // Should contain the last MAX_HISTORY_MESSAGES
    // The last message index is MAX_HISTORY_MESSAGES + 4
    // The first message in result should correspond to index 5
    expect(result[0].parts[0].text).toBe('Message 5');
    expect(result[MAX_HISTORY_MESSAGES - 1].parts[0].text).toBe(`Message ${MAX_HISTORY_MESSAGES + 4}`);
  });

  it('should handle mixed scenarios (filtering + sliding window)', () => {
    // Create messages where every other message is empty
    // Total valid messages should exceed MAX_HISTORY_MESSAGES to test slicing after filtering
    const totalValid = MAX_HISTORY_MESSAGES + 5;
    const messages: Message[] = [];

    for (let i = 0; i < totalValid * 2; i++) {
        messages.push({
            role: 'user',
            content: i % 2 === 0 ? `Valid ${i}` : '' // Even indices are valid
        });
    }

    const result = messagesToApiHistory(messages);

    expect(result).toHaveLength(MAX_HISTORY_MESSAGES);
    // The last valid message was at index (totalValid * 2) - 2 -> "Valid 58" (if totalValid=30)
    // 30 valid messages. We want last 25.
    // 30 - 25 = 5. So we skip first 5 valid messages.
    // The valid messages are: Valid 0, Valid 2, Valid 4, ..., Valid 58.
    // Skipped: Valid 0, Valid 2, Valid 4, Valid 6, Valid 8.
    // First in result should be Valid 10.

    // Check first item
    expect(result[0].parts[0].text).toBe('Valid 10');

    // Check last item
    const lastIndex = (totalValid * 2) - 2;
    expect(result[MAX_HISTORY_MESSAGES - 1].parts[0].text).toBe(`Valid ${lastIndex}`);
  });
});
