// אלחנן עודפים · V21 (Local Device Version)
// שמירה מקומית בלבד (localStorage) + גיבוי/שחזור לקובץ JSON
const STORAGE_KEY = "elchanan_inventory_v21";
let products = [];
let currentProductId = null;
let currentFilter = "all";
let sortedOnce = false;
let toastTimer = null;

// DOM
const listEl = document.getElementById("productList");
const searchEl = document.getElementById("searchInput");
const addBtn = document.getElementById("addProductBtn");
const toolsToggleBtn = document.getElementById("toolsToggleBtn");
const toolsMenu = document.getElementById("toolsMenu");
const toastEl = document.getElementById("toast");

// modal product
const productModalBackdrop = document.getElementById("productModalBackdrop");
const productModalTitle = document.getElementById("productModalTitle");
const closeProductModalBtn = document.getElementById("closeProductModalBtn");
const nameInput = document.getElementById("productNameInput");
const stockInput = document.getElementById("productStockInput");
const minInput = document.getElementById("productMinStockInput");
const notesInput = document.getElementById("productNotesInput");
const minusBtn = document.getElementById("productMinusBtn");
const plusBtn = document.getElementById("productPlusBtn");
const saveBtn = document.getElementById("saveProductBtn");
const deleteBtn = document.getElementById("deleteProductBtn");
const imagePreview = document.getElementById("productImagePreview");
const imageInput = document.getElementById("productImageInput");
const imageRemoveBtn = document.getElementById("productImageRemoveBtn");

// report
const reportModalBackdrop = document.getElementById("reportModalBackdrop");
const closeReportModalBtn = document.getElementById("closeReportModalBtn");
const reportSummaryEl = document.getElementById("reportSummary");
const reportLowStockEl = document.getElementById("reportLowStock");
const reportZeroStockEl = document.getElementById("reportZeroStock");

// utils
const id = () => Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);

function autoImageUrl(name){
  if(!name) return null;
  return "https://source.unsplash.com/160x160/?"+encodeURIComponent(name.trim());
}

function showToast(msg,type="success"){
  if(!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.remove("success","error");
  if(type==="success") toastEl.classList.add("success");
  if(type==="error") toastEl.classList.add("error");
  toastEl.classList.add("show");
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toastEl.classList.remove("show"),1500);
}

// storage
function loadProducts(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw){products=[];return;}
    const arr = JSON.parse(raw);
    if(!Array.isArray(arr)){products=[];return;}
    products = arr.map(p=>({
      id:p.id||id(),
      name:p.name||"",
      stock:Number(p.stock??0),
      minStock:Number(p.minStock??0),
      notes:p.notes||"",
      createdAt:p.createdAt||Date.now(),
      lastUsed:p.lastUsed||0,
      imageData:p.imageData||null,
      autoImageUrl:p.autoImageUrl||null
    }));
  }catch(e){products=[];}
}
function saveProducts(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(products));
}

// sort & filter
function sortOnce(){
  if(sortedOnce) return;
  sortedOnce = true;
  products.sort((a,b)=>{
    const at=a.lastUsed||a.createdAt||0;
    const bt=b.lastUsed||b.createdAt||0;
    return bt-at;
  });
}
function filterForView(){
  const q = searchEl.value.trim().toLowerCase();
  let arr = products.slice();
  if(q) arr = arr.filter(p=>(p.name||"").toLowerCase().includes(q));
  if(currentFilter==="low"){
    arr = arr.filter(p=>p.minStock>0 && p.stock<=p.minStock);
  }else if(currentFilter==="zero"){
    arr = arr.filter(p=>p.stock===0);
  }
  return arr;
}

// render
function render(){
  if(!listEl) return;
  listEl.innerHTML="";
  const arr = filterForView();
  if(!arr.length){
    const li=document.createElement("li");
    li.className="product-item";
    li.textContent="אין מוצרים להצגה.";
    listEl.appendChild(li);
    return;
  }
  arr.forEach(p=>{
    const li=document.createElement("li");
    li.className="product-item";

    const avatar=document.createElement("div");
    avatar.className="product-avatar";
    let imgUrl = p.imageData || p.autoImageUrl;
    if(!imgUrl && p.name){
      imgUrl = autoImageUrl(p.name);
      p.autoImageUrl = imgUrl;
      saveProducts();
    }
    if(imgUrl){
      const img=document.createElement("img");
      img.src=imgUrl;
      img.alt=p.name||"מוצר";
      img.onerror=()=>{p.autoImageUrl=null;saveProducts();render();};
      avatar.appendChild(img);
    }else{
      avatar.classList.add("placeholder");
      const s=document.createElement("span");
      s.textContent="📷";
      avatar.appendChild(s);
    }
    avatar.addEventListener("click",ev=>{
      ev.stopPropagation();
      openProductModal(p.id);
    });

    const main=document.createElement("div");
    main.className="product-main";
    main.addEventListener("click",()=>openProductModal(p.id));
    const name=document.createElement("h3");
    name.className="product-name";
    name.textContent=p.name||"מוצר ללא שם";
    const meta=document.createElement("p");
    meta.className="product-meta";
    const minText=p.minStock>0?`מינימום ${p.minStock}`:"אין מינימום";
    const notes=p.notes?` · ${p.notes}`:"";
    meta.textContent=minText+notes;
    main.appendChild(name);main.appendChild(meta);

    const stock=document.createElement("div");
    stock.className="stock-badge";
    stock.textContent="מלאי: "+(p.stock??0);
    if(p.minStock>0 && p.stock<=p.minStock) stock.classList.add("low");

    const actions=document.createElement("div");
    actions.className="product-actions";
    const minus=document.createElement("button");
    minus.className="danger-btn";minus.textContent="-";
    minus.addEventListener("click",ev=>{
      ev.stopPropagation();changeStock(p.id,-1);
    });
    const plus=document.createElement("button");
    plus.className="success-btn";plus.textContent="+";
    plus.addEventListener("click",ev=>{
      ev.stopPropagation();changeStock(p.id,1);
    });
    actions.appendChild(minus);actions.appendChild(plus);

    li.appendChild(avatar);
    li.appendChild(main);
    li.appendChild(stock);
    li.appendChild(actions);
    listEl.appendChild(li);
  });
}

// stock logic
function findIndex(pid){return products.findIndex(p=>p.id===pid);}
function changeStock(pid,delta){
  const i=findIndex(pid);if(i===-1)return;
  const p=products[i];
  const newStock=(p.stock??0)+delta;
  if(newStock<0)return;
  p.stock=newStock;
  p.lastUsed=Date.now();
  saveProducts();
  render();
  showToast(delta>0?"נוסף בהצלחה":"נגרע בהצלחה","success");
}

// modal
function resetImagePreview(p){
  imagePreview.innerHTML="";
  imagePreview.classList.add("placeholder");
  let url=p.imageData||p.autoImageUrl;
  if(!url && p.name){
    url=autoImageUrl(p.name);
    p.autoImageUrl=url;
    saveProducts();
  }
  if(url){
    imagePreview.classList.remove("placeholder");
    const img=document.createElement("img");
    img.src=url;img.alt=p.name||"מוצר";
    imagePreview.appendChild(img);
  }else{
    const s=document.createElement("span");
    s.className="camera-icon";s.textContent="📷";
    imagePreview.appendChild(s);
  }
}
function openProductModal(pid){
  const i=findIndex(pid);if(i===-1)return;
  const p=products[i];
  currentProductId=pid;
  productModalTitle.textContent=p.name||"מוצר";
  nameInput.value=p.name||"";
  stockInput.value=p.stock??0;
  minInput.value=p.minStock??0;
  notesInput.value=p.notes||"";
  resetImagePreview(p);
  productModalBackdrop.classList.remove("hidden");
}
function openNewProductModal(){
  const p={
    id:id(),name:"",stock:0,minStock:0,notes:"",
    createdAt:Date.now(),lastUsed:0,imageData:null,autoImageUrl:null
  };
  products.unshift(p);saveProducts();render();openProductModal(p.id);
}
function closeProductModal(){
  currentProductId=null;
  productModalBackdrop.classList.add("hidden");
  imageInput.value="";
}
closeProductModalBtn.addEventListener("click",closeProductModal);
productModalBackdrop.addEventListener("click",ev=>{
  if(ev.target===productModalBackdrop) closeProductModal();
});
minusBtn.addEventListener("click",()=>{
  if(!currentProductId)return;
  changeStock(currentProductId,-1);
  const p=products[findIndex(currentProductId)];
  stockInput.value=p.stock??0;
});
plusBtn.addEventListener("click",()=>{
  if(!currentProductId)return;
  changeStock(currentProductId,1);
  const p=products[findIndex(currentProductId)];
  stockInput.value=p.stock??0;
});
saveBtn.addEventListener("click",()=>{
  if(!currentProductId)return;
  const i=findIndex(currentProductId);if(i===-1)return;
  const p=products[i];
  const name=nameInput.value.trim();
  if(!name){showToast("חייב שם למוצר","error");return;}
  p.name=name;
  const s=Number(stockInput.value||0);
  const m=Number(minInput.value||0);
  p.stock=isNaN(s)||s<0?0:s;
  p.minStock=isNaN(m)||m<0?0:m;
  p.notes=notesInput.value.trim();
  p.lastUsed=Date.now();
  saveProducts();render();showToast("המוצר נשמר","success");closeProductModal();
});
deleteBtn.addEventListener("click",()=>{
  if(!currentProductId)return;
  if(!confirm("למחוק את המוצר הזה?"))return;
  const i=findIndex(currentProductId);if(i===-1)return;
  products.splice(i,1);saveProducts();render();showToast("המוצר נמחק","success");closeProductModal();
});

// image
imagePreview.addEventListener("click",()=>imageInput.click());
imageInput.addEventListener("change",()=>{
  if(!currentProductId)return;
  const file=imageInput.files && imageInput.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const i=findIndex(currentProductId);if(i===-1)return;
    products[i].imageData=e.target.result;
    products[i].autoImageUrl=null;
    saveProducts();resetImagePreview(products[i]);render();
    showToast("תמונה נשמרה","success");
  };
  reader.readAsDataURL(file);
});
imageRemoveBtn.addEventListener("click",()=>{
  if(!currentProductId)return;
  const i=findIndex(currentProductId);if(i===-1)return;
  products[i].imageData=null;products[i].autoImageUrl=null;
  saveProducts();resetImagePreview(products[i]);render();
  showToast("תמונה נמחקה","success");
});

// tools
toolsToggleBtn.addEventListener("click",()=>toolsMenu.classList.toggle("hidden"));
toolsMenu.addEventListener("click",ev=>{
  const btn=ev.target;
  if(!(btn instanceof HTMLButtonElement))return;
  const action=btn.dataset.action;
  if(action==="showAll"){currentFilter="all";showToast("מציג את כל המוצרים");}
  else if(action==="lowStock"){currentFilter="low";showToast("מלאי נמוך בלבד");}
  else if(action==="zeroStock"){currentFilter="zero";showToast("מוצרים שנגמרו");}
  else if(action==="sortByUsage"){
    products.sort((a,b)=>{
      const at=a.lastUsed||a.createdAt||0;
      const bt=b.lastUsed||b.createdAt||0;
      return bt-at;
    });
    saveProducts();showToast("מוין לפי שימוש אחרון");
  }else if(action==="sortByStock"){
    products.sort((a,b)=>(b.stock??0)-(a.stock??0));
    saveProducts();showToast("מוין לפי כמות");
  }else if(action==="inventoryReport"){openReportModal();}
  else if(action==="backup"){backupData();}
  else if(action==="restore"){restoreData();}
  render();
});

// report
function openReportModal(){
  const totalProducts=products.length;
  const totalUnits=products.reduce((s,p)=>s+(p.stock??0),0);
  const low=products.filter(p=>p.minStock>0 && p.stock<=p.minStock);
  const zero=products.filter(p=>p.stock===0);
  reportSummaryEl.innerHTML=
    `<div><strong>סה״כ מוצרים:</strong> ${totalProducts}</div>
     <div><strong>סה״כ יחידות:</strong> ${totalUnits}</div>
     <div><strong>במלאי נמוך:</strong> ${low.length}</div>
     <div><strong>נגמרו:</strong> ${zero.length}</div>`;
  if(low.length){
    reportLowStockEl.innerHTML=
      `<h3>מלאי נמוך</h3><ul class="report-list">${low.map(p=>`<li>${p.name} – ${p.stock} (מינימום ${p.minStock})</li>`).join("")}</ul>`;
  }else{
    reportLowStockEl.innerHTML='<h3>מלאי נמוך</h3><div class="empty-msg">אין פריטים.</div>';
  }
  if(zero.length){
    reportZeroStockEl.innerHTML=
      `<h3>נגמרו</h3><ul class="report-list">${zero.map(p=>`<li>${p.name}</li>`).join("")}</ul>`;
  }else{
    reportZeroStockEl.innerHTML='<h3>נגמרו</h3><div class="empty-msg">אין פריטים.</div>';
  }
  reportModalBackdrop.classList.remove("hidden");
}
function closeReportModal(){reportModalBackdrop.classList.add("hidden");}
closeReportModalBtn.addEventListener("click",closeReportModal);
reportModalBackdrop.addEventListener("click",ev=>{
  if(ev.target===reportModalBackdrop) closeReportModal();
});

// backup / restore
function backupData(){
  if(!products.length){showToast("אין נתונים לגיבוי","error");return;}
  const blob=new Blob([JSON.stringify(products,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="inventory_backup.json";
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("קובץ גיבוי ירד","success");
}
function restoreData(){
  const input=document.createElement("input");
  input.type="file";input.accept="application/json";
  input.addEventListener("change",()=>{
    const file=input.files && input.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const arr=JSON.parse(e.target.result);
        if(!Array.isArray(arr)) throw new Error();
        products=arr.map(p=>({
          id:p.id||id(),name:p.name||"",
          stock:Number(p.stock??0),minStock:Number(p.minStock??0),
          notes:p.notes||"",createdAt:p.createdAt||Date.now(),
          lastUsed:p.lastUsed||0,imageData:p.imageData||null,
          autoImageUrl:p.autoImageUrl||null
        }));
        saveProducts();render();showToast("הנתונים שוחזרו","success");
      }catch(err){console.error(err);showToast("קובץ לא תקין","error");}
    };
    reader.readAsText(file);
  });
  input.click();
}

// init
function init(){
  loadProducts();sortOnce();render();
  addBtn.addEventListener("click",openNewProductModal);
  searchEl.addEventListener("input",render);
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("service-worker.js").catch(()=>{});
  }
}
document.addEventListener("DOMContentLoaded",init);
