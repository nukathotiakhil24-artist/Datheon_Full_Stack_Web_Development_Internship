"use strict";

// ---------- Config ----------
const API_URL = "https://fakestoreapi.com/products";
const CART_KEY = "datheon_cart_v1";
const TAX_RATE = 0.08;
const FREE_SHIPPING_CENTS = 10000; // free shipping on $100+
const SHIPPING_FLAT_CENTS = 599;
const MAX_QTY = 10;

// FakeStoreAPI spells it "jewelery"; clothing covers both men's and women's.
const CATEGORY_GROUPS = {
  electronics: ["electronics"],
  jewelry: ["jewelery", "jewelry"],
  clothing: ["men's clothing", "women's clothing"],
};

// ---------- State ----------
let products = [];
let cart = loadCart();
const view = { category: "all", search: "", sort: "featured" };

// ---------- DOM ----------
const $ = (selector) => document.querySelector(selector);
const grid = $("#product-grid");
const statusEl = $("#status");
const filtersEl = $("#filters");
const searchEl = $("#search");
const sortEl = $("#sort");
const cartBtn = $("#cart-btn");
const cartCount = $("#cart-count");
const cartDrawer = $("#cart-drawer");
const cartItemsEl = $("#cart-items");
const overlay = $("#overlay");
const checkoutBtn = $("#checkout-btn");
const modal = $("#modal");
const toast = $("#toast");

// ---------- Helpers ----------
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const toCents = (dollars) => Math.round(dollars * 100);
const formatMoney = (cents) => `$${(cents / 100).toFixed(2)}`;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

// ---------- Cart persistence ----------
function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch (err) {
    console.error("Could not save cart:", err);
  }
}

// ---------- Cart actions ----------
function addToCart(productId) {
  const existing = cart.find((item) => item.id === productId);
  if (existing) {
    if (existing.qty >= MAX_QTY) {
      showToast(`Maximum ${MAX_QTY} per item`);
      return;
    }
    existing.qty += 1;
  } else {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    cart.push({
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.image,
      qty: 1,
    });
  }
  saveCart();
  renderCart();
  bumpBadge();
  showToast("Added to cart");
}

function removeFromCart(productId) {
  cart = cart.filter((item) => item.id !== productId);
  saveCart();
  renderCart();
}

function updateQuantity(productId, delta) {
  const item = cart.find((i) => i.id === productId);
  if (!item) return;
  const next = item.qty + delta;
  if (next <= 0) {
    removeFromCart(productId);
    return;
  }
  item.qty = Math.min(next, MAX_QTY);
  saveCart();
  renderCart();
}

function calculateTotal() {
  const subtotal = cart.reduce((sum, item) => sum + toCents(item.price) * item.qty, 0);
  const tax = Math.round(subtotal * TAX_RATE);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_CENTS ? 0 : SHIPPING_FLAT_CENTS;
  return { subtotal, tax, shipping, total: subtotal + tax + shipping };
}

function cartItemCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

// ---------- Product data ----------
async function fetchProducts() {
  grid.innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton"></div>').join("");
  statusEl.textContent = "Loading products...";
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    products = await response.json();
    statusEl.textContent = "";
    renderProducts();
  } catch (err) {
    console.error(err);
    grid.innerHTML = "";
    statusEl.innerHTML =
      'Could not load products. Check your connection. <button class="btn btn-primary btn-sm" id="retry" type="button">Retry</button>';
    $("#retry").addEventListener("click", fetchProducts);
  }
}

function getVisibleProducts() {
  const query = view.search.trim().toLowerCase();
  let list = products.filter((p) => {
    const categoryOk =
      view.category === "all" || CATEGORY_GROUPS[view.category].includes(p.category);
    const searchOk =
      !query ||
      p.title.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query);
    return categoryOk && searchOk;
  });

  if (view.sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
  else if (view.sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
  else if (view.sort === "rating") list = [...list].sort((a, b) => b.rating.rate - a.rating.rate);
  return list;
}

// ---------- Rendering ----------
function renderStars(rate) {
  const full = Math.round(rate);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function renderProducts() {
  const list = getVisibleProducts();
  if (!list.length) {
    grid.innerHTML = "";
    statusEl.textContent = "No products match your search.";
    return;
  }
  statusEl.textContent = `${list.length} product${list.length === 1 ? "" : "s"}`;

  grid.innerHTML = list
    .map((p) => {
      const badges = [];
      if (p.rating.rate >= 4.5) badges.push('<span class="badge">Top Rated</span>');
      if (p.rating.count >= 250) badges.push('<span class="badge popular">Popular</span>');
      return `
        <article class="product-card">
          <div class="badges">${badges.join("")}</div>
          <div class="product-img"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}" loading="lazy" /></div>
          <div class="product-body">
            <span class="product-category">${escapeHtml(p.category)}</span>
            <h3 class="product-title" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</h3>
            <div class="rating" aria-label="Rated ${p.rating.rate} out of 5">${renderStars(p.rating.rate)}<span class="count">${p.rating.rate} (${p.rating.count})</span></div>
            <div class="product-footer">
              <span class="price">${formatMoney(toCents(p.price))}</span>
              <button class="btn btn-primary btn-sm" type="button" data-add="${p.id}">Add to Cart</button>
            </div>
          </div>
        </article>`;
    })
    .join("");
}

function renderCart() {
  cartCount.textContent = cartItemCount();

  if (!cart.length) {
    cartItemsEl.innerHTML = '<p class="empty-cart">Your cart is empty.</p>';
  } else {
    cartItemsEl.innerHTML = cart
      .map(
        (item) => `
        <div class="cart-item">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />
          <div class="cart-item-info">
            <span class="cart-item-title">${escapeHtml(item.title)}</span>
            <span class="cart-item-price">${formatMoney(toCents(item.price) * item.qty)}</span>
            <div class="qty">
              <button type="button" data-dec="${item.id}" aria-label="Decrease quantity">&minus;</button>
              <span>${item.qty}</span>
              <button type="button" data-inc="${item.id}" aria-label="Increase quantity">+</button>
            </div>
          </div>
          <button class="remove-btn" type="button" data-remove="${item.id}">Remove</button>
        </div>`
      )
      .join("");
  }

  const { subtotal, tax, shipping, total } = calculateTotal();
  $("#subtotal").textContent = formatMoney(subtotal);
  $("#tax").textContent = formatMoney(tax);
  $("#shipping").textContent = shipping ? formatMoney(shipping) : subtotal ? "Free" : formatMoney(0);
  $("#total").textContent = formatMoney(total);

  const note = $("#shipping-note");
  if (subtotal === 0) note.textContent = "";
  else if (shipping === 0) note.textContent = "You qualify for free shipping!";
  else note.textContent = `Add ${formatMoney(FREE_SHIPPING_CENTS - subtotal)} more for free shipping`;

  checkoutBtn.disabled = cart.length === 0;
}

function bumpBadge() {
  cartCount.classList.remove("bump");
  void cartCount.offsetWidth; // restart animation
  cartCount.classList.add("bump");
}

// ---------- Drawer + modal ----------
function openCart() {
  cartDrawer.classList.add("open");
  overlay.classList.add("show");
  cartDrawer.setAttribute("aria-hidden", "false");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  overlay.classList.remove("show");
  cartDrawer.setAttribute("aria-hidden", "true");
}

function checkout() {
  if (!cart.length) return;
  const { total } = calculateTotal();
  const items = cartItemCount();
  const orderId = "ORD-" + Math.random().toString(36).slice(2, 8).toUpperCase();

  $("#order-id").textContent = `Order ${orderId}`;
  $("#order-summary").textContent = `${items} item${items === 1 ? "" : "s"} - ${formatMoney(total)} total. A confirmation would be emailed to you.`;

  cart = [];
  saveCart();
  renderCart();
  closeCart();
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

// ---------- Events ----------
grid.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-add]");
  if (btn) addToCart(Number(btn.dataset.add));
});

cartItemsEl.addEventListener("click", (e) => {
  const inc = e.target.closest("[data-inc]");
  const dec = e.target.closest("[data-dec]");
  const rem = e.target.closest("[data-remove]");
  if (inc) updateQuantity(Number(inc.dataset.inc), 1);
  else if (dec) updateQuantity(Number(dec.dataset.dec), -1);
  else if (rem) removeFromCart(Number(rem.dataset.remove));
});

filtersEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-category]");
  if (!btn) return;
  view.category = btn.dataset.category;
  filtersEl.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("active", chip === btn));
  renderProducts();
});

searchEl.addEventListener("input", () => {
  view.search = searchEl.value;
  renderProducts();
});

sortEl.addEventListener("change", () => {
  view.sort = sortEl.value;
  renderProducts();
});

cartBtn.addEventListener("click", openCart);
$("#close-cart").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);
checkoutBtn.addEventListener("click", checkout);
$("#modal-close").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closeCart();
  closeModal();
});

// ---------- Init ----------
renderCart();
fetchProducts();
