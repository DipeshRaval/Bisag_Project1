const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

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
  return fetch(url, base)
}

export { API_BASE_URL }
