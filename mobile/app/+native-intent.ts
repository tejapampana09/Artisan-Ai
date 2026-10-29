/** Reject malformed external URLs before Expo Router's legacy query decoder runs. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (typeof path !== 'string' || path.length > 8192) return '/';
  try {
    // Validate only: returning the original preserves encoded slashes and query values.
    // The platform decoder fails immediately instead of recursively repairing bad UTF-8.
    decodeURIComponent(path);
    // Preserve the existing Google OAuth custom-scheme callback normalization.
    if (path.includes('oauth2redirect')) {
      const queryIndex = path.indexOf('?');
      const query = queryIndex !== -1 ? path.substring(queryIndex) : '';
      return `/oauth2redirect${query}`;
    }
    return path;
  } catch {
    return '/';
  }
}
