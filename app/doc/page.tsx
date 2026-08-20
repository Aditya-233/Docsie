"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { DocumentEditorClient } from "./[docId]/client";
import { Loader2 } from "lucide-react";

function DocRouter() {
  const searchParams = useSearchParams();
  const [docId, setDocId] = useState<string>("demo");

  useEffect(() => {
    const idFromQuery = searchParams?.get("id") || searchParams?.get("docId");
    if (idFromQuery) {
      setDocId(idFromQuery);
    } else if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qId = params.get("id") || params.get("docId");
      if (qId) {
        setDocId(qId);
      } else {
        const hash = window.location.hash.replace(/^#/, "");
        if (hash) setDocId(hash);
      }
    }
  }, [searchParams]);

  return <DocumentEditorClient docId={docId} />;
}

export default function GenericDocPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f9fbfd]">
          <Loader2 className="w-9 h-9 text-blue-600 animate-spin" />
        </div>
      }
    >
      <DocRouter />
    </Suspense>
  );
}
