// localStorage wrapper. Namespaced so a guest list and any number of
// mock "account" lists coexist without collisions.

const SESSION_KEY = "swym_session";
const GUEST_KEY = "swym_wishlist_guest";
const accountKey = (name) => `swym_wishlist_account_${name.trim().toLowerCase()}`;
const displayNameKey = (name) => `swym_account_displayname_${name.trim().toLowerCase()}`;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// localStorage.setItem throws in real, reachable conditions — Safari
// private browsing blocks writes outright, and any browser throws once
// the ~5-10MB quota is hit. Returning a success flag instead of letting
// this throw lets callers show an honest "couldn't save" instead of
// silently losing the write mid-click.
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getSession() {
  return readJSON(SESSION_KEY, { mode: "guest" });
}

export function setSession(session) {
  return writeJSON(SESSION_KEY, session);
}

export function getGuestList() {
  return readJSON(GUEST_KEY, []);
}

export function setGuestList(items) {
  return writeJSON(GUEST_KEY, items);
}

export function getAccountList(name) {
  return readJSON(accountKey(name), []);
}

export function setAccountList(name, items) {
  return writeJSON(accountKey(name), items);
}

// The name is matched case-insensitively (accountKey lowercases it), but
// what gets *displayed* should stay stable regardless of which casing
// was typed on any given sign-in — otherwise "Alice" who signs in later
// as "alice" sees her own display name flip. The casing used the first
// time an account is created is the one that sticks.
export function getAccountDisplayName(name) {
  return readJSON(displayNameKey(name), name.trim());
}

export function setAccountDisplayName(name) {
  return writeJSON(displayNameKey(name), name.trim());
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
  return session.mode === "account"
    ? setAccountList(session.name, items)
    : setGuestList(items);
}

// Whether this account name already has a saved list (vs. a brand-new
// account with nothing to merge against).
export function accountExists(name) {
  return localStorage.getItem(accountKey(name)) !== null;
}
