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

function handleExport() {
  const code = encodeList(getActiveList());
  $("#export-output").value = code;
  showStatus("Exported. Copy the code above to import it into another list.");
}

function handleImport() {
  const raw = $("#import-input").value;
  const imported = decodeList(raw);
  if (imported === null) {
    showStatus("That code couldn't be read — it's not a valid export. Your list was not changed.", true);
    return;
  }
  const current = getActiveList();
  const merged = mergeLists(current, imported);
  const dedupedCount = current.length + imported.length - merged.length;
  if (!setActiveList(merged)) {
    showStatus(STORAGE_FAILED_MSG, true);
    return;
  }
  showStatus(
    `Imported ${imported.length} item(s), merged into your current ${current.length}-item list → ` +
    `${merged.length} total` + (dedupedCount > 0 ? ` (${dedupedCount} were already on your list).` : ".")
  );
  renderAll();
}

function renderAll() {
  renderSession();
  renderProducts();
  renderWishlist();
}

$("#export-btn").addEventListener("click", handleExport);
$("#import-btn").addEventListener("click", handleImport);

renderAll();
