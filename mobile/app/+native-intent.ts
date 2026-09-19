export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    if (!path) return path;

    // Handle Google OAuth custom scheme redirect
    // (e.g. "artisanai://oauth2redirect?code=..." or "artisanai:/oauth2redirect?code=...")
    if (path.includes("oauth2redirect")) {
      const queryIndex = path.indexOf("?");
      const query = queryIndex !== -1 ? path.substring(queryIndex) : "";
      return `/oauth2redirect${query}`;
    }
  } catch (err) {
    console.warn("native-intent redirectSystemPath error:", err);
  }
  return path;
}
