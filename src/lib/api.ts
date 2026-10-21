"use client";
import type { ApiError, ErrorCode } from "@/shared/types";

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode | "network",
    message: string,
    public readonly body?: ApiError,
  ) {
    super(message);
  }
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  json?: unknown;
  form?: FormData;
  /** Reuse the same key across retries of one user action (Constitution III). */
  idempotencyKey?: string;
  retries?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch wrapper: idempotency key per action, retries on network errors, typed API errors. */
export async function api<T>(url: string, opts: Options = {}): Promise<T> {
  const method = opts.method ?? (opts.json || opts.form ? "POST" : "GET");
  const headers: Record<string, string> = {};
  if (method !== "GET") headers["Idempotency-Key"] = opts.idempotencyKey ?? crypto.randomUUID();
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  const retries = opts.retries ?? 3;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { method, headers, body, credentials: "same-origin" });
    } catch {
      if (attempt >= retries) throw new ApiRequestError(0, "network", "No connection. Try again.");
      await sleep(500 * 2 ** attempt);
      continue;
    }
    if (res.status >= 502 && res.status <= 504 && attempt < retries) {
      await sleep(500 * 2 ** attempt);
      continue;
    }
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => undefined);
    if (!res.ok) {
      const err = data as ApiError | undefined;
      throw new ApiRequestError(
        res.status,
        err?.error ?? "invalid_request",
        err?.message ?? `Request failed (${res.status})`,
        err,
      );
    }
    return data as T;
  }
}
