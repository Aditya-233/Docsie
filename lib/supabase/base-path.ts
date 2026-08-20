/**
 * Utility functions for resolving base paths and OAuth redirect URLs across
 * GitHub Pages (e.g. /Docsie) and local development environments.
 */

export function getBasePath(): string {
  // If explicitly configured at build time via env
  if (process.env.NEXT_PUBLIC_BASE_PATH) {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH.replace(/\/$/, "");
    return basePath.startsWith("/") ? basePath : `/${basePath}`;
  }

  // Browser-side dynamic fallback for GitHub Pages repo subpaths
  if (typeof window !== "undefined") {
    if (window.location.pathname.startsWith("/Docsie")) {
      return "/Docsie";
    }
  }

  return "";
}

export function getAuthRedirectUrl(nextPath: string = "/"): string {
  const basePath = getBasePath();
  const normalizedNext = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;

  if (typeof window === "undefined") {
    return `${basePath}/auth/callback?next=${encodeURIComponent(normalizedNext)}`;
  }

  const origin = window.location.origin;
  return `${origin}${basePath}/auth/callback?next=${encodeURIComponent(normalizedNext)}`;
}
