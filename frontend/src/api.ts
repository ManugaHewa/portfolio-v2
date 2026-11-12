import type { ProjectDetail, ProjectSummary } from "./types";
import { recordProjectsTiming } from "./lib/liveStats";

const BASE = "/api";

/** A request the server answered with an error status, carrying that status. */
export class HttpError extends Error {
  constructor(
    path: string,
    readonly httpStatus: number,
  ) {
    super(`Request to ${path} failed with ${httpStatus}`);
  }
}

async function requestWithStatus<T>(path: string, init?: RequestInit): Promise<{ body: T; httpStatus: number }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    throw new HttpError(path, res.status);
  }

  return { body: (await res.json()) as T, httpStatus: res.status };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await requestWithStatus<T>(path, init)).body;
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

/**
 * The project list, timed: how long this visit's request took and how many
 * projects came back go to the live readout (lib/liveStats.ts). A failure is
 * recorded as one, never as a number.
 */
async function getProjects(): Promise<ProjectSummary[]> {
  const start = performance.now();
  try {
    const list = await request<ProjectSummary[]>("/projects");
    recordProjectsTiming({ ok: true, ms: Math.max(1, Math.round(performance.now() - start)), count: list.length });
    return list;
  } catch (err) {
    recordProjectsTiming({ ok: false });
    throw err;
  }
}

export const api = {
  getProjects,
  getProject: (slug: string) => request<ProjectDetail>(`/projects/${slug}`),
  /** Also hands back the HTTP status the server answered with, which the page shows. */
  sendContactMessage: async (data: ContactPayload): Promise<{ status: string; httpStatus?: number }> => {
    const { body, httpStatus } = await requestWithStatus<{ status: string }>("/contact", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return { ...body, httpStatus };
  },
};
