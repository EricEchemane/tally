// Same-origin calls; next.config.ts rewrites /api/* to FastAPI.
export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API ${status}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, json?: unknown) =>
    request<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: json === undefined ? undefined : JSON.stringify(json) }),
  patch: <T>(path: string, json: unknown) =>
    request<T>(path, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(json) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, files: FileList | File[]) => {
    const form = new FormData();
    for (const f of Array.from(files)) form.append("images", f);
    return request<T>(path, { method: "POST", body: form });
  },
};

export const peso = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-PH", { style: "currency", currency: "PHP" });
