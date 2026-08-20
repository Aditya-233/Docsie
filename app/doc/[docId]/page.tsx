import { DocumentEditorClient } from "./client";

interface PageProps {
  params: Promise<{ docId: string }>;
}

export function generateStaticParams() {
  return [{ docId: "demo" }, { docId: "new" }];
}

export default async function DocumentEditorPage({ params }: PageProps) {
  const resolvedParams = await params;
  return <DocumentEditorClient docId={resolvedParams.docId} />;
}
