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

// ==================== Retail (قطاعي) - متغيرات جديدة ====================
let retailInvoice = [];
let savedRetailInvoices = [];
let editingRetailInvoiceIndex = null;     // ← مهم جدًا
let allRetailCustomers = [];              // للاقتراحات
let retailPriceAdjustment = 0;   // قيمة الزيادة أو النقصان
let retailAdjustmentType = 'percent';

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

// ==================== عرض المنتجات (بعد التحديث) ====================
function renderProducts(filtered = products) {
    const container = document.getElementById('products-list');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(filtered)) filtered = [];
    const validProducts = filtered.filter(p => p && typeof p === 'object' && Array.isArray(p.variants));

    if (validProducts.length === 0) {
        container.innerHTML = `
            <div class="bg-white rounded-2xl p-10 text-center text-gray-500">
                <div class="text-6xl mb-4">🛒</div>
                <p class="text-xl font-medium">لا يوجد منتجات</p>
            </div>
        `;
        return;
    }

    validProducts.forEach(product => {
        let rowsHTML = '';
        product.variants.forEach(variant => {
            const price = Number(variant.price);
            const priceDisplay = isNaN(price) ? '—' : price.toFixed(2);
            rowsHTML += `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3 text-right font-medium">${variant.size || 'غير محدد'}</td>
                    <td class="px-4 py-3 text-center font-bold text-blue-700">${priceDisplay} <span class="text-sm text-gray-500">ج.م</span></td>
                </tr>
            `;
        });

        let companyBadges = '';
        if (Array.isArray(product.companies) && product.companies.length > 0) {
            companyBadges = product.companies.map(c => {
                if (c === 'redsea') return `<span class="bg-red-100 text-red-700 text-xs px-3 py-1 rounded-full">البحر الأحمر</span>`;
                if (c === 'aquadelta') return `<span class="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full">أكوا دلتا</span>`;
                return '';
            }).join(' ');
        }

        const card = document.createElement('div');
        card.className = 'bg-white rounded-2xl shadow-md overflow-hidden mb-6';
        card.innerHTML = `
            <div class="bg-gradient-to-r from-blue-600 to-blue-800 px-5 py-4 text-white">
                <div class="flex justify-between items-center flex-wrap gap-2">
                    <h3 class="text-xl font-bold">${product.name}</h3>
                    <div class="flex items-center gap-2">
                        ${companyBadges}
                        <span class="bg-white/20 px-3 py-1 rounded-full text-sm">${product.variants.length} مقاس</span>
                    </div>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-right border-collapse">
                    <thead class="bg-gray-100 text-gray-700 text-sm">
                        <tr>
                            <th class="px-4 py-3 font-semibold">المقاس</th>
                            <th class="px-4 py-3 font-semibold text-center">السعر</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">${rowsHTML}</tbody>
                </table>
            </div>
            <div class="px-5 py-4 bg-gray-50 flex justify-end gap-3">
                <button onclick="editProduct(${product.id})" class="bg-amber-100 hover:bg-amber-200 text-amber-800 px-5 py-2 rounded-lg">✏️ تعديل</button>
                <button onclick="deleteProduct(${product.id})" class="bg-red-100 hover:bg-red-200 text-red-800 px-5 py-2 rounded-lg">🗑️ حذف</button>
            </div>
        `;
        container.appendChild(card);
    });
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
        row.className = 'flex gap-3 items-center bg-gray-50 rounded-2xl p-3';
        row.innerHTML = `
            <input type="text" value="${variant.size || ''}" oninput="updateVariantSize(${index}, this.value)" class="flex-1 px-4 py-3 rounded-xl border focus:border-blue-400 text-lg">
            <input type="number" step="0.01" min="0" value="${variant.price || ''}" oninput="updateVariantPrice(${index}, this.value)" class="w-28 px-4 py-3 rounded-xl border focus:border-blue-400 text-lg text-center">
            <button onclick="removeVariant(${index})" class="w-9 h-9 flex items-center justify-center text-red-500 text-2xl hover:bg-red-100 rounded-xl">×</button>
        `;
        container.appendChild(row);
    });
}

function updateVariantSize(index, value) { if (editingVariants[index]) editingVariants[index].size = value; }
function updateVariantPrice(index, value) { if (editingVariants[index]) editingVariants[index].price = parseFloat(value) || 0; }

function addVariantRow() {
    editingVariants.push({ size: '', price: 0 });
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
    
    // إعادة تعيين الـ checkboxes
    document.getElementById('company-redsea').checked = false;
    document.getElementById('company-aquadelta').checked = false;
    
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
    document.getElementById('company-redsea').checked = editingCompanies.includes('redsea');
    document.getElementById('company-aquadelta').checked = editingCompanies.includes('aquadelta');

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

    const selectedCompanies = [];
    if (document.getElementById('company-redsea').checked) selectedCompanies.push('redsea');
    if (document.getElementById('company-aquadelta').checked) selectedCompanies.push('aquadelta');

    const cleanVariants = editingVariants
        .filter(v => (v.size || '').trim() !== '' && parseFloat(v.price) > 0)
        .map(v => ({ size: v.size.trim(), price: parseFloat(v.price) }));

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
    renderProducts();
    populateProductDatalist();
    closeModal();

    const toast = document.createElement('div');
    toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 bg-green-600 text-white px-8 py-4 rounded-3xl shadow-xl z-50';
    toast.textContent = editingProductId !== null ? '✅ تم تعديل المنتج' : '✅ تم إضافة المنتج بنجاح';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

function deleteProduct(id) {
    if (!confirm('هل أنت متأكد من حذف المنتج ده؟')) return;
    products = products.filter(p => p.id !== id);
    saveProducts();           // ← Firebase
    renderProducts();
    populateProductDatalist();
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
    alert('✅ تم حذف الفاتورة');
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

    const toast = document.createElement('div');
    toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 bg-amber-600 text-white px-6 py-3 rounded-3xl shadow-xl z-50';
    toast.textContent = '✏️ جاري تعديل الفاتورة...';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
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
                    border-bottom: 3px solid #1e40af;
                    padding-bottom: 15px;
                }
                .shop-name {
                    font-size: 28px;
                    font-weight: bold;
                    color: #1e40af;
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
                .blue { color: #1e40af; }
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
        populateProductDatalist();           // للبحث عن المنتجات
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
    // الاستماع للمنتجات
    db.collection("appData").doc("products")
        .onSnapshot((doc) => {
            if (doc.exists) {
                products = doc.data().products || [];
                renderProducts();
                populateProductDatalist();
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
    await loadProducts();
    await loadSavedInvoices();
    
    // أضف تحميل فواتير القطاعي هنا أيضًا
    await loadRetailInvoices();        // ← أضف هذا السطر

    renderProducts();
    populateProductDatalist();
    renderSavedInvoices();
    renderRetailInvoices();            // ← أضف هذا أيضًا

    setupCustomerAutocomplete();
    setupRetailCustomerAutocomplete();

    listenToDataChanges();
    showSection('products');

    console.log("🚀 التطبيق بدأ بنجاح مع Firebase");
}

// ====================== تعديل الأسعار جماعي ======================

function openBulkPriceModal() {
    bulkEditCompany = null;
    bulkEditType = 'percent';
    
    // إعادة تعيين الأزرار
    document.getElementById('btn-redsea').classList.remove('border-amber-500', 'bg-amber-50');
    document.getElementById('btn-aquadelta').classList.remove('border-amber-500', 'bg-amber-50');
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
    document.getElementById('btn-redsea').classList.toggle('border-amber-500', company === 'redsea');
    document.getElementById('btn-redsea').classList.toggle('bg-amber-50', company === 'redsea');
    
    document.getElementById('btn-aquadelta').classList.toggle('border-amber-500', company === 'aquadelta');
    document.getElementById('btn-aquadelta').classList.toggle('bg-amber-50', company === 'aquadelta');
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

    const confirmMsg = `هل أنت متأكدة من  ${actionText} على كل أسعار منتجات شركة ${bulkEditCompany === 'redsea' ? 'البحر الأحمر' : 'أكوا دلتا'}؟`;

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
        alert(`⚠️  لا يوجد منتجات تابعة لشركة ${bulkEditCompany === 'redsea' ? 'البحر الأحمر' : 'أكوا دلتا'}`);
    } else {
        saveProducts();
        renderProducts();
        alert(`✅ تم تعديل  ${updatedCount} أسعار  منتج بنجاح`);
    }

    closeBulkPriceModal();
}

document.getElementById('product-search-box').addEventListener('input', function () {
    const query = this.value.trim().toLowerCase();

    const filteredProducts = query === ""
        ? products
        : products.filter(p => p.name.toLowerCase().includes(query));

    renderProducts(filteredProducts);
});

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



// ==================== عرض جدول الفاتورة القطاعية ====================
function renderRetailTable() {
    const tbody = document.getElementById('retail-invoice-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    retailInvoice.forEach((item, index) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        row.innerHTML = `
            <td class="py-5 px-6 font-medium">${item.productName}</td>
            <td class="py-5 px-6 text-center text-lg">${item.size}</td>
            <td class="py-5 px-6 text-center">${item.price}</td>
            <td class="py-5 px-6 text-center text-lg font-medium">${item.qty}</td>
            <td class="py-5 px-6 text-center font-bold">${item.subtotal.toFixed(2)}</td>
            <td class="py-5 px-6 text-center no-print">
                <button onclick="removeRetailItem(${index})" class="text-red-500 hover:text-red-700 text-3xl">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// ==================== حذف منتج من الفاتورة القطاعية ====================
window.removeRetailItem = function(index) {
    retailInvoice.splice(index, 1);
    renderRetailTable();
    updateRetailTotalAndRemaining();
};

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

    if (editingRetailInvoiceIndex !== null) {
        savedRetailInvoices[editingRetailInvoiceIndex] = invoice;
    } else {
        savedRetailInvoices.push(invoice);
    }

    recalculateAllRetailInvoicesForCustomer(customer);
    saveAllRetailInvoices();

    // تصفير الفاتورة
    retailInvoice = [];
    editingRetailInvoiceIndex = null;

    renderRetailTable();
    updateRetailTotalAndRemaining();

    if (customerInput) customerInput.value = '';
    document.getElementById('retail-paid-input').value = '0';
    const remEl = document.getElementById('retail-remaining-input');
    if (remEl) remEl.value = '0';

    updateRetailInvoiceHeader();
    renderRetailInvoices();

    setTimeout(getAllUniqueRetailCustomers, 100);

    // رسالة نجاح
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-8 py-4 rounded-3xl shadow-xl z-50';
    toast.textContent = '✅ تم حفظ فاتورة القطاعي بنجاح';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
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

    const customerInput = document.getElementById('retail-customer-name');
    if (customerInput) customerInput.value = invoice.customer;

    const paidInput = document.getElementById('retail-paid-input');
    if (paidInput) paidInput.value = Number(invoice.paid || 0).toFixed(2);

    renderRetailTable();
    updateRetailTotalAndRemaining();
    updateRetailInvoiceHeader();

    showSection('retail');

    const toast = document.createElement('div');
    toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 bg-amber-600 text-white px-6 py-3 rounded-3xl shadow-xl z-50';
    toast.textContent = '✏️ جاري تعديل فاتورة القطاعي...';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
};

window.deleteRetailSavedInvoice = function(index) {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة القطاعية؟')) return;
    savedRetailInvoices.splice(index, 1);
    saveAllRetailInvoices();
    renderRetailInvoices();
    alert('✅ تم حذف الفاتورة');
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
                    border-bottom: 4px solid #10b981;
                    padding-bottom: 15px;
                }
                .shop-name {
                    font-size: 28px;
                    font-weight: bold;
                    color: #10b981;
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
                    background-color: #ecfdf5;
                    font-weight: 600;
                    color: #065f46;
                }
                .totals {
                    margin-top: 30px;
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 15px;
                }
                .total-box {
                    border: 2px solid #10b981;
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
                .emerald { color: #10b981; }
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
                    <h3 style="color:#10b981;">إجمالي الفاتورة الجديدة</h3>
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
        renderRetailTable();
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
    }
}

// تطبيق التعديل تلقائياً عند الكتابة
function applyRetailPriceAdjustment() {
    const typeSelect = document.getElementById('retail-price-type');
    const valueInput = document.getElementById('retail-price-adjust');

    if (!typeSelect || !valueInput) return;

    retailAdjustmentType = typeSelect.value;
    retailPriceAdjustment = parseFloat(valueInput.value) || 0;
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

    // التحقق من وجود تعديل
    if (retailPriceAdjustment === 0) {
        return alert('❌ اضف النسبه أو المبلغ للقطاعي أولاً');
    }

    let finalPrice = variant.price;

    if (retailAdjustmentType === 'percent') {
        finalPrice = variant.price * (1 + retailPriceAdjustment / 100);
    } else {
        finalPrice = variant.price + retailPriceAdjustment;
    }

    finalPrice = Math.max(0, finalPrice);   // منع السعر السالب

    retailInvoice.push({
        id: Date.now(),
        productName: product.name,
        size: size,
        price: finalPrice,
        qty: qty,
        subtotal: finalPrice * qty
    });

    renderRetailTable();
    updateRetailTotalAndRemaining();

    // تصفير الكمية
    if (qtyInput) qtyInput.value = 1;

    // تصفير التعديل بعد الإضافة
    retailPriceAdjustment = 0;
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

window.onload = startApp;