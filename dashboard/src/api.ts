/**
 * Single place that knows where the bot lives and how FastAPI reports failures.
 *
 * Every component should go through here rather than calling fetch directly,
 * so the base URL exists once and errors surface the same way everywhere.
 */

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

export { BASE as API_BASE };

/**
 * A failed request. `status` is 0 when the bot could not be reached at all
 * (connection refused, CORS, bot not running) as opposed to an HTTP error.
 *
 * Note: fields are declared explicitly rather than as constructor parameter
 * properties -- tsconfig sets `erasableSyntaxOnly`, which forbids those.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly ibErrorCode?: number;

  constructor(message: string, status: number, ibErrorCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.ibErrorCode = ibErrorCode;
  }
}

/**
 * Turn a non-ok Response into an ApiError.
 *
 * FastAPI's `detail` is a plain string for most endpoints, but /historical's
 * 502 path sends `{error, ib_error_code}` (see bot/api.py). Handle both, and
 * fall back gracefully when the body isn't JSON at all.
 */
async function toApiError(res: Response): Promise<ApiError> {
  let detail: unknown;
  try {
    detail = (await res.json())?.detail;
  } catch {
    return new ApiError(res.statusText || `Request failed (${res.status})`, res.status);
  }

  if (typeof detail === 'string' && detail) {
    return new ApiError(detail, res.status);
  }

  if (detail && typeof detail === 'object') {
    const { error, ib_error_code: code } = detail as { error?: string; ib_error_code?: number };
    const message = error || JSON.stringify(detail);
    return new ApiError(
      code ? `${message} (IB error ${code})` : message,
      res.status,
      code,
    );
  }

  return new ApiError(res.statusText || `Request failed (${res.status})`, res.status);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    // fetch only rejects on network-level failure, never on HTTP status.
    throw new ApiError(`Cannot reach the bot at ${BASE}. Is it running?`, 0);
  }

  if (!res.ok) throw await toApiError(res);

  return (await res.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, data?: any): Promise<T> {
  const init: RequestInit = { method: 'POST' };
  if (data !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(data);
  }
  return request<T>(path, init);
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

/** Message suitable for showing a user, from anything thrown by the helpers above. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}
