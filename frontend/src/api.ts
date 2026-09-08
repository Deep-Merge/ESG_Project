import type { AuditRow, DocumentRow, Entry, Overview, QAPair, ReviewBundle, Taxonomy } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.headers.get("content-type")?.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return undefined as T;
}

export const api = {
  overview: () => request<Overview>("/api/overview"),
  taxonomy: () => request<Taxonomy>("/api/taxonomy"),
  documents: () => request<DocumentRow[]>("/api/documents"),
  document: (id: string) => request<DocumentRow>(`/api/documents/${id}`),
  review: (id: string) => request<ReviewBundle>(`/api/documents/${id}/review`),
  entries: (status = "approved") => request<Entry[]>(`/api/entries?status=${status}`),
  entry: (id: string) => request<{ entry: Entry; history: AuditRow[] }>(`/api/entries/${id}`),
  search: (q: string) => request<Entry[]>(`/api/search?q=${encodeURIComponent(q)}`),
  qa: () => request<QAPair[]>("/api/qa"),
  audit: () => request<AuditRow[]>("/api/audit"),

  upload: async (file: File, reviewer: string) => {
    const body = new FormData();
    body.append("file", file);
    body.append("reviewer", reviewer);
    return request<DocumentRow>("/api/documents", { method: "POST", body });
  },

  reviewEntry: (id: string, payload: { action: string; body?: string; tags?: string[]; reviewer?: string }) =>
    request<Entry>(`/api/entries/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  importReview: async (documentId: string, file: File, reviewer: string) => {
    const body = new FormData();
    body.append("file", file);
    body.append("reviewer", reviewer);
    return request<{ applied: number; found: number }>(`/api/documents/${documentId}/import-review`, {
      method: "POST",
      body,
    });
  },

  addQa: (payload: { question: string; answer: string; tags: string[]; source_document: string }) =>
    request<QAPair>("/api/qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  downloadMarked: (id: string) => {
    window.open(`/api/documents/${id}/download`, "_blank");
  },

  exportPack: async () => {
    const res = await fetch("/api/export/sharepoint", { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sharepoint-pack.zip";
    a.click();
    URL.revokeObjectURL(url);
  },
};
