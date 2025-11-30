// script.js V21 A2

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = firebase.storage();

// ----------------- State -----------------
let items = {};
let currentFilter = "all";
let currentSort = null;   // 'usage' | 'qty' | null
let currentSearch = "";
let editingItemId = null;
let uploadingImageFile = null;

// ----------------- DOM -----------------
const itemsListEl      = document.getElementById("items-list");
const emptyStateEl     = document.getElementById("empty-state");
const toastEl          = document.getElementById("toast");

// מודאל מוצר
const itemModalBackdrop = document.getElementById("item-modal-backdrop");
const itemModalClose    = document.getElementById("item-modal-close");
const itemModalTitle    = document.getElementById("item-modal-title");
const itemModalPic      = document.getElementById("item-modal-pic");
const itemNameInput     = document.getElementById("item-name-input");
const itemQtyInput      = document.getElementById("item-qty-input");
const itemMinInput      = document.getElementById("item-min-input");
const itemNotesInput    = document.getElementById("item-notes-input");
const uploadImageBtn    = document.getElementById("upload-image-btn");
const itemImageInputCam = document.getElementById("item-image-input-camera");
const itemImageInputGal = document.getElementById("item-image-input-gallery");
const deleteItemBtn     = document.getElementById("delete-item-btn");
const saveItemBtn       = document.getElementById("save-item-btn");

// מודאל תמונה גדולה
const imageModalBackdrop = document.getElementById("image-modal-backdrop");
const imageModalClose    = document.getElementById("image-modal-close");
const imageModalImg      = document.getElementById("image-modal-img");

// כפתורים למעלה
const newItemBtn   = document.getElementById("new-item-btn");
const filterButtons = document.querySelectorAll("[data-filter]");
const sortUsageBtn = document.getElementById("sort-usage");
const sortQtyBtn   = document.getElementById("sort-qty");
const searchInput  = document.getElementById("search-input");

// ----------------- Utils -----------------
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl.classList.remove("show");
  }, 1500);
}

function generateId() {
  return db.ref().child("items").push().key;
}

function getNowIso() {
  return new Date().toISOString();
}

// ----------------- Firebase sync -----------------
function subscribeToItems() {
  db.ref("items").on("value", snapshot => {
    const val = snapshot.val();
    items = val || {};
    renderItems();
  });
}

function saveItemToDb(item) {
  if (!item.id) {
    item.id = generateId();
  }
  item.updatedAt = getNowIso();
  return db.ref("items/" + item.id).set(item);
}

function deleteItemFromDb(id) {
  return db.ref("items/" + id).remove();
}

function updateQtyInDb(id, newQty) {
  return db.ref("items/" + id).update({
    qty: newQty,
    lastUsed: getNowIso(),
    updatedAt: getNowIso()
  });
}

function deleteImageFromStorage(item) {
  if (!item.imageUrl) return Promise.resolve();
  try {
    const ref = storage.refFromURL(item.imageUrl);
    return ref.delete().catch(() => {});
  } catch (e) {
    return Promise.resolve();
  }
}

// ----------------- Render -----------------
function renderItems() {
  const entries = Object.values(items || {});
  let filtered = entries;

  // חיפוש
  if (currentSearch.trim() !== "") {
    const q = currentSearch.trim().toLowerCase();
    filtered = filtered.filter(it =>
      (it.name || "").toLowerCase().includes(q) ||
      (it.notes || "").toLowerCase().includes(q)
    );
  }

  // פילטר מלאי
  if (currentFilter === "low") {
    // מלאי נמוך: כמות בין 1 ל-1 (כלומר 1) – "נשאר פחות מ-1" -> קרוב לסוף
    filtered = filtered.filter(it => {
      const qty = Number(it.qty || 0);
      return qty > 0 && qty <= 1;
    });
  } else if (currentFilter === "zero") {
    filtered = filtered.filter(it => Number(it.qty || 0) === 0);
  }

  // מיון
  if (currentSort === "qty") {
    // מהכי הרבה להכי מעט
    filtered.sort((a, b) => Number(b.qty || 0) - Number(a.qty || 0));
  } else if (currentSort === "usage") {
    filtered.sort((a, b) => {
      const au = a.lastUsed || "";
      const bu = b.lastUsed || "";
      return bu.localeCompare(au); // הכי חדשים קודם
    });
  } else {
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
  }

  itemsListEl.innerHTML = "";
  if (filtered.length === 0) {
    emptyStateEl.style.display = "block";
    return;
  } else {
    emptyStateEl.style.display = "none";
  }

  filtered.forEach(item => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.dataset.id = item.id;

    const pic = document.createElement("div");
    pic.className = "item-pic";
    if (item.imageUrl) {
      const img = document.createElement("img");
      img.src = item.imageUrl;
      pic.appendChild(img);
    } else {
      pic.textContent = "📷";
    }

    // לחיצה על התמונה:
    pic.addEventListener("click", ev => {
      ev.stopPropagation();
      if (item.imageUrl) {
        openImageModal(item.imageUrl);
      } else {
        openImageUploadChooser();
      }
    });

    const main = document.createElement("div");
    main.className = "item-main";

    const title = document.createElement("div");
    title.className = "item-title";
    title.textContent = item.name || "(ללא שם)";

    const chip = document.createElement("span");
    chip.className = "tag";
    const qtyNum = Number(item.qty || 0);
    const minNum = Number(item.minQty || 0);
    if (qtyNum === 0) {
      chip.textContent = "נגמר";
      chip.style.background = "#b00020";
    } else if (qtyNum <= 1) {
      chip.textContent = "מלאי נמוך";
      chip.style.background = "#b36a00";
    } else {
      chip.textContent = "מספיק במלאי";
      chip.style.background = "#145a32";
    }
    title.appendChild(chip);

    const meta = document.createElement("div");
    meta.className = "item-meta";
    meta.textContent =
      `כמות: ${qtyNum}` +
      (item.notes ? ` · הערות: ${item.notes}` : "");

    main.appendChild(title);
    main.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const countBadge = document.createElement("div");
    countBadge.className = "badge-count";
    countBadge.textContent = `כמות: ${qtyNum}`;
    actions.appendChild(countBadge);

    const actionsRow = document.createElement("div");
    actionsRow.className = "item-actions-row";

    const minusBtn = document.createElement("button");
    minusBtn.className = "btn-small";
    minusBtn.textContent = "-";
    minusBtn.addEventListener("click", ev => {
      ev.stopPropagation();
      changeQty(item.id, -1);
    });

    const plusBtn = document.createElement("button");
    plusBtn.className = "btn-small";
    plusBtn.textContent = "+";
    plusBtn.addEventListener("click", ev => {
      ev.stopPropagation();
      changeQty(item.id, +1);
    });

    actionsRow.appendChild(minusBtn);
    actionsRow.appendChild(plusBtn);
    actions.appendChild(actionsRow);

    row.appendChild(pic);
    row.appendChild(main);
    row.appendChild(actions);

    row.addEventListener("click", () => openItemModal(item.id));

    itemsListEl.appendChild(row);
  });
}

// ----------------- Qty change -----------------
function changeQty(id, delta) {
  const item = items[id];
  if (!item) return;
  const oldVal = Number(item.qty || 0);
  const newVal = oldVal + delta;
  if (newVal < 0) return;

  updateQtyInDb(id, newVal)
    .then(() => {
      showToast(delta > 0 ? "נוסף בהצלחה" : "נגרע בהצלחה");
    })
    .catch(() => showToast("שגיאה בשמירה לענן"));
}

// ----------------- Item modal -----------------
function openItemModal(id) {
  editingItemId = id || null;
  uploadingImageFile = null;

  if (id && items[id]) {
    const item = items[id];
    itemModalTitle.textContent = "עריכת מוצר";
    itemNameInput.value  = item.name || "";
    itemQtyInput.value   = item.qty ?? "";
    itemMinInput.value   = item.minQty ?? "";
    itemNotesInput.value = item.notes || "";
    setModalImage(item.imageUrl);
    deleteItemBtn.style.display = "inline-block";
  } else {
    itemModalTitle.textContent = "מוצר חדש";
    itemNameInput.value = "";
    itemQtyInput.value = "0";
    itemMinInput.value = "0";
    itemNotesInput.value = "";
    setModalImage(null);
    deleteItemBtn.style.display = "none";
  }

  itemModalBackdrop.classList.add("show");
}

function closeItemModal() {
  itemModalBackdrop.classList.remove("show");
}

function setModalImage(url) {
  itemModalPic.innerHTML = "";
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    itemModalPic.appendChild(img);
  } else {
    itemModalPic.textContent = "📷";
  }
}

// ----------------- Image big modal -----------------
function openImageModal(url) {
  imageModalImg.src = url;
  imageModalBackdrop.classList.add("show");
}

function closeImageModal() {
  imageModalBackdrop.classList.remove("show");
  imageModalImg.src = "";
}

// ----------------- Image upload chooser -----------------
function openImageUploadChooser() {
  const useCamera = confirm("לצלם עכשיו? ביטול = לבחור מהגלריה");
  if (useCamera) {
    itemImageInputCam.click();
  } else {
    itemImageInputGal.click();
  }
}

function handleChosenImage(file) {
  if (!file) return;
  uploadingImageFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    setModalImage(e.target.result);
  };
  reader.readAsDataURL(file);
}

itemImageInputCam.addEventListener("change", () => {
  const file = itemImageInputCam.files[0];
  handleChosenImage(file);
});
itemImageInputGal.addEventListener("change", () => {
  const file = itemImageInputGal.files[0];
  handleChosenImage(file);
});

uploadImageBtn.addEventListener("click", openImageUploadChooser);

// ----------------- Save item -----------------
async function saveItemFromModal() {
  const name = (itemNameInput.value || "").trim();
  const qty  = Number(itemQtyInput.value || 0);
  const notes = itemNotesInput.value || "";

  if (!name) {
    showToast("חסר שם מוצר");
    return;
  }

  let item;
  if (editingItemId && items[editingItemId]) {
    item = { ...items[editingItemId] };
  } else {
    item = {
      id: editingItemId || null,
      lastUsed: null
    };
  }

  item.name = name;
  item.qty = qty;
  item.minQty = 0; // לא משתמשים כרגע
  item.notes = notes;

  try {
    if (uploadingImageFile) {
      const file = uploadingImageFile;
      const id = item.id || generateId();
      const ref = storage.ref(`items/${id}/${file.name}`);
      await ref.put(file);
      const url = await ref.getDownloadURL();
      item.imageUrl = url;
      item.id = id;
    }

    await saveItemToDb(item);
    showToast("נשמר בהצלחה");
    closeItemModal();
  } catch (e) {
    console.error(e);
    showToast("שגיאה בשמירה (בדוק הרשאות Firebase Storage)");
  }
}

// ----------------- Delete item -----------------
async function deleteCurrentItem() {
  if (!editingItemId || !items[editingItemId]) {
    closeItemModal();
    return;
  }
  const item = items[editingItemId];
  if (!confirm(`למחוק את "${item.name}"?`)) return;

  try {
    await deleteImageFromStorage(item);
    await deleteItemFromDb(editingItemId);
    showToast("נמחק");
    closeItemModal();
  } catch (e) {
    console.error(e);
    showToast("שגיאה במחיקה");
  }
}

// ----------------- Filters & sort -----------------
filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;
    filterButtons.forEach(b => b.classList.remove("btn-primary"));
    btn.classList.add("btn-primary");
    renderItems();
  });
});

sortUsageBtn.addEventListener("click", () => {
  currentSort = "usage";
  sortUsageBtn.classList.add("active-sort");
  sortQtyBtn.classList.remove("active-sort");
  renderItems();
});

sortQtyBtn.addEventListener("click", () => {
  currentSort = "qty";
  sortQtyBtn.classList.add("active-sort");
  sortUsageBtn.classList.remove("active-sort");
  renderItems();
});

// ----------------- Search -----------------
searchInput.addEventListener("input", () => {
  currentSearch = searchInput.value || "";
  renderItems();
});

// ----------------- Event listeners (מודאלים, כפתורים) -----------------
newItemBtn.addEventListener("click", () => openItemModal(null));
itemModalClose.addEventListener("click", closeItemModal);
itemModalBackdrop.addEventListener("click", ev => {
  if (ev.target === itemModalBackdrop) closeItemModal();
});

saveItemBtn.addEventListener("click", saveItemFromModal);
deleteItemBtn.addEventListener("click", deleteCurrentItem);

// שינוי מהיר בתוך המודאל
document.querySelectorAll("[data-quick]").forEach(btn => {
  btn.addEventListener("click", () => {
    const delta = Number(btn.dataset.quick);
    const current = Number(itemQtyInput.value || 0);
    const val = current + delta;
    if (val < 0) return;
    itemQtyInput.value = val;
  });
});

// מודאל תמונה
imageModalClose.addEventListener("click", closeImageModal);
imageModalBackdrop.addEventListener("click", ev => {
  if (ev.target === imageModalBackdrop) closeImageModal();
});

// ----------------- Init -----------------
(function init() {
  filterButtons.forEach(btn => {
    if (btn.dataset.filter === "all") {
      btn.classList.add("btn-primary");
    }
  });
  subscribeToItems();
})();
