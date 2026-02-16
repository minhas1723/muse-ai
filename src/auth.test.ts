import { describe, it, expect } from 'vitest';
import { extractCodeFromUrl } from './auth';

describe('extractCodeFromUrl', () => {
  it('should extract code from a valid redirect URL', () => {
    const url = 'http://localhost:8085/oauth2callback?code=4/0AfgkS...&scope=email';
    expect(extractCodeFromUrl(url)).toBe('4/0AfgkS...');
  });

  it('should extract code from a URL with other query parameters', () => {
    const url = 'http://localhost:8085/oauth2callback?state=xyz&code=abc12345&scope=profile';
    expect(extractCodeFromUrl(url)).toBe('abc12345');
  });

  it('should throw an error if the URL contains an error parameter', () => {
    const url = 'http://localhost:8085/oauth2callback?error=access_denied';
    expect(() => extractCodeFromUrl(url)).toThrow('Google OAuth error: access_denied');
  });

  it('should return the input string if it is a raw code', () => {
    const rawCode = '4/0AfgkS...';
    expect(extractCodeFromUrl(rawCode)).toBe('4/0AfgkS...');
  });

  it('should handle whitespace in raw code', () => {
    const rawCode = '  4/0AfgkS...  ';
    expect(extractCodeFromUrl(rawCode)).toBe('4/0AfgkS...');
  });

  it('should return null for empty string', () => {
    expect(extractCodeFromUrl('')).toBeNull();
  });

  it('should return null for whitespace only string', () => {
    expect(extractCodeFromUrl('   ')).toBeNull();
  });

  it('should return null if URL has no code parameter', () => {
    const url = 'http://localhost:8085/oauth2callback?state=xyz';
    expect(extractCodeFromUrl(url)).toBeNull();
  });

  it('should return input if string is not a URL but contains :// (invalid url treated as code)', () => {
    // This triggers the try block but new URL() throws, so it falls back to raw string
    const invalidUrl = '://';
    expect(extractCodeFromUrl(invalidUrl)).toBe('://');
  });
});
