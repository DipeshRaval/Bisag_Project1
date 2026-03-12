const runtimeHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
const fallbackApiBase = `http://${runtimeHost}:3000`
const API_BASE_URL = (import.meta.env.VITE_API_URL || fallbackApiBase).replace(/\/$/, '')
const API_DEBUG = String(import.meta.env.VITE_API_DEBUG || '').toLowerCase() === 'true'

const buildHeaders = (options = {}) => {
  if (options.body === undefined || options.body instanceof FormData) {
    return options.headers || {}
  }
  return {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
}

export const apiFetch = (path, options = {}) => {
  const url = `${API_BASE_URL}${path}`
  const headers = buildHeaders(options)
  const base = {
    credentials: 'include',
    ...options,
    headers,
  }
  if (options.body instanceof FormData) {
    base.headers = options.headers || {}
  }
  if (API_DEBUG) {
    console.log('[API DEBUG] Request', {
      method: base.method || 'GET',
      url,
      body: typeof base.body === 'string' ? base.body : base.body ? '[non-string-body]' : undefined,
    })
  }
  return fetch(url, base)
}

export const apiFetchJson = async (path, options = {}) => {
  const res = await apiFetch(path, options)
  const text = await res.text()
  let data = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }

  if (API_DEBUG) {
    console.log('[API DEBUG] Response', {
      url: `${API_BASE_URL}${path}`,
      status: res.status,
      ok: res.ok,
      data,
    })
  }

  return { res, data }
}

export { API_BASE_URL, API_DEBUG }
