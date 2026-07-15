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
