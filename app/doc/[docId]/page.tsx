import { DocumentEditorClient } from "./client";
import { PRE_RENDERED_DOC_IDS } from "@/lib/storage";

interface PageProps {
  params: Promise<{ docId: string }>;
}

export function generateStaticParams() {
  return PRE_RENDERED_DOC_IDS.map((docId) => ({ docId }));
}

export default async function DocumentEditorPage({ params }: PageProps) {
  const resolvedParams = await params;
  return <DocumentEditorClient docId={resolvedParams.docId} />;
}
