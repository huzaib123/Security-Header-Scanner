const MAX_URL_LENGTH = 2048;

// Turns user input like "Example.com/login#top" into a canonical URL. Adds
// https:// when no scheme is given, lowercases the host, drops the default
// port and the fragment. The returned key is used for caching and history.
export function normalizeUrl(input) {
  if (typeof input !== 'string') throw new TypeError('URL must be a string');
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) throw new TypeError('URL is empty or too long');

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw new TypeError('This is not a valid web address');
  }
  if (!url.hostname || !url.hostname.includes('.') && !url.hostname.startsWith('[') && url.hostname !== 'localhost') {
    throw new TypeError('Enter a full domain such as example.com');
  }
  url.hash = '';
  const key = `${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}${url.search}`.toLowerCase();
  return { url, href: url.href, key };
}
