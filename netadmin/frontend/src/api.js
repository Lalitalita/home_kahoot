let token = localStorage.getItem('na_token') || ''

export const setToken = (t) => {
  token = t || ''
  if (t) localStorage.setItem('na_token', t)
  else localStorage.removeItem('na_token')
}
export const hasToken = () => !!token

export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Serveur injoignable')
  }
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    setToken('')
    window.dispatchEvent(new Event('na-logout'))
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const d = data.detail
    throw new Error(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => x.msg).join(', ') : `Erreur ${res.status}`)
  }
  return data
}
