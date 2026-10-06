import type { ProjectDetail, ProjectSummary } from "./types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    throw new Error(`Request to ${path} failed with ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/** Mirrors the strict Zod schema in backend/src/routes/contact.ts. */
export interface ContactPayload {
  name: string;
  email: string;
  message: string;
  /** The honeypot. Always empty when a person fills in the form. */
  website: string;
  /** Milliseconds between the form appearing and this send. */
  elapsedMs: number;
  /** Only sent when Turnstile is switched on. */
  turnstileToken?: string;
}

export const api = {
  getProjects: () => request<ProjectSummary[]>("/projects"),
  getProject: (slug: string) => request<ProjectDetail>(`/projects/${slug}`),
  sendContactMessage: (data: ContactPayload) =>
    request<{ status: string }>("/contact", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
