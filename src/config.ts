export const BACKEND_URL: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL
    ? String(import.meta.env.VITE_BACKEND_URL).trim().replace(/\/$/, '')
    : '')

export function apiUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return BACKEND_URL ? `${BACKEND_URL}${clean}` : clean
}
