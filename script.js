// script.js

// ----------------- Firebase init -----------------
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = firebase.storage();

// ----------------- State -----------------
let items = {};           // { id: { id, name, qty, minQty, notes, imageUrl, lastUsed, updatedAt } }
let currentFilter = "all";
let currentSort = null;   // 'usage' | 'qty' | null
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
const deleteImageBtn    = document.getElementById("delete-image-btn");
const itemImageInput    = document.getElementById("item-image-input");
const deleteItemBtn     = document.getElementById("delete-item-btn");
const saveItemBtn       = document.getElementById("save-item-btn");

// מודאל דוח
const reportModalBackdrop = document.getElementById("report-modal-backdrop");
const reportModalClose    = document.getElementById("report-modal-close");
const statTotalItemsEl    = document.getElementById("stat-total-items");
const statTotalQtyEl      = document.getElementById("stat-total-qty");
const statLowCountEl      = document.getElementById("stat-low-count");
const statZeroCountEl     = document.getElementById("stat-zero-count");
const reportLowListEl     = document.getElementById("report-low-list");
const reportZeroListEl    = document.getElementById("report-zero-list");

// כפתורים למעלה
const newItemBtn   = document.getElementById("new-item-btn");
const filterButtons = document.querySelectorAll("[data-filter]");
const sortUsageBtn = document.getElementById("sort-usage");
const sortQtyBtn   = document.getElementById("sort-qty");
const reportBtn    = document.getElementById("report-btn");
const backupBtn    = document.getElementById("backup-btn");
const restoreBtn   = document.getElementById("restore-btn");

// ----------------- Utils -----------------
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl.classList.remove("show");
  }, 1500);
}

function generateId() {
  // מפתח חדש מה־Realtime DB
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

  if (currentFilter === "low") {
    filtered = entries.filter(it => it.minQty != null && it.minQty !== "" && Number(it.qty || 0) > 0 && Number(it.qty || 0) <= Number(it.minQty || 0));
  } else if (currentFilter === "zero") {
    filtered = entries.filter(it => Number(it.qty || 0) === 0);
  }

  if (currentSort === "qty") {
    filtered.sort((a, b) => Number(a.qty || 0) - Number(b.qty || 0));
  } else if (currentSort === "usage") {
    filtered.sort((a, b) => {
      const au = a.lastUsed || "";
      const bu = b.lastUsed || "";
      return au.localeCompare(bu); // הכי ישנים קודם
    });
  } else {
    // ברירת מחדל – לפי שם
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
    } else if (minNum && qtyNum <= minNum) {
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
      `כמות: ${qtyNum} · מינימום: ${minNum || 0}` +
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

// ----------------- Save item -----------------
async function saveItemFromModal() {
  const name = (itemNameInput.value || "").trim();
  const qty  = Number(itemQtyInput.value || 0);
  const min  = Number(itemMinInput.value || 0);
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
  item.minQty = min;
  item.notes = notes;

  try {
    // אם יש קובץ תמונה חדש – קודם מעלים
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
    showToast("שגיאה בשמירה");
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

// ----------------- Image upload -----------------
uploadImageBtn.addEventListener("click", () => {
  itemImageInput.click();
});

itemImageInput.addEventListener("change", () => {
  const file = itemImageInput.files[0];
  if (!file) return;
  uploadingImageFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    setModalImage(e.target.result);
  };
  reader.readAsDataURL(file);
});

deleteImageBtn.addEventListener("click", async () => {
  if (editingItemId && items[editingItemId] && items[editingItemId].imageUrl) {
    // מחיקה מהענן + מה־DB
    const item = items[editingItemId];
    try {
      await deleteImageFromStorage(item);
      await db.ref("items/" + editingItemId).update({
        imageUrl: null,
        updatedAt: getNowIso()
      });
      showToast("התמונה נמחקה");
    } catch (e) {
      console.error(e);
      showToast("שגיאה במחיקת התמונה");
    }
  }
  uploadingImageFile = null;
  setModalImage(null);
});

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
  renderItems();
});

sortQtyBtn.addEventListener("click", () => {
  currentSort = "qty";
  renderItems();
});

// ----------------- Report -----------------
function openReportModal() {
  const arr = Object.values(items || {});
  const totalItems = arr.length;
  const totalQty = arr.reduce((sum, it) => sum + Number(it.qty || 0), 0);
  const lows = arr.filter(it => {
    const q = Number(it.qty || 0);
    const m = Number(it.minQty || 0);
    return m && q > 0 && q <= m;
  });
  const zeros = arr.filter(it => Number(it.qty || 0) === 0);

  statTotalItemsEl.textContent = totalItems;
  statTotalQtyEl.textContent   = totalQty;
  statLowCountEl.textContent   = lows.length;
  statZeroCountEl.textContent  = zeros.length;

  reportLowListEl.innerHTML = lows.length
    ? lows.map(it => `<div>• ${it.name} — כמות ${it.qty}, מינימום ${it.minQty}</div>`).join("")
    : "<div>אין כרגע מלאי נמוך.</div>";

  reportZeroListEl.innerHTML = zeros.length
    ? zeros.map(it => `<div>• ${it.name}</div>`).join("")
    : "<div>אין מוצרים שנגמרו.</div>";

  reportModalBackdrop.classList.add("show");
}

function closeReportModal() {
  reportModalBackdrop.classList.remove("show");
}

// ----------------- Backup / Restore -----------------
function backupToJson() {
  const data = items || {};
  const text = JSON.stringify(data, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventory-backup.json";
  a.click();
  URL.revokeObjectURL(url);
  showToast("גיבוי הוכן להורדה");
}

function restoreFromJsonFile(file) {
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const text = e.target.result;
      const data = JSON.parse(text);
      if (typeof data !== "object" || Array.isArray(data)) {
        throw new Error("פורמט לא תקין");
      }
      await db.ref("items").set(data);
      showToast("שוחזר בהצלחה לענן");
    } catch (err) {
      console.error(err);
      showToast("שגיאה בשחזור");
    }
  };
  reader.readAsText(file, "utf-8");
}

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

// דוח מלאי
reportBtn.addEventListener("click", openReportModal);
reportModalClose.addEventListener("click", closeReportModal);
reportModalBackdrop.addEventListener("click", ev => {
  if (ev.target === reportModalBackdrop) closeReportModal();
});

// גיבוי
backupBtn.addEventListener("click", backupToJson);

// שחזור
restoreBtn.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (file) restoreFromJsonFile(file);
  });
  input.click();
});

// ----------------- Init -----------------
(function init() {
  // ברירת מחדל: הצג הכל
  filterButtons.forEach(btn => {
    if (btn.dataset.filter === "all") {
      btn.classList.add("btn-primary");
    }
  });
  subscribeToItems();
})();
