"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { extractSpaRedirectTarget, resolveHistoryPath } from "@/lib/spa-routing";

/**
 * GitHubPagesRedirect
 *
 * Client-side redirect handler for GitHub Pages Single Page Applications.
 * When GitHub Pages serves 404.html on direct navigation/hard-reload of dynamic routes
 * (e.g., /Docsie/doc/[docId] or /Docsie/auth/callback), 404.html redirects to /Docsie/?p=<target>.
 *
 * This component runs on mount, extracts the ?p= parameter, uses window.history.replaceState
 * to cleanly restore the destination in the browser address bar, and instructs Next.js router
 * to navigate to the target route smoothly without losing path, query params, or hash.
 */
export function GitHubPagesRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let redirectParam: string | null = null;

    if (searchParams?.has("p")) {
      redirectParam = searchParams.get("p");
    } else if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      redirectParam = params.get("p");
    }

    const target = extractSpaRedirectTarget(redirectParam);
    if (!target) return;

    let routeTarget = target;
    const docMatch = target.match(/^\/doc\/([a-zA-Z0-9_-]+)/);
    const preRendered = [
      "demo",
      "new",
      "getting-started",
      "q3-planning-doc",
      "design-system-spec",
      "blank",
      "proposal",
      "resume",
      "notes",
    ];
    if (docMatch && !preRendered.includes(docMatch[1])) {
      routeTarget = `/doc?id=${encodeURIComponent(docMatch[1])}`;
    }

    if (typeof window !== "undefined") {
      const historyPath = resolveHistoryPath(target, window.location.pathname);
      window.history.replaceState(null, "", historyPath);
    }

    router.replace(routeTarget);
  }, [router, searchParams]);

  return null;
}
