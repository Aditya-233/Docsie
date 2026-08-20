"use client";

import { useEffect } from "react";
import { buildSpaRedirectUrl } from "@/lib/spa-routing";

export default function NotFound() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const pathname = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;

    // Check if the current path is a real route needing redirect
    if (
      pathname &&
      !pathname.endsWith("/404") &&
      !pathname.endsWith("/404.html") &&
      !pathname.endsWith("/_not-found") &&
      !pathname.endsWith("/_not-found.html")
    ) {
      const redirectUrl = buildSpaRedirectUrl(pathname, search, hash, "/Docsie");
      window.location.replace(redirectUrl);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f9fbfd] text-center p-4">
      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
      <h2 className="text-xl font-medium text-gray-800">Redirecting to Google Docs...</h2>
      <p className="text-sm text-gray-500 mt-1">Please wait while we route your request.</p>
    </div>
  );
}
