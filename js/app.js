import { PRODUCTS, getProduct } from "./products.js";
import { mergeLists, itemKey, encodeList, decodeList } from "./merge.js";
import {
  getSession, setSession,
  getGuestList, setGuestList,
  getAccountList, setAccountList,
  getActiveList, setActiveList,
  accountExists, getAccountDisplayName, setAccountDisplayName,
} from "./storage.js";

const STORAGE_FAILED_MSG =
  "Couldn't save that — your browser may be blocking local storage " +
  "(e.g. private browsing) or storage is full. Nothing was changed.";

const $ = (sel) => document.querySelector(sel);

const productGrid = $("#product-grid");
const wishlistItemsEl = $("#wishlist-items");
const wishlistCountEl = $("#wishlist-count");
const activeListLabelEl = $("#active-list-label");
const sessionControlsEl = $("#session-controls");
const statusEl = $("#status-message");

// Tracks the variant currently selected per product (before it's added).
const selectedVariant = {};

function showStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function isInActiveList(productId, variant) {
  const key = itemKey({ productId, variant });
  return getActiveList().some((it) => itemKey(it) === key);
}

function addToActiveList(productId, variant) {
  const list = getActiveList();
  const key = itemKey({ productId, variant });
  if (list.some((it) => itemKey(it) === key)) return true; // already there
  list.push({ productId, variant, addedAt: new Date().toISOString() });
  return setActiveList(list);
}

function removeFromActiveList(productId, variant) {
  const key = itemKey({ productId, variant });
  return setActiveList(getActiveList().filter((it) => itemKey(it) !== key));
}

function renderProducts() {
  productGrid.innerHTML = "";
  for (const product of PRODUCTS) {
    const card = document.createElement("div");
    card.className = "product-card";

    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    const currentVariant = hasVariants
      ? (selectedVariant[product.id] ?? product.variants[0])
      : null;
    if (hasVariants) selectedVariant[product.id] = currentVariant;

    const active = isInActiveList(product.id, currentVariant);

    card.innerHTML = `
      <div class="product-emoji">${product.emoji}</div>
      <div class="product-name">${product.name}</div>
      <div class="product-meta">${product.category}</div>
      <div class="product-price">$${product.price.toFixed(2)}</div>
      ${hasVariants ? `<select class="variant-select">${product.variants
        .map((v) => `<option value="${v}" ${v === currentVariant ? "selected" : ""}>${v}</option>`)
        .join("")}</select>` : ""}
      <button class="wishlist-btn ${active ? "active" : ""}">
        ${active ? "♥ On wishlist" : "♡ Add to wishlist"}
      </button>
    `;

    if (hasVariants) {
      card.querySelector(".variant-select").addEventListener("change", (e) => {
        selectedVariant[product.id] = e.target.value;
        renderProducts();
      });
    }

    card.querySelector(".wishlist-btn").addEventListener("click", () => {
      const variant = hasVariants ? selectedVariant[product.id] : null;
      const removing = isInActiveList(product.id, variant);
      const ok = removing
        ? removeFromActiveList(product.id, variant)
        : addToActiveList(product.id, variant);
      if (!ok) {
        showStatus(STORAGE_FAILED_MSG, true);
      } else {
        const label = `${product.name}${variant ? ` (${variant})` : ""}`;
        showStatus(removing ? `Removed ${label} from your wishlist.` : `Added ${label} to your wishlist.`);
      }
      renderAll();
    });

    productGrid.appendChild(card);
  }
}

function renderWishlist() {
  const list = getActiveList();
  wishlistCountEl.textContent = list.length ? `(${list.length})` : "";

  const session = getSession();
  activeListLabelEl.textContent = session.mode === "account"
    ? `Showing the wishlist for account "${session.name}"`
    : "Showing your guest wishlist (this device only, not signed in)";

  wishlistItemsEl.innerHTML = "";
  if (list.length === 0) {
    wishlistItemsEl.innerHTML = `<li class="empty-note">Nothing here yet.</li>`;
    return;
  }

  for (const item of [...list].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))) {
    const product = getProduct(item.productId);
    wishlistItemsEl.appendChild(buildWishlistRow(item, product));
  }
}

// Built with createElement/textContent rather than innerHTML because
// item.productId and item.variant can come from an imported code — i.e.
// attacker-controlled string data, not just our own catalog. An earlier
// innerHTML-based version of this function was exploitable: importing a
// code with productId `<img src=x onerror=...>` executed script on
// render (confirmed via a live payload before this fix, both through the
// "unavailable item" path and through the variant field on a real
// product). textContent never interprets its input as markup, so the
// same payload just renders as literal text.
function buildWishlistRow(item, product) {
  const li = document.createElement("li");
  const emoji = document.createElement("span");
  emoji.className = "emoji";
  const info = document.createElement("span");
  info.className = "info";
  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-btn";
  removeBtn.title = "Remove";
  removeBtn.textContent = "✕";

  if (product) {
    li.className = "wishlist-item";
    emoji.textContent = product.emoji;
    const titleLine = document.createElement("span");
    titleLine.textContent = product.name + (item.variant ? ` — ${item.variant}` : "");
    const small = document.createElement("small");
    small.textContent = `$${product.price.toFixed(2)} · added ${new Date(item.addedAt).toLocaleString()}`;
    info.append(titleLine, document.createElement("br"), small);
  } else {
    li.className = "wishlist-item unavailable";
    emoji.textContent = "❔";
    const titleLine = document.createElement("span");
    titleLine.textContent = `Item unavailable (product "${item.productId}" no longer in catalog)`;
    const small = document.createElement("small");
    small.textContent = `added ${new Date(item.addedAt).toLocaleString()}`;
    info.append(titleLine, document.createElement("br"), small);
  }

  removeBtn.addEventListener("click", () => {
    if (!removeFromActiveList(item.productId, item.variant)) showStatus(STORAGE_FAILED_MSG, true);
    renderAll();
  });

  li.append(emoji, info, removeBtn);
  return li;
}

function renderSession() {
  const session = getSession();
  sessionControlsEl.innerHTML = "";

  if (session.mode === "account") {
    const label = document.createElement("span");
    label.className = "session-label";
    label.textContent = `Signed in as ${session.name}`;
    const signOutBtn = document.createElement("button");
    signOutBtn.className = "secondary";
    signOutBtn.textContent = "Sign out";
    signOutBtn.addEventListener("click", () => {
      if (setSession({ mode: "guest" })) {
        showStatus("Signed out. You're browsing as a guest again.");
      } else {
        showStatus(STORAGE_FAILED_MSG, true);
      }
      renderAll();
    });
    sessionControlsEl.append(label, signOutBtn);
  } else {
    const input = document.createElement("input");
    input.placeholder = "Your name";
    const signInBtn = document.createElement("button");
    signInBtn.textContent = "Sign in";
    signInBtn.addEventListener("click", () => handleSignIn(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSignIn(input.value);
    });
    sessionControlsEl.append(input, signInBtn);
  }
}

function handleSignIn(rawName) {
  const name = rawName.trim();
  if (!name) {
    showStatus("Enter a name to sign in.", true);
    return;
  }

  const guestList = getGuestList();
  const isNewAccount = !accountExists(name);
  let ok = true;

  if (isNewAccount) {
    // Nothing to merge against — the guest items simply become this
    // account's list. The typed casing becomes canonical for this
    // account's display name from now on.
    ok = setAccountDisplayName(name) && ok;
    ok = setAccountList(name, guestList) && ok;
    ok = setGuestList([]) && ok;
    ok = setSession({ mode: "account", name }) && ok;
    if (ok) {
      showStatus(
        guestList.length
          ? `Created account "${name}" with your ${guestList.length} guest item(s).`
          : `Created account "${name}".`
      );
    }
  } else {
    // Sign-in is matched case-insensitively, but display the name using
    // whatever casing this account was originally created with — not
    // whatever the user just typed — so "Alice" doesn't start rendering
    // as "alice" just because that's how she typed it this time.
    const canonicalName = getAccountDisplayName(name);
    const existing = getAccountList(name);
    const merged = mergeLists(existing, guestList);
    const dedupedCount = existing.length + guestList.length - merged.length;
    ok = setAccountList(name, merged) && ok;
    ok = setGuestList([]) && ok;
    ok = setSession({ mode: "account", name: canonicalName }) && ok;
    if (ok) {
      showStatus(
        `Signed in as "${canonicalName}". Merged ${guestList.length} guest item(s) into your ` +
        `existing ${existing.length}-item list → ${merged.length} total` +
        (dedupedCount > 0 ? ` (${dedupedCount} were already on both lists).` : ".")
      );
    }
  }

  if (!ok) showStatus(STORAGE_FAILED_MSG, true);
  renderAll();
}

// --- Sharing: a real link instead of a copy/paste code box ---
//
// The old version required manually selecting and copying a raw base64
// blob out of a textarea, then finding somewhere to paste it — a debug
// affordance, not a feature. This generates an actual URL (one-click
// copy via the Clipboard API, with a visible-field fallback if that's
// blocked), and the receiving end auto-detects the `shared` query param
// on load and asks for confirmation before merging — nobody's wishlist
// changes without them clicking something.

let pendingSharedItems = null;

async function handleShare() {
  const list = getActiveList();
  if (list.length === 0) {
    showStatus("Your wishlist is empty — add something first, then share it.", true);
    return;
  }
  const code = encodeList(list);
  // encodeURIComponent matters here, not just style: base64 can contain
  // "+", and a raw "+" in a query string is silently read back as a
  // space by URLSearchParams (application/x-www-form-urlencoded rules),
  // which would corrupt the code. Confirmed this actually happens
  // before adding the encode call, not assumed.
  const url = `${location.origin}${location.pathname}?shared=${encodeURIComponent(code)}`;
  const outputEl = $("#share-output");

  try {
    await navigator.clipboard.writeText(url);
    outputEl.hidden = true;
    showStatus(`Link copied — ${list.length} item(s). Anyone who opens it can add your list to theirs.`);
  } catch {
    // Clipboard permission denied or unavailable (some browsers block
    // it outside a user gesture, or in restricted/embedded contexts).
    // Don't fail silently — show the link so it can still be copied by
    // hand.
    outputEl.value = url;
    outputEl.hidden = false;
    outputEl.select();
    showStatus("Couldn't copy automatically — select and copy the link shown below.", true);
  }
}

// Runs once at startup. If the URL carries a `shared` code (someone
// opened a link generated by handleShare), decode it and show a confirm
// banner rather than merging immediately — opening a link shouldn't be
// enough by itself to change someone's saved data.
function checkForSharedLink() {
  const params = new URLSearchParams(location.search);
  const sharedCode = params.get("shared");
  if (!sharedCode) return;

  // Strip the param immediately regardless of outcome, so refreshing
  // the page doesn't re-trigger the prompt.
  history.replaceState({}, "", location.origin + location.pathname);

  const imported = decodeList(sharedCode);
  if (imported === null) {
    showStatus("The shared link you opened wasn't valid — nothing was changed.", true);
    return;
  }
  if (imported.length === 0) {
    showStatus("That shared link didn't contain any items.", true);
    return;
  }

  pendingSharedItems = imported;
  const banner = $("#share-banner");
  $("#share-banner-text").textContent =
    `Someone shared ${imported.length} item${imported.length === 1 ? "" : "s"} with you.`;
  banner.hidden = false;
}

function hideShareBanner() {
  $("#share-banner").hidden = true;
  pendingSharedItems = null;
}

function handleShareMerge() {
  if (!pendingSharedItems) return;
  const current = getActiveList();
  const merged = mergeLists(current, pendingSharedItems);
  const dedupedCount = current.length + pendingSharedItems.length - merged.length;
  if (!setActiveList(merged)) {
    showStatus(STORAGE_FAILED_MSG, true);
    return;
  }
  showStatus(
    `Merged ${pendingSharedItems.length} shared item(s) into your ${current.length}-item list → ` +
    `${merged.length} total` + (dedupedCount > 0 ? ` (${dedupedCount} were already on your list).` : ".")
  );
  hideShareBanner();
  renderAll();
}

function renderAll() {
  renderSession();
  renderProducts();
  renderWishlist();
}

$("#share-btn").addEventListener("click", handleShare);
$("#share-merge-btn").addEventListener("click", handleShareMerge);
$("#share-dismiss-btn").addEventListener("click", hideShareBanner);

checkForSharedLink();
renderAll();
