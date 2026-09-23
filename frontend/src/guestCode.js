// Shared across the site (guest self-service pages and the quiz join flow)
// so a guest never has to retype their access code once they've used it
// anywhere on the site.
const KEY = "guest_access_code";

export function getStoredGuestCode() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredGuestCode(code) {
  try {
    if (code) localStorage.setItem(KEY, code);
  } catch {
    // ignore (private browsing, storage disabled...)
  }
}
