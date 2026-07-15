import { PRODUCTS, getProduct } from "./products.js";
import { mergeLists, itemKey, encodeList, decodeList } from "./merge.js";
import {
  getSession, setSession,
  getGuestList, setGuestList,
  getAccountList, setAccountList,
  getActiveList, setActiveList,
  accountExists,
} from "./storage.js";

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
  if (list.some((it) => itemKey(it) === key)) return; // already there
  list.push({ productId, variant, addedAt: new Date().toISOString() });
  setActiveList(list);
}

function removeFromActiveList(productId, variant) {
  const key = itemKey({ productId, variant });
  setActiveList(getActiveList().filter((it) => itemKey(it) !== key));
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
      if (isInActiveList(product.id, variant)) {
        removeFromActiveList(product.id, variant);
        showStatus(`Removed ${product.name}${variant ? ` (${variant})` : ""} from your wishlist.`);
      } else {
        addToActiveList(product.id, variant);
        showStatus(`Added ${product.name}${variant ? ` (${variant})` : ""} to your wishlist.`);
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
    const li = document.createElement("li");
    li.className = "wishlist-item" + (product ? "" : " unavailable");
    li.innerHTML = product
      ? `<span class="emoji">${product.emoji}</span>
         <span class="info">${product.name}${item.variant ? ` — ${item.variant}` : ""}<br>
           <small>$${product.price.toFixed(2)} · added ${new Date(item.addedAt).toLocaleString()}</small>
         </span>
         <button class="remove-btn" title="Remove">✕</button>`
      : `<span class="emoji">❔</span>
         <span class="info">Item unavailable (product "${item.productId}" no longer in catalog)<br>
           <small>added ${new Date(item.addedAt).toLocaleString()}</small>
         </span>
         <button class="remove-btn" title="Remove">✕</button>`;

    li.querySelector(".remove-btn").addEventListener("click", () => {
      removeFromActiveList(item.productId, item.variant);
      renderAll();
    });

    wishlistItemsEl.appendChild(li);
  }
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
      setSession({ mode: "guest" });
      showStatus("Signed out. You're browsing as a guest again.");
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

  if (isNewAccount) {
    // Nothing to merge against — the guest items simply become this
    // account's list.
    setAccountList(name, guestList);
    setGuestList([]);
    setSession({ mode: "account", name });
    showStatus(
      guestList.length
        ? `Created account "${name}" with your ${guestList.length} guest item(s).`
        : `Created account "${name}".`
    );
  } else {
    const existing = getAccountList(name);
    const merged = mergeLists(existing, guestList);
    const dedupedCount = existing.length + guestList.length - merged.length;
    setAccountList(name, merged);
    setGuestList([]);
    setSession({ mode: "account", name });
    showStatus(
      `Signed in as "${name}". Merged ${guestList.length} guest item(s) into your ` +
      `existing ${existing.length}-item list → ${merged.length} total` +
      (dedupedCount > 0 ? ` (${dedupedCount} were already on both lists).` : ".")
    );
  }

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
  setActiveList(merged);
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
