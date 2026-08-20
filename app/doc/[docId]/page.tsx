import { DocumentEditorClient } from "./client";

interface PageProps {
  params: Promise<{ docId: string }>;
}

export function generateStaticParams() {
  return [
    { docId: "demo" },
    { docId: "new" },
    { docId: "getting-started" },
    { docId: "q3-planning-doc" },
    { docId: "design-system-spec" },
    { docId: "blank" },
    { docId: "proposal" },
    { docId: "resume" },
    { docId: "notes" },
  ];
}

export default async function DocumentEditorPage({ params }: PageProps) {
  const resolvedParams = await params;
  return <DocumentEditorClient docId={resolvedParams.docId} />;
}
