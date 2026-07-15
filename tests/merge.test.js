import { mergeLists, encodeList, decodeList } from "../js/merge.js";

let pass = 0, fail = 0;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log(`PASS  ${label}`);
  } else {
    fail++;
    console.log(`FAIL  ${label}`);
    console.log(`      expected: ${e}`);
    console.log(`      actual:   ${a}`);
  }
}

function assert(cond, label) {
  if (cond) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}`); }
}

const item = (productId, addedAt, variant = null) => ({ productId, variant, addedAt });

// --- empty side ---
{
  const a = [item("tote", "2026-01-01T00:00:00.000Z")];
  assertEqual(mergeLists(a, []), a, "merge with empty list returns the non-empty side");
  assertEqual(mergeLists([], []), [], "merge of two empty lists is empty");
}

// --- dedupe by productId+variant, keep earliest addedAt ---
{
  const a = [item("tote", "2026-01-05T00:00:00.000Z")];
  const b = [item("tote", "2026-01-01T00:00:00.000Z")]; // earlier
  const result = mergeLists(a, b);
  assertEqual(result.length, 1, "duplicate product+variant collapses to one entry");
  assertEqual(result[0].addedAt, "2026-01-01T00:00:00.000Z", "kept the earlier addedAt on conflict");
}

// --- same product, different variant = distinct items ---
{
  const a = [item("shirt", "2026-01-01T00:00:00.000Z", "M")];
  const b = [item("shirt", "2026-01-01T00:00:00.000Z", "L")];
  const result = mergeLists(a, b);
  assertEqual(result.length, 2, "same productId, different variant, are NOT deduped");
}

// --- idempotency: merging a list into itself changes nothing ---
{
  const a = [item("tote", "2026-01-01T00:00:00.000Z"), item("mug", "2026-01-02T00:00:00.000Z")];
  assertEqual(mergeLists(a, a), a, "merging a list with itself is a no-op (no duplicate growth)");
}

// --- idempotency: re-merging the same second list twice is stable ---
{
  const a = [item("tote", "2026-01-05T00:00:00.000Z")];
  const b = [item("tote", "2026-01-01T00:00:00.000Z"), item("mug", "2026-01-03T00:00:00.000Z")];
  const once = mergeLists(a, b);
  const twice = mergeLists(once, b);
  assertEqual(once, twice, "mergeLists(mergeLists(A,B), B) === mergeLists(A,B) — re-import is idempotent");
}

// --- ordering: result sorted by addedAt ascending regardless of input order ---
{
  const a = [item("late", "2026-01-10T00:00:00.000Z")];
  const b = [item("early", "2026-01-01T00:00:00.000Z")];
  const result = mergeLists(a, b);
  assertEqual(result.map(i => i.productId), ["early", "late"], "merged result is sorted by addedAt ascending");
}

// --- encode/decode round trip ---
{
  const a = [item("tote", "2026-01-01T00:00:00.000Z"), item("shirt", "2026-01-02T00:00:00.000Z", "L")];
  const code = encodeList(a);
  const decoded = decodeList(code);
  assertEqual(decoded, a, "encodeList/decodeList round-trips without loss");
}

// --- malformed import codes must not throw and must return null ---
{
  assertEqual(decodeList("not-valid-base64!!!"), null, "garbage string decodes to null, does not throw");
  assertEqual(decodeList(encodeList([{ foo: "bar" }])), null, "well-formed base64 but wrong item shape -> null");
  assertEqual(decodeList(encodeList("just a string, not an array")), null, "valid JSON but not an array -> null");
  assertEqual(decodeList(encodeList([{ productId: "x", addedAt: "not-a-date" }])), null, "invalid addedAt -> null");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
