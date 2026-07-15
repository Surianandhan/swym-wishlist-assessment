// Pure logic, no DOM/localStorage — importable from both the browser app
// and the Node test script, so tests exercise the real shipped code.

export function itemKey(item) {
  return `${item.productId}::${item.variant ?? ""}`;
}

// Dedupe by (productId, variant). On conflict, keep the earliest addedAt.
// Order of arguments doesn't matter; result is sorted by addedAt ascending.
// Idempotent: mergeLists(mergeLists(A, B), B) === mergeLists(A, B).
export function mergeLists(listA, listB) {
  const byKey = new Map();

  for (const item of [...listA, ...listB]) {
    const key = itemKey(item);
    const existing = byKey.get(key);
    if (!existing || new Date(item.addedAt) < new Date(existing.addedAt)) {
      byKey.set(key, item);
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => new Date(a.addedAt) - new Date(b.addedAt)
  );
}

function toBase64(str) {
  if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(str)));
  return Buffer.from(str, "utf-8").toString("base64");
}

function fromBase64(b64) {
  if (typeof atob === "function") return decodeURIComponent(escape(atob(b64)));
  return Buffer.from(b64, "base64").toString("utf-8");
}

export function encodeList(items) {
  return toBase64(JSON.stringify(items));
}

// Returns the decoded item array, or null if the code is malformed/invalid.
// Never throws — callers rely on null to mean "show an error, don't touch
// the existing list" rather than crashing or wiping data.
export function decodeList(code) {
  try {
    const items = JSON.parse(fromBase64(code.trim()));
    if (!Array.isArray(items)) return null;
    for (const item of items) {
      if (typeof item.productId !== "string") return null;
      if (typeof item.addedAt !== "string" || isNaN(new Date(item.addedAt))) return null;
    }
    return items;
  } catch {
    return null;
  }
}
