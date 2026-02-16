/**
 * Sanitize ts_headline HTML snippets to allow only <mark> tags.
 * The snippet comes from PostgreSQL's ts_headline function which uses
 * trusted database content, but we strip everything else for defense-in-depth.
 */
export function sanitizeSnippet(html: string): string {
  // Replace all HTML tags except <mark> and </mark>
  return html.replace(/<(?!\/?mark\b)[^>]*>/gi, '');
}
