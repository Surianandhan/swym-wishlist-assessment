// localStorage wrapper. Namespaced so a guest list and any number of
// mock "account" lists coexist without collisions.

const SESSION_KEY = "swym_session";
const GUEST_KEY = "swym_wishlist_guest";
const accountKey = (name) => `swym_wishlist_account_${name.trim().toLowerCase()}`;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getSession() {
  return readJSON(SESSION_KEY, { mode: "guest" });
}

export function setSession(session) {
  writeJSON(SESSION_KEY, session);
}

export function getGuestList() {
  return readJSON(GUEST_KEY, []);
}

export function setGuestList(items) {
  writeJSON(GUEST_KEY, items);
}

export function getAccountList(name) {
  return readJSON(accountKey(name), []);
}

export function setAccountList(name, items) {
  writeJSON(accountKey(name), items);
}

// Whichever list is "active" right now, based on session mode.
export function getActiveList() {
  const session = getSession();
  return session.mode === "account"
    ? getAccountList(session.name)
    : getGuestList();
}

export function setActiveList(items) {
  const session = getSession();
  if (session.mode === "account") setAccountList(session.name, items);
  else setGuestList(items);
}

// Whether this account name already has a saved list (vs. a brand-new
// account with nothing to merge against).
export function accountExists(name) {
  return localStorage.getItem(accountKey(name)) !== null;
}
