// Fetch helper for the v2 API.
//
// In a browser session, the cookie is sent automatically (credentials: "include").
// For programmatic use, pass `token` to attach an `Authorization: Bearer` header.
// Errors are normalized to { code, message, fields } and thrown.

const DEFAULT_BASE = "/api/v2";

class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function request(path, { method = "GET", body, token, base = DEFAULT_BASE } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let payload = null;
  const text = await res.text();
  if (text) {
    try { payload = JSON.parse(text); } catch { /* leave null */ }
  }

  if (!res.ok) {
    const detail = payload?.detail ?? payload;
    const err = detail?.error ?? {};
    throw new ApiError(res.status, err.code ?? "internal", err.message ?? res.statusText, err.fields);
  }

  return payload;
}

export const api = {
  request,
  me: () => request("/me"),
  tokens: {
    list: () => request("/tokens"),
    create: (name) => request("/tokens", { method: "POST", body: { name } }),
    revoke: (id) => request(`/tokens/${id}`, { method: "DELETE" }),
  },
  projects: {
    list: () => request("/projects"),
    create: (name) => request("/projects", { method: "POST", body: { name } }),
    detail: (id) => request(`/projects/${id}`),
  },
  tasks: {
    list: (projectId, params) => {
      const q = params ? `?${new URLSearchParams(params).toString()}` : "";
      return request(`/projects/${projectId}/tasks${q}`);
    },
    create: (projectId, body) =>
      request(`/projects/${projectId}/tasks`, { method: "POST", body }),
    move: (projectId, taskId, body) =>
      request(`/projects/${projectId}/tasks/${taskId}/move`, { method: "POST", body }),
    update: (projectId, taskId, body) =>
      request(`/projects/${projectId}/tasks/${taskId}`, { method: "PATCH", body }),
    remove: (projectId, taskId) =>
      request(`/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" }),
  },
  comments: {
    list: (projectId, taskId) =>
      request(`/projects/${projectId}/tasks/${taskId}/comments`),
    create: (projectId, taskId, body_md) =>
      request(`/projects/${projectId}/tasks/${taskId}/comments`, {
        method: "POST",
        body: { body_md },
      }),
    remove: (commentId) =>
      request(`/comments/${commentId}`, { method: "DELETE" }),
  },
  attachments: {
    list: (projectId, taskId) =>
      request(`/projects/${projectId}/tasks/${taskId}/attachments`),
    upload: async (projectId, taskId, file) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${DEFAULT_BASE}/projects/${projectId}/tasks/${taskId}/attachments`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const text = await res.text();
      let payload = null;
      if (text) { try { payload = JSON.parse(text); } catch { /* leave null */ } }
      if (!res.ok) {
        const err = payload?.detail?.error ?? payload?.detail ?? {};
        throw new ApiError(res.status, err.code ?? "internal", err.message ?? res.statusText, err.fields);
      }
      return payload;
    },
    rawUrl: (id) => `${DEFAULT_BASE}/attachments/${id}/raw`,
    remove: (id) => request(`/attachments/${id}`, { method: "DELETE" }),
  },
  activity: {
    list: (projectId, params) => {
      const q = params ? `?${new URLSearchParams(params).toString()}` : "";
      return request(`/projects/${projectId}/activity${q}`);
    },
  },
  members: {
    list: (projectId) => request(`/projects/${projectId}/members`),
    invite: (projectId, email, role) =>
      request(`/projects/${projectId}/members`, { method: "POST", body: { email, role } }),
    changeRole: (projectId, userId, role) =>
      request(`/projects/${projectId}/members/${userId}`, { method: "PATCH", body: { role } }),
    remove: (projectId, userId) =>
      request(`/projects/${projectId}/members/${userId}`, { method: "DELETE" }),
  },
};

export { ApiError };
