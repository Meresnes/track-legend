import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

export const metadata = {
  title: "API Docs | Track Legend",
  description: "Interactive OpenAPI reference for the Track Legend BFF.",
};

export const scalarConfiguration = {
  theme: "saturn",
  darkMode: true,
  layout: "classic",
  showSidebar: true,
  hideDownloadButton: false,
  url: "/api/openapi.json",
} as const;

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-[var(--tl-bg-primary)]">
      <ApiReferenceReact configuration={scalarConfiguration} />
    </main>
  );
}
