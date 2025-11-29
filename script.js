// ================================
//     אלחנן עודפים V20 – לוגיקה
// ================================

const STORAGE_KEY = "elchanan_inventory_v20";
let products = [];
let currentModalId = null;
let hasSortedThisSession = false;

// צלילים – שים קבצים משלך בתיקיית sounds
const addSound = new Audio("sounds/add.mp3");       // צליל עדין להוספה
const subtractSound = new Audio("sounds/subtle.mp3"); // צליל קצר ופחות צורם לחיסור

function safePlay(sound) {
  if (!sound) return;
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

// ------------ שמירת / טעינת נתונים ------------

function loadProducts() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    // דוגמאות ראשוניות – אתה יכול למחוק ידנית באפליקציה
    products = [
      { id: crypto.randomUUID(), name: "חלה", stock: 20, minStock: 5, createdAt: Date.now() - 86400000, lastUsed: Date.now() - 3600000 },
      { id: crypto.randomUUID(), name: "שתיה קלה", stock: 35, minStock: 10, createdAt: Date.now() - 43200000, lastUsed: Date.now() - 7200000 },
      { id: crypto.randomUUID(), name: "ביסלי", stock: 15, minStock: 5, createdAt: Date.now() - 10800000, lastUsed: Date.now() - 1800000 }
    ];
    saveProducts();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      products = parsed;
    } else {
      products = [];
    }
  } catch {
    products = [];
  }
}

function saveProducts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

// ------------ עיבוד / מיון ------------

// מיון לפי שימוש רק בכניסה / רענון (לא בתוך הסשן)
function sortProductsOnLoad() {
  if (hasSortedThisSession) return;
  hasSortedThisSession = true;

  products.sort((a, b) => {
    const aTime = a.lastUsed || a.createdAt || 0;
    const bTime = b.lastUsed || b.createdAt || 0;
    return bTime - aTime;
  });
}

// ------------ רינדור למסך ------------

function renderProducts() {
  const listEl = document.getElementById("productList");
  const searchValue = document.getElementById("searchInput").value.trim().toLowerCase();

  listEl.innerHTML = "";

  products
    .filter(p => !searchValue || p.name.toLowerCase().includes(searchValue))
    .forEach(product => {
      const li = document.createElement("li");
      li.className = "product-item";

      // חלק לוחץ לפתיחת פרטי מוצר
      const main = document.createElement("div");
      main.className = "product-main";
      main.addEventListener("click", () => openProductModal(product.id));

      const nameEl = document.createElement("h3");
      nameEl.className = "product-name";
      nameEl.textContent = product.name;

      const metaEl = document.createElement("p");
      metaEl.className = "product-meta";
      metaEl.textContent = product.minStock
        ? `מלאי מינימלי: ${product.minStock}`
        : "אין מלאי מינימלי";

      main.appendChild(nameEl);
      main.appendChild(metaEl);

      // באג' מלאי
      const stockBadge = document.createElement("div");
      stockBadge.className = "stock-badge";
      stockBadge.textContent = `מלאי: ${product.stock ?? 0}`;
      if (product.minStock && product.stock <= product.minStock) {
        stockBadge.classList.add("low-stock");
      }

      // כפתורי + / -
      const actions = document.createElement("div");
      actions.className = "product-actions";

      const minusBtn = document.createElement("button");
      minusBtn.className = "danger-btn";
      minusBtn.textContent = "-";
      minusBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        changeStock(product.id, -1);
      });

      const plusBtn = document.createElement("button");
      plusBtn.className = "success-btn";
      plusBtn.textContent = "+";
      plusBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        changeStock(product.id, +1);
      });

      actions.appendChild(minusBtn);
      actions.appendChild(plusBtn);

      li.appendChild(main);
      li.appendChild(stockBadge);
      li.appendChild(actions);

      listEl.appendChild(li);
    });
}

// ------------ לוגיקת מלאי ------------

function findProductIndex(id) {
  return products.findIndex(p => p.id === id);
}

function changeStock(id, delta) {
  const index = findProductIndex(id);
  if (index === -1) return;

  const product = products[index];
  const nextStock = (product.stock ?? 0) + delta;
  if (nextStock < 0) return;

  product.stock = nextStock;
  product.lastUsed = Date.now();

  saveProducts();
  renderProducts();

  if (delta > 0) safePlay(addSound);
  if (delta < 0) safePlay(subtractSound);
}

function setStock(id, newValue) {
  const index = findProductIndex(id);
  if (index === -1) return;

  const value = Number(newValue);
  if (isNaN(value) || value < 0) return;

  products[index].stock = value;
  products[index].lastUsed = Date.now();
  saveProducts();
  renderProducts();
}

// ------------ מוצר חדש / עדכון מוצר ------------

function createEmptyProduct() {
  return {
    id: crypto.randomUUID(),
    name: "",
    stock: 0,
    minStock: 0,
    createdAt: Date.now(),
    lastUsed: 0
  };
}

// ------------ מודאל פרטי מוצר ------------

const modalBackdrop = document.getElementById("productModal");
const modalTitle = document.getElementById("modalTitle");
const modalName = document.getElementById("modalName");
const modalCurrentStock = document.getElementById("modalCurrentStock");
const modalManualStock = document.getElementById("modalManualStock");

const modalMinusBtn = document.getElementById("modalMinusBtn");
const modalPlusBtn = document.getElementById("modalPlusBtn");
const modalSaveStockBtn = document.getElementById("modalSaveStockBtn");
const modalSaveProductBtn = document.getElementById("modalSaveProductBtn");
const modalDeleteBtn = document.getElementById("modalDeleteBtn");
const closeModalBtn = document.getElementById("closeModalBtn");

function openProductModal(id) {
  const index = findProductIndex(id);
  if (index === -1) return;

  currentModalId = id;
  const product = products[index];

  modalTitle.textContent = product.name || "מוצר חדש";
  modalName.value = product.name || "";
  modalCurrentStock.textContent = product.stock ?? 0;
  modalManualStock.value = product.stock ?? 0;

  modalBackdrop.classList.remove("hidden");
}

function openNewProductModal() {
  const newProduct = createEmptyProduct();
  products.unshift(newProduct);
  saveProducts();
  renderProducts();

  openProductModal(newProduct.id);
}

function closeProductModal() {
  currentModalId = null;
  modalBackdrop.classList.add("hidden");
}

// חיבור אירועים למודאל
modalMinusBtn.addEventListener("click", () => {
  if (!currentModalId) return;
  changeStock(currentModalId, -1);
  const product = products[findProductIndex(currentModalId)];
  modalCurrentStock.textContent = product.stock ?? 0;
  modalManualStock.value = product.stock ?? 0;
});

modalPlusBtn.addEventListener("click", () => {
  if (!currentModalId) return;
  changeStock(currentModalId, +1);
  const product = products[findProductIndex(currentModalId)];
  modalCurrentStock.textContent = product.stock ?? 0;
  modalManualStock.value = product.stock ?? 0;
});

modalSaveStockBtn.addEventListener("click", () => {
  if (!currentModalId) return;
  setStock(currentModalId, modalManualStock.value);
  const product = products[findProductIndex(currentModalId)];
  modalCurrentStock.textContent = product.stock ?? 0;
});

modalSaveProductBtn.addEventListener("click", () => {
  if (!currentModalId) return;
  const index = findProductIndex(currentModalId);
  if (index === -1) return;

  const name = modalName.value.trim();
  if (!name) {
    alert("חייב שם למוצר");
    return;
  }
  products[index].name = name;
  saveProducts();
  renderProducts();
  closeProductModal();
});

modalDeleteBtn.addEventListener("click", () => {
  if (!currentModalId) return;

  const ok = confirm("למחוק את המוצר הזה? אי אפשר לבטל.");
  if (!ok) return;

  const index = findProductIndex(currentModalId);
  if (index !== -1) {
    products.splice(index, 1);
    saveProducts();
    renderProducts();
  }
  closeProductModal();
});

closeModalBtn.addEventListener("click", () => {
  closeProductModal();
});

modalBackdrop.addEventListener("click", (ev) => {
  if (ev.target === modalBackdrop) {
    closeProductModal();
  }
});

// ------------ אתחול אפליקציה ------------

function initApp() {
  loadProducts();
  sortProductsOnLoad();
  renderProducts();

  document.getElementById("addProductBtn").addEventListener("click", openNewProductModal);
  document.getElementById("searchInput").addEventListener("input", renderProducts);

  // רישום Service Worker בשביל "הוסף למסך הבית" ו-Offline
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch((err) => {
        console.warn("Service worker register failed", err);
      });
  }
}

document.addEventListener("DOMContentLoaded", initApp);