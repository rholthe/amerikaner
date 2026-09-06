export class ApiFeil extends Error {
  status: number;
  constructor(status: number, melding: string) {
    super(melding);
    this.status = status;
  }
}

async function kall<T>(metode: string, sti: string, data?: unknown): Promise<T> {
  const res = await fetch(sti, {
    method: metode,
    headers: data !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: data !== undefined ? JSON.stringify(data) : undefined,
    credentials: "same-origin",
  });
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* tomt svar */
  }
  if (!res.ok) {
    const melding =
      (payload as { error?: string } | null)?.error ?? `Feil (${res.status})`;
    throw new ApiFeil(res.status, melding);
  }
  return payload as T;
}

export const api = {
  get: <T>(sti: string) => kall<T>("GET", sti),
  post: <T>(sti: string, data?: unknown) => kall<T>("POST", sti, data ?? {}),
  put: <T>(sti: string, data?: unknown) => kall<T>("PUT", sti, data ?? {}),
  patch: <T>(sti: string, data?: unknown) => kall<T>("PATCH", sti, data ?? {}),
  delete: <T>(sti: string, data?: unknown) => kall<T>("DELETE", sti, data),
};

/** Fetcher for SWR. Generisk slik at useSWR<T> beholder typen sin. */
export function hentJson<T>(sti: string): Promise<T> {
  return api.get<T>(sti);
}
