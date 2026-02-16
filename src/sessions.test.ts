import { describe, it, expect } from 'vitest';
import { generateTitle } from './sessions';
import { ChatMessage } from './gemini';

describe('generateTitle', () => {
  it('returns "New Chat" when message list is empty', () => {
    const messages: ChatMessage[] = [];
    expect(generateTitle(messages)).toBe('New Chat');
  });

  it('returns "New Chat" when no user message exists', () => {
    const messages: ChatMessage[] = [
      { role: 'model', parts: [{ text: 'Hello' }] }
    ];
    expect(generateTitle(messages)).toBe('New Chat');
  });

  it('extracts title from legacy frontend format (msg.content)', () => {
    // casting to any to simulate legacy format
    const messages: any[] = [
      { role: 'user', content: 'Legacy title format' }
    ];
    expect(generateTitle(messages)).toBe('Legacy title format');
  });

  it('extracts title from backend format (msg.parts)', () => {
    const messages: ChatMessage[] = [
      { role: 'user', parts: [{ text: 'Backend title format' }] }
    ];
    expect(generateTitle(messages)).toBe('Backend title format');
  });

  it('joins multiple parts with space', () => {
    const messages: ChatMessage[] = [
      { role: 'user', parts: [{ text: 'Hello' }, { text: 'World' }] }
    ];
    expect(generateTitle(messages)).toBe('Hello World');
  });

  it('trims whitespace', () => {
    const messages: ChatMessage[] = [
      { role: 'user', parts: [{ text: '  Trim me  ' }] }
    ];
    expect(generateTitle(messages)).toBe('Trim me');
  });

  it('returns "New Chat" if text is empty after trimming', () => {
    const messages: ChatMessage[] = [
      { role: 'user', parts: [{ text: '   ' }] }
    ];
    expect(generateTitle(messages)).toBe('New Chat');
  });

  it('truncates long titles to 40 chars + ...', () => {
    const longText = 'This is a very long title that should be truncated because it exceeds forty characters';
    // "This is a very long title that should be" is 40 chars
    const expected = 'This is a very long title that should be...';

    const messages: ChatMessage[] = [
      { role: 'user', parts: [{ text: longText }] }
    ];
    expect(generateTitle(messages)).toBe(expected);
  });

  it('handles mixed content correctly (prioritizes content over parts if both exist)', () => {
      // The code checks for msg.content first
      const messages: any[] = [
          { role: 'user', content: 'Content', parts: [{ text: 'Parts' }] }
      ];
      expect(generateTitle(messages)).toBe('Content');
  });
});
