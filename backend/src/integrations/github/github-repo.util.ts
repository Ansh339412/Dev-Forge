const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

/** Accepts "owner/name" or a github.com URL. Returns null for anything else (no path tricks reach the API). */
export function parseRepository(input: string): { owner: string; name: string } | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '');
  if (!REPO_RE.test(cleaned)) return null;
  const [owner, name] = cleaned.split('/');
  if ([owner, name].some((part) => part === '.' || part === '..')) return null;
  return { owner, name };
}
