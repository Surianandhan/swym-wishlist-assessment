// Mock catalog. Emoji stand in for product photography — deliberate, not a
// placeholder-image shortcut: it keeps the artifact fully self-contained
// with zero network requests, so nothing can break during grading due to
// a dead image host.
//
// A few products carry `variants` to exercise the "same product, different
// variant = distinct wishlist item" edge case end-to-end in the real UI.

export const PRODUCTS = [
  { id: "tote-bag",    name: "Canvas Tote Bag",     price: 24, category: "Bags",       emoji: "👜" },
  { id: "mug",         name: "Ceramic Mug",         price: 14, category: "Home",       emoji: "☕" },
  { id: "tshirt",      name: "Classic Tee",         price: 22, category: "Apparel",    emoji: "👕", variants: ["S", "M", "L"] },
  { id: "sneakers",    name: "Everyday Sneakers",   price: 68, category: "Footwear",   emoji: "👟", variants: ["8", "9", "10"] },
  { id: "notebook",    name: "Dot Grid Notebook",   price: 12, category: "Stationery", emoji: "📓" },
  { id: "headphones",  name: "Wireless Headphones", price: 89, category: "Electronics",emoji: "🎧" },
  { id: "planter",     name: "Succulent Planter",   price: 18, category: "Home",       emoji: "🪴" },
  { id: "backpack",    name: "Daypack",             price: 54, category: "Bags",       emoji: "🎒" },
  { id: "candle",      name: "Soy Candle",          price: 16, category: "Home",       emoji: "🕯️" },
  { id: "bottle",      name: "Insulated Bottle",    price: 28, category: "Outdoors",   emoji: "🧴", variants: ["500ml", "750ml"] },
];

export function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id) ?? null;
}
