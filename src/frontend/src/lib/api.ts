type ApiRequest = Omit<RequestInit, "body"> & {
  body?: BodyInit | null;
  json?: unknown;
};

type ErrorPayload = {
  error?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: ApiRequest = {}) {
  const headers = new Headers(options.headers);
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers,
    body: options.json === undefined ? options.body : JSON.stringify(options.json),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await readJson(response)) as T | ErrorPayload | null;
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? payload.error
        : undefined;
    throw new ApiError(message ?? "Request failed", response.status);
  }

  return payload as T;
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text) as unknown;
}
