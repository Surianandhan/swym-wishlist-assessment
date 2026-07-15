# Swym Sample Store — Wishlist with Merge

A small static storefront with a wishlist feature. No backend — everything
persists in `localStorage`, which is why GitHub Pages is sufficient hosting.

## The merge requirement

Two ways to reach the same `mergeLists()` logic ([js/merge.js](js/merge.js)):

1. **Guest → Account.** Add items while browsing anonymously, then "sign
   in" with a name. If that name already has a saved list, your guest
   items merge into it. Sign out, add different items as a guest again,
   sign back in with the same name — the two lists merge again.
2. **Share link.** "🔗 Share my wishlist" copies a URL encoding the
   current list to the clipboard (falls back to a visible, selectable
   field if clipboard access is blocked). Opening that link — in another
   tab, another browser, or handed to someone else — shows a confirm
   banner ("Someone shared N items with you") rather than merging
   silently; accepting merges it into whatever list is currently active
   there. This is also how merge behavior can be exercised directly with
   a hand-crafted `?shared=<code>` link, without needing two devices.

Merge rule: items are deduped by `(productId, variant)`. On a duplicate,
the entry with the earlier `addedAt` wins. Merging is idempotent — merging
the same list into itself, or re-importing the same code twice, does not
create duplicates.

## Design tensions the brief left open, and how they were resolved

- **GitHub Pages is static-only, no server.** → Persistence had to be
  `localStorage`, so "signing in" is a namespaced local identity, not
  real auth. Stated explicitly as a scoped-out simplification, not an
  oversight.
- **"Merge two distinct lists" doesn't say how a user gets two lists.**
  → Resolved as guest→account (mirrors Swym's actual product) plus a
  share link (also realistic, and independently testable without two
  devices).
- **A naive merge just concatenates.** → Deduped by `(productId,
  variant)`, earliest `addedAt` wins, verified idempotent.
- **First export/import draft was a manual copy/paste code box.** →
  Replaced with a real shareable link: one-click copy, confirm-before-
  merge on the receiving end, no data changes without an explicit click.
- **First render pass trusted imported data.** → A crafted import code
  turned out to execute script via unescaped `innerHTML` (confirmed live
  before fixing, not assumed). Fixed with input validation at the decode
  boundary and safe DOM construction at the render sink.

## Running locally

No build step. Serve the directory with any static file server, e.g.:

```
python3 -m http.server 5173
```

## Tests

`js/merge.js` is pure (no DOM/localStorage), so it's tested directly with
Node — no framework:

```
npm test
```
