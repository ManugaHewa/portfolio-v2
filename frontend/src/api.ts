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

export const api = {
  getProjects: () => request<ProjectSummary[]>("/projects"),
  getProject: (slug: string) => request<ProjectDetail>(`/projects/${slug}`),
  sendContactMessage: (data: { name: string; email: string; message: string }) =>
    request<{ id: string; status: string }>("/contact", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
