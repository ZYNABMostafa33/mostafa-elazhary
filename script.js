// ==================== المتغيرات العامة ====================
let products = [];
let currentInvoice = [];
let savedInvoices = [];
let editingProductId = null;
let editingVariants = [];
let customersBalance = {};
let editingInvoiceIndex = null;   // ← مهم جدًا
let editingCompanies = [];        // لتخزين الشركات المختارة للمنتج
let bulkEditCompany = null;     // الشركة اللي هنعدل أسعارها
let bulkEditType = 'percent';   // 'percent' أو 'fixed'
let allCustomers = [];   // عشان نحفظ أسماء الزبائن السابقين

// ==================== قائمة الشركات (تصنيف المنتجات) - قابلة للتعديل ====================
const DEFAULT_COMPANIES = [
    { id: 'redsea',    label: 'البحر الأحمر' },
    { id: 'aquadelta', label: 'أكوا دلتا' },
    { id: 'dr',        label: 'Dr' },
    { id: 'nawakel',   label: 'النواكل' },
    { id: 'zahr',      label: 'الزهر' },
    { id: 'khazanat',  label: 'خزانات' },
    { id: 'kawabel',   label: 'كاوابيل + غطيان' },
    { id: 'masaseer',  label: 'مواسير شعبي + رمادي' },
    { id: 'extra',     label: 'اضافي' }
];

// قائمة الشركات الفعلية (تتحمل من Firebase، وتقدر تضيف/تعدل/تحذف منها)
let companiesList = JSON.parse(JSON.stringify(DEFAULT_COMPANIES));

// الشركات اللي فيها تعديل السعر بيتطبق على الفاتورة كلها مش على كل منتج لوحده
const PERCENT_COMPANIES = ['redsea', 'aquadelta', 'dr'];

function getCompanyLabel(id) {
    const c = companiesList.find(c => c.id === id);
    return c ? c.label : id;
}

async function saveCompanies() {
    try {
        await db.collection("appData").doc("companies").set({
            companiesList: companiesList,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error("خطأ في حفظ الشركات:", e);
        localStorage.setItem('companiesList', JSON.stringify(companiesList));
    }
}

async function loadCompanies() {
    try {
        const doc = await db.collection("appData").doc("companies").get();
        if (doc.exists && Array.isArray(doc.data().companiesList) && doc.data().companiesList.length > 0) {
            companiesList = doc.data().companiesList;
        } else {
            companiesList = JSON.parse(JSON.stringify(DEFAULT_COMPANIES));
            await saveCompanies();
        }
    } catch (e) {
        console.error("خطأ في تحميل الشركات:", e);
        companiesList = JSON.parse(JSON.stringify(DEFAULT_COMPANIES));
    }
}

// الشركة المختارة حاليًا لتصفية قائمة "منتجاتنا" (فلتر مستقل عن فلتر القطاعي)
let productsSelectedCompany = '';

// ==================== Toast Notifications (رسائل نجاح/خطأ موحدة) ====================
function showToast(message, type = 'success') {
    const palette = {
        success: 'bg-emerald-600',
        error: 'bg-red-600',
        warning: 'bg-amber-500',
        info: 'bg-brand-600'
    };
    const toast = document.createElement('div');
    toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 ${palette[type] || palette.success} text-white px-6 py-3.5 rounded-2xl shadow-lifted z-[60] text-sm sm:text-base font-semibold max-w-[90vw] text-center`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
}

// ==================== Retail (قطاعي) - متغيرات جديدة ====================
let retailInvoice = [];
let savedRetailInvoices = [];
let editingRetailInvoiceIndex = null;     // ← مهم جدًا
let allRetailCustomers = [];              // للاقتراحات
let retailPriceAdjustment = 0;   // قيمة الزيادة أو النقصان
let retailAdjustmentType = 'percent';
let retailSelectedCompany = '';  // الشركة المختارة حاليًا في فاتورة القطاعي
let retailAdjustmentConfirmed = false;   // (باقية لتوافق قديم، لم تعد تُستخدم للحجب)
let retailItemAdjustmentConfirmed = false; // هل المستخدم حط نسبة/قيمة الزيادة أو النقصان الأول قبل إضافة منتج (للشركات العادية غير الثلاثة)
let retailStaging = [];   // قائمة مؤقتة لمنتجات الشركة المختارة (البحر الأحمر/أكوا دلتا/Dr) قبل ما تتضاف للفاتورة الكلية

async function saveProducts() {
    try {
        await db.collection("appData").doc("products").set({
            products: products,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ المنتجات تم حفظها على Firebase");
    } catch (e) {
        console.error("خطأ في حفظ المنتجات:", e);
        localStorage.setItem('products', JSON.stringify(products));
    }
}

async function loadProducts() {
    try {
        const doc = await db.collection("appData").doc("products").get();
        
        if (doc.exists) {
            products = doc.data().products || [];
        } else {
            // بيانات افتراضية أول مرة
            products = [];
            await saveProducts();
        }
    } catch (e) {
        console.error("خطأ في تحميل المنتجات:", e);
        products = [];
    }
    
    renderProducts();
    populateProductDatalist();
}

async function saveAllInvoices() {
    try {
        await db.collection("appData").doc("invoices").set({
            savedInvoices: savedInvoices,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ الفواتير تم حفظها على Firebase");
    } catch (e) {
        console.error("خطأ في حفظ الفواتير:", e);
        localStorage.setItem('savedInvoices', JSON.stringify(savedInvoices));
    }
}

// ==================== إحصائيات سريعة (منتجاتنا) ====================
function updateProductsStats() {
    const countEl = document.getElementById('stat-products-count');
    const variantsEl = document.getElementById('stat-variants-count');
    if (!countEl || !variantsEl) return;

    const validProducts = Array.isArray(products) ? products.filter(p => p && Array.isArray(p.variants)) : [];
    const totalVariants = validProducts.reduce((sum, p) => sum + p.variants.length, 0);

    countEl.textContent = validProducts.length;
    variantsEl.textContent = totalVariants;
}

// ==================== تصفية قائمة المنتجات (بحث + شركة) ====================
function applyProductsFilter() {
    const searchBox = document.getElementById('product-search-box');
    const query = searchBox ? searchBox.value.trim().toLowerCase() : '';

    let filtered = Array.isArray(products) ? products : [];

    if (productsSelectedCompany) {
        filtered = filtered.filter(p => Array.isArray(p.companies) && p.companies.includes(productsSelectedCompany));
    }

    if (query) {
        filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(query));
    }

    renderProducts(filtered);
}

// ==================== أزرار تصفية "منتجاتنا" حسب الشركة ====================
function renderProductsCompanyFilter() {
    const container = document.getElementById('products-company-filter');
    if (!container) return;
    container.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.textContent = 'كل الشركات';
    allBtn.className = 'chip';
    allBtn.dataset.companyId = '';
    allBtn.onclick = () => selectProductsCompanyFilter('');
    container.appendChild(allBtn);

    companiesList.forEach(c => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = c.label;
        btn.className = 'chip';
        btn.dataset.companyId = c.id;
        btn.onclick = () => selectProductsCompanyFilter(c.id);
        container.appendChild(btn);
    });

    updateProductsCompanyFilterActiveState();
}

function updateProductsCompanyFilterActiveState() {
    const container = document.getElementById('products-company-filter');
    if (!container) return;
    Array.from(container.children).forEach(btn => {
        btn.classList.toggle('chip-active', btn.dataset.companyId === productsSelectedCompany);
    });
}

function selectProductsCompanyFilter(companyId) {
    productsSelectedCompany = companyId;
    updateProductsCompanyFilterActiveState();
    applyProductsFilter();
}

// ==================== تحذير الكمية القليلة (كل المنتجات اللي وصلت لحد التنبيه أو أقل) ====================
function updateLowStockAlert() {
    const alertBox = document.getElementById('low-stock-alert');
    const countEl = document.getElementById('low-stock-count');
    const panel = document.getElementById('low-stock-panel');
    if (!alertBox || !countEl || !panel) return;

    const lowItems = [];
    (Array.isArray(products) ? products : []).forEach(p => {
        if (!p || !Array.isArray(p.variants)) return;
        p.variants.forEach(v => {
            const hasStockInfo = v.stock !== undefined && v.stock !== null && v.stock !== '';
            const stock = Number(v.stock) || 0;
            const threshold = Number(v.alertThreshold) || 0;
            if (hasStockInfo && threshold > 0 && stock <= threshold) {
                lowItems.push({ productName: p.name, size: v.size, stock });
            }
        });
    });

    if (lowItems.length === 0) {
        alertBox.classList.add('hidden');
        panel.classList.add('hidden');
        panel.innerHTML = '';
        return;
    }

    alertBox.classList.remove('hidden');
    countEl.textContent = lowItems.length;
    panel.innerHTML = lowItems.map(it => `
        <div class="flex items-center justify-between bg-red-50 rounded-xl px-4 py-2.5">
            <div>
                <div class="font-semibold text-red-800">${it.productName}</div>
                <div class="text-xs text-red-500">${it.size}</div>
            </div>
            <div class="text-red-700 font-bold">متبقي ${it.stock}</div>
        </div>
    `).join('');
}

function toggleLowStockPanel() {
    const panel = document.getElementById('low-stock-panel');
    if (panel) panel.classList.toggle('hidden');
}

// ==================== عرض المنتجات (بعد التحديث) ====================
function renderProducts(filtered = products) {
    updateProductsStats();
    updateLowStockAlert();
    const container = document.getElementById('products-list');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(filtered)) filtered = [];
    const validProducts = filtered.filter(p => p && typeof p === 'object' && Array.isArray(p.variants));

    if (validProducts.length === 0) {
        container.innerHTML = `
            <div class="card empty-state">
                <div class="text-6xl mb-4">🛒</div>
                <p class="text-lg font-bold text-slate-600">لا يوجد منتجات مطابقة</p>
                <p class="text-sm text-slate-400 mt-1">جرّب تغيير كلمة البحث أو الشركة المختارة</p>
            </div>
        `;
        return;
    }

    validProducts.forEach(product => {
        let rowsHTML = '';
        product.variants.forEach(variant => {
            const price = Number(variant.price);
            const priceDisplay = isNaN(price) ? '—' : price.toFixed(2);
            const stock = Number(variant.stock) || 0;
            const threshold = Number(variant.alertThreshold) || 0;
            const hasStockInfo = variant.stock !== undefined && variant.stock !== null && variant.stock !== '';
            const isLowStock = hasStockInfo && threshold > 0 && stock <= threshold;

            rowsHTML += `
                <tr class="hover:bg-gray-50 transition-colors ${isLowStock ? 'bg-rose-50' : ''}">
                    <td class="px-4 py-3 text-right font-medium">${variant.size || 'غير محدد'}</td>
                    <td class="px-4 py-3 text-center font-bold text-blue-700">${priceDisplay} <span class="text-sm text-gray-500">ج.م</span></td>
                    <td class="px-4 py-3 text-center">${hasStockInfo ? stock : '—'}</td>
                    <td class="px-4 py-3 text-center">
                        ${isLowStock ? `<span class="badge bg-rose-100 text-rose-700">⚠️ الكمية قليلة (متبقي ${stock})</span>` : ''}
                    </td>
                </tr>
            `;
        });

        let companyBadges = '';
        if (Array.isArray(product.companies) && product.companies.length > 0) {
            companyBadges = product.companies.map(c => {
                const label = getCompanyLabel(c);
                return `<span class="bg-white/15 text-white text-xs px-3 py-1 rounded-full font-medium">${label}</span>`;
            }).join(' ');
        }

        const card = document.createElement('div');
        card.className = 'card overflow-hidden';
        card.innerHTML = `
            <div class="bg-brand-600 px-5 py-4 text-white">
                <div class="flex justify-between items-center flex-wrap gap-2">
                    <h3 class="text-lg sm:text-xl font-bold">${product.name}</h3>
                    <div class="flex items-center gap-2 flex-wrap justify-end">
                        ${companyBadges}
                        <span class="bg-white/20 px-3 py-1 rounded-full text-xs sm:text-sm font-medium">${product.variants.length} مقاس</span>
                    </div>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="table-modern">
                    <thead>
                        <tr>
                            <th class="text-right">المقاس</th>
                            <th class="text-center">السعر</th>
                            <th class="text-center">الكمية بالمخزن</th>
                            <th class="text-center">تحذيرات</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">${rowsHTML}</tbody>
                </table>
            </div>
            <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button onclick="editProduct(${product.id})" class="btn-secondary !py-2 !px-4 text-sm">✏️ تعديل</button>
                <button onclick="deleteProduct(${product.id})" class="btn-danger !py-2 !px-4 text-sm">🗑️ حذف</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// ==================== مودال المنتج - عرض الشركات المختارة (Chips) ====================
function renderSelectedCompaniesChips() {
    const container = document.getElementById('product-companies-container');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(editingCompanies) || editingCompanies.length === 0) {
        container.innerHTML = `<span class="text-sm text-slate-400">لسه مفيش شركات متختارة لهذا المنتج</span>`;
        return;
    }

    editingCompanies.forEach(id => {
        const chip = document.createElement('span');
        chip.className = 'badge bg-brand-50 text-brand-700 border border-brand-100';
        chip.textContent = getCompanyLabel(id);
        container.appendChild(chip);
    });
}

// ==================== مودال إدارة الشركات (إضافة / تعديل / حذف) ====================
function openCompanyManager() {
    renderCompanyManagerList();
    const modal = document.getElementById('company-manager-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeCompanyManager() {
    const modal = document.getElementById('company-manager-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    // تحديث الشيبس في مودال المنتج بعد الإغلاق
    renderSelectedCompaniesChips();
}

function renderCompanyManagerList() {
    const container = document.getElementById('company-manager-list');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(companiesList) || companiesList.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-6">مفيش شركات لسه، ضيف واحدة تحت 👇</div>`;
        return;
    }

    companiesList.forEach(c => {
        const isChecked = Array.isArray(editingCompanies) && editingCompanies.includes(c.id);
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 bg-slate-50 rounded-xl p-3';
        row.innerHTML = `
            <label class="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
                <input type="checkbox" ${isChecked ? 'checked' : ''}
                       onchange="toggleCompanySelection('${c.id}', this.checked)"
                       class="w-5 h-5 accent-brand-600 shrink-0">
                <span id="company-label-${c.id}" class="font-medium text-slate-700 truncate">${c.label}</span>
            </label>
            <button type="button" onclick="startRenameCompany('${c.id}')" class="btn-secondary !py-1.5 !px-3 text-xs shrink-0">✏️ تعديل</button>
            <button type="button" onclick="deleteCompanyEntry('${c.id}')" class="btn-danger !py-1.5 !px-3 text-xs shrink-0">🗑️ حذف</button>
        `;
        container.appendChild(row);
    });
}

function toggleCompanySelection(id, checked) {
    if (!Array.isArray(editingCompanies)) editingCompanies = [];
    if (checked) {
        if (!editingCompanies.includes(id)) editingCompanies.push(id);
    } else {
        editingCompanies = editingCompanies.filter(c => c !== id);
    }
}

function startRenameCompany(id) {
    const c = companiesList.find(c => c.id === id);
    if (!c) return;
    const newLabel = prompt('اكتب الاسم الجديد للشركة:', c.label);
    if (newLabel === null) return;
    const trimmed = newLabel.trim();
    if (!trimmed) return alert('❌ الاسم لا يمكن أن يكون فارغ');
    c.label = trimmed;
    saveCompanies();
    renderCompanyManagerList();
    renderProductsCompanyFilter();
    populateRetailCompanyFilter();
    applyProductsFilter();
    showToast('✅ تم تعديل اسم الشركة', 'success');
}

function deleteCompanyEntry(id) {
    const c = companiesList.find(c => c.id === id);
    if (!c) return;
    if (!confirm(`هل أنت متأكد من حذف شركة "${c.label}"؟ هيتشال من كل المنتجات المرتبطة بيها.`)) return;

    companiesList = companiesList.filter(c => c.id !== id);
    editingCompanies = Array.isArray(editingCompanies) ? editingCompanies.filter(cid => cid !== id) : [];

    // تنظيف المنتجات اللي كانت مرتبطة بالشركة دي
    products.forEach(p => {
        if (Array.isArray(p.companies)) {
            p.companies = p.companies.filter(cid => cid !== id);
        }
    });

    saveCompanies();
    saveProducts();
    renderCompanyManagerList();
    renderProductsCompanyFilter();
    populateRetailCompanyFilter();
    applyProductsFilter();
    showToast('🗑️ تم حذف الشركة', 'error');
}

function addNewCompanyEntry() {
    const input = document.getElementById('new-company-name');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return alert('❌ اكتب اسم الشركة الجديدة');

    const id = 'c_' + Date.now();
    companiesList.push({ id, label: name });

    if (!Array.isArray(editingCompanies)) editingCompanies = [];
    editingCompanies.push(id);

    input.value = '';
    saveCompanies();
    renderCompanyManagerList();
    renderProductsCompanyFilter();
    populateRetailCompanyFilter();
    showToast('✅ تم إضافة الشركة', 'success');
}

// ==================== مودال المنتج ====================
function renderVariantsInModal() {
    const container = document.getElementById('variants-container');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(editingVariants) || editingVariants.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'text-center py-8 text-gray-400';
        empty.innerHTML = 'اضغط "مقاس جديد" للبداية';
        container.appendChild(empty);
        return;
    }

    editingVariants.forEach((variant, index) => {
        const row = document.createElement('div');
        row.className = 'bg-gray-50 rounded-2xl p-3 space-y-2';
        row.innerHTML = `
            <div class="flex gap-3 items-center">
                <input type="text" placeholder="المقاس" value="${variant.size || ''}" oninput="updateVariantSize(${index}, this.value)" class="flex-1 px-4 py-3 rounded-xl border focus:border-blue-400 text-lg">
                <input type="number" step="0.01" min="0" placeholder="السعر" value="${variant.price || ''}" oninput="updateVariantPrice(${index}, this.value)" class="w-28 px-4 py-3 rounded-xl border focus:border-blue-400 text-lg text-center">
                <button onclick="removeVariant(${index})" class="w-9 h-9 flex items-center justify-center text-red-500 text-2xl hover:bg-red-100 rounded-xl shrink-0">×</button>
            </div>
            <div class="flex gap-3 items-center">
                <div class="flex-1">
                    <label class="text-xs text-slate-400 mb-1 block">الكمية المتاحة بالمخزن</label>
                    <input type="number" step="1" min="0" placeholder="الكمية" value="${variant.stock || ''}" oninput="updateVariantStock(${index}, this.value)" class="w-full px-4 py-2.5 rounded-xl border focus:border-blue-400 text-center">
                </div>
                <div class="flex-1">
                    <label class="text-xs text-slate-400 mb-1 block">تحذيرات (حد التنبيه)</label>
                    <input type="number" step="1" min="0" placeholder="مثلاً 5" value="${variant.alertThreshold || ''}" oninput="updateVariantAlert(${index}, this.value)" class="w-full px-4 py-2.5 rounded-xl border focus:border-blue-400 text-center">
                </div>
            </div>
        `;
        container.appendChild(row);
    });
}

function updateVariantSize(index, value) { if (editingVariants[index]) editingVariants[index].size = value; }
function updateVariantPrice(index, value) { if (editingVariants[index]) editingVariants[index].price = parseFloat(value) || 0; }
function updateVariantStock(index, value) { if (editingVariants[index]) editingVariants[index].stock = parseFloat(value) || 0; }
function updateVariantAlert(index, value) { if (editingVariants[index]) editingVariants[index].alertThreshold = parseFloat(value) || 0; }

function addVariantRow() {
    editingVariants.push({ size: '', price: 0, stock: 0, alertThreshold: 0 });
    renderVariantsInModal();
}

function removeVariant(index) {
    editingVariants.splice(index, 1);
    renderVariantsInModal();
}

function openAddProductModal() {
    editingProductId = null;
    editingVariants = [];
    editingCompanies = [];                    // ← جديد
    document.getElementById('modal-title').textContent = 'إضافة منتج جديد';
    document.getElementById('product-name').value = '';
    
    // إعادة تعيين الشركات المختارة
    renderSelectedCompaniesChips();
    
    renderVariantsInModal();
    const modal = document.getElementById('product-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    editingProductId = id;
    document.getElementById('modal-title').textContent = 'تعديل المنتج';
    document.getElementById('product-name').value = product.name || '';

    editingVariants = Array.isArray(product.variants) ? JSON.parse(JSON.stringify(product.variants)) : [];
    
    // تحميل الشركات المختارة
    editingCompanies = Array.isArray(product.companies) ? [...product.companies] : [];
    renderSelectedCompaniesChips();

    renderVariantsInModal();

    const modal = document.getElementById('product-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeModal() {
    const modal = document.getElementById('product-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function saveProduct() {
    const name = document.getElementById('product-name').value.trim();
    if (!name) return alert('❌ ضع اسم المنتج');

    if (!Array.isArray(editingVariants) || editingVariants.length === 0) 
        return alert('❌ لازم تضيف مقاس واحد على الأقل');

    const selectedCompanies = Array.isArray(editingCompanies) ? [...editingCompanies] : [];

    const cleanVariants = editingVariants
        .filter(v => (v.size || '').trim() !== '' && parseFloat(v.price) > 0)
        .map(v => ({
            size: v.size.trim(),
            price: parseFloat(v.price),
            stock: parseFloat(v.stock) || 0,
            alertThreshold: parseFloat(v.alertThreshold) || 0
        }));

    if (cleanVariants.length === 0) return alert('❌ تأكد إن كل مقاس له اسم وسعر صحيح');

    if (editingProductId !== null) {
        const index = products.findIndex(p => p.id === editingProductId);
        if (index !== -1) {
            products[index].name = name;
            products[index].variants = cleanVariants;
            products[index].companies = selectedCompanies;
        }
    } else {
        products.push({ 
            id: Date.now(), 
            name, 
            variants: cleanVariants,
            companies: selectedCompanies
        });
    }

    saveProducts();           // ← Firebase
    applyProductsFilter();
    populateProductDatalist();
    closeModal();

    showToast(editingProductId !== null ? '✅ تم تعديل المنتج' : '✅ تم إضافة المنتج بنجاح', 'success');
}

function deleteProduct(id) {
    if (!confirm('هل أنت متأكد من حذف المنتج ده؟')) return;
    products = products.filter(p => p.id !== id);
    saveProducts();           // ← Firebase
    applyProductsFilter();
    populateProductDatalist();
    showToast('🗑️ تم حذف المنتج', 'error');
}

// ==================== الفاتورة ====================
function populateProductDatalist() {
    const dl = document.getElementById('products-datalist');
    if (!dl) return;
    dl.innerHTML = '';
    products.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        dl.appendChild(opt);
    });
}

function updatePriceDisplay() {
    const productInput = document.getElementById('product-search');
    const sizeSelect = document.getElementById('size-select');
    const priceDisplay = document.getElementById('price-display');
    if (!productInput || !sizeSelect || !priceDisplay) return;

    const productName = productInput.value.trim();
    const size = sizeSelect.value;
    if (!productName || !size) {
        priceDisplay.textContent = '0';
        return;
    }

    const product = products.find(p => p.name.trim() === productName);
    const variant = product ? product.variants.find(v => v.size === size) : null;
    priceDisplay.textContent = variant ? variant.price : '0';
}

function addToInvoice() {
    const productInput = document.getElementById('product-search');
    const sizeSelect = document.getElementById('size-select');
    const qtyInput = document.getElementById('qty-input');

    if (!productInput || !sizeSelect || !qtyInput) return;

    const productName = productInput.value.trim();
    const size = sizeSelect.value;
    const qty = parseInt(qtyInput.value) || 1;

    if (!productName) return alert('❌ اختر المنتج');
    if (!size) return alert('❌ اختر المقاس');
    if (qty < 1) return alert('❌ الكمية غلط');

    const product = products.find(p => p.name.trim() === productName);
    if (!product) return alert('❌ المنتج غير موجود');

    const variant = product.variants.find(v => v.size === size);
    if (!variant) return alert('❌ المقاس غير موجود');

    currentInvoice.push({
        id: Date.now(),
        productName: product.name,
        size: size,
        price: variant.price,
        qty: qty,
        subtotal: variant.price * qty
    });

    renderInvoiceTable();
    updateTotalAndRemaining();

    qtyInput.value = 1;
}

function renderInvoiceTable() {
    const tbody = document.getElementById('invoice-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    currentInvoice.forEach((item, index) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        row.innerHTML = `
            <td class="py-5 px-6 font-medium">${item.productName}</td>
            <td class="py-5 px-6 text-center text-lg">${item.size}</td>
            <td class="py-5 px-6 text-center">${item.price}</td>
            <td class="py-5 px-6 text-center text-lg font-medium">${item.qty}</td>
            <td class="py-5 px-6 text-center font-bold">${item.subtotal}</td>
            <td class="py-5 px-6 text-center no-print">
                <button onclick="removeFromInvoice(${index})" class="text-red-500 hover:text-red-700 text-3xl">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    updateTotalAndRemaining();
}

function removeFromInvoice(index) {
    currentInvoice.splice(index, 1);
    renderInvoiceTable();
    updateTotalAndRemaining();
}

// ==================== حساب الرصيد السابق لعميل ====================
function getCustomerPreviousDebt(customerName, excludeIndex = -1) {
    if (!customerName || customerName === 'عميل غير محدد') return 0;

    const customerInvs = savedInvoices
        .map((inv, idx) => ({ ...inv, originalIndex: idx }))
        .filter(inv => inv.customer === customerName && inv.originalIndex !== excludeIndex)
        .sort((a, b) => a.date - b.date);  // من الأقدم للأحدث

    let runningDebt = 0;

    for (let inv of customerInvs) {
        const total = Number(inv.total) || 0;
        const paid = Number(inv.paid) || 0;
        runningDebt = Math.max(0, (total + runningDebt) - paid);   // مهم: Math.max(0, ...)
    }

    return runningDebt;
}
// ==================== تحديث الإجمالي والمتبقي (النسخة الصحيحة) ====================
function updateTotalAndRemaining() {
    const currentTotal = currentInvoice.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const paid = parseFloat(document.getElementById("paid-input")?.value || 0) || 0;
    const customerName = document.getElementById('customer-name').value.trim();

    const previousDebt = getCustomerPreviousDebt(customerName, editingInvoiceIndex);

    const grandTotal = currentTotal + previousDebt;
    let remaining = grandTotal - paid;

    // عرض
    document.getElementById('total-display').textContent = currentTotal.toFixed(2);
    document.getElementById('total-input').value = grandTotal.toFixed(2);

    const remainingEl = document.getElementById('remaining-input');
    if (remainingEl) {
        remainingEl.value = Math.max(0, remaining).toFixed(2);
        remainingEl.style.color = remaining > 0 ? "#dc2626" : "#16a34a";
    }

    return { 
        currentTotal, 
        grandTotal, 
        paid, 
        remaining: Math.max(0, remaining), 
        previousDebt 
    };
}


function saveCurrentInvoice() {
    const customerInput = document.getElementById('customer-name');
    const customer = customerInput ? customerInput.value.trim() : 'عميل غير محدد';

    if (currentInvoice.length === 0) 
        return alert('❌ الفاتورة فاضية!');

    const { currentTotal } = updateTotalAndRemaining();

    const invoice = {
        customer,
        items: JSON.parse(JSON.stringify(currentInvoice)),
        total: Number(currentTotal.toFixed(2)),
        paid: parseFloat(document.getElementById("paid-input").value) || 0,
        date: (editingInvoiceIndex !== null && savedInvoices[editingInvoiceIndex])
        ? savedInvoices[editingInvoiceIndex].date
        : Date.now()
    };

    if (editingInvoiceIndex !== null) {
        savedInvoices[editingInvoiceIndex] = invoice;
    } else {
        savedInvoices.push(invoice);
    }

    recalculateAllInvoicesForCustomer(customer);
    saveAllInvoices();        // ← Firebase

    // تصفير
    currentInvoice = [];
    editingInvoiceIndex = null;
    renderInvoiceTable();
    updateTotalAndRemaining();

    if (customerInput) customerInput.value = '';
    document.getElementById('paid-input').value = '0';
    document.getElementById('remaining-input').value = '0';

    updateInvoiceHeader();
    renderSavedInvoices();

    setTimeout(() => getAllUniqueCustomers(), 100);

    showToast('✅ تم حفظ الفاتورة بنجاح', 'success');
}

// ====================== اقتراح أسماء الزبائن ======================
function getAllUniqueCustomers() {
    const customersSet = new Set();
    
    savedInvoices.forEach(inv => {
        if (inv.customer && inv.customer !== 'عميل غير محدد') {
            customersSet.add(inv.customer.trim());
        }
    });
    
    allCustomers = Array.from(customersSet).sort();
    return allCustomers;
}

function setupCustomerAutocomplete() {
    const customerInput = document.getElementById('customer-name');
    if (!customerInput) return;

    // إنشاء الـ datalist لو مش موجود
    let datalist = document.getElementById('customers-datalist');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'customers-datalist';
        document.body.appendChild(datalist);
    }

    customerInput.setAttribute('list', 'customers-datalist');

    // تحديث الاقتراحات عند التركيز أو الكتابة
    function updateCustomerSuggestions() {
        getAllUniqueCustomers();
        datalist.innerHTML = '';

        allCustomers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer;
            datalist.appendChild(option);
        });
    }

    customerInput.addEventListener('focus', updateCustomerSuggestions);
    customerInput.addEventListener('input', () => {
        // تحديث فوري للـ header أثناء الكتابة
        updateInvoiceHeader();
    });
}



// ربط حقل المدفوع مباشرة
document.addEventListener('DOMContentLoaded', () => {
    const paidInput = document.getElementById('paid-input');
    if (paidInput) {
        paidInput.addEventListener('input', updateTotalAndRemaining);
    }
    const retailPaid = document.getElementById('retail-paid-input');
if (retailPaid) retailPaid.addEventListener('input', updateRetailTotalAndRemaining);
});

// ==================== إعادة حساب كل فواتير الزبون بعد أي تعديل ====================
function recalculateAllInvoicesForCustomer(customerName) {
    if (!customerName || customerName === 'عميل غير محدد') return;

    const customerInvoices = savedInvoices
        .map((inv, idx) => ({ ...inv, originalIndex: idx }))
        .filter(inv => inv.customer === customerName)
        .sort((a, b) => a.date - b.date);

    let runningDebt = 0;

    for (let i = 0; i < customerInvoices.length; i++) {
        const inv = customerInvoices[i];
        const realIndex = inv.originalIndex;

        const currentTotal = Number(inv.total) || 0;
        const paid = Number(inv.paid) || 0;

        const grandTotal = currentTotal + runningDebt;
        const remaining = grandTotal - paid;

        // حفظ القيم المحسوبة (اختياري للعرض السريع)
        savedInvoices[realIndex].grandTotal = Number(grandTotal.toFixed(2));
        savedInvoices[realIndex].remaining = Number(Math.max(0, remaining).toFixed(2));

        // الدين للفاتورة التالية
        runningDebt = Math.max(0, remaining);
    }
}

function updateRemaining() { updateTotalAndRemaining(); }

function updateInvoiceHeader() {
    const customerNameInput = document.getElementById('customer-name');
    const invoiceCustomer = document.getElementById('invoice-customer');
    if (!invoiceCustomer || !customerNameInput) return;

    const name = customerNameInput.value.trim() || 'عميل غير محدد';

    const previousDebt = getCustomerPreviousDebt(name, editingInvoiceIndex);

    if (previousDebt > 0) {
        invoiceCustomer.innerHTML = `
            ${name} 
            <span class="text-red-600 font-bold">(عليه ${previousDebt.toFixed(2)} جنيه سابقًا)</span>
        `;
    } else {
        invoiceCustomer.textContent = name;
    }
}

function clearInvoice() {
    if (!confirm('هل تريد مسح الفاتورة كاملة؟')) return;
    currentInvoice = [];
    renderInvoiceTable();
    updateTotalAndRemaining();

    const customerName = document.getElementById('customer-name');
    if (customerName) customerName.value = '';
    updateInvoiceHeader();
}


function renderSavedInvoices() {
    const container = document.getElementById('saved-invoices-list');
    if (!container) return;
    container.innerHTML = '';

    if (savedInvoices.length === 0) {
        container.innerHTML = `
            <div class="bg-white rounded-2xl p-10 text-center text-gray-500">
                <p>لا توجد فواتير محفوظة بعد</p>
            </div>
        `;
        return;
    }

    savedInvoices.forEach((inv, index) => {
        const dateObj = new Date(inv.date);
        const formattedDate = dateObj.toLocaleDateString('ar-EG', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        const formattedTime = dateObj.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', minute: '2-digit' 
        });

        const currentTotal = Number(inv.total) || 0;
        const previousDebt = getCustomerPreviousDebt(inv.customer, index);
        const grandTotal = currentTotal + previousDebt;
        const paid = Number(inv.paid) || 0;
        const remaining = grandTotal - paid;

        const card = document.createElement('div');
        card.className = 'bg-gray-50 rounded-xl p-4 shadow-sm';

        card.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <div class="font-semibold">${inv.customer}</div>
                <div class="text-gray-500 text-sm">${formattedDate} - ${formattedTime}</div>
            </div>

            <button onclick="toggleInvoiceDetails(${index})" 
                    class="text-blue-600 underline mb-3">
                عرض المنتجات
            </button>

            <div id="invoice-details-${index}" class="hidden">

                <!-- جدول المنتجات -->
                <table class="w-full text-right border-collapse mb-4">
                    <thead class="bg-gray-200">
                        <tr>
                            <th class="py-2 px-4 text-right">المنتج</th>
                            <th class="py-2 px-4">المقاس</th>
                            <th class="py-2 px-4">السعر</th>
                            <th class="py-2 px-4">الكمية</th>
                            <th class="py-2 px-4">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inv.items.map(item => `
                            <tr class="border-b">
                                <td class="py-2 px-4 text-right">${item.productName}</td>
                                <td class="py-2 px-4 text-center">${item.size}</td>
                                <td class="py-2 px-4 text-center">${item.price}</td>
                                <td class="py-2 px-4 text-center">${item.qty}</td>
                                <td class="py-2 px-4 text-center font-bold">${item.subtotal}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <!-- المبالغ -->
                <div class="bg-white rounded-2xl p-5 shadow-sm">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                        <div>
                            <div class="text-xs text-gray-500 mb-1">إجمالي الفاتورة الجديدة</div>
                            <div class="text-2xl font-bold text-blue-600">
                                ${currentTotal.toFixed(2)} جنيه
                            </div>
                        </div>
                       
                        <div>
                            <div class="text-xs text-gray-500 mb-1">المبلغ المدفوع</div>
                            <div class="text-2xl font-bold text-green-600">
                                ${paid.toFixed(2)} جنيه
                            </div>
                        </div>
                        <div class="md:col-span-3 mt-4 pt-4 border-t">
                            <div class="text-xs text-gray-500 mb-1">المتبقي النهائي</div>
                            <div class="text-3xl font-bold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}">
                                ${remaining.toFixed(2)} جنيه
                            </div>
                        </div>
                    </div>
                </div>

                <!-- أزرار -->
                <div class="flex justify-end gap-4 mt-4">
                    <button onclick="printSavedInvoice(${index})" class="text-blue-600 underline">طباعة</button>
                    <button onclick="editSavedInvoice(${index})" class="text-amber-600 underline">تعديل</button>
                    <button onclick="deleteSavedInvoice(${index})" class="text-red-600 underline">حذف</button>
                </div>

            </div>
        `;
        container.appendChild(card);
    });
}
function toggleInvoiceDetails(index) {
    const detailsDiv = document.getElementById(`invoice-details-${index}`);
    if (detailsDiv) detailsDiv.classList.toggle('hidden');
}

function filterInvoicesByCustomer() {
    const input = document.getElementById('search-customer');
    const container = document.getElementById('saved-invoices-list');
    if (!container || !input) return;

    const filter = input.value.trim().toLowerCase();

    if (filter === '') {
        renderSavedInvoices();
        return;
    }

    container.innerHTML = '';

    const filteredInvoices = savedInvoices.filter(inv => 
        inv.customer && inv.customer.toLowerCase().includes(filter)
    );

    if (filteredInvoices.length === 0) {
        container.innerHTML = `
            <div class="bg-white rounded-2xl p-10 text-center text-gray-500">
                <p>لا توجد فواتير مطابقة للبحث</p>
            </div>
        `;
        return;
    }

    filteredInvoices.forEach((inv) => {
        const realIndex = savedInvoices.findIndex(i => i === inv);
        if (realIndex === -1) return;

        const dateObj = new Date(inv.date);
        const formattedDate = dateObj.toLocaleDateString('ar-EG', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        const formattedTime = dateObj.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', minute: '2-digit' 
        });

        const currentTotal = Number(inv.total) || 0;
        const previousDebt = getCustomerPreviousDebt(inv.customer, realIndex);
        const grandTotal = currentTotal + previousDebt;
        const paid = Number(inv.paid) || 0;
        const remaining = grandTotal - paid;

        const card = document.createElement('div');
        card.className = 'bg-gray-50 rounded-xl p-4 shadow-sm';

        card.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <div class="font-semibold">${inv.customer}</div>
                <div class="text-gray-500 text-sm">${formattedDate} - ${formattedTime}</div>
            </div>

            <button onclick="toggleInvoiceDetails(${realIndex})" class="text-blue-600 underline mb-3">
                عرض المنتجات
            </button>

            <div id="invoice-details-${realIndex}" class="hidden">
                <!-- جدول المنتجات -->
                <table class="w-full text-right border-collapse mb-4">
                    <thead class="bg-gray-200">
                        <tr>
                            <th class="py-2 px-4 text-right">المنتج</th>
                            <th class="py-2 px-4">المقاس</th>
                            <th class="py-2 px-4">السعر</th>
                            <th class="py-2 px-4">الكمية</th>
                            <th class="py-2 px-4">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inv.items.map(item => `
                            <tr class="border-b">
                                <td class="py-2 px-4 text-right">${item.productName}</td>
                                <td class="py-2 px-4 text-center">${item.size}</td>
                                <td class="py-2 px-4 text-center">${item.price}</td>
                                <td class="py-2 px-4 text-center">${item.qty}</td>
                                <td class="py-2 px-4 text-center font-bold">${item.subtotal}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="bg-white rounded-2xl p-5 shadow-sm">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                        <div>
                            <div class="text-xs text-gray-500 mb-1">إجمالي الفاتورة الجديدة</div>
                            <div class="text-2xl font-bold text-blue-600">${currentTotal.toFixed(2)} جنيه</div>
                        </div>
                        <div>
                            <div class="text-xs text-gray-500 mb-1">المبلغ المدفوع</div>
                            <div class="text-2xl font-bold text-green-600">${paid.toFixed(2)} جنيه</div>
                        </div>
                        <div class="md:col-span-3 mt-4 pt-4 border-t">
                            <div class="text-xs text-gray-500 mb-1">المتبقي النهائي</div>
                            <div class="text-3xl font-bold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}">
                                ${remaining.toFixed(2)} جنيه
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-4 mt-4">
                    <button onclick="printSavedInvoice(${realIndex})" class="text-blue-600 underline">طباعة</button>
                    <button onclick="editSavedInvoice(${realIndex})" class="text-amber-600 underline">تعديل</button>
                    <button onclick="deleteSavedInvoice(${realIndex})" class="text-red-600 underline">حذف</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function deleteSavedInvoice(index) {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return;
    savedInvoices.splice(index, 1);
    saveAllInvoices();        // ← Firebase
    renderSavedInvoices();
    showToast('🗑️ تم حذف الفاتورة', 'error');
}

function editSavedInvoice(index) {
    const invoice = savedInvoices[index];
    if (!invoice) return;

    if (!confirm('هل تريد تعديل هذه الفاتورة؟\nسيتم استبدال البيانات القديمة بالجديدة.')) return;

    editingInvoiceIndex = index;

    // تحميل المنتجات
    currentInvoice = JSON.parse(JSON.stringify(invoice.items));

    // تحميل اسم الزبون
    const customerInput = document.getElementById('customer-name');
    if (customerInput) customerInput.value = invoice.customer;

    // تحميل المبلغ المدفوع القديم (مهم جدًا)
    const paidInput = document.getElementById('paid-input');
    if (paidInput) {
        paidInput.value = Number(invoice.paid || 0).toFixed(2);
    }

    renderInvoiceTable();
    updateTotalAndRemaining();
    updateInvoiceHeader();

    showSection('invoice');

    showToast('✏️ جاري تعديل الفاتورة...', 'warning');
}

function printSavedInvoice(index) {
    const inv = savedInvoices[index];
    if (!inv) return;

    const dateObj = new Date(inv.date);
    const formattedDate = dateObj.toLocaleDateString('ar-EG', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const formattedTime = dateObj.toLocaleTimeString('ar-EG', { 
        hour: '2-digit', minute: '2-digit' 
    });

    const currentTotal = Number(inv.total) || 0;
    const previousDebt = getCustomerPreviousDebt(inv.customer, index);
    const grandTotal = currentTotal + previousDebt;
    const paid = Number(inv.paid) || 0;
    const remaining = grandTotal - paid;

    const html = `
        <html dir="rtl" lang="ar">
        <head>
            <title>فاتورة متجري - ${inv.customer}</title>
            <style>
                body { 
                    font-family: 'Cairo', Arial, sans-serif; 
                    padding: 30px; 
                    line-height: 1.6;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #1E3A5F;
                    padding-bottom: 15px;
                }
                .shop-name {
                    font-size: 28px;
                    font-weight: bold;
                    color: #1E3A5F;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 25px 0;
                }
                th, td {
                    border: 1px solid #333;
                    padding: 12px;
                    text-align: center;
                }
                th {
                    background-color: #f1f5f9;
                    font-weight: 600;
                }
                .totals {
                    margin-top: 30px;
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 15px;
                }
                .total-box {
                    border: 2px solid #333;
                    padding: 15px;
                    text-align: center;
                    border-radius: 8px;
                }
                .total-box h3 {
                    margin: 0 0 8px 0;
                    font-size: 16px;
                    color: #444;
                }
                .amount {
                    font-size: 22px;
                    font-weight: bold;
                }
                .red { color: #dc2626; }
                .green { color: #16a34a; }
                .blue { color: #1E3A5F; }
                .purple { color: #7c3aed; }
                @media print {
                    body { padding: 20px; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="shop-name">مصطفى الازهرى للادوات الصحيه </div>
                <h2>فاتورة بيع</h2>
                <p>رقم الفاتورة: #${index + 1} &nbsp;&nbsp;&nbsp; التاريخ: ${formattedDate} - ${formattedTime}</p>
            </div>

            <div style="margin-bottom: 20px;">
                <strong>اسم الزبون:</strong> ${inv.customer}
                ${previousDebt > 0 ? `<span style="color:red;"> (عليه ${previousDebt.toFixed(2)} جنيه سابقًا)</span>` : ''}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>المنتج</th>
                        <th>المقاس</th>
                        <th>السعر</th>
                        <th>الكمية</th>
                        <th>الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${inv.items.map(item => `
                        <tr>
                            <td>${item.productName}</td>
                            <td>${item.size}</td>
                            <td>${item.price}</td>
                            <td>${item.qty}</td>
                            <td>${item.subtotal}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="totals">
                <div class="total-box">
                    <h3>إجمالي الفاتورة الجديدة</h3>
                    <div class="amount blue">${currentTotal.toFixed(2)} جنيه</div>
                </div>
                \
                <div class="total-box">
                    <h3>المبلغ المدفوع</h3>
                    <div class="amount green">${paid.toFixed(2)} جنيه</div>
                </div>
                <div class="total-box" style="grid-column: 1 / -1; border-color: #dc2626;">
                    <h3>المتبقي النهائي</h3>
                    <div class="amount ${remaining > 0 ? 'red' : 'green'}">
                        ${remaining.toFixed(2)} جنيه
                    </div>
                </div>
            </div>

            <div style="margin-top: 40px; text-align: center; color: #666;">
                شكرًا لتعاملك مع مصطفى الازهرى للادوات الصحية<br>
                برجاء الاحتفاظ بالفاتورة
            </div>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 500);
}



// ==================== تبديل الأقسام ====================
// ==================== تبديل الأقسام (النسخة الكاملة والمُصححة) ====================
function showSection(section) {
    // جلب العناصر
    const productsSection = document.getElementById('products-section');
    const invoiceSection   = document.getElementById('invoice-section');
    const retailSection    = document.getElementById('retail-section');

    const btnProducts = document.getElementById('btn-products');
    const btnInvoice  = document.getElementById('btn-invoice');
    const btnRetail   = document.getElementById('btn-retail');

    // إخفاء كل الأقسام
    if (productsSection) productsSection.classList.add('hidden');
    if (invoiceSection)  invoiceSection.classList.add('hidden');
    if (retailSection)   retailSection.classList.add('hidden');

    // إزالة التنسيق النشط من كل الأزرار
    if (btnProducts) btnProducts.classList.remove('border-b-4', 'border-blue-600', 'text-blue-600');
    if (btnInvoice)  btnInvoice.classList.remove('border-b-4', 'border-blue-600', 'text-blue-600');
    if (btnRetail)   btnRetail.classList.remove('border-b-4', 'border-green-600', 'text-green-600');

    // عرض القسم المطلوب وتفعيل الزر
    if (section === 'products') {
        if (productsSection) productsSection.classList.remove('hidden');
        if (btnProducts) btnProducts.classList.add('border-b-4', 'border-blue-600', 'text-blue-600');

    } else if (section === 'invoice') {
        if (invoiceSection) invoiceSection.classList.remove('hidden');
        if (btnInvoice) btnInvoice.classList.add('border-b-4', 'border-blue-600', 'text-blue-600');
        populateProductDatalist();
        updateInvoiceHeader();

    } else if (section === 'retail') {
        if (retailSection) retailSection.classList.remove('hidden');
        if (btnRetail) btnRetail.classList.add('border-b-4', 'border-green-600', 'text-green-600');

        // مهم: تحديث الاقتراحات والمنتجات
        populateRetailCompanyFilter();       // اختيار الشركة
        populateRetailProductDatalist(retailSelectedCompany); // للبحث عن المنتجات
        toggleRetailAdjustmentUI();          // إظهار/إخفاء نوع تعديل السعر المناسب
        updateRetailInvoiceHeader();         // عرض اسم العميل + الدين السابق
    }
}

function handleProductSearch(val) {
    const sizeSelect = document.getElementById('size-select');
    if (!sizeSelect) return;
    sizeSelect.innerHTML = '<option value="">اختر المقاس...</option>';

    const product = products.find(p => p.name === val);
    if (!product || !Array.isArray(product.variants)) return;

    product.variants.forEach(variant => {
        const opt = document.createElement('option');
        opt.value = variant.size;
        opt.textContent = variant.size;
        sizeSelect.appendChild(opt);
    });

    document.getElementById('price-display').textContent = '0';
}

function loadCustomersBalance() {
    const saved = localStorage.getItem('customersBalance');
    if (saved) {
        try { customersBalance = JSON.parse(saved); } 
        catch (e) { customersBalance = {}; }
    }
}

function listenToDataChanges() {
    // الاستماع للشركات
    db.collection("appData").doc("companies")
        .onSnapshot((doc) => {
            if (doc.exists && Array.isArray(doc.data().companiesList)) {
                companiesList = doc.data().companiesList;
                renderProductsCompanyFilter();
                populateRetailCompanyFilter();
                if (document.getElementById('company-manager-modal') && !document.getElementById('company-manager-modal').classList.contains('hidden')) {
                    renderCompanyManagerList();
                }
            }
        });

    // الاستماع للمنتجات
    db.collection("appData").doc("products")
        .onSnapshot((doc) => {
            if (doc.exists) {
                products = doc.data().products || [];
                applyProductsFilter();
                populateProductDatalist();
                populateRetailProductDatalist(retailSelectedCompany);
            }
        });

    // الاستماع للفواتير
    db.collection("appData").doc("invoices")
        .onSnapshot((doc) => {
            if (doc.exists) {
                savedInvoices = doc.data().savedInvoices || [];
                renderSavedInvoices();
            }
        });

        db.collection("appData").doc("retail_invoices")
        .onSnapshot((doc) => {
            if (doc.exists) {
                savedRetailInvoices = doc.data().savedRetailInvoices || [];
                renderRetailInvoices();
            }
        });
}

async function loadSavedInvoices() {
    try {
        const doc = await db.collection("appData").doc("invoices").get();
        if (doc.exists) {
            savedInvoices = doc.data().savedInvoices || [];
        } else {
            savedInvoices = [];
        }
    } catch (e) {
        console.error("خطأ في تحميل الفواتير:", e);
        const saved = localStorage.getItem('savedInvoices');
        savedInvoices = saved ? JSON.parse(saved) : [];
    }
    renderSavedInvoices();
}

async function startApp() {
    await loadCompanies();
    await loadProducts();
    await loadSavedInvoices();
    
    // أضف تحميل فواتير القطاعي هنا أيضًا
    await loadRetailInvoices();        // ← أضف هذا السطر

    renderProductsCompanyFilter();     // ← أزرار تصفية منتجاتنا حسب الشركة
    applyProductsFilter();
    populateProductDatalist();
    renderSavedInvoices();
    renderRetailInvoices();            // ← أضف هذا أيضًا

    populateRetailCompanyFilter();
    populateRetailProductDatalist(retailSelectedCompany);
    toggleRetailAdjustmentUI();

    setupCustomerAutocomplete();
    setupRetailCustomerAutocomplete();

    listenToDataChanges();
    showSection('products');

    console.log("🚀 التطبيق بدأ بنجاح مع Firebase");
}

// ====================== تعديل الأسعار جماعي ======================

function renderBulkCompanyButtons() {
    const container = document.getElementById('bulk-companies-container');
    if (!container) return;
    container.innerHTML = '';

    companiesList.forEach(c => {
        const btn = document.createElement('button');
        btn.id = `btn-${c.id}`;
        btn.type = 'button';
        btn.setAttribute('onclick', `selectCompanyForBulk('${c.id}')`);
        btn.className = 'py-5 rounded-2xl border-2 border-gray-300 font-medium text-lg hover:border-amber-500 transition-all';
        btn.textContent = c.label;
        container.appendChild(btn);
    });
}

function openBulkPriceModal() {
    bulkEditCompany = null;
    bulkEditType = 'percent';
    
    // إعادة تعيين الأزرار
    renderBulkCompanyButtons();
    document.getElementById('btn-percent').classList.add('border-amber-500', 'bg-amber-50');
    document.getElementById('btn-fixed').classList.remove('border-amber-500', 'bg-amber-50');
    
    document.getElementById('bulk-value').value = '';
    document.getElementById('bulk-label').textContent = 'نسبة الزيادة (%)';
    
    const modal = document.getElementById('bulk-price-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeBulkPriceModal() {
    const modal = document.getElementById('bulk-price-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

document.getElementById('go-top').addEventListener('click', function () {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

function selectCompanyForBulk(company) {
    bulkEditCompany = company;
    
    // تغيير الستايل للأزرار
    companiesList.forEach(c => {
        const btn = document.getElementById(`btn-${c.id}`);
        if (!btn) return;
        btn.classList.toggle('border-amber-500', company === c.id);
        btn.classList.toggle('bg-amber-50', company === c.id);
    });
}

function setBulkEditType(type) {
    bulkEditType = type;
    
    // إعادة تعيين كل الأزرار
    const buttons = ['btn-percent', 'btn-minus-percent', 'btn-fixed', 'btn-minus-fixed'];
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.remove('border-amber-500', 'bg-amber-50');
        }
    });

    // تفعيل الزر المختار
    let activeBtnId = '';
    if (type === 'percent') activeBtnId = 'btn-percent';
    else if (type === 'minus_percent') activeBtnId = 'btn-minus-percent';
    else if (type === 'fixed') activeBtnId = 'btn-fixed';
    else if (type === 'minus_fixed') activeBtnId = 'btn-minus-fixed';

    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.add('border-amber-500', 'bg-amber-50');
    }

    // تغيير النص في الـ label
    const label = document.getElementById('bulk-label');
    if (type === 'percent' || type === 'minus_percent') {
        label.textContent = 'النسبة المئوية (%)';
    } else {
        label.textContent = 'القيمة الثابتة (جنيه)';
    }
}

function applyBulkPriceChange() {
    if (!bulkEditCompany) {
        return alert('❌ اختر الشركة أولاً');
    }

    const valueStr = document.getElementById('bulk-value').value.trim();
    if (!valueStr) {
        return alert('❌ ادخل القيمة');
    }

    const value = parseFloat(valueStr);
    if (isNaN(value) || value <= 0) {
        return alert('❌ القيمة لازم تكون رقم أكبر من صفر');
    }

    // رسالة التأكيد
    let actionText = '';
    if (bulkEditType === 'percent') actionText = `زيادة ${value}%`;
    else if (bulkEditType === 'minus_percent') actionText = `نقصان ${value}%`;
    else if (bulkEditType === 'fixed') actionText = `زيادة ${value} جنيه`;
    else if (bulkEditType === 'minus_fixed') actionText = `نقصان ${value} جنيه`;

    const confirmMsg = `هل أنت متأكدة من  ${actionText} على كل أسعار منتجات شركة ${getCompanyLabel(bulkEditCompany)}؟`;

    if (!confirm(confirmMsg)) {
        return;   // المستخدم ضغط إلغاء
    }

    let updatedCount = 0;

    products.forEach(product => {
        if (!Array.isArray(product.companies)) return;
        
        if (product.companies.includes(bulkEditCompany)) {
            product.variants.forEach(variant => {
                let newPrice = variant.price;

                if (bulkEditType === 'percent') {
                    newPrice = variant.price * (1 + value / 100);
                } 
                else if (bulkEditType === 'minus_percent') {
                    newPrice = variant.price * (1 - value / 100);
                } 
                else if (bulkEditType === 'fixed') {
                    newPrice = variant.price + value;
                } 
                else if (bulkEditType === 'minus_fixed') {
                    newPrice = variant.price - value;
                }

                // منع السعر من يبقى سالب
                variant.price = Math.max(0, Math.round(newPrice * 100) / 100);
            });
            updatedCount++;
        }
    });

    if (updatedCount === 0) {
        alert(`⚠️  لا يوجد منتجات تابعة لشركة ${getCompanyLabel(bulkEditCompany)}`);
    } else {
        saveProducts();
        applyProductsFilter();
        showToast(`✅ تم تعديل ${updatedCount} من أسعار المنتجات بنجاح`, 'success');
    }

    closeBulkPriceModal();
}

document.getElementById('product-search-box').addEventListener('input', applyProductsFilter);

function populateSizeSelect() {
    const productInput = document.getElementById('product-search');
    const sizeSelect = document.getElementById('size-select');
    if (!productInput || !sizeSelect) return;

    const productName = productInput.value.trim();
    sizeSelect.innerHTML = '<option value="">اختر المقاس</option>'; // الخيار الافتراضي

    const product = products.find(p => p.name.trim() === productName);
    if (!product || !Array.isArray(product.variants)) return;

    product.variants.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.size;
        opt.textContent = v.size;
        sizeSelect.appendChild(opt);
    });
}

document.getElementById('product-search').addEventListener('input', () => {
    populateSizeSelect();
    updatePriceDisplay();
});


// ==================== Retail - اختيار الشركة ====================
function populateRetailCompanyFilter() {
    const select = document.getElementById('retail-company-filter');
    if (!select) return;

    const previousValue = select.value || retailSelectedCompany;
    select.innerHTML = '<option value="">كل الشركات</option>';
    companiesList.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.label;
        select.appendChild(opt);
    });
    select.value = previousValue || '';
}

function handleRetailCompanyChange() {
    const select = document.getElementById('retail-company-filter');
    const newCompany = select ? select.value : '';

    // لو فيه منتجات لسه في القائمة المؤقتة لشركة تانية، نتأكد قبل ما نمسحها
    if (retailStaging.length > 0 && newCompany !== retailSelectedCompany) {
        const ok = confirm('هتفقد المنتجات اللي لسه في القائمة المؤقتة لـ "' + getCompanyLabel(retailSelectedCompany) + '" لو غيّرت الشركة. عايز تكمل؟');
        if (!ok) {
            if (select) select.value = retailSelectedCompany;
            return;
        }
        retailStaging = [];
    }

    retailSelectedCompany = newCompany;

    // تصفير حقل المنتج والمقاس عند تغيير الشركة
    const productInput = document.getElementById('retail-product-search');
    if (productInput) productInput.value = '';
    const sizeSelect = document.getElementById('retail-size-select');
    if (sizeSelect) sizeSelect.innerHTML = '<option value="">اختر المقاس...</option>';

    populateRetailProductDatalist(retailSelectedCompany);
    toggleRetailAdjustmentUI();
    renderRetailStaging();
}

function populateRetailProductDatalist(companyId = '') {
    const dl = document.getElementById('retail-products-datalist');
    if (!dl) return;
    dl.innerHTML = '';

    const filtered = companyId
        ? products.filter(p => Array.isArray(p.companies) && p.companies.includes(companyId))
        : products;

    filtered.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        dl.appendChild(opt);
    });
}

// إظهار مربع تعديل السعر لكل منتج، أو مربع تعديل السعر على الفاتورة كلها
// حسب الشركة المختارة (البحر الأحمر / أكوا دلتا / Dr تتعامل على مستوى الفاتورة)
function toggleRetailAdjustmentUI() {
    const perItemBlock = document.getElementById('retail-per-item-adjust-block');
    const invoiceLevelBlock = document.getElementById('retail-invoice-level-adjust');
    if (!perItemBlock || !invoiceLevelBlock) return;

    if (PERCENT_COMPANIES.includes(retailSelectedCompany)) {
        perItemBlock.classList.add('hidden');
        invoiceLevelBlock.classList.remove('hidden');

        // تصفير تعديل السعر لكل منتج، مش هيتطبق للشركات دي
        retailPriceAdjustment = 0;
        const adjustInput = document.getElementById('retail-price-adjust');
        if (adjustInput) adjustInput.value = 0;
    } else {
        perItemBlock.classList.remove('hidden');
        invoiceLevelBlock.classList.add('hidden');
    }
}

// باقية لتوافق قديم (مش بتحجب حاجة دلوقتي)
function markRetailAdjustmentConfirmed() {
    retailAdjustmentConfirmed = true;
}

// ==================== عرض القائمة المؤقتة (Staging) لمنتجات الشركة المختارة ====================
// (البحر الأحمر / أكوا دلتا / Dr) - المنتجات هنا لسه مضافتش للفاتورة الكلية ومفيهاش تعديل سعر
function renderRetailStaging() {
    const container = document.getElementById('retail-staging-container');
    if (!container) return;

    if (retailStaging.length === 0) {
        container.innerHTML = `<p class="text-sm text-rose-300 mb-4">لسه معملتش إضافة منتجات — اختار منتج ومقاس وكمية واضغط "أضف" فوق، وهيتضافوا هنا الأول.</p>`;
        return;
    }

    container.innerHTML = `
        <label class="block text-sm font-semibold mb-3 text-rose-600">المنتجات المضافة مؤقتًا (${retailStaging.length})</label>
        <div class="space-y-2 mb-5">
            ${retailStaging.map(item => `
                <div class="flex items-center justify-between bg-white rounded-xl border border-rose-100 px-3 py-2.5">
                    <div class="min-w-0">
                        <div class="font-semibold text-sm truncate">${item.productName}</div>
                        <div class="text-xs text-slate-400">${item.size} — ${Number(item.basePrice).toFixed(2)} جنيه للوحدة</div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <input type="number" min="1" value="${item.qty}"
                               onchange="updateRetailStagingQty(${item.id}, this.value)"
                               class="w-16 text-center border border-rose-200 rounded-lg py-1.5">
                        <button onclick="removeRetailStagingItem(${item.id})" class="text-red-500 hover:text-red-700 text-xl">🗑️</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

window.updateRetailStagingQty = function(id, newQty) {
    const qty = parseInt(newQty) || 1;
    const item = retailStaging.find(i => i.id === id);
    if (!item) return;
    item.qty = qty < 1 ? 1 : qty;
    renderRetailStaging();
};

window.removeRetailStagingItem = function(id) {
    retailStaging = retailStaging.filter(i => i.id !== id);
    renderRetailStaging();
};

// ==================== إضافة القائمة المؤقتة للفاتورة الكلية (البحر الأحمر / أكوا دلتا / Dr) ====================
// المبلغ الثابت بيتوزع على كل منتجات القائمة المؤقتة حسب نصيب كل واحد، مش كل منتج ياخد نفس القيمة
function commitRetailStagingToInvoice() {
    if (!PERCENT_COMPANIES.includes(retailSelectedCompany)) {
        return alert('❌ اختر شركة من (البحر الأحمر / أكوا دلتا / Dr) الأول');
    }

    if (retailStaging.length === 0) {
        return alert('❌ لسه معملتش إضافة منتجات للقائمة المؤقتة');
    }

    const typeSelect = document.getElementById('retail-invoice-adjust-type');
    const valueInput = document.getElementById('retail-invoice-adjust-value');
    const type = typeSelect ? typeSelect.value : 'percent';
    const value = valueInput ? (parseFloat(valueInput.value) || 0) : 0;

    if (type === 'percent') {
        // كل منتج بياخد نفس النسبة من سعره الأصلي
        retailStaging.forEach(item => {
            const newPrice = Math.max(0, item.basePrice * (1 + value / 100));
            retailInvoice.push({
                id: Date.now() + Math.floor(Math.random() * 1000),
                productName: item.productName,
                size: item.size,
                basePrice: item.basePrice,
                price: newPrice,
                qty: item.qty,
                subtotal: newPrice * item.qty,
                company: retailSelectedCompany,
                isPercentGroup: true,
                adjustType: type,
                adjustValue: value
            });
        });
    } else {
        // المبلغ الثابت: بيتوزع على كل منتجات القائمة المؤقتة، كل واحد على قد نصيبه من إجمالي القيمة الأصلية
        const totalBase = retailStaging.reduce((sum, item) => sum + (item.basePrice * item.qty), 0);

        retailStaging.forEach(item => {
            const baseSubtotal = item.basePrice * item.qty;
            const share = totalBase > 0 ? (baseSubtotal / totalBase) : (1 / retailStaging.length);
            const addition = value * share;
            const newSubtotal = Math.max(0, baseSubtotal + addition);
            const newPrice = item.qty > 0 ? newSubtotal / item.qty : newSubtotal;

            retailInvoice.push({
                id: Date.now() + Math.floor(Math.random() * 1000),
                productName: item.productName,
                size: item.size,
                basePrice: item.basePrice,
                price: newPrice,
                qty: item.qty,
                subtotal: newSubtotal,
                company: retailSelectedCompany,
                isPercentGroup: true,
                adjustType: type,
                adjustValue: value
            });
        });
    }

    // تصفير القائمة المؤقتة وحقل القيمة بعد الإضافة
    retailStaging = [];
    if (valueInput) valueInput.value = 0;

    renderRetailStaging();
    renderRetailPercentGroups();
    updateRetailTotalAndRemaining();
    showToast('✅ تم إضافة منتجات ' + getCompanyLabel(retailSelectedCompany) + ' للفاتورة', 'success');
}

// ==================== تعديل مجموعة شركة اتضافت بالفعل (رجوعها للقائمة المؤقتة) ====================
window.editRetailPercentGroup = function(companyId) {
    const groupItems = retailInvoice.filter(item => item.company === companyId && item.isPercentGroup);
    if (groupItems.length === 0) return;

    if (!confirm('هترجع منتجات ' + getCompanyLabel(companyId) + ' للقائمة المؤقتة عشان تعدلها. متابع؟')) return;

    // لو فيه منتجات تانية لسه في القائمة المؤقتة، هتتفقد
    retailStaging = groupItems.map(item => ({
        id: Date.now() + Math.floor(Math.random() * 1000),
        productName: item.productName,
        size: item.size,
        basePrice: item.basePrice,
        qty: item.qty
    }));

    // شيل المجموعة من الفاتورة الكلية
    retailInvoice = retailInvoice.filter(item => !(item.company === companyId && item.isPercentGroup));

    // فعّل نفس الشركة واعرض القائمة المؤقتة
    retailSelectedCompany = companyId;
    const companySelect = document.getElementById('retail-company-filter');
    if (companySelect) companySelect.value = companyId;

    const sample = groupItems[0];
    const typeSelect = document.getElementById('retail-invoice-adjust-type');
    const valueInput = document.getElementById('retail-invoice-adjust-value');
    if (typeSelect) typeSelect.value = sample.adjustType || 'percent';
    if (valueInput) valueInput.value = sample.adjustValue || 0;

    toggleRetailAdjustmentUI();
    renderRetailStaging();
    renderRetailTable();
    renderRetailPercentGroups();
    updateRetailTotalAndRemaining();

    showToast('✏️ رجعت المنتجات للتعديل — عدّل زي ما تحب وادوس "إضافة للفاتورة" تاني', 'warning');
};

// ==================== حذف مجموعة شركة بالكامل من الفاتورة الكلية ====================
window.deleteRetailPercentGroup = function(companyId) {
    const groupItems = retailInvoice.filter(item => item.company === companyId && item.isPercentGroup);
    if (groupItems.length === 0) return;

    if (!confirm('هل تريد حذف كل منتجات ' + getCompanyLabel(companyId) + ' من الفاتورة؟')) return;

    retailInvoice = retailInvoice.filter(item => !(item.company === companyId && item.isPercentGroup));

    renderRetailTable();
    renderRetailPercentGroups();
    updateRetailTotalAndRemaining();
    showToast('🗑️ تم حذف منتجات ' + getCompanyLabel(companyId), 'error');
};

// ==================== Retail - دوال المنتجات ====================
function handleRetailProductSearch(val) {
    const sizeSelect = document.getElementById('retail-size-select');
    if (!sizeSelect) return;
    sizeSelect.innerHTML = '<option value="">اختر المقاس...</option>';

    const product = products.find(p => p.name === val);
    if (!product || !Array.isArray(product.variants)) return;

    product.variants.forEach(variant => {
        const opt = document.createElement('option');
        opt.value = variant.size;
        opt.textContent = variant.size;
        sizeSelect.appendChild(opt);
    });
}



// ==================== عرض جدول الفاتورة القطاعية (المنتجات العادية فقط) ====================
function renderRetailTable() {
    const tbody = document.getElementById('retail-invoice-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const normalItems = retailInvoice.filter(item => !item.isPercentGroup);

    normalItems.forEach((item) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        row.innerHTML = `
            <td class="py-5 px-6 font-medium">${item.productName}</td>
            <td class="py-5 px-6 text-center text-lg">${item.size}</td>
            <td class="py-5 px-6 text-center no-print text-slate-400">${Number(item.basePrice ?? item.price).toFixed(2)}</td>
            <td class="py-5 px-6 text-center">${Number(item.price).toFixed(2)}</td>
            <td class="py-5 px-6 text-center text-lg font-medium">${item.qty}</td>
            <td class="py-5 px-6 text-center font-bold">${item.subtotal.toFixed(2)}</td>
            <td class="py-5 px-6 text-center no-print">
                <button onclick="removeRetailItemById(${item.id})" class="text-red-500 hover:text-red-700 text-3xl">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    renderRetailPercentGroups();
}

// ==================== إعادة حساب مجموعة "مبلغ ثابت" من الأصل (عشان الإضافة تفضل ثابتة دايمًا) ====================
// بتتنادى كل ما الكمية تتغير أو منتج يتشال من مجموعة شركة، عشان الـ 30 جنيه (مثلاً)
// تتوزع من جديد على اللي باقي فعلاً، مش تعتمد على سعر قديم متحسوب من الأول
function recalcFixedGroup(companyId) {
    const items = retailInvoice.filter(item => item.company === companyId && item.isPercentGroup);
    if (items.length === 0) return;
    if (items[0].adjustType !== 'fixed') return; // نوع "نسبة مئوية %" مش محتاج إعادة حساب، كل منتج مستقل

    const value = items[0].adjustValue || 0;
    const totalBase = items.reduce((sum, it) => sum + (it.basePrice * it.qty), 0);

    items.forEach(item => {
        const baseSubtotal = item.basePrice * item.qty;
        const share = totalBase > 0 ? (baseSubtotal / totalBase) : (1 / items.length);
        const addition = value * share;
        const newSubtotal = Math.max(0, baseSubtotal + addition);
        item.price = item.qty > 0 ? newSubtotal / item.qty : newSubtotal;
        item.subtotal = newSubtotal;
    });
}

// ==================== حذف منتج من الفاتورة القطاعية (بالـ id) ====================
window.removeRetailItemById = function(id) {
    const removed = retailInvoice.find(item => item.id === id);
    retailInvoice = retailInvoice.filter(item => item.id !== id);

    if (removed && removed.isPercentGroup) {
        recalcFixedGroup(removed.company);
    }

    renderRetailTable();
    updateRetailTotalAndRemaining();
};

// ==================== تعديل كمية منتج داخل مربع شركة (البحر الأحمر / أكوا دلتا / Dr) ====================
window.updateRetailPercentItemQty = function(id, newQty) {
    const qty = parseInt(newQty) || 1;
    const item = retailInvoice.find(i => i.id === id);
    if (!item) return;
    item.qty = qty < 1 ? 1 : qty;

    if (item.isPercentGroup && item.adjustType === 'fixed') {
        recalcFixedGroup(item.company);
    } else {
        item.subtotal = item.price * item.qty;
    }

    renderRetailPercentGroups();
    updateRetailTotalAndRemaining();
};

// ==================== عرض مربعات الشركات (البحر الأحمر / أكوا دلتا / Dr) في الفاتورة القطاعية ====================
function renderRetailPercentGroups() {
    const container = document.getElementById('retail-percent-groups');
    if (!container) return;
    container.innerHTML = '';

    const groupedByCompany = {};
    retailInvoice.filter(item => item.isPercentGroup).forEach(item => {
        if (!groupedByCompany[item.company]) groupedByCompany[item.company] = [];
        groupedByCompany[item.company].push(item);
    });

    const companyIds = Object.keys(groupedByCompany);
    if (companyIds.length === 0) return;

    companyIds.forEach(companyId => {
        const items = groupedByCompany[companyId];
        const groupTotal = items.reduce((sum, it) => sum + it.subtotal, 0);

        const box = document.createElement('div');
        box.className = 'card overflow-hidden mb-4 border-rose-100';
        box.innerHTML = `
            <div class="px-5 sm:px-6 py-4 bg-rose-50 border-b border-rose-100 flex flex-wrap justify-between items-center gap-2">
                <h3 class="font-bold text-rose-700">🧴 ${getCompanyLabel(companyId)}</h3>
                <div class="flex items-center gap-3">
                    <span class="text-sm text-rose-500 font-semibold">${items.length} منتج</span>
                    <button onclick="editRetailPercentGroup('${companyId}')" class="text-amber-600 hover:text-amber-700 text-sm font-semibold underline no-print">تعديل</button>
                    <button onclick="deleteRetailPercentGroup('${companyId}')" class="text-red-600 hover:text-red-700 text-sm font-semibold underline no-print">حذف الكل</button>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full table-modern">
                    <thead class="bg-rose-50/70">
                        <tr>
                            <th class="text-right">المنتج</th>
                            <th>المقاس</th>
                            <th class="no-print">السعر الأصلي</th>
                            <th>السعر</th>
                            <th>الكمية</th>
                            <th>الإجمالي</th>
                            <th class="no-print">حذف</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr class="hover:bg-gray-50">
                                <td class="py-4 px-4 font-medium">${item.productName}</td>
                                <td class="py-4 px-4 text-center">${item.size}</td>
                                <td class="py-4 px-4 text-center no-print text-slate-400">${Number(item.basePrice).toFixed(2)}</td>
                                <td class="py-4 px-4 text-center">${Number(item.price).toFixed(2)}</td>
                                <td class="py-4 px-4 text-center">
                                    <input type="number" min="1" value="${item.qty}"
                                           onchange="updateRetailPercentItemQty(${item.id}, this.value)"
                                           class="w-16 text-center border border-rose-200 rounded-lg py-1 no-print">
                                    <span class="hidden print:inline">${item.qty}</span>
                                </td>
                                <td class="py-4 px-4 text-center font-bold">${item.subtotal.toFixed(2)}</td>
                                <td class="py-4 px-4 text-center no-print">
                                    <button onclick="removeRetailItemById(${item.id})" class="text-red-500 hover:text-red-700 text-2xl">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="px-5 sm:px-6 py-3 bg-rose-50 border-t border-rose-100 flex justify-between font-bold text-rose-700">
                <span>إجمالي ${getCompanyLabel(companyId)}</span>
                <span>${groupTotal.toFixed(2)} جنيه</span>
            </div>
        `;
        container.appendChild(box);
    });
}

// ==================== حساب الدين السابق لعميل قطاعي ====================
function getRetailCustomerPreviousDebt(customerName, excludeIndex = -1) {
    if (!customerName || customerName === 'عميل غير محدد') return 0;

    const customerInvs = savedRetailInvoices
        .map((inv, idx) => ({ ...inv, originalIndex: idx }))
        .filter(inv => inv.customer === customerName && inv.originalIndex !== excludeIndex)
        .sort((a, b) => a.date - b.date);

    let runningDebt = 0;
    for (let inv of customerInvs) {
        const total = Number(inv.total) || 0;
        const paid = Number(inv.paid) || 0;
        runningDebt = Math.max(0, (total + runningDebt) - paid);
    }
    return runningDebt;
}

// ==================== بحث فواتير القطاعي السابقة ====================
function filterRetailInvoicesByCustomer() {
    const input = document.getElementById('search-retail-customer');
    const container = document.getElementById('saved-retail-invoices-list');
    if (!container || !input) return;

    const filter = input.value.trim().toLowerCase();

    if (filter === '') {
        renderRetailInvoices();
        return;
    }

    container.innerHTML = '';

    const filteredInvoices = savedRetailInvoices.filter(inv => 
        inv.customer && inv.customer.toLowerCase().includes(filter)
    );

    if (filteredInvoices.length === 0) {
        container.innerHTML = `
            <div class="bg-white rounded-2xl p-10 text-center text-gray-500">
                <p>لا توجد فواتير قطاعي مطابقة للبحث</p>
            </div>
        `;
        return;
    }

    filteredInvoices.forEach((inv) => {
        const realIndex = savedRetailInvoices.findIndex(i => i === inv);
        if (realIndex === -1) return;

        const dateObj = new Date(inv.date);
        const formattedDate = dateObj.toLocaleDateString('ar-EG', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        const formattedTime = dateObj.toLocaleTimeString('ar-EG', { 
            hour: '2-digit', minute: '2-digit' 
        });

        const currentTotal = Number(inv.total) || 0;
        const previousDebt = getRetailCustomerPreviousDebt(inv.customer, realIndex);
        const paid = Number(inv.paid) || 0;
        const remaining = (currentTotal + previousDebt) - paid;

        const card = document.createElement('div');
        card.className = 'bg-gray-50 rounded-xl p-4 shadow-sm';

        card.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <div class="font-semibold">${inv.customer}</div>
                <div class="text-gray-500 text-sm">${formattedDate} - ${formattedTime}</div>
            </div>
            <button onclick="toggleRetailInvoiceDetails(${realIndex})" class="text-green-600 underline mb-3">
                عرض المنتجات
            </button>
            <div id="retail-invoice-details-${realIndex}" class="hidden">
                <table class="w-full text-right border-collapse mb-4">
                    <thead class="bg-gray-200">
                        <tr>
                            <th class="py-2 px-4 text-right">المنتج</th>
                            <th class="py-2 px-4">المقاس</th>
                            <th class="py-2 px-4">السعر</th>
                            <th class="py-2 px-4">الكمية</th>
                            <th class="py-2 px-4">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inv.items.map(item => `
                            <tr class="border-b">
                                <td class="py-2 px-4 text-right">${item.productName}</td>
                                <td class="py-2 px-4 text-center">${item.size}</td>
                                <td class="py-2 px-4 text-center">${item.price}</td>
                                <td class="py-2 px-4 text-center">${item.qty}</td>
                                <td class="py-2 px-4 text-center font-bold">${item.subtotal}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="bg-white rounded-2xl p-5 shadow-sm">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                        <div>
                            <div class="text-xs text-gray-500 mb-1">إجمالي الفاتورة الجديدة</div>
                            <div class="text-2xl font-bold text-blue-600">${currentTotal.toFixed(2)} جنيه</div>
                        </div>
                        <div>
                            <div class="text-xs text-gray-500 mb-1">المبلغ المدفوع</div>
                            <div class="text-2xl font-bold text-green-600">${paid.toFixed(2)} جنيه</div>
                        </div>
                        <div class="md:col-span-3 mt-4 pt-4 border-t">
                            <div class="text-xs text-gray-500 mb-1">المتبقي النهائي</div>
                            <div class="text-3xl font-bold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}">
                                ${remaining.toFixed(2)} جنيه
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex justify-end gap-4 mt-4">
                    <button onclick="printRetailSavedInvoice(${realIndex})" class="text-green-600 underline">طباعة</button>
                    <button onclick="editRetailSavedInvoice(${realIndex})" class="text-amber-600 underline">تعديل</button>
                    <button onclick="deleteRetailSavedInvoice(${realIndex})" class="text-red-600 underline">حذف</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ==================== تحديث الإجمالي + الدين + المتبقي للقطاعي ====================
function updateRetailTotalAndRemaining() {
    const currentTotal = retailInvoice.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const paid = parseFloat(document.getElementById("retail-paid-input")?.value || 0) || 0;
    const customerName = document.getElementById('retail-customer-name').value.trim();

    // تصحيح اسم الدالة (مهم جداً)
    const previousDebt = getRetailCustomerPreviousDebt(customerName, editingRetailInvoiceIndex);
    
    const grandTotal = currentTotal + previousDebt;
    let remaining = grandTotal - paid;

    // عرض القيم
    const totalDisplay = document.getElementById('retail-total-display');
    const totalInput = document.getElementById('retail-total-input');
    const remainingEl = document.getElementById('retail-remaining-input');

    if (totalDisplay) totalDisplay.textContent = currentTotal.toFixed(2);
    if (totalInput) totalInput.value = grandTotal.toFixed(2);

    if (remainingEl) {
        remainingEl.value = Math.max(0, remaining).toFixed(2);
        remainingEl.style.color = remaining > 0 ? "#dc2626" : "#16a34a";
    }

    return { currentTotal, grandTotal, paid, remaining: Math.max(0, remaining), previousDebt };
}

// ==================== المخزون: خصم/استرجاع الكمية عند حفظ/حذف فاتورة قطاعي ====================
function findProductVariant(productName, size) {
    const product = products.find(p => p.name === productName);
    if (!product || !Array.isArray(product.variants)) return null;
    return product.variants.find(v => v.size === size) || null;
}

// sign = -1 خصم من المخزون (عند البيع) / sign = +1 رجّع للمخزون (عند الحذف أو تعديل فاتورة قديمة)
function adjustStockForItems(items, sign) {
    let changed = false;
    (Array.isArray(items) ? items : []).forEach(item => {
        const variant = findProductVariant(item.productName, item.size);
        if (!variant) return;
        const hasStockInfo = variant.stock !== undefined && variant.stock !== null && variant.stock !== '';
        if (!hasStockInfo) return; // المقاس ده مفيهوش بيانات مخزون أصلاً
        const currentStock = Number(variant.stock) || 0;
        const qty = Number(item.qty) || 0;
        variant.stock = Math.max(0, currentStock + sign * qty);
        changed = true;
    });
    if (changed) {
        saveProducts();
        renderProducts();
    }
}

function saveRetailInvoice() {
    const customerInput = document.getElementById('retail-customer-name');
    const customer = customerInput ? customerInput.value.trim() : 'عميل غير محدد';

    if (retailInvoice.length === 0) {
        return alert('❌ الفاتورة فاضية!');
    }

    const { currentTotal } = updateRetailTotalAndRemaining();

    const invoice = {
        customer: customer || 'عميل غير محدد',
        items: JSON.parse(JSON.stringify(retailInvoice)),
        total: Number(currentTotal.toFixed(2)),
        paid: parseFloat(document.getElementById("retail-paid-input").value) || 0,
        date: Date.now()
    };

    // المخزون بينقص بس لما الفاتورة تتحفظ نهائي
    if (editingRetailInvoiceIndex !== null) {
        // فاتورة بتتعدل: رجّع كمية الفاتورة القديمة الأول، وبعدين انقص كمية الفاتورة الجديدة
        const oldInvoice = savedRetailInvoices[editingRetailInvoiceIndex];
        if (oldInvoice) adjustStockForItems(oldInvoice.items, +1);
        savedRetailInvoices[editingRetailInvoiceIndex] = invoice;
    } else {
        savedRetailInvoices.push(invoice);
    }
    adjustStockForItems(invoice.items, -1);

    recalculateAllRetailInvoicesForCustomer(customer);
    saveAllRetailInvoices();

    // تصفير الفاتورة
    retailInvoice = [];
    retailStaging = [];
    editingRetailInvoiceIndex = null;

    renderRetailTable();
    renderRetailStaging();
    renderRetailPercentGroups();
    updateRetailTotalAndRemaining();

    if (customerInput) customerInput.value = '';
    document.getElementById('retail-paid-input').value = '0';
    const remEl = document.getElementById('retail-remaining-input');
    if (remEl) remEl.value = '0';

    updateRetailInvoiceHeader();
    renderRetailInvoices();

    setTimeout(getAllUniqueRetailCustomers, 100);

    showToast('✅ تم حفظ فاتورة القطاعي بنجاح', 'success');
}

// ==================== إعادة حساب كل فواتير العميل القطاعي ====================
function recalculateAllRetailInvoicesForCustomer(customerName) {
    if (!customerName || customerName === 'عميل غير محدد') return;

    const customerInvoices = savedRetailInvoices
        .map((inv, idx) => ({ ...inv, originalIndex: idx }))
        .filter(inv => inv.customer === customerName)
        .sort((a, b) => a.date - b.date);

    let runningDebt = 0;

    for (let i = 0; i < customerInvoices.length; i++) {
        const inv = customerInvoices[i];
        const realIndex = inv.originalIndex;

        const currentTotal = Number(inv.total) || 0;
        const paid = Number(inv.paid) || 0;

        const grandTotal = currentTotal + runningDebt;
        const remaining = grandTotal - paid;

        savedRetailInvoices[realIndex].grandTotal = Number(grandTotal.toFixed(2));
        savedRetailInvoices[realIndex].remaining = Number(Math.max(0, remaining).toFixed(2));

        runningDebt = Math.max(0, remaining);
    }
}

// ==================== عرض الفواتير السابقة (كاملة مثل التجار) ====================
function renderRetailInvoices() {
    const container = document.getElementById('saved-retail-invoices-list');
    if (!container) return;
    container.innerHTML = '';

    if (savedRetailInvoices.length === 0) {
        container.innerHTML = `<div class="bg-white rounded-2xl p-10 text-center text-gray-500"><p>لا توجد فواتير قطاعي محفوظة بعد</p></div>`;
        return;
    }

    savedRetailInvoices.forEach((inv, index) => {
        const dateObj = new Date(inv.date);
        const formattedDate = dateObj.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const formattedTime = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

        const currentTotal = Number(inv.total) || 0;
        const previousDebt = getRetailCustomerPreviousDebt(inv.customer, index);
        const grandTotal = currentTotal + previousDebt;
        const paid = Number(inv.paid) || 0;
        const remaining = grandTotal - paid;

        const card = document.createElement('div');
        card.className = 'bg-gray-50 rounded-xl p-4 shadow-sm';

        card.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <div class="font-semibold">${inv.customer}</div>
                <div class="text-gray-500 text-sm">${formattedDate} - ${formattedTime}</div>
            </div>
            <button onclick="toggleRetailInvoiceDetails(${index})" class="text-green-600 underline mb-3">عرض المنتجات</button>
            <div id="retail-invoice-details-${index}" class="hidden">
                <table class="w-full text-right border-collapse mb-4">
                    <thead class="bg-gray-200"><tr>
                        <th class="py-2 px-4 text-right">المنتج</th>
                        <th class="py-2 px-4">المقاس</th>
                        <th class="py-2 px-4">السعر</th>
                        <th class="py-2 px-4">الكمية</th>
                        <th class="py-2 px-4">الإجمالي</th>
                    </tr></thead>
                    <tbody>
                        ${inv.items.map(item => `
                            <tr class="border-b">
                                <td class="py-2 px-4 text-right">${item.productName}</td>
                                <td class="py-2 px-4 text-center">${item.size}</td>
                                <td class="py-2 px-4 text-center">${item.price}</td>
                                <td class="py-2 px-4 text-center">${item.qty}</td>
                                <td class="py-2 px-4 text-center font-bold">${item.subtotal}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="bg-white rounded-2xl p-5 shadow-sm">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                        <div><div class="text-xs text-gray-500 mb-1">إجمالي الفاتورة الجديدة</div><div class="text-2xl font-bold text-blue-600">${currentTotal.toFixed(2)} جنيه</div></div>
                        <div><div class="text-xs text-gray-500 mb-1">المبلغ المدفوع</div><div class="text-2xl font-bold text-green-600">${paid.toFixed(2)} جنيه</div></div>
                        <div class="md:col-span-3 mt-4 pt-4 border-t"><div class="text-xs text-gray-500 mb-1">المتبقي النهائي</div><div class="text-3xl font-bold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}">${remaining.toFixed(2)} جنيه</div></div>
                    </div>
                </div>
                <div class="flex justify-end gap-4 mt-4">
                    <button onclick="printRetailSavedInvoice(${index})" class="text-green-600 underline">طباعة</button>
                    <button onclick="editRetailSavedInvoice(${index})" class="text-amber-600 underline">تعديل</button>
                    <button onclick="deleteRetailSavedInvoice(${index})" class="text-red-600 underline">حذف</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

window.toggleRetailInvoiceDetails = function(index) {
    const detailsDiv = document.getElementById(`retail-invoice-details-${index}`);
    if (detailsDiv) detailsDiv.classList.toggle('hidden');
};

// ==================== تعديل - حذف - طباعة ====================
window.editRetailSavedInvoice = function(index) {
    const invoice = savedRetailInvoices[index];
    if (!invoice) return;
    if (!confirm('هل تريد تعديل هذه الفاتورة القطاعية؟')) return;

    editingRetailInvoiceIndex = index;
    retailInvoice = JSON.parse(JSON.stringify(invoice.items));
    retailStaging = [];

    const customerInput = document.getElementById('retail-customer-name');
    if (customerInput) customerInput.value = invoice.customer;

    const paidInput = document.getElementById('retail-paid-input');
    if (paidInput) paidInput.value = Number(invoice.paid || 0).toFixed(2);

    renderRetailTable();
    renderRetailStaging();
    updateRetailTotalAndRemaining();
    updateRetailInvoiceHeader();

    showSection('retail');

    showToast('✏️ جاري تعديل فاتورة القطاعي...', 'warning');
};

window.deleteRetailSavedInvoice = function(index) {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة القطاعية؟')) return;
    const inv = savedRetailInvoices[index];
    if (inv) adjustStockForItems(inv.items, +1); // رجّع الكمية للمخزون
    savedRetailInvoices.splice(index, 1);
    saveAllRetailInvoices();
    renderRetailInvoices();
    showToast('🗑️ تم حذف الفاتورة', 'error');
};

// ==================== طباعة فاتورة قطاعي (نفس شكل التجار) ====================
// ==================== طباعة فاتورة قطاعي ====================
window.printRetailSavedInvoice = function(index) {
    const inv = savedRetailInvoices[index];
    if (!inv) return;

    const dateObj = new Date(inv.date);
    const formattedDate = dateObj.toLocaleDateString('ar-EG', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const formattedTime = dateObj.toLocaleTimeString('ar-EG', { 
        hour: '2-digit', minute: '2-digit' 
    });

    const currentTotal = Number(inv.total) || 0;
    const previousDebt = getRetailCustomerPreviousDebt(inv.customer, index);
    const paid = Number(inv.paid) || 0;
    const remaining = (currentTotal + previousDebt) - paid;

    const html = `
        <html dir="rtl" lang="ar">
        <head>
            <title>فاتورة قطاعي - ${inv.customer}</title>
            <style>
                body { 
                    font-family: 'Cairo', Arial, sans-serif; 
                    padding: 30px; 
                    line-height: 1.6;
                    background: #f9fafb;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 4px solid #14B8A6;
                    padding-bottom: 15px;
                }
                .shop-name {
                    font-size: 28px;
                    font-weight: bold;
                    color: #14B8A6;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 25px 0;
                }
                th, td {
                    border: 1px solid #333;
                    padding: 12px;
                    text-align: center;
                }
                th {
                    background-color: #F0FDFA;
                    font-weight: 600;
                    color: #0F766E;
                }
                .totals {
                    margin-top: 30px;
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 15px;
                }
                .total-box {
                    border: 2px solid #14B8A6;
                    padding: 15px;
                    text-align: center;
                    border-radius: 8px;
                    background: white;
                }
                .amount {
                    font-size: 22px;
                    font-weight: bold;
                }
                .red { color: #dc2626; }
                .green { color: #16a34a; }
                .emerald { color: #14B8A6; }
                @media print {
                    body { padding: 20px; }
                    button, .no-print { display: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="shop-name">مصطفى الازهرى للادوات الصحيه</div>
                <h2>فاتورة بيع قطاعي</h2>
                <p>رقم الفاتورة: #${index + 1} &nbsp;&nbsp;&nbsp; التاريخ: ${formattedDate} - ${formattedTime}</p>
            </div>

            <div style="margin-bottom: 20px; font-size: 18px;">
                <strong>اسم العميل:</strong> ${inv.customer}
                ${previousDebt > 0 ? `<span style="color:#dc2626;"> (عليه ${previousDebt.toFixed(2)} جنيه سابقًا)</span>` : ''}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>المنتج</th>
                        <th>المقاس</th>
                        <th>السعر</th>
                        <th>الكمية</th>
                        <th>الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${inv.items.map(item => `
                        <tr>
                            <td>${item.productName}</td>
                            <td>${item.size}</td>
                            <td>${Number(item.price).toFixed(2)}</td>
                            <td>${item.qty}</td>
                            <td>${Number(item.subtotal).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="totals">
                <div class="total-box">
                    <h3 style="color:#14B8A6;">إجمالي الفاتورة الجديدة</h3>
                    <div class="amount emerald">${currentTotal.toFixed(2)} جنيه</div>
                </div>
                <div class="total-box">
                    <h3 style="color:#16a34a;">المبلغ المدفوع</h3>
                    <div class="amount green">${paid.toFixed(2)} جنيه</div>
                </div>
                <div class="total-box" style="grid-column: 1 / -1; border-color: #dc2626;">
                    <h3>المتبقي النهائي</h3>
                    <div class="amount ${remaining > 0 ? 'red' : 'green'}">
                        ${remaining.toFixed(2)} جنيه
                    </div>
                </div>
            </div>

            <div style="margin-top: 50px; text-align: center; color: #666; font-size: 16px;">
                شكرًا لتعاملك مع مصطفى الازهرى للادوات الصحية<br>
                برجاء الاحتفاظ بالفاتورة <br>
                للاستفساراتصل على : 01002908735 او 01119032231
            </div>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
    }, 600);
};

// ==================== اقتراح أسماء العملاء القطاعي ====================
function getAllUniqueRetailCustomers() {
    const customersSet = new Set();
    savedRetailInvoices.forEach(inv => {
        if (inv.customer && inv.customer !== 'عميل غير محدد') {
            customersSet.add(inv.customer.trim());
        }
    });
    allRetailCustomers = Array.from(customersSet).sort();
    return allRetailCustomers;
}

function setupRetailCustomerAutocomplete() {
    const customerInput = document.getElementById('retail-customer-name');
    if (!customerInput) return;

    let datalist = document.getElementById('retail-customers-datalist');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'retail-customers-datalist';
        document.body.appendChild(datalist);
    }

    customerInput.setAttribute('list', 'retail-customers-datalist');

    function updateSuggestions() {
        getAllUniqueRetailCustomers();
        datalist.innerHTML = '';
        allRetailCustomers.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            datalist.appendChild(opt);
        });
    }

    customerInput.addEventListener('focus', updateSuggestions);
    customerInput.addEventListener('input', updateRetailInvoiceHeader);
}

function updateRetailInvoiceHeader() {
    const customerNameInput = document.getElementById('retail-customer-name');
    const balanceEl = document.getElementById('retail-customer-balance');
    if (!customerNameInput || !balanceEl) return;

    const name = customerNameInput.value.trim() || 'عميل غير محدد';
    const previousBalance = getRetailCustomerPreviousDebt(name, editingRetailInvoiceIndex);

    if (previousBalance > 0) {
        balanceEl.innerHTML = `<span class="text-red-600">عليه ${previousBalance.toFixed(2)} جنيه سابقًا</span>`;
        balanceEl.className = "px-5 py-4 rounded-2xl text-sm font-medium bg-red-50 text-red-600 flex items-center min-w-[180px]";
    } 
    else if (previousBalance < 0) {
        const credit = Math.abs(previousBalance);
        balanceEl.innerHTML = `<span class="text-emerald-600">ليه رصيد زائد ${credit.toFixed(2)} جنيه</span>`;
        balanceEl.className = "px-5 py-4 rounded-2xl text-sm font-medium bg-emerald-50 text-emerald-600 flex items-center min-w-[180px]";
    } 
    else {
        balanceEl.innerHTML = `<span class="text-gray-500">لا يوجد رصيد سابق</span>`;
        balanceEl.className = "px-5 py-4 rounded-2xl text-sm font-medium bg-gray-50 text-gray-500 flex items-center min-w-[180px]";
    }
}

async function saveAllRetailInvoices() {
    try {
        await db.collection("appData").doc("retail_invoices").set({
            savedRetailInvoices: savedRetailInvoices,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("✅ فواتير القطاعي تم حفظها على Firebase");
    } catch (e) {
        console.error("خطأ في حفظ فواتير القطاعي:", e);
    }
}

async function loadRetailInvoices() {
    try {
        const doc = await db.collection("appData").doc("retail_invoices").get();
        if (doc.exists) {
            savedRetailInvoices = doc.data().savedRetailInvoices || [];
        } else {
            savedRetailInvoices = [];
        }
    } catch (e) {
        console.error("خطأ في تحميل فواتير القطاعي:", e);
        savedRetailInvoices = [];
    }
    renderRetailInvoices();
}
// دوال وهمية مؤقتة لإزالة الأخطاء في Console


function clearRetailInvoice() {
    if (confirm('هل تريد مسح الفاتورة القطاعية؟')) {
        retailInvoice = [];
        retailStaging = [];
        renderRetailTable();
        renderRetailStaging();
        renderRetailPercentGroups();
        updateRetailTotalAndRemaining();
    }
}


// ==================== تعديل السعر لفواتير القطاعي (النسخة النهائية) ====================


// تحديث عند اختيار المقاس (يرجع للسعر الأصلي)
function updateRetailPriceDisplay() {
    const productName = document.getElementById('retail-product-search').value.trim();
    const size = document.getElementById('retail-size-select').value;

    const product = products.find(p => p.name === productName);
    const variant = product?.variants.find(v => v.size === size);

    if (variant) {
        retailPriceAdjustment = 0;                    // تصفير التعديل
        const adjustInput = document.getElementById('retail-price-adjust');
        if (adjustInput) adjustInput.value = 0;
        retailItemAdjustmentConfirmed = false;         // لازم يحط النسبة/المبلغ تاني قبل الإضافة
    }
}

// تطبيق التعديل تلقائياً عند الكتابة، وتأكيد إن اليوزر حط القيمة فعلاً قبل الإضافة
function applyRetailPriceAdjustment() {
    const typeSelect = document.getElementById('retail-price-type');
    const valueInput = document.getElementById('retail-price-adjust');

    if (!typeSelect || !valueInput) return;

    retailAdjustmentType = typeSelect.value;
    retailPriceAdjustment = parseFloat(valueInput.value) || 0;
    retailItemAdjustmentConfirmed = true;
}

// ==================== إضافة منتج لفاتورة القطاعي (النسخة المحدثة) ====================
function addToRetailInvoice() {
    const productName = document.getElementById('retail-product-search').value.trim();
    const size = document.getElementById('retail-size-select').value;
    const qtyInput = document.getElementById('retail-qty-input');
    const qty = parseInt(qtyInput ? qtyInput.value : 1) || 1;

    if (!productName) return alert('❌ اختر المنتج');
    if (!size) return alert('❌ اختر المقاس');
    if (qty < 1) return alert('❌ الكمية غلط');

    const product = products.find(p => p.name === productName);
    if (!product) return alert('❌ المنتج غير موجود');

    const variant = product.variants.find(v => v.size === size);
    if (!variant) return alert('❌ المقاس غير موجود');

    const isPercentCompany = PERCENT_COMPANIES.includes(retailSelectedCompany);

    if (isPercentCompany) {
        // الشركات الخاصة (البحر الأحمر / أكوا دلتا / Dr): المنتج بيدخل قائمة مؤقتة من غير أي تعديل سعر هنا
        // النسبة أو المبلغ بيتحطوا لاحقًا عند الضغط على "إضافة للفاتورة"
        retailStaging.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            productName: product.name,
            size: size,
            basePrice: variant.price,
            qty: qty
        });

        renderRetailStaging();

        // تصفير الكمية بس
        if (qtyInput) qtyInput.value = 1;

        console.log(`تم إضافة ${product.name} للقائمة المؤقتة`);
        return;
    }

    // === باقي الشركات: لازم اليوزر يحط نسبة الزيادة أو النقصان الأول قبل ما يضيف المنتج ===
    if (!retailItemAdjustmentConfirmed) {
        return alert('⚠️ لازم تحط نسبة الزيادة أو النقصان الأول (حتى لو صفر) قبل ما تضيف المنتج');
    }

    let finalPrice = variant.price;
    if (retailAdjustmentType === 'percent') {
        finalPrice = variant.price * (1 + retailPriceAdjustment / 100);
    } else {
        finalPrice = variant.price + retailPriceAdjustment;
    }

    finalPrice = Math.max(0, finalPrice);   // منع السعر السالب

    retailInvoice.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        productName: product.name,
        size: size,
        basePrice: variant.price,
        price: finalPrice,
        qty: qty,
        subtotal: finalPrice * qty
    });

    renderRetailTable();
    updateRetailTotalAndRemaining();

    // تصفير الكمية
    if (qtyInput) qtyInput.value = 1;

    // تصفير التعديل بعد الإضافة، ولازم يتحط تاني قبل المنتج الجاي
    retailPriceAdjustment = 0;
    retailItemAdjustmentConfirmed = false;
    const adjustInput = document.getElementById('retail-price-adjust');
    if (adjustInput) adjustInput.value = 0;

    console.log(`تم إضافة ${product.name} بسعر معدل: ${finalPrice.toFixed(2)}`);
}

// ==================== ربط زرار الحفظ القطاعي ====================
document.addEventListener('DOMContentLoaded', () => {
    const saveRetailBtn = document.getElementById('save-retail-btn');
    if (saveRetailBtn) {
        saveRetailBtn.addEventListener('click', saveRetailInvoice);
        console.log("✅ زرار حفظ فاتورة القطاعي تم ربطه بنجاح");
    }
});

// ==================== نظام تسجيل الدخول (Firebase Authentication) ====================
// ملاحظة أمان: تسجيل الدخول هنا للعرض فقط (إخفاء/إظهار الواجهة).
// الحماية الحقيقية للبيانات تتم عبر Firestore Security Rules التي تتحقق
// من request.auth != null على مستوى السيرفر، وليس عبر هذا الكود.
let appHasStarted = false;

function showAppScreen() {
    const loginScreen = document.getElementById('login-screen');
    const appRoot = document.getElementById('app-root');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appRoot) appRoot.classList.remove('hidden');
}

function showLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    const appRoot = document.getElementById('app-root');
    if (appRoot) appRoot.classList.add('hidden');
    if (loginScreen) loginScreen.classList.remove('hidden');
    appHasStarted = false; // يسمح بإعادة تحميل بيانات المستخدم التالي عند تسجيل دخول جديد
}

function setLoginError(message) {
    const el = document.getElementById('login-error');
    if (!el) return;
    if (!message) {
        el.classList.add('hidden');
        el.textContent = '';
    } else {
        el.textContent = message;
        el.classList.remove('hidden');
    }
}

function translateAuthError(code) {
    const map = {
        'auth/invalid-email': 'البريد الإلكتروني غير صحيح.',
        'auth/user-disabled': 'هذا الحساب معطل.',
        'auth/user-not-found': 'بيانات الدخول غير صحيحة.',
        'auth/wrong-password': 'بيانات الدخول غير صحيحة.',
        'auth/invalid-credential': 'بيانات الدخول غير صحيحة.',
        'auth/too-many-requests': 'محاولات كثيرة جدًا، حاول لاحقًا.',
        'auth/network-request-failed': 'تحقق من الاتصال بالإنترنت.'
    };
    return map[code] || 'حدث خطأ أثناء تسجيل الدخول، حاول مرة أخرى.';
}

function setupLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoginError('');
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const submitBtn = document.getElementById('login-submit-btn');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'جاري الدخول...'; }
        try {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            // onAuthStateChanged هو اللي هيتكفل بإظهار التطبيق
        } catch (err) {
            console.error('خطأ تسجيل الدخول:', err);
            setLoginError(translateAuthError(err.code));
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'تسجيل الدخول'; }
        }
    });
}

function logoutUser() {
    firebase.auth().signOut().catch((err) => console.error('خطأ تسجيل الخروج:', err));
}

function initAuth() {
    setupLoginForm();
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            showAppScreen();
            if (!appHasStarted) {
                appHasStarted = true;
                startApp();
            }
        } else {
            showLoginScreen();
        }
    });
}

window.onload = initAuth;