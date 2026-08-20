/**
 * Utility functions for GitHub Pages Single Page Application (SPA) routing and 404 redirect handling.
 */

export interface ParsedSpaRedirect {
  targetPath: string | null;
  historyPath: string | null;
  isValid: boolean;
}

/**
 * Extracts and sanitizes the SPA redirect target from a query string or URL parameter.
 * Enforces security validations to avoid open redirects.
 */
export function extractSpaRedirectTarget(param: string | null | undefined): string | null {
  if (!param) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(param);
  } catch {
    decoded = param;
  }

  // Security check: Must start with single '/' and NOT be protocol-relative ('//') or start with schema ('http:')
  if (
    decoded.startsWith("/") &&
    !decoded.startsWith("//") &&
    !decoded.includes("\\") &&
    !decoded.startsWith("/\\")
  ) {
    return decoded;
  }

  return null;
}

/**
 * Generates the redirect URL intended for 404.html to return to the SPA entry point with ?p=
 */
export function buildSpaRedirectUrl(
  pathname: string,
  search: string = "",
  hash: string = "",
  repoPrefix: string = "/Docsie"
): string {
  const cleanPath = pathname || "/";
  const isRepo = cleanPath === repoPrefix || cleanPath.startsWith(repoPrefix + "/");
  const prefix = isRepo ? repoPrefix : "";
  let subPath = isRepo ? cleanPath.slice(repoPrefix.length) : cleanPath;
  if (!subPath.startsWith("/")) {
    subPath = "/" + subPath;
  }

  const fullTarget = subPath + (search || "") + (hash || "");
  return `${prefix}/?p=${encodeURIComponent(fullTarget)}`;
}

/**
 * Resolves the full browser history URL to update address bar after SPA redirect
 */
export function resolveHistoryPath(
  target: string,
  currentPath: string,
  repoPrefix: string = "/Docsie"
): string {
  const isRepo = currentPath === repoPrefix || currentPath.startsWith(repoPrefix + "/");
  return (isRepo ? repoPrefix : "") + target;
}
