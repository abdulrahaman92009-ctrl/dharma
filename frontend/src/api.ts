
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

export type ApiOptions = {
  method?: string;
  token?: string;
  body?: unknown;
};

export async function apiRequest<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: options.method || "GET",
    headers,
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data as T;
}

export const api = {
  register: (body: { name: string; email: string; password: string }) =>
    apiRequest("/api/auth/register", { method: "POST", body }),

  login: (body: { email: string; password: string }) =>
    apiRequest("/api/auth/login", { method: "POST", body }),

  me: (token: string) =>
    apiRequest("/api/me", { token }),

  updateProfile: (token: string, body: { name?: string; bio?: string }) =>
    apiRequest("/api/me", { method: "PATCH", token, body }),

  members: (token: string, q = "") =>
    apiRequest(`/api/members?q=${encodeURIComponent(q)}`, { token }),

  rooms: (token: string) =>
    apiRequest("/api/rooms", { token }),

  joinRoom: (token: string, roomId: string) =>
    apiRequest(`/api/rooms/${roomId}/join`, {
      method: "POST",
      token,
      body: {},
    }),

  roomMessages: (token: string, roomId: string) =>
    apiRequest(`/api/rooms/${roomId}/messages`, { token }),

  sendRoomMessage: (token: string, roomId: string, body: string) =>
    apiRequest(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      token,
      body: { body },
    }),
};
