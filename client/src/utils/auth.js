const AUTH_SESSION_KEY = 'drvl:authSession'

export const markAuthenticated = () => {
  if (typeof window === 'undefined' || !window?.localStorage) return
  window.localStorage.setItem(AUTH_SESSION_KEY, 'true')
}

export const clearAuthentication = () => {
  if (typeof window === 'undefined' || !window?.localStorage) return
  window.localStorage.removeItem(AUTH_SESSION_KEY)
}

export const isAuthenticated = () => {
  if (typeof window === 'undefined' || !window?.localStorage) return false
  return window.localStorage.getItem(AUTH_SESSION_KEY) === 'true'
}
