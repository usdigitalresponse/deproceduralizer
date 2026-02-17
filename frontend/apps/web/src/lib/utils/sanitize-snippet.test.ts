import { describe, it, expect } from 'vitest';
import { sanitizeSnippet } from './sanitize-snippet';

describe('sanitizeSnippet', () => {
  it('preserves <mark> tags', () => {
    expect(sanitizeSnippet('hello <mark>world</mark>')).toBe('hello <mark>world</mark>');
  });

  it('preserves multiple <mark> tags', () => {
    expect(sanitizeSnippet('<mark>one</mark> and <mark>two</mark>'))
      .toBe('<mark>one</mark> and <mark>two</mark>');
  });

  it('strips <script> tags', () => {
    expect(sanitizeSnippet('hello <script>alert("xss")</script> world'))
      .toBe('hello alert("xss") world');
  });

  it('strips <a> tags but keeps text content', () => {
    expect(sanitizeSnippet('see <a href="http://example.com">link</a> here'))
      .toBe('see link here');
  });

  it('strips <img> tags', () => {
    expect(sanitizeSnippet('before <img src="x.png"/> after'))
      .toBe('before  after');
  });

  it('returns empty string unchanged', () => {
    expect(sanitizeSnippet('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(sanitizeSnippet('no tags here')).toBe('no tags here');
  });
});
