// ==================== المتغيرات العامة ====================
let products = [];
let currentInvoice = [];
let savedInvoices = [];
let editingProduct_id = null;
let editingVariants = [];
let customersBalance = {};
let editingInvoiceIndex = null;   //  مهم جدًا
let editingCompanies = [];        // لتخزين الشركات المختارة للمنتج
let bulkEditCompany = null;     // الشركة اللي هنعدل أسعارها
let bulkEditType = 'percent';   // 'percent' أو 'fixed'
let allCustomers = [];   // عشان نحفظ أسماء الزبائن السابقين
let invoiceSelectedCompany = '';  // الشركة المختارة حاليًا في فاتورة الجملة (لتمييز المنتجات المتشابهة بالاسم)

// ==================== سلة المحذوفات (منتجات / فواتير تجار / فواتير قطاعي) ====================
// أي عنصر بيتحذف بيروح هنا الأول بدل ما يتشال نهائي، وبيفضل موجود 30 يوم يقدر
// المستخدم يرجعه فيها، وبعد كده لو محدش رجعه بيتشال نهائي تلقائيًا.
let trashedProducts = [];        // [{ trashId, deletedAt, data }]
let trashedInvoices = [];        // فواتير التجار المحذوفة
let trashedRetailInvoices = [];  // فواتير القطاعي المحذوفة
const TRASH_RETENTION_DAYS = 30;

function makeTrashId() {
    return Date.now() + '-' + Math.floor(Math.random() * 1000000);
}

/* ==================== قفل بكلمة السر ====================
   بيحمي: الأسعار الأصلية (شكل + تعديل) / المكسب وتقرير الأرباح / صفحة الرسوم البيانية.
   بعد ما تكتبي كلمة السر مرة، بتفضل مفتوحة 10 دقايق بس، وبعدها بتقفل لوحدها. */
const APP_SECRET_PASSWORD = '1323@';
const SECRET_VISIBLE_SECONDS = 100;   // بعدها بيتخفي كل حاجة وبيتطلب الباسورد تاني
let __secretUnlockedUntil = 0;
let __secretAutoLockTimer = null;

function isSecretUnlocked() { return Date.now() < __secretUnlockedUntil; }
window.isSecretUnlocked = isSecretUnlocked;

// بيرجّع كل الأسعار/المكاسب المكشوفة لحالة الإخفاء تاني
function hideAllRevealedSecrets() {
    document.querySelectorAll('.hidden-price-value:not(.hidden)').forEach(valueEl => {
        const wrapper = valueEl.parentElement;
        if (!wrapper) return;
        valueEl.classList.add('hidden');
        const maskEl = wrapper.querySelector('.hidden-price-mask');
        if (maskEl) maskEl.classList.remove('hidden');
        const btn = wrapper.querySelector('button');
        if (btn && typeof icon === 'function') btn.innerHTML = icon('eye', 'w-4 h-4');
    });
}

function scheduleSecretAutoLock() {
    if (__secretAutoLockTimer) clearTimeout(__secretAutoLockTimer);
    __secretAutoLockTimer = setTimeout(() => {
        __secretUnlockedUntil = 0;
        hideAllRevealedSecrets();
        // لو مودال المنتج مفتوح أو لوحة المعلومات ظاهرة، نعيد رسمهم في حالة القفل
        const productModal = document.getElementById('product-modal');
        if (productModal && !productModal.classList.contains('hidden') && typeof renderVariantsInModal === 'function') {
            renderVariantsInModal();
        }
        const dash = document.getElementById('dashboard-section');
        if (dash && !dash.classList.contains('hidden') && typeof renderDashboard === 'function') {
            renderDashboard();
        }
        if (typeof closeProfitModal === 'function') {
            const pm = document.getElementById('profit-modal');
            if (pm && !pm.classList.contains('hidden')) closeProfitModal();
        }
        if (typeof showToast === 'function') showToast('خلصت الـ 100 ثانية — اتقفلت تاني', 'warning');
    }, SECRET_VISIBLE_SECONDS * 1000);
}

// صندوق كلمة السر (بيكتب نقط مش ظاهرة)، بيرجّع Promise<boolean>
function askSecretPassword(reason) {
    return new Promise(resolve => {
        const old = document.getElementById('secret-ask-modal');
        if (old) old.remove();

        const box = document.createElement('div');
        box.id = 'secret-ask-modal';
        box.style.cssText = 'position:fixed;inset:0;background:rgba(30,34,51,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';
        box.innerHTML = `
            <div style="background:#fff;border-radius:16px;padding:22px;width:100%;max-width:320px;text-align:center;font-family:'Cairo',Arial,sans-serif;" dir="rtl">
                <div style="font-size:30px;margin-bottom:8px;">🔒</div>
                <div style="font-size:14px;font-weight:700;color:#1E2233;margin-bottom:14px;">${reason || 'البيانات دي محميّة — اكتبي كلمة السر:'}</div>
                <input id="secret-ask-input" type="password" autocomplete="off"
                       style="width:100%;padding:12px;border:1px solid #DDD6C9;border-radius:12px;text-align:center;font-size:18px;letter-spacing:.3em;box-sizing:border-box;">
                <div id="secret-ask-err" style="color:#dc2626;font-size:12px;height:16px;margin-top:6px;"></div>
                <div style="display:flex;gap:8px;margin-top:10px;">
                    <button type="button" id="secret-ask-ok" style="flex:1;padding:11px;border-radius:12px;border:none;background:#6D5CE7;color:#fff;font-weight:700;">تأكيد</button>
                    <button type="button" id="secret-ask-cancel" style="flex:1;padding:11px;border-radius:12px;border:1px solid #DDD6C9;background:#fff;color:#555;font-weight:700;">إلغاء</button>
                </div>
            </div>`;
        document.body.appendChild(box);

        const input = box.querySelector('#secret-ask-input');
        const err = box.querySelector('#secret-ask-err');
        setTimeout(() => input.focus(), 50);

        const finish = ok => { box.remove(); resolve(ok); };
        const submit = () => {
            if (String(input.value).trim() === APP_SECRET_PASSWORD) {
                __secretUnlockedUntil = Date.now() + SECRET_VISIBLE_SECONDS * 1000;
                scheduleSecretAutoLock();
                finish(true);
            } else {
                err.textContent = 'كلمة السر غلط';
                input.value = '';
                input.focus();
            }
        };
        box.querySelector('#secret-ask-ok').onclick = submit;
        box.querySelector('#secret-ask-cancel').onclick = () => finish(false);
        input.onkeydown = e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') finish(false); };
        box.onclick = e => { if (e.target === box) finish(false); };
    });
}
window.requireSecret = askSecretPassword;   // اسم قديم متوافق، لكن دلوقتي بيرجّع Promise

// قفل فوري من غير ما تستني الـ 100 ثانية
window.lockSecretNow = function () {
    __secretUnlockedUntil = 0;
    if (__secretAutoLockTimer) { clearTimeout(__secretAutoLockTimer); __secretAutoLockTimer = null; }
    hideAllRevealedSecrets();
    if (typeof renderProducts === 'function') renderProducts();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof showToast === 'function') showToast('اتقفلت تاني', 'warning');
};

// فتح القفل ثم إعادة رسم الشاشة اللي محتاجة إذن
window.unlockAndRender = async function (what) {
    const ok = await askSecretPassword();
    if (!ok) return;
    if (what === 'variants' && typeof renderVariantsInModal === 'function') renderVariantsInModal();
    if (what === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
    if (what === 'products' && typeof renderProducts === 'function') renderProducts();
};

/* ==================== بيانات المحل (بتظهر في آخر الفاتورة المطبوعة) ==================== */
const SHOP_FACEBOOK_URL  = 'https://www.facebook.com/share/1CYhb53Kx8/';
const SHOP_FACEBOOK_NAME = 'معرض الأزهرى للأدوات الصحيه';
const SHOP_PHONE         = '01141257655';

let __fbQrDataUrl = '';
function ensureFacebookQr() {
    return new Promise(resolve => {
        if (__fbQrDataUrl) return resolve(__fbQrDataUrl);
        if (typeof QRCode === 'undefined' || !QRCode.toDataURL) return resolve('');
        try {
            QRCode.toDataURL(SHOP_FACEBOOK_URL, {
                width: 220, margin: 1, color: { dark: '#1E2233', light: '#FFFFFF' }
            }, (err, url) => {
                if (!err && url) __fbQrDataUrl = url;
                resolve(__fbQrDataUrl);
            });
        } catch (e) { resolve(''); }
    });
}
window.ensureFacebookQr = ensureFacebookQr;

// نجهّز الكود بدري عشان الطباعة تطلع فورًا
document.addEventListener('DOMContentLoaded', () => {
    ensureFacebookQr();
    setTimeout(ensureFacebookQr, 2500);
});

// آخر الفاتورة: كود الصفحة + الاسم + رقم التليفون
function shopPrintFooterHtml(qrDataUrl, accent) {
    accent = accent || '#14B8A6';
    return `
        <div style="margin-top:34px;padding-top:14px;border-top:2px dashed #CBD5E1;
                    display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;">
            ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR"
                 style="width:78px;height:78px;border:1px solid #E2E8F0;border-radius:6px;padding:3px;background:#fff;">` : ''}
            <div style="text-align:right;font-size:13px;line-height:1.9;color:#334155;">
                <div style="font-weight:700;color:${accent};font-size:15px;">${SHOP_FACEBOOK_NAME}</div>
                <div>امسح الكود بالكاميرا يوديك على صفحتنا على فيسبوك</div>
                <div style="font-weight:700;">للاستفسار: ${SHOP_PHONE}</div>
            </div>
        </div>`;
}

/* ==================== الخصم: مبلغ أو نسبة ==================== */
function computeDiscountAmount(scope, rawTotal) {
    const isRetail = scope === 'retail';
    const input  = document.getElementById(isRetail ? 'retail-discount-input' : 'discount-input');
    const typeEl = document.getElementById(isRetail ? 'retail-discount-type'  : 'discount-type');
    const hintEl = document.getElementById(isRetail ? 'retail-discount-hint'  : 'discount-hint');

    const raw  = parseFloat(input ? input.value : 0) || 0;
    const type = typeEl ? typeEl.value : 'amount';

    let amount = raw;
    if (type === 'percent') {
        const pct = Math.min(100, Math.max(0, raw));
        amount = (Number(rawTotal) || 0) * pct / 100;
    }
    amount = Math.max(0, Math.min(Number(rawTotal) || 0, amount));

    if (hintEl) {
        hintEl.textContent = (type === 'percent' && raw > 0)
            ? `خصم ${raw}% = ${amount.toFixed(2)} جنيه`
            : '';
    }
    return amount;
}
window.computeDiscountAmount = computeDiscountAmount;

// لما نفتح فاتورة قديمة للتعديل، الخصم المحفوظ مبلغ جاهز مش نسبة
function setDiscountFieldsFromSaved(scope, savedAmount) {
    const isRetail = scope === 'retail';
    const input  = document.getElementById(isRetail ? 'retail-discount-input' : 'discount-input');
    const typeEl = document.getElementById(isRetail ? 'retail-discount-type'  : 'discount-type');
    if (typeEl) typeEl.value = 'amount';
    if (input) input.value = Number(savedAmount || 0).toFixed(2);
}
window.setDiscountFieldsFromSaved = setDiscountFieldsFromSaved;

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
    if (!id) return 'بدون شركة';
    const c = companiesList.find(c => c.id === id);
    return c ? c.label : id;
}

// ==================== إيجاد المنتج الصح لما يكون فيه أكتر من منتج بنفس الاسم ====================
// لو فيه منتجين بنفس الاسم وكل واحد تابع لشركة مختلفة (زي "هيملايا" في البحر الأحمر وفي أكوا دلتا
// بسعرين مختلفين)، لازم نستخدم الشركة المختارة حاليًا عشان نجيب المنتج والسعر الصح، مش أول منتج
// بنفس الاسم يلاقيه في القائمة.
function findProductByNameAndCompany(name, companyId) {
    if (!name) return null;
    const matches = products.filter(p => p.name === name);
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    if (companyId) {
        const exact = matches.find(p => Array.isArray(p.companies) && p.companies.includes(companyId));
        if (exact) return exact;
    }
    // مفيش شركة محددة أو مفيش تطابق: نرجع لأول منتج (سلوك قديم) عشان الفاتورة متتوقفش
    return matches[0];
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
let editingRetailInvoiceIndex = null;     //  مهم جدًا
let retailStagingAdjustmentTouched = false; // هل المستخدم حط نسبة/مبلغ الزيادة قبل "إضافة للفاتورة" (البحر الأحمر/أكوا دلتا/Dr)
let allRetailCustomers = [];              // للاقتراحات
let retailPriceAdjustment = 0;   // قيمة الزيادة أو النقصان
let retailAdjustmentType = 'percent';
let retailSelectedCompany = '';  // الشركة المختارة حاليًا في فاتورة القطاعي
let retailAdjustmentConfirmed = false;   // (باقية لتوافق قديم، لم تعد تُستخدم للحجب)
let retailItemAdjustmentConfirmed = false; // هل المستخدم حط نسبة/قيمة الزيادة أو النقصان الأول قبل إضافة منتج (للشركات العادية غير الثلاثة)
let retailStaging = [];   // قائمة مؤقتة لمنتجات الشركة المختارة (البحر الأحمر/أكوا دلتا/Dr) قبل ما تتضاف للفاتورة الكلية
let retailSessionAddedAt = Date.now();   // كل المنتجات اللي بتتضاف في نفس جلسة العمل (فاتورة جديدة أو تعديل) بتاخد نفس التاريخ ده
let retailEditingPaymentContext = null;  // { index, paymentId } — الدفعة اللي بتتعدل دلوقتي (لو فيه)

async function saveProducts() {
    try {
        await db.collection("appData").doc("products").set({
            products: products,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(" المنتجات تم حفظها على Firebase");
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
        console.log(" الفواتير تم حفظها على Firebase");
    } catch (e) {
        console.error("خطأ في حفظ الفواتير:", e);
        localStorage.setItem('savedInvoices', JSON.stringify(savedInvoices));
    }
}

// ==================== سلة المحذوفات: حفظ وتحميل ====================
async function saveTrash() {
    try {
        await db.collection("appData").doc("trash").set({
            trashedProducts: trashedProducts,
            trashedInvoices: trashedInvoices,
            trashedRetailInvoices: trashedRetailInvoices,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error("خطأ في حفظ سلة المحذوفات:", e);
        localStorage.setItem('trashedProducts', JSON.stringify(trashedProducts));
        localStorage.setItem('trashedInvoices', JSON.stringify(trashedInvoices));
        localStorage.setItem('trashedRetailInvoices', JSON.stringify(trashedRetailInvoices));
    }
}

async function loadTrash() {
    try {
        const doc = await db.collection("appData").doc("trash").get();
        if (doc.exists) {
            trashedProducts = doc.data().trashedProducts || [];
            trashedInvoices = doc.data().trashedInvoices || [];
            trashedRetailInvoices = doc.data().trashedRetailInvoices || [];
        } else {
            trashedProducts = [];
            trashedInvoices = [];
            trashedRetailInvoices = [];
        }
    } catch (e) {
        console.error("خطأ في تحميل سلة المحذوفات:", e);
        trashedProducts = JSON.parse(localStorage.getItem('trashedProducts') || '[]');
        trashedInvoices = JSON.parse(localStorage.getItem('trashedInvoices') || '[]');
        trashedRetailInvoices = JSON.parse(localStorage.getItem('trashedRetailInvoices') || '[]');
    }
    purgeExpiredTrash();
}

// بيشيل أي عنصر في سلة المحذوفات عدّى عليه 30 يوم من غير ما حد يرجّعه
function purgeExpiredTrash() {
    const now = Date.now();
    const cutoffMs = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const beforeCount = trashedProducts.length + trashedInvoices.length + trashedRetailInvoices.length;

    trashedProducts = trashedProducts.filter(t => (now - t.deletedAt) < cutoffMs);
    trashedInvoices = trashedInvoices.filter(t => (now - t.deletedAt) < cutoffMs);
    trashedRetailInvoices = trashedRetailInvoices.filter(t => (now - t.deletedAt) < cutoffMs);

    const afterCount = trashedProducts.length + trashedInvoices.length + trashedRetailInvoices.length;
    if (afterCount !== beforeCount) {
        saveTrash();
    }
    renderTrash();
}

// بيرجع عدد الأيام المتبقية قبل ما العنصر يتحذف نهائي تلقائيًا
function trashDaysLeft(deletedAt) {
    const cutoffMs = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - (Number(deletedAt) || 0);
    return Math.max(0, Math.ceil((cutoffMs - elapsed) / (24 * 60 * 60 * 1000)));
}

function formatTrashDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) +
        ' - ' + d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

// ==================== استرجاع / حذف نهائي: المنتجات ====================
window.restoreTrashedProduct = function(trashId) {
    const idx = trashedProducts.findIndex(t => t.trashId === trashId);
    if (idx === -1) return;
    const entry = trashedProducts[idx];
    products.push(entry.data);
    trashedProducts.splice(idx, 1);
    saveProducts();
    saveTrash();
    applyProductsFilter();
    populateProductDatalist();
    renderTrash();
    showToast(' تم استرجاع المنتج', 'success');
};

window.permanentlyDeleteTrashedProduct = function(trashId) {
    if (!confirm('حذف نهائي! مش هينفع ترجع المنتج ده تاني بعد كده. متأكد؟')) return;
    trashedProducts = trashedProducts.filter(t => t.trashId !== trashId);
    saveTrash();
    renderTrash();
    showToast(' تم الحذف النهائي', 'error');
};

// ==================== استرجاع / حذف نهائي: فواتير التجار ====================
window.restoreTrashedInvoice = function(trashId) {
    const idx = trashedInvoices.findIndex(t => t.trashId === trashId);
    if (idx === -1) return;
    const entry = trashedInvoices[idx];
    savedInvoices.push(entry.data);
    trashedInvoices.splice(idx, 1);
    if (getInvoiceStockState(entry.data, 'invoice') === 'deducted') adjustStockForItems(getStockItemsForInvoice(entry.data), -1); // كانت متخصمة، فترجع تتخصم
    recalculateAllInvoicesForCustomer(entry.data.customer);
    saveAllInvoices();
    saveTrash();
    renderSavedInvoices();
    renderTrash();
    showToast(' تم استرجاع الفاتورة', 'success');
};

window.permanentlyDeleteTrashedInvoice = function(trashId) {
    if (!confirm('حذف نهائي! مش هينفع ترجع الفاتورة دي تاني بعد كده. متأكد؟')) return;
    trashedInvoices = trashedInvoices.filter(t => t.trashId !== trashId);
    saveTrash();
    renderTrash();
    showToast(' تم الحذف النهائي', 'error');
};

// ==================== استرجاع / حذف نهائي: فواتير القطاعي ====================
window.restoreTrashedRetailInvoice = function(trashId) {
    const idx = trashedRetailInvoices.findIndex(t => t.trashId === trashId);
    if (idx === -1) return;
    const entry = trashedRetailInvoices[idx];
    savedRetailInvoices.push(entry.data);
    trashedRetailInvoices.splice(idx, 1);
    // رجّعت للفواتير الفعلية: لو كانت متخصمة قبل الحذف ننقص المخزون تاني، ولو لسه متخصمتش منعملش حاجة
    if (getInvoiceStockState(entry.data, 'retail') === 'deducted') adjustStockForItems(getStockItemsForInvoice(entry.data), -1);
    recalculateAllRetailInvoicesForCustomer(entry.data.customer);
    saveAllRetailInvoices();
    saveTrash();
    renderRetailInvoices();
    renderTrash();
    showToast(' تم استرجاع الفاتورة', 'success');
};

window.permanentlyDeleteTrashedRetailInvoice = function(trashId) {
    if (!confirm('حذف نهائي! مش هينفع ترجع الفاتورة دي تاني بعد كده. متأكد؟')) return;
    trashedRetailInvoices = trashedRetailInvoices.filter(t => t.trashId !== trashId);
    saveTrash();
    renderTrash();
    showToast(' تم الحذف النهائي', 'error');
};

// ==================== عرض سلة المحذوفات ====================
function renderTrash() {
    const productsContainer = document.getElementById('trash-products-list');
    const invoicesContainer = document.getElementById('trash-invoices-list');
    const retailContainer = document.getElementById('trash-retail-invoices-list');
    if (!productsContainer && !invoicesContainer && !retailContainer) return;

    const emptyHtml = (msg) => `<div class="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm">${msg}</div>`;

    if (productsContainer) {
        productsContainer.innerHTML = trashedProducts.length === 0
            ? emptyHtml('لا يوجد منتجات محذوفة')
            : trashedProducts.slice().reverse().map(entry => `
                <div class="bg-gray-50 rounded-xl p-4 shadow-sm flex flex-wrap justify-between items-center gap-3">
                    <div>
                        <div class="font-semibold">${entry.data.name}</div>
                        <div class="text-xs text-gray-500 mt-1">اتحذف بتاريخ: ${formatTrashDate(entry.deletedAt)}</div>
                        <div class="text-xs text-amber-600 mt-1">هيتحذف نهائي تلقائيًا خلال ${trashDaysLeft(entry.deletedAt)} يوم</div>
                    </div>
                    <div class="flex items-center gap-3">
                        <button onclick="restoreTrashedProduct('${entry.trashId}')" class="text-green-600 underline font-semibold"> استرجاع</button>
                        <button onclick="permanentlyDeleteTrashedProduct('${entry.trashId}')" class="text-red-600 underline font-semibold"> حذف نهائي</button>
                    </div>
                </div>
            `).join('');
    }

    if (invoicesContainer) {
        invoicesContainer.innerHTML = trashedInvoices.length === 0
            ? emptyHtml('لا يوجد فواتير تجار محذوفة')
            : trashedInvoices.slice().reverse().map(entry => `
                <div class="bg-gray-50 rounded-xl p-4 shadow-sm flex flex-wrap justify-between items-center gap-3">
                    <div>
                        <div class="font-semibold">${entry.data.customer} <span class="text-blue-600 font-bold">(${Number(entry.data.total || 0).toFixed(2)} جنيه)</span></div>
                        <div class="text-xs text-gray-500 mt-1">اتحذفت بتاريخ: ${formatTrashDate(entry.deletedAt)}</div>
                        <div class="text-xs text-amber-600 mt-1">هتتحذف نهائي تلقائيًا خلال ${trashDaysLeft(entry.deletedAt)} يوم</div>
                    </div>
                    <div class="flex items-center gap-3">
                        <button onclick="restoreTrashedInvoice('${entry.trashId}')" class="text-green-600 underline font-semibold"> استرجاع</button>
                        <button onclick="permanentlyDeleteTrashedInvoice('${entry.trashId}')" class="text-red-600 underline font-semibold"> حذف نهائي</button>
                    </div>
                </div>
            `).join('');
    }

    if (retailContainer) {
        retailContainer.innerHTML = trashedRetailInvoices.length === 0
            ? emptyHtml('لا يوجد فواتير قطاعي محذوفة')
            : trashedRetailInvoices.slice().reverse().map(entry => `
                <div class="bg-gray-50 rounded-xl p-4 shadow-sm flex flex-wrap justify-between items-center gap-3">
                    <div>
                        <div class="font-semibold">${entry.data.customer} <span class="text-rose-600 font-bold">(${Number(entry.data.total || 0).toFixed(2)} جنيه)</span></div>
                        <div class="text-xs text-gray-500 mt-1">اتحذفت بتاريخ: ${formatTrashDate(entry.deletedAt)}</div>
                        <div class="text-xs text-amber-600 mt-1">هتتحذف نهائي تلقائيًا خلال ${trashDaysLeft(entry.deletedAt)} يوم</div>
                    </div>
                    <div class="flex items-center gap-3">
                        <button onclick="restoreTrashedRetailInvoice('${entry.trashId}')" class="text-green-600 underline font-semibold"> استرجاع</button>
                        <button onclick="permanentlyDeleteTrashedRetailInvoice('${entry.trashId}')" class="text-red-600 underline font-semibold"> حذف نهائي</button>
                    </div>
                </div>
            `).join('');
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
    container.innerHTML = '<option value="">كل الشركات</option>';

    companiesList.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.label;
        container.appendChild(opt);
    });

    updateProductsCompanyFilterActiveState();
}

function updateProductsCompanyFilterActiveState() {
    const container = document.getElementById('products-company-filter');
    if (!container) return;
    container.value = productsSelectedCompany || '';
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

// ==================== قوائم "المزيد" المنسدلة الصغيرة (تصميم فقط - لا تغيّر أي منطق) ====================
function closeAllMenus() {
    document.querySelectorAll('[data-open-menu="true"]').forEach(el => {
        el.classList.add('hidden');
        el.removeAttribute('data-open-menu');
    });
}
function toggleMenu(menuId) {
    const menu = document.getElementById(menuId);
    if (!menu) return;
    const wasOpen = menu.getAttribute('data-open-menu') === 'true';
    closeAllMenus();
    if (!wasOpen) {
        menu.classList.remove('hidden');
        menu.setAttribute('data-open-menu', 'true');
    }
}
document.addEventListener('click', function (e) {
    if (e.target.closest('[data-open-menu="true"]')) return;
    if (e.target.closest('button') && e.target.closest('button').getAttribute('onclick') && e.target.closest('button').getAttribute('onclick').includes('toggleMenu')) return;
    closeAllMenus();
});

// ==================== إظهار/إخفاء تفاصيل كارت المنتج (Progressive disclosure) ====================
function toggleProductDetails(id) {
    const details = document.getElementById('product-details-' + id);
    const btn = document.getElementById('toggle-btn-' + id);
    if (!details) return;
    const isHidden = details.classList.contains('hidden');
    details.classList.toggle('hidden');
    if (btn) btn.textContent = isHidden ? 'إخفاء التفاصيل' : 'عرض التفاصيل';
}

// ==================== عرض المنتجات (بعد التحديث) ====================
// ==================== إظهار/إخفاء السعر الأصلي لصف مقاس معين (مخفي افتراضيًا) ====================
async function toggleOriginalPriceCell(btn) {
    const wrapper = btn.parentElement;
    if (!wrapper) return;
    const maskEl = wrapper.querySelector('.hidden-price-mask');
    const valueEl = wrapper.querySelector('.hidden-price-value');
    if (!maskEl || !valueEl) return;
    const isHidden = valueEl.classList.contains('hidden');
    // الإظهار محتاج كلمة السر، أما الإخفاء فمسموح لأي حد
    if (isHidden && !(await requireSecret('عشان تشوفي السعر الأصلي اكتبي كلمة السر:'))) return;
    maskEl.classList.toggle('hidden', isHidden);
    valueEl.classList.toggle('hidden', !isHidden);
    btn.textContent = isHidden ? '' : '';
}

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
                <div class="text-6xl mb-4"></div>
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
            const originalPrice = Number(variant.originalPrice);
            const originalPriceDisplay = isNaN(originalPrice) ? '0.00' : originalPrice.toFixed(2);
            const stock = Number(variant.stock) || 0;
            const threshold = Number(variant.alertThreshold) || 0;
            const hasStockInfo = variant.stock !== undefined && variant.stock !== null && variant.stock !== '';
            const isLowStock = hasStockInfo && threshold > 0 && stock <= threshold;

            rowsHTML += `
                <tr class="hover:bg-gray-50 transition-colors ${isLowStock ? 'bg-rose-50' : ''}">
                    <td class="px-4 py-3 text-right font-medium">${variant.size || 'غير محدد'}</td>
                    <td class="px-4 py-3 text-center font-bold text-blue-700">${priceDisplay} <span class="text-sm text-gray-500">ج.م</span></td>
                    <td class="px-4 py-3 text-center no-print">
                        <div class="flex items-center justify-center gap-2">
                            <span class="hidden-price-mask font-semibold text-slate-400 select-none">••••</span>
                            <span class="hidden-price-value hidden font-semibold text-slate-600">${originalPriceDisplay} <span class="text-xs text-gray-400">ج.م</span></span>
                            <button type="button" onclick="toggleOriginalPriceCell(this)" title="إظهار/إخفاء السعر الأصلي" class="icon-btn-sm">${icon('eye')}</button>
                        </div>
                    </td>
                    <td class="px-4 py-3 text-center">${hasStockInfo ? stock : '—'}</td>
                    <td class="px-4 py-3 text-center">
                        ${isLowStock ? `<span class="badge bg-rose-100 text-rose-700"> الكمية قليلة (متبقي ${stock})</span>` : ''}
                    </td>
                </tr>
            `;
        });

        let companyBadges = '';
        if (Array.isArray(product.companies) && product.companies.length > 0) {
            companyBadges = product.companies.map(c => {
                const label = getCompanyLabel(c);
                return `<span class="badge bg-brand-50 text-brand-700">${label}</span>`;
            }).join(' ');
        }

        const productLowCount = product.variants.filter(v => {
            const hasStockInfo = v.stock !== undefined && v.stock !== null && v.stock !== '';
            const stock = Number(v.stock) || 0;
            const threshold = Number(v.alertThreshold) || 0;
            return hasStockInfo && threshold > 0 && stock <= threshold;
        }).length;
        const lowStockBadge = productLowCount > 0
            ? `<span class="badge bg-rose-100 text-rose-700"> ${productLowCount} كمية منخفضة</span>`
            : '';

        const card = document.createElement('div');
        card.className = 'card overflow-hidden';
        card.innerHTML = `
            <div class="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                <div class="flex items-center gap-3 min-w-0">
                    ${productThumbHtml(product)}
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap mb-1.5">
                            <h3 class="text-base sm:text-lg font-bold text-slate-900 truncate">${product.name}</h3>
                            ${companyBadges}
                        </div>
                        <div class="flex items-center gap-2 flex-wrap text-xs sm:text-sm text-slate-400">
                            <span>${product.variants.length} مقاس</span>
                            ${lowStockBadge}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button type="button" id="toggle-btn-${product.id}" onclick="toggleProductDetails(${product.id})" class="btn-secondary !py-2 !px-4 text-sm">عرض التفاصيل</button>
                    <div class="relative">
                        <button type="button" onclick="toggleMenu('product-menu-${product.id}')" class="btn-ghost !px-3" title="المزيد">⋯</button>
                        <div id="product-menu-${product.id}" class="hidden absolute left-0 mt-2 w-36 bg-white rounded-xl border border-slate-200 shadow-lifted z-20 py-1.5">
                            <button type="button" onclick="closeAllMenus(); editProduct(${product.id})" class="w-full text-right px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"> تعديل</button>
                            <button type="button" onclick="closeAllMenus(); deleteProduct(${product.id})" class="w-full text-right px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"> حذف</button>
                        </div>
                    </div>
                </div>
            </div>
            <div id="product-details-${product.id}" class="hidden overflow-x-auto border-t border-slate-100">
                <table class="table-modern">
                    <thead>
                        <tr>
                            <th class="text-right">المقاس</th>
                            <th class="text-center">السعر</th>
                            <th class="text-center no-print">السعر الأصلي</th>
                            <th class="text-center">الكمية بالمخزن</th>
                            <th class="text-center">تحذيرات</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">${rowsHTML}</tbody>
                </table>
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
        container.innerHTML = `<div class="text-center text-slate-400 py-6">مفيش شركات لسه، ضيف واحدة تحت </div>`;
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
            <button type="button" onclick="startRenameCompany('${c.id}')" class="btn-secondary !py-1.5 !px-3 text-xs shrink-0"> تعديل</button>
            <button type="button" onclick="deleteCompanyEntry('${c.id}')" class="btn-danger !py-1.5 !px-3 text-xs shrink-0"> حذف</button>
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
    if (!trimmed) return alert(' الاسم لا يمكن أن يكون فارغ');
    c.label = trimmed;
    saveCompanies();
    renderCompanyManagerList();
    renderProductsCompanyFilter();
    populateRetailCompanyFilter();
    populateInvoiceCompanyFilter();
    applyProductsFilter();
    showToast(' تم تعديل اسم الشركة', 'success');
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
    populateInvoiceCompanyFilter();
    applyProductsFilter();
    showToast(' تم حذف الشركة', 'error');
}

function addNewCompanyEntry() {
    const input = document.getElementById('new-company-name');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return alert(' اكتب اسم الشركة الجديدة');

    const id = 'c_' + Date.now();
    companiesList.push({ id, label: name });

    if (!Array.isArray(editingCompanies)) editingCompanies = [];
    editingCompanies.push(id);

    input.value = '';
    saveCompanies();
    renderCompanyManagerList();
    renderProductsCompanyFilter();
    populateRetailCompanyFilter();
    populateInvoiceCompanyFilter();
    showToast(' تم إضافة الشركة', 'success');
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
                <button onclick="removeVariant(${index})" class="w-9 h-9 flex items-center justify-center text-red-500 text-2xl hover:bg-red-100 rounded-xl shrink-0">×</button>
            </div>
            <div class="flex gap-3 items-center">
                <div class="flex-1">
                    <label class="text-xs text-slate-400 mb-1 block">السعر الأصلي</label>
                    ${isSecretUnlocked()
                        ? `<input type="number" step="0.01" min="0" placeholder="السعر الأصلي" value="${variant.originalPrice || ''}" oninput="updateVariantOriginalPrice(${index}, this.value)" class="w-full px-4 py-3 rounded-xl border focus:border-blue-400 text-lg text-center">`
                        : `<button type="button" onclick="unlockAndRender('variants')" class="w-full px-4 py-3 rounded-xl border border-dashed bg-slate-50 text-slate-400 text-sm font-semibold">🔒 محمي — اضغطي لإدخال كلمة السر</button>`}
                </div>
                <div class="flex-1">
                    <label class="text-xs text-slate-400 mb-1 block">السعر بعد المكسب</label>
                    <input type="number" step="0.01" min="0" placeholder="السعر بعد المكسب" value="${variant.price || ''}" oninput="updateVariantPrice(${index}, this.value)" class="w-full px-4 py-3 rounded-xl border focus:border-blue-400 text-lg text-center">
                </div>
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
function updateVariantOriginalPrice(index, value) { if (editingVariants[index]) editingVariants[index].originalPrice = parseFloat(value) || 0; }
function updateVariantStock(index, value) { if (editingVariants[index]) editingVariants[index].stock = parseFloat(value) || 0; }
function updateVariantAlert(index, value) { if (editingVariants[index]) editingVariants[index].alertThreshold = parseFloat(value) || 0; }

function addVariantRow() {
    editingVariants.push({ size: '', originalPrice: 0, price: 0, stock: 0, alertThreshold: 0 });
    renderVariantsInModal();
}

function removeVariant(index) {
    editingVariants.splice(index, 1);
    renderVariantsInModal();
}

function openAddProductModal() {
    editingProductId = null;
    editingProductImage = '';
    editingVariants = [];
    editingCompanies = [];                    //  جديد
    document.getElementById('modal-title').textContent = 'إضافة منتج جديد';
    document.getElementById('product-name').value = '';
    renderProductImagePreview();
    
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
    editingProductImage = getProductImage(id);
    renderProductImagePreview();
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

async function saveProduct() {
    const name = document.getElementById('product-name').value.trim();
    if (!name) return alert(' ضع اسم المنتج');

    if (!Array.isArray(editingVariants) || editingVariants.length === 0) 
        return alert(' لازم تضيف مقاس واحد على الأقل');

    const selectedCompanies = Array.isArray(editingCompanies) ? [...editingCompanies] : [];

    if (selectedCompanies.length === 0)
        return alert(' لازم تختار شركة واحدة على الأقل للمنتج قبل الحفظ');

    const cleanVariants = editingVariants
        .filter(v => (v.size || '').trim() !== '' && parseFloat(v.price) > 0)
        .map(v => ({
            size: v.size.trim(),
            originalPrice: parseFloat(v.originalPrice) || 0,
            price: parseFloat(v.price),
            stock: parseFloat(v.stock) || 0,
            alertThreshold: parseFloat(v.alertThreshold) || 0
        }));

    if (cleanVariants.length === 0) return alert(' تأكد إن كل مقاس له اسم وسعر صحيح');

    // ==== حماية السعر الأصلي وقت الحفظ نفسه ====
    // حتى لو الشاشة كانت متفتحة (خلال الـ 100 ثانية) وحد غيّر في السعر الأصلي،
    // الحفظ نفسه مش هيتم إلا لو كتب كلمة السر دلوقتي بالظبط.
    if (editingProductId !== null) {
        const existingProduct = products.find(p => p.id === editingProductId);
        const originalPriceChanged = !!existingProduct && cleanVariants.some(v => {
            const oldVariant = (existingProduct.variants || []).find(ov => ov.size === v.size);
            const oldPrice = oldVariant ? (Number(oldVariant.originalPrice) || 0) : 0;
            return Math.abs(oldPrice - (Number(v.originalPrice) || 0)) > 0.001;
        });
        if (originalPriceChanged && !(await requireSecret('السعر الأصلي اتغيّر — لازم كلمة السر عشان يتحفظ التعديل:'))) {
            return; // الباسورد غلط أو اتلغى — الحفظ مبيحصلش خالص والمنتج بيفضل زي ما كان
        }
    }

    let savedProductId = editingProductId;

    if (editingProductId !== null) {
        const index = products.findIndex(p => p.id === editingProductId);
        if (index !== -1) {
            products[index].name = name;
            products[index].variants = cleanVariants;
            products[index].companies = selectedCompanies;
        }
    } else {
        savedProductId = Date.now();
        products.push({ 
            id: savedProductId, 
            name, 
            variants: cleanVariants,
            companies: selectedCompanies
        });
    }

    // الصورة اختيارية: بتتحفظ لو اترفعت، وبتتمسح لو المستخدمة شالتها
    if (savedProductId !== null && savedProductId !== undefined) {
        persistProductImage(savedProductId);
    }

    saveProducts();           //  Firebase
    applyProductsFilter();
    populateProductDatalist();
    closeModal();

    showToast(editingProductId !== null ? ' تم تعديل المنتج' : ' تم إضافة المنتج بنجاح', 'success');
}

function deleteProduct(id) {
    if (!confirm('هل أنت متأكد من حذف المنتج ده؟ (هينتقل لسلة المحذوفات ولو محدش رجّعه هيتحذف نهائي بعد 30 يوم)')) return;
    const product = products.find(p => p.id === id);
    if (!product) return;
    products = products.filter(p => p.id !== id);
    trashedProducts.push({ trashId: makeTrashId(), deletedAt: Date.now(), data: JSON.parse(JSON.stringify(product)) });
    saveProducts();           //  Firebase
    saveTrash();
    applyProductsFilter();
    populateProductDatalist();
    renderTrash();
    showToast(' تم نقل المنتج لسلة المحذوفات', 'error');
}

// ==================== الفاتورة ====================
function populateProductDatalist(companyId = '') {
    const dl = document.getElementById('products-datalist');
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

// ==================== فاتورة الجملة - اختيار الشركة (لتمييز المنتجات المتشابهة بالاسم) ====================
function populateInvoiceCompanyFilter() {
    const select = document.getElementById('invoice-company-filter');
    if (!select) return;

    const previousValue = select.value || invoiceSelectedCompany;
    select.innerHTML = '<option value="">كل الشركات</option>';
    companiesList.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.label;
        select.appendChild(opt);
    });
    select.value = previousValue || '';
}

function handleInvoiceCompanyChange() {
    const select = document.getElementById('invoice-company-filter');
    invoiceSelectedCompany = select ? select.value : '';

    // تصفير حقل المنتج والمقاس عند تغيير الشركة عشان منجيبش سعر شركة تانية بالغلط
    const productInput = document.getElementById('product-search');
    if (productInput) productInput.value = '';
    const sizeSelect = document.getElementById('size-select');
    if (sizeSelect) sizeSelect.innerHTML = '<option value="">اختر المقاس...</option>';
    const priceDisplay = document.getElementById('price-display');
    if (priceDisplay) priceDisplay.textContent = '0';
    updateInvoiceStockDisplay();

    populateProductDatalist(invoiceSelectedCompany);
}

function updatePriceDisplay() {
    const productInput = document.getElementById('product-search');
    const sizeSelect = document.getElementById('size-select');
    const priceDisplay = document.getElementById('price-display');
    if (!productInput || !sizeSelect || !priceDisplay) return;

    updateInvoiceStockDisplay();   // الكمية المتاحة في المخزن (للشاشة بس)

    const productName = productInput.value.trim();
    const size = sizeSelect.value;
    if (!productName || !size) {
        priceDisplay.textContent = '0';
        return;
    }

    const product = findProductByNameAndCompany(productName, invoiceSelectedCompany);
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

    if (!productName) return alert(' اختر المنتج');
    if (!size) return alert(' اختر المقاس');
    if (qty < 1) return alert(' الكمية غلط');

    const product = findProductByNameAndCompany(productName, invoiceSelectedCompany);
    if (!product) return alert(' المنتج غير موجود');

    const variant = product.variants.find(v => v.size === size);
    if (!variant) return alert(' المقاس غير موجود');

    currentInvoice.push({
        id: Date.now(),
        productName: product.name,
        size: size,
        price: variant.price,
        qty: qty,
        subtotal: variant.price * qty,
        company: invoiceSelectedCompany || (Array.isArray(product.companies) ? product.companies[0] : '')
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
            <td class="py-5 px-6 text-center no-print text-slate-400 text-sm">${getCompanyLabel(item.company)}</td>
            <td class="py-5 px-6 text-center text-lg">${item.size}</td>
            <td class="py-5 px-6 text-center">${item.price}</td>
            <td class="py-5 px-6 text-center text-lg font-medium">${item.qty}</td>
            <td class="py-5 px-6 text-center no-print">${stockBadgeHtml(item)}</td>
            <td class="py-5 px-6 text-center font-bold">${item.subtotal}</td>
            <td class="py-5 px-6 text-center no-print">
                <button onclick="removeFromInvoice(${index})" class="icon-btn-sm !text-[var(--danger)]">${icon('trash')}</button>
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
        const total = getNetTotal(inv);   // الصافي بعد المرتجعات
        const paid = Number(inv.paid) || 0;
        runningDebt = Math.max(0, (total + runningDebt) - paid);   // مهم: Math.max(0, ...)
    }

    return runningDebt;
}
// ==================== تحديث الإجمالي والمتبقي (النسخة الصحيحة) ====================
function updateTotalAndRemaining() {
    const rawTotal = currentInvoice.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const discount = computeDiscountAmount('invoice', rawTotal);
    const currentTotal = Math.max(0, rawTotal - discount);
    const paid = parseFloat(document.getElementById("paid-input")?.value || 0) || 0;
    const customerName = document.getElementById('customer-name').value.trim();

    const previousDebt = getCustomerPreviousDebt(customerName, editingInvoiceIndex);

    const grandTotal = currentTotal + previousDebt;
    let remaining = grandTotal - paid;

    // عرض
    document.getElementById('total-display').textContent = currentTotal.toFixed(2) + (discount > 0 ? ` (بعد خصم ${discount.toFixed(2)})` : '');
    document.getElementById('total-input').value = grandTotal.toFixed(2);

    const remainingEl = document.getElementById('remaining-input');
    if (remainingEl) {
        remainingEl.value = Math.max(0, remaining).toFixed(2);
        remainingEl.style.color = remaining > 0 ? "#dc2626" : "#16a34a";
    }

    return { 
        currentTotal, 
        rawTotal,
        discount,
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
        return alert(' الفاتورة فاضية!');

    const { currentTotal, discount } = updateTotalAndRemaining();

    const oldInvoice = editingInvoiceIndex !== null ? savedInvoices[editingInvoiceIndex] : null;

    const invoice = {
        customer,
        items: JSON.parse(JSON.stringify(currentInvoice)),
        total: Number(currentTotal.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        paid: parseFloat(document.getElementById("paid-input").value) || 0,
        date: (editingInvoiceIndex !== null && savedInvoices[editingInvoiceIndex])
        ? savedInvoices[editingInvoiceIndex].date
        : Date.now()
    };

    // سجل المرتجعات بتاع الفاتورة بيفضل زي ما هو حتى لو الفاتورة اتعدلت
    if (editingInvoiceIndex !== null && savedInvoices[editingInvoiceIndex] && Array.isArray(savedInvoices[editingInvoiceIndex].returns)) {
        invoice.returns = JSON.parse(JSON.stringify(savedInvoices[editingInvoiceIndex].returns));
    }

    // المخزون: الفاتورة الجديدة بتتحفظ "لسه متخصمتش"، والخصم بيتم بزرار "تم التسليم" بس.
    if (editingInvoiceIndex !== null) {
        const oldState = getInvoiceStockState(oldInvoice, 'invoice');
        if (oldState === 'deducted') {
            // فاتورة اتسلّمت واتخصمت قبل كده وبتتعدل: نظبط المخزن على فرق الكميات بس
            adjustStockForItems(getStockItemsForInvoice(oldInvoice), +1);
            invoice.stockDeducted = true;
            if (oldInvoice.stockDeductedAt) invoice.stockDeductedAt = oldInvoice.stockDeductedAt;
            savedInvoices[editingInvoiceIndex] = invoice;
            adjustStockForItems(getStockItemsForInvoice(invoice), -1);
        } else {
            if (oldState === 'pending') invoice.stockDeducted = false;   // 'untracked' (فاتورة قديمة) بتفضل من غير علامة
            savedInvoices[editingInvoiceIndex] = invoice;
        }
    } else {
        invoice.stockDeducted = false;
        savedInvoices.push(invoice);
    }

    recalculateAllInvoicesForCustomer(customer);
    saveAllInvoices();        //  Firebase

    // تصفير
    currentInvoice = [];
    editingInvoiceIndex = null;
    renderInvoiceTable();
    updateTotalAndRemaining();

    if (customerInput) customerInput.value = '';
    document.getElementById('paid-input').value = '0';
    document.getElementById('remaining-input').value = '0';
    const discountInputAfterSave = document.getElementById('discount-input');
    if (discountInputAfterSave) discountInputAfterSave.value = '0';
    const discountTypeAfterSave = document.getElementById('discount-type');
    if (discountTypeAfterSave) discountTypeAfterSave.value = 'amount';
    const discountHintAfterSave = document.getElementById('discount-hint');
    if (discountHintAfterSave) discountHintAfterSave.textContent = '';

    updateInvoiceHeader();
    renderSavedInvoices();

    setTimeout(() => getAllUniqueCustomers(), 100);

    showToast(' تم حفظ الفاتورة بنجاح', 'success');
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

        const currentTotal = getNetTotal(inv);   // الصافي بعد المرتجعات
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


// ==================== كارت الفاتورة المحفوظة (نسخة واحدة تُستخدم في العرض العادي وفي البحث) ====================
function buildInvoiceCardHTML(inv, index) {
    const dateObj = new Date(inv.date);
    const formattedDate = dateObj.toLocaleDateString('ar-EG', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const formattedTime = dateObj.toLocaleTimeString('ar-EG', {
        hour: '2-digit', minute: '2-digit'
    });

    const currentTotal = getNetTotal(inv);           // الصافي بعد المرتجعات
    const previousDebt = getCustomerPreviousDebt(inv.customer, index);
    const grandTotal = currentTotal + previousDebt;
    const paid = Number(inv.paid) || 0;
    const remaining = grandTotal - paid;

    return `
            <div class="flex justify-between items-center mb-3">
                <div class="font-semibold">${inv.customer}</div>
                <div class="text-gray-500 text-sm">${formattedDate} - ${formattedTime}</div>
            </div>

            ${stockStatusBlockHtml(inv, 'invoice', index)}

            <button onclick="toggleInvoiceDetails(${index})"
                    class="text-blue-600 underline mb-3">
                عرض المنتجات
            </button>

            <div id="invoice-details-${index}" class="hidden">

                <!-- جدول المنتجات (زي ما هو من غير أي تعديل) -->
                <table class="w-full text-right border-collapse mb-4">
                    <thead class="bg-gray-200">
                        <tr>
                            <th class="py-2 px-4 text-right">المنتج</th>
                            <th class="py-2 px-4 no-print">الشركة</th>
                            <th class="py-2 px-4">المقاس</th>
                            <th class="py-2 px-4">السعر</th>
                            <th class="py-2 px-4">الكمية</th>
                            <th class="py-2 px-4">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(inv.items || []).map(item => `
                            <tr class="border-b">
                                <td class="py-2 px-4 text-right">${item.productName}</td>
                                <td class="py-2 px-4 text-center no-print text-slate-400 text-sm">${getCompanyLabel(item.company)}</td>
                                <td class="py-2 px-4 text-center">${item.size}</td>
                                <td class="py-2 px-4 text-center">${item.price}</td>
                                <td class="py-2 px-4 text-center">${item.qty}</td>
                                <td class="py-2 px-4 text-center font-bold">${item.subtotal}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <!-- سجل المرتجعات (بيظهر لوحده تحت الفاتورة وبس لما يكون فيه إرجاع) -->
                ${returnsSectionHtml('invoice', index, inv)}

                <!-- المبالغ -->
                <div class="bg-white rounded-2xl p-5 shadow-sm">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                        <div>
                            <div class="text-xs text-gray-500 mb-1">${getReturnsTotal(inv) > 0 ? 'صافي الفاتورة بعد المرتجعات' : 'إجمالي الفاتورة الجديدة'}</div>
                            <div class="text-2xl font-bold text-blue-600">
                                ${currentTotal.toFixed(2)} جنيه
                            </div>
                            ${Number(inv.discount) > 0 ? `<div class="text-xs text-amber-600 mt-1">(بعد خصم ${Number(inv.discount).toFixed(2)} جنيه)</div>` : ''}
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
                <div class="inv-actions no-print">
                    ${stockUndoButtonHtml(inv, 'invoice', index)}
                    <button onclick="openReturnsModal('invoice', ${index})" class="inv-act inv-act-purple">↩ مرتجع</button>
                    <button onclick="printSavedInvoice(${index})" class="inv-act inv-act-blue">🖨 طباعة</button>
                    <button onclick="editSavedInvoice(${index})" class="inv-act inv-act-amber">✎ تعديل</button>
                    <button onclick="deleteSavedInvoice(${index})" class="inv-act inv-act-red">🗑 حذف</button>
                </div>

            </div>
    `;
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
        const card = document.createElement('div');
        card.className = 'bg-gray-50 rounded-xl p-4 shadow-sm';
        card.innerHTML = buildInvoiceCardHTML(inv, index);
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

        const card = document.createElement('div');
        card.className = 'bg-gray-50 rounded-xl p-4 shadow-sm';
        card.innerHTML = buildInvoiceCardHTML(inv, realIndex);
        container.appendChild(card);
    });
}

function deleteSavedInvoice(index) {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟ (هتتنقل لسلة المحذوفات ولو محدش رجّعها هتتحذف نهائي بعد 30 يوم)')) return;
    const invoice = savedInvoices[index];
    if (!invoice) return;
    // لو الفاتورة كانت اتخصمت من المخزن، الكميات ترجع لما تتحذف
    if (getInvoiceStockState(invoice, 'invoice') === 'deducted') adjustStockForItems(getStockItemsForInvoice(invoice), +1);
    savedInvoices.splice(index, 1);
    trashedInvoices.push({ trashId: makeTrashId(), deletedAt: Date.now(), data: JSON.parse(JSON.stringify(invoice)) });
    saveAllInvoices();        //  Firebase
    saveTrash();
    renderSavedInvoices();
    renderTrash();
    showToast(' تم نقل الفاتورة لسلة المحذوفات', 'error');
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

    setDiscountFieldsFromSaved('invoice', invoice.discount);

    renderInvoiceTable();
    updateTotalAndRemaining();
    updateInvoiceHeader();

    showSection('invoice');

    showToast(' جاري تعديل الفاتورة...', 'warning');
}

async function printSavedInvoice(index) {
    const inv = savedInvoices[index];
    if (!inv) return;

    const dateObj = new Date(inv.date);
    const formattedDate = dateObj.toLocaleDateString('ar-EG', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const formattedTime = dateObj.toLocaleTimeString('ar-EG', { 
        hour: '2-digit', minute: '2-digit' 
    });

    const currentTotal = getNetTotal(inv);   // الصافي بعد المرتجعات
    const previousDebt = getCustomerPreviousDebt(inv.customer, index);
    const grandTotal = currentTotal + previousDebt;
    const paid = Number(inv.paid) || 0;
    const remaining = grandTotal - paid;

    const fbQr = await ensureFacebookQr();

    const html = `
        <html dir="rtl" lang="ar">
        <head>
            <title>فاتورة متجري - ${inv.customer}</title>
            <style>
                body { 
                    font-family: 'Cairo', Arial, sans-serif; 
                    padding: 30px; 
                    line-height: 1.6;
                    font-size: 15px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #1E3A5F;
                    padding-bottom: 15px;
                }
                .shop-name {
                    font-size: 26px;
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
                    padding: 9px;
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
                .section-title { margin-top: 30px; color: #6D28D9; font-size: 18px; }
                .summary-card {
                    margin-top: 28px; border: 2px solid #1E3A5F; border-radius: 10px;
                    overflow: hidden; background: #fff;
                }
                .summary-row {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 9px 18px; border-bottom: 1px solid #E5E7EB; font-size: 15px; color: #374151;
                }
                .summary-row:last-child { border-bottom: none; }
                .summary-row.strong { font-weight: 700; color: #111827; background: #F9FAFB; }
                .summary-row .red { font-weight: 700; color: #dc2626; }
                .summary-row .green { font-weight: 700; color: #16a34a; }
                .summary-row.final {
                    padding: 14px 18px; font-size: 17px; font-weight: 800;
                    border-top: 2px solid #1E3A5F;
                }
                .summary-row.final span:last-child { font-size: 20px; }
                .summary-row.final.due { background: #FEF2F2; color: #b91c1c; }
                .summary-row.final.clear { background: #F0FDF4; color: #15803d; }
                .summary-note { padding: 6px 18px 12px; font-size: 12.5px; color: #92400E; text-align: center; }
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

            ${returnsPrintHtml(inv)}

            ${printSummaryCardHtml({
                gross: getGrossTotal(inv), returnsTotal: getReturnsTotal(inv), net: currentTotal,
                discount: Number(inv.discount) || 0, previousDebt, grandTotal, paid, remaining,
                settled: !!inv.settled
            })}

            <div style="margin-top: 40px; text-align: center; color: #666;">
                شكرًا لتعاملك مع مصطفى الازهرى للادوات الصحية<br>
                برجاء الاحتفاظ بالفاتورة
            </div>
            ${shopPrintFooterHtml(fbQr, '#1E3A5F')}
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
    const debtsSection     = document.getElementById('debts-section');
    const trashSection     = document.getElementById('trash-section');

    const btnProducts = document.getElementById('btn-products');
    const btnInvoice  = document.getElementById('btn-invoice');
    const btnRetail   = document.getElementById('btn-retail');
    const btnDebts    = document.getElementById('btn-debts');
    const btnTrash    = document.getElementById('btn-trash');

    // إخفاء كل الأقسام
    if (productsSection) productsSection.classList.add('hidden');
    if (invoiceSection)  invoiceSection.classList.add('hidden');
    if (retailSection)   retailSection.classList.add('hidden');
    if (debtsSection)    debtsSection.classList.add('hidden');
    if (trashSection)    trashSection.classList.add('hidden');

    // إزالة التنسيق النشط من كل الأزرار
    if (btnProducts) btnProducts.classList.remove('border-b-4', 'border-blue-600', 'text-blue-600');
    if (btnInvoice)  btnInvoice.classList.remove('border-b-4', 'border-blue-600', 'text-blue-600');
    if (btnRetail)   btnRetail.classList.remove('border-b-4', 'border-green-600', 'text-green-600');
    if (btnDebts)     btnDebts.classList.remove('border-b-4', 'border-red-600', 'text-red-600');
    if (btnTrash)    btnTrash.classList.remove('border-b-4', 'border-slate-600', 'text-slate-700');

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
        populateRetailCompanyFilter();
    populateInvoiceCompanyFilter();       // اختيار الشركة
        populateRetailProductDatalist(retailSelectedCompany); // للبحث عن المنتجات
        toggleRetailAdjustmentUI();          // إظهار/إخفاء نوع تعديل السعر المناسب
        updateRetailInvoiceHeader();         // عرض اسم العميل + الدين السابق

    } else if (section === 'debts') {
        if (debtsSection) debtsSection.classList.remove('hidden');
        if (btnDebts) btnDebts.classList.add('border-b-4', 'border-red-600', 'text-red-600');
        renderDebtsList();

    } else if (section === 'trash') {
        if (trashSection) trashSection.classList.remove('hidden');
        if (btnTrash) btnTrash.classList.add('border-b-4', 'border-slate-600', 'text-slate-700');
        purgeExpiredTrash(); // ينضف أي حاجة عدّى عليها 30 يوم قبل ما نعرض السلة
    }
}

function handleProductSearch(val) {
    const sizeSelect = document.getElementById('size-select');
    if (!sizeSelect) return;
    sizeSelect.innerHTML = '<option value="">اختر المقاس...</option>';

    const product = findProductByNameAndCompany(val, invoiceSelectedCompany);
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
    populateInvoiceCompanyFilter();
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
                refreshAllStockViews();
            }
        });

    // الاستماع لصور المنتجات
    db.collection("appData").doc("productImages")
        .onSnapshot((doc) => {
            if (doc.exists) {
                productImages = doc.data().images || {};
                applyProductsFilter();
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

    // الاستماع لسلة المحذوفات
    db.collection("appData").doc("trash")
        .onSnapshot((doc) => {
            if (doc.exists) {
                trashedProducts = doc.data().trashedProducts || [];
                trashedInvoices = doc.data().trashedInvoices || [];
                trashedRetailInvoices = doc.data().trashedRetailInvoices || [];
                renderTrash();
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
    await loadProductImages();
    await loadProducts();
    await loadSavedInvoices();
    
    // أضف تحميل فواتير القطاعي هنا أيضًا
    await loadRetailInvoices();        //  أضف هذا السطر

    // تحميل سلة المحذوفات (وتنضيف أي حاجة عدّى عليها 30 يوم)
    await loadTrash();

    renderProductsCompanyFilter();     //  أزرار تصفية منتجاتنا حسب الشركة
    applyProductsFilter();
    populateProductDatalist();
    renderSavedInvoices();
    renderRetailInvoices();            //  أضف هذا أيضًا

    populateRetailCompanyFilter();
    populateInvoiceCompanyFilter();
    populateRetailProductDatalist(retailSelectedCompany);
    toggleRetailAdjustmentUI();

    setupCustomerAutocomplete();
    setupRetailCustomerAutocomplete();

    listenToDataChanges();
    showSection('dashboard');

    console.log(" التطبيق بدأ بنجاح مع Firebase");
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

// بياخد تكلفة المنتج وقت البيع: بيفضل "السعر الأصلي" (originalPrice) المسجل وقت إضافة المنتج
// للفاتورة، ولو مش موجود (فواتير قديمة قبل إضافة الخانة دي) بيرجع لنظام السعر الأساسي القديم
// عشان أرقام المكسب القديمة متتغيرش فجأة.
function getRetailItemCost(item) {
    // لو السعر الأصلي متسجل فعلاً وأكبر من صفر، استخدمه.
    // لو مش متسجل، أو متسجل بصفر (يعني المستخدم مادخلش سعر أصلي خالص)، ارجع للسعر
    // الأساسي (السعر بعد المكسب اللي متسجل على المنتج قبل أي زيادة إضافية وقت البيع)
    // عشان المكسب يتحسب من فرق النسبة بس، مش من السعر كله.
    const original = Number(item.originalPrice) || 0;
    if (item.originalPrice !== undefined && item.originalPrice !== null && item.originalPrice !== '' && original > 0) {
        return original;
    }
    return Number(item.basePrice ?? item.price) || 0;
}

// بيحسب مكسب فاتورة واحدة، مستبعدًا منتجات "البحر الأحمر" زي حساب المكسب العام بالظبط
function computeRetailInvoiceProfit(items) {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => {
        if (item.company === 'redsea') return sum; // استبعاد البحر الأحمر من المكسب
        const cost = getRetailItemCost(item);
        const price = Number(item.price) || 0;
        const qty = Number(item.qty) || 0;
        return sum + (price - cost) * qty;
    }, 0);
}

// ==================== المكسب الفعلي للفاتورة: خصم أثر الخصم + أثر "خالصة" اليدوية ====================
// 1) لو في خصم على الفاتورة (discount)، ده مبلغ فعليًا اتنازلنا عنه من إجمالي البيع، فلازم
//    ينزل من المكسب بنفس قيمته (مش يفضل زي ما لو اتباع بالسعر الكامل).
// 2) لو الفاتورة اتحطت "خالصة" والمدفوع أقل من إجمالي الفاتورة (بعد الخصم أصلاً)، يبقى
//    الفرق ده كمان بيتخصم من المكسب. مثال: فاتورة إجمالي 110، مكسبها 30، اتدفع منها 100
//    بس، وبعدين اتحطت خالصة  الفرق (10) بينزل من المكسب فيبقى 20.
// لو رجعنا وألغينا "خالصة" أو شلنا الخصم، المكسب يرجع زي ما كان من غير خصم.
// فاتورة أغلب منتجاتها "بحر أحمر": الخصم و"اعتبارها خالصة" ميتخصموش من المكسب.
// المقارنة بعدد المنتجات (كل منتج+مقاس بيتعد مرة واحدة) مش بالكميات:
//   منتجات البحر الأحمر أكتر من باقي المنتجات (أو الفاتورة كلها بحر أحمر) → الخصم/خالصة ميأثروش على المكسب
//   غير كده (أقل أو متساوية) → الخصم/خالصة بينزلوا من المكسب عادي
function isRedSeaMajorityInvoice(inv) {
    if (!inv || !Array.isArray(inv.items)) return false;
    const red = new Set(), other = new Set();
    inv.items.forEach(item => {
        const key = itemReturnKey(item);
        (item.company === 'redsea' ? red : other).add(key);
    });
    return red.size > other.size;
}

function computeRetailInvoiceProfitAdjusted(inv) {
    if (!inv) return 0;
    let profit = computeRetailInvoiceProfit(inv.items);
    if (isRedSeaMajorityInvoice(inv)) return profit;   // من غير خصم ولا أثر "خالصة"

    const discount = Number(inv.discount) || 0;
    if (discount > 0) profit -= discount;

    if (inv.settled) {
        const total = Number(inv.total) || 0; // ده أصلاً بعد خصم الفاتورة
        const paid = Number(inv.paid) || 0;
        const shortfall = Math.max(0, total - paid); // المتبقي على الفاتورة نفسها بس (من غير دين سابق)
        profit -= shortfall;
    }
    return profit;
}

// ==================== المكسب: حساب الفرق بين السعر الأصلي والسعر المباع بيه (زيادات + تعديلات "تحكم") ====================
// بيرجع تاريخ اليوم بصيغة YYYY-MM-DD حسب توقيت الجهاز (مش UTC) عشان يتوافق مع input type=date
function toLocalDateKey(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// بيجمع مكسب كل عناصر كل الفواتير القطاعي (القديمة والجديدة) في خريطة باليوم
// ملحوظة: منتجات "البحر الأحمر" مستبعدة تمامًا من حساب المكسب بناءً على طلب المستخدم
function buildRetailProfitByDay() {
    const map = {}; // { 'YYYY-MM-DD': profitAmount }
    savedRetailInvoices.forEach(inv => {
        if (!Array.isArray(inv.items)) return;
        inv.items.forEach(item => {
            if (item.company === 'redsea') return; // استبعاد البحر الأحمر
            const cost = getRetailItemCost(item);
            const price = Number(item.price) || 0;
            const qty = Number(item.qty) || 0;
            const profit = (price - cost) * qty;
            if (!profit) return;
            const ts = Number(item.addedAt) || Number(inv.date) || Date.now();
            const key = toLocalDateKey(ts);
            map[key] = (map[key] || 0) + profit;
        });

        // فاتورة أغلب منتجاتها بحر أحمر: الخصم و"خالصة" ميأثروش على المكسب
        if (isRedSeaMajorityInvoice(inv)) return;

        const invDateKey = toLocalDateKey(Number(inv.date) || Date.now());

        // خصم أثر الخصم (discount) على الفاتورة من مكسب يوم الفاتورة
        const discount = Number(inv.discount) || 0;
        if (discount > 0) {
            map[invDateKey] = (map[invDateKey] || 0) - discount;
        }

        // خصم أثر "خالصة" اليدوية: أي مبلغ اتنازلنا عنه في فاتورة اتحطت خالصة بينزل من
        // مكسب يوم الفاتورة (نفس المنطق المستخدم في computeRetailInvoiceProfitAdjusted)
        if (inv.settled) {
            const total = Number(inv.total) || 0;
            const paid = Number(inv.paid) || 0;
            const shortfall = Math.max(0, total - paid);
            if (shortfall > 0) {
                map[invDateKey] = (map[invDateKey] || 0) - shortfall;
            }
        }
    });
    return map;
}

window.openProfitModal = async function() {
    if (!(await requireSecret('تقرير الأرباح محميّ — اكتبي كلمة السر:'))) return;
    const dateInput = document.getElementById('profit-date-input');
    if (dateInput && !dateInput.value) {
        dateInput.value = toLocalDateKey(Date.now());
    }
    renderProfitModal();
    const modal = document.getElementById('profit-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeProfitModal = function() {
    const modal = document.getElementById('profit-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

window.renderProfitModal = function() {
    const dateInput = document.getElementById('profit-date-input');
    if (!dateInput) return;
    const selected = dateInput.value ? new Date(dateInput.value + 'T00:00:00') : new Date();
    const selectedKey = toLocalDateKey(selected.getTime());
    const selectedYear = selected.getFullYear();
    const selectedMonth = selected.getMonth();

    const profitByDay = buildRetailProfitByDay();

    let dayProfit = 0, monthProfit = 0, yearProfit = 0;
    Object.entries(profitByDay).forEach(([key, amount]) => {
        const [y, m, d] = key.split('-').map(Number);
        if (key === selectedKey) dayProfit += amount;
        if (y === selectedYear && (m - 1) === selectedMonth) monthProfit += amount;
        if (y === selectedYear) yearProfit += amount;
    });

    const dayEl = document.getElementById('profit-day-value');
    const monthEl = document.getElementById('profit-month-value');
    const yearEl = document.getElementById('profit-year-value');
    if (dayEl) dayEl.textContent = `${dayProfit.toFixed(2)} جنيه`;
    if (monthEl) monthEl.textContent = `${monthProfit.toFixed(2)} جنيه`;
    if (yearEl) yearEl.textContent = `${yearProfit.toFixed(2)} جنيه`;
};

// ==================== إعادة حساب مكسب الفواتير القديمة بالسعر الأصلي الحالي للمنتج ====================
// بتدور على كل منتج في كل فاتورة قطاعي قديمة، وتجيب "السعر الأصلي" المسجل دلوقتي على نفس المنتج
// والمقاس والشركة، وتحطه في الفاتورة عشان مكسبها يتحسب بيه بدل الطريقة القديمة.
// لو المنتج اتحذف أو المقاس مبقاش موجود، بنسيب الفاتورة زي ما هي من غير تغيير.
window.recalculateOldInvoicesProfit = function() {
    if (!Array.isArray(savedRetailInvoices) || savedRetailInvoices.length === 0) {
        return alert(' مفيش فواتير قطاعي محفوظة أصلاً');
    }

    const confirmMsg = 'هيتم تحديث "السعر الأصلي" في كل الفواتير القطاعي القديمة بالسعر الأصلي الحالي المسجل على كل منتج، وهيتغير على أساسه حساب المكسب بتاعها. متابعة؟';
    if (!confirm(confirmMsg)) return;

    let updatedItemsCount = 0;
    let updatedInvoicesCount = 0;

    savedRetailInvoices.forEach(inv => {
        if (!Array.isArray(inv.items)) return;
        let invoiceChanged = false;

        inv.items.forEach(item => {
            const product = findProductByNameAndCompany(item.productName, item.company);
            if (!product || !Array.isArray(product.variants)) return;

            const variant = product.variants.find(v => v.size === item.size);
            if (!variant) return;

            const currentOriginalPrice = Number(variant.originalPrice) || 0;
            if (item.originalPrice !== currentOriginalPrice) {
                item.originalPrice = currentOriginalPrice;
                updatedItemsCount++;
                invoiceChanged = true;
            }
        });

        if (invoiceChanged) updatedInvoicesCount++;
    });

    if (updatedItemsCount === 0) {
        showToast(' مفيش حاجة اتغيرت — كل الأسعار الأصلية متسجلة بالفعل', 'info');
        closeProfitModal();
        return;
    }

    saveAllRetailInvoices();
    renderRetailInvoices();
    renderProfitModal();
    showToast(` تم تحديث مكسب ${updatedInvoicesCount} فاتورة (${updatedItemsCount} منتج)`, 'success');
    closeProfitModal();
};

(function () {
    const goTop = document.getElementById('go-top');
    if (goTop) goTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

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
        return alert(' اختر الشركة أولاً');
    }

    const valueStr = document.getElementById('bulk-value').value.trim();
    if (!valueStr) {
        return alert(' ادخل القيمة');
    }

    const value = parseFloat(valueStr);
    if (isNaN(value) || value <= 0) {
        return alert(' القيمة لازم تكون رقم أكبر من صفر');
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
        alert(`  لا يوجد منتجات تابعة لشركة ${getCompanyLabel(bulkEditCompany)}`);
    } else {
        saveProducts();
        applyProductsFilter();
        showToast(` تم تعديل ${updatedCount} من أسعار المنتجات بنجاح`, 'success');
    }

    closeBulkPriceModal();
}

(function () {
    const box = document.getElementById('product-search-box');
    if (box) box.addEventListener('input', () => applyProductsFilter());
})();

function populateSizeSelect() {
    const productInput = document.getElementById('product-search');
    const sizeSelect = document.getElementById('size-select');
    if (!productInput || !sizeSelect) return;

    const productName = productInput.value.trim();
    sizeSelect.innerHTML = '<option value="">اختر المقاس</option>'; // الخيار الافتراضي

    const product = findProductByNameAndCompany(productName, invoiceSelectedCompany);
    if (!product || !Array.isArray(product.variants)) return;

    product.variants.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.size;
        opt.textContent = v.size;
        sizeSelect.appendChild(opt);
    });
}

(function () {
    const el = document.getElementById('product-search');
    if (el) el.addEventListener('input', () => { populateSizeSelect(); updatePriceDisplay(); });
})();


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
    retailStagingAdjustmentTouched = false; // شركة جديدة = لازم يحط النسبة/المبلغ تاني

    // تصفير حقل المنتج والمقاس عند تغيير الشركة
    const productInput = document.getElementById('retail-product-search');
    if (productInput) productInput.value = '';
    const sizeSelect = document.getElementById('retail-size-select');
    if (sizeSelect) sizeSelect.innerHTML = '<option value="">اختر المقاس...</option>';

    populateRetailProductDatalist(retailSelectedCompany);
    toggleRetailAdjustmentUI();
    renderRetailStaging();
    updateRetailStockDisplay();
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
                        <div class="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                            <span>${item.size} — ${Number(item.basePrice).toFixed(2)} جنيه للوحدة</span>
                            <span class="no-print">المخزن: ${stockBadgeHtml(item, retailSelectedCompany)}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <input type="number" min="1" value="${item.qty}"
                               onchange="updateRetailStagingQty(${item.id}, this.value)"
                               class="w-16 text-center border border-rose-200 rounded-lg py-1.5">
                        <button onclick="removeRetailStagingItem(${item.id})" class="icon-btn-sm !text-[var(--danger)]">${icon('trash')}</button>
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
    const removed = retailStaging.find(i => i.id === id);
    if (!removed) return;
    if (!confirm(`هل تريد حذف "${removed.productName}" (${removed.size}) من القائمة المؤقتة؟`)) return;
    retailStaging = retailStaging.filter(i => i.id !== id);
    renderRetailStaging();
};

// ==================== إضافة القائمة المؤقتة للفاتورة الكلية (البحر الأحمر / أكوا دلتا / Dr) ====================
// المبلغ الثابت بيتوزع على كل منتجات القائمة المؤقتة حسب نصيب كل واحد، مش كل منتج ياخد نفس القيمة
function commitRetailStagingToInvoice() {
    if (!PERCENT_COMPANIES.includes(retailSelectedCompany)) {
        return alert(' اختر شركة من (البحر الأحمر / أكوا دلتا / Dr) الأول');
    }

    if (retailStaging.length === 0) {
        return alert(' لسه معملتش إضافة منتجات للقائمة المؤقتة');
    }

    if (!retailStagingAdjustmentTouched) {
        return alert(' لازم تحط نسبة الزيادة أو النقصان الأول (حتى لو صفر) قبل ما تضيف للفاتورة');
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
                originalPrice: Number(item.originalPrice) || 0,
                price: newPrice,
                qty: item.qty,
                subtotal: newPrice * item.qty,
                company: retailSelectedCompany,
                isPercentGroup: true,
                adjustType: type,
                adjustValue: value,
                addedAt: retailSessionAddedAt
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
                originalPrice: Number(item.originalPrice) || 0,
                price: newPrice,
                qty: item.qty,
                subtotal: newSubtotal,
                company: retailSelectedCompany,
                isPercentGroup: true,
                adjustType: type,
                adjustValue: value,
                addedAt: retailSessionAddedAt
            });
        });
    }

    // تصفير القائمة المؤقتة وحقل القيمة بعد الإضافة
    retailStaging = [];
    if (valueInput) valueInput.value = 0;
    retailStagingAdjustmentTouched = false; // لازم يحط القيمة تاني قبل الدفعة الجاية

    renderRetailStaging();
    renderRetailPercentGroups();
    updateRetailTotalAndRemaining();
    showToast(' تم إضافة منتجات ' + getCompanyLabel(retailSelectedCompany) + ' للفاتورة', 'success');
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
        originalPrice: Number(item.originalPrice) || 0,
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
    retailStagingAdjustmentTouched = true; // القيمة رجعت من تعديل سابق، فمعتبرينها متحطوطة فعلاً

    toggleRetailAdjustmentUI();
    renderRetailStaging();
    renderRetailTable();
    renderRetailPercentGroups();
    updateRetailTotalAndRemaining();

    showToast(' رجعت المنتجات للتعديل — عدّل زي ما تحب وادوس "إضافة للفاتورة" تاني', 'warning');
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
    showToast(' تم حذف منتجات ' + getCompanyLabel(companyId), 'error');
};

// ==================== Retail - دوال المنتجات ====================
function handleRetailProductSearch(val) {
    const sizeSelect = document.getElementById('retail-size-select');
    if (!sizeSelect) return;
    sizeSelect.innerHTML = '<option value="">اختر المقاس...</option>';
    updateRetailStockDisplay();

    // إصلاح مشكلة شائعة في المتصفح: بعد ما تختار منتج وتمسح الكتابة، قائمة الاقتراحات
    // ممكن متظهرش تاني إلا لو دوست برة الخانة ووقفت عليها من جديد. الحل إننا نعيد
    // تعبئة القائمة، ولو الخانة بقت فاضية نعمل blur/focus سريع يجبر المتصفح يفتح
    // قائمة الاقتراحات تلقائيًا من غير ما يحتاج المستخدم يدوس تاني بنفسه.
    const productInput = document.getElementById('retail-product-search');
    if (productInput) {
        populateRetailProductDatalist(retailSelectedCompany);
        if (val === '' && document.activeElement === productInput) {
            productInput.blur();
            requestAnimationFrame(() => productInput.focus());
        } else {
            productInput.removeAttribute('list');
            requestAnimationFrame(() => productInput.setAttribute('list', 'retail-products-datalist'));
        }
    }

    const product = findProductByNameAndCompany(val, retailSelectedCompany);
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
            <td class="py-5 px-6 text-center no-print text-slate-400 text-sm">${getCompanyLabel(item.company)}</td>
            <td class="py-5 px-6 text-center text-lg">${item.size}</td>
            <td class="py-5 px-6 text-center no-print text-slate-400">${Number(item.basePrice ?? item.price).toFixed(2)}</td>
            <td class="py-5 px-6 text-center">${Number(item.price).toFixed(2)}</td>
            <td class="py-5 px-6 text-center">
                <div class="flex items-center justify-center gap-1 no-print">
                    <button onclick="updateRetailItemQty(${item.id}, ${item.qty - 1})" class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-lg font-bold text-gray-600">−</button>
                    <input type="number" min="1" value="${item.qty}"
                           onchange="updateRetailItemQty(${item.id}, this.value)"
                           class="w-14 text-center border border-gray-200 rounded-lg py-1.5 text-lg font-medium">
                    <button onclick="updateRetailItemQty(${item.id}, ${item.qty + 1})" class="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-lg font-bold text-gray-600">+</button>
                </div>
                <span class="hidden print:inline text-lg font-medium">${item.qty}</span>
            </td>
            <td class="py-5 px-6 text-center no-print">${stockBadgeHtml(item)}</td>
            <td class="py-5 px-6 text-center font-bold">${item.subtotal.toFixed(2)}</td>
            <td class="py-5 px-6 text-center no-print">
                <button onclick="removeRetailItemById(${item.id})" class="icon-btn-sm !text-[var(--danger)]">${icon('trash')}</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    renderRetailPercentGroups();
}

// ==================== تعديل كمية منتج عادي (مش شركات نسبة) داخل الفاتورة الحالية قبل الحفظ ====================
window.updateRetailItemQty = function(id, newQty) {
    const qty = parseInt(newQty) || 1;
    const item = retailInvoice.find(i => i.id === id);
    if (!item) return;
    item.qty = qty < 1 ? 1 : qty;
    item.subtotal = item.price * item.qty;

    renderRetailTable();
    updateRetailTotalAndRemaining();
};

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
    if (!removed) return;

    if (!confirm(`هل تريد حذف "${removed.productName}" (${removed.size}) من الفاتورة؟`)) return;

    retailInvoice = retailInvoice.filter(item => item.id !== id);

    if (removed.isPercentGroup) {
        recalcFixedGroup(removed.company);
    }

    renderRetailTable();
    updateRetailTotalAndRemaining();
    showToast(` تم حذف "${removed.productName}" من الفاتورة`, 'error');
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
                <h3 class="font-bold text-rose-700"> ${getCompanyLabel(companyId)}</h3>
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
                            <th class="no-print">المتاح بالمخزن</th>
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
                                    <div class="flex items-center justify-center gap-1 no-print">
                                        <button onclick="updateRetailPercentItemQty(${item.id}, ${item.qty - 1})" class="w-8 h-8 rounded-lg bg-rose-100 hover:bg-rose-200 text-lg font-bold text-rose-600">−</button>
                                        <input type="number" min="1" value="${item.qty}"
                                               onchange="updateRetailPercentItemQty(${item.id}, this.value)"
                                               class="w-14 text-center border border-rose-200 rounded-lg py-1">
                                        <button onclick="updateRetailPercentItemQty(${item.id}, ${item.qty + 1})" class="w-8 h-8 rounded-lg bg-rose-100 hover:bg-rose-200 text-lg font-bold text-rose-600">+</button>
                                    </div>
                                    <span class="hidden print:inline">${item.qty}</span>
                                </td>
                                <td class="py-4 px-4 text-center no-print">${stockBadgeHtml(item)}</td>
                                <td class="py-4 px-4 text-center font-bold">${item.subtotal.toFixed(2)}</td>
                                <td class="py-4 px-4 text-center no-print">
                                    <button onclick="removeRetailItemById(${item.id})" class="icon-btn-sm !text-[var(--danger)]">${icon('trash')}</button>
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
        const total = getNetTotal(inv);   // الصافي بعد المرتجعات
        const paid = Number(inv.paid) || 0;
        // فاتورة اتحطت "خالصة" يدويًا: منعتبرش أي متبقي فيها في حساب دين العميل، حتى لو فعليًا لسه عليه فيها فلوس
        runningDebt = inv.settled ? 0 : Math.max(0, (total + runningDebt) - paid);
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

        const card = document.createElement('div');
        card.className = 'bg-gray-50 rounded-xl p-4 shadow-sm';
        card.innerHTML = buildRetailCardHTML(inv, realIndex);
        container.appendChild(card);
    });
}

// ==================== تحديث الإجمالي + الدين + المتبقي للقطاعي ====================
function updateRetailTotalAndRemaining() {
    const rawTotal = retailInvoice.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const discount = computeDiscountAmount('retail', rawTotal);
    // الخصم بينزل من إجمالي الفاتورة هنا. المكسب نفسه بيتحسب من سعر كل منتج وتكلفته
    // (في computeRetailInvoiceProfitAdjusted)، وبعدين بينزل منه قيمة الخصم لوحده هناك.
    const currentTotal = Math.max(0, rawTotal - discount);
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

    if (totalDisplay) totalDisplay.textContent = currentTotal.toFixed(2) + (discount > 0 ? ` (بعد خصم ${discount.toFixed(2)})` : '');
    if (totalInput) totalInput.value = grandTotal.toFixed(2);

    if (remainingEl) {
        remainingEl.value = Math.max(0, remaining).toFixed(2);
        remainingEl.style.color = remaining > 0 ? "#dc2626" : "#16a34a";
    }

    return { currentTotal, rawTotal, discount, grandTotal, paid, remaining: Math.max(0, remaining), previousDebt };
}

// ==================== المخزون: خصم/استرجاع الكمية عند حفظ/حذف فاتورة قطاعي ====================
function findProductVariant(productName, size, companyId = '') {
    const product = findProductByNameAndCompany(productName, companyId);
    if (!product || !Array.isArray(product.variants)) return null;
    return product.variants.find(v => v.size === size) || null;
}

// sign = -1 خصم من المخزون (عند البيع) / sign = +1 رجّع للمخزون (عند الحذف أو تعديل فاتورة قديمة)
function adjustStockForItems(items, sign) {
    let changed = false;
    (Array.isArray(items) ? items : []).forEach(item => {
        const variant = findProductVariant(item.productName, item.size, item.company);
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
        refreshAllStockViews();
    }
}

// ==================== حالة خصم المخزون للفاتورة ====================
// الفاتورة بتتحفظ من غير ما تخصم من المخزن. الخصم بيحصل بس لما تدوسي "تم التسليم".
//   stockDeducted === true   → اتخصمت من المخزن
//   stockDeducted === false  → محفوظة بس لسه مخصمتش (مستنية زرار "تم التسليم")
//   undefined (فاتورة قديمة من قبل التعديل ده):
//       قطاعي: كانت بتخصم وقت الحفظ، فبنعتبرها "اتخصمت"
//       تجار : عمرها ما كانت بتخصم، فبنسيبها زي ما هي من غير زرار
function getInvoiceStockState(inv, kind) {
    if (!inv) return 'untracked';
    if (inv.stockDeducted === true) return 'deducted';
    if (inv.stockDeducted === false) return 'pending';
    return kind === 'retail' ? 'deducted' : 'untracked';
}

// المنتجات اللي المفروض تتخصم/ترجع للمخزن لفاتورة = كميات الفاتورة بعد طرح اللي اترجّع منها
function getStockItemsForInvoice(inv) {
    const returned = {};
    getInvoiceReturns(inv).forEach(r => {
        returned[r.key] = (returned[r.key] || 0) + (Number(r.qty) || 0);
    });
    const out = [];
    (Array.isArray(inv && inv.items) ? inv.items : []).forEach(item => {
        const key = itemReturnKey(item);
        let qty = Number(item.qty) || 0;
        const takeOff = Math.min(qty, returned[key] || 0);
        returned[key] = (returned[key] || 0) - takeOff;
        qty -= takeOff;
        if (qty > 0) out.push({ ...item, qty });
    });
    return out;
}

function persistInvoiceStockChange(kind) {
    if (kind === 'retail') {
        saveAllRetailInvoices();
        filterRetailInvoicesByCustomer();   // بيحافظ على البحث الحالي لو مكتوب
    } else {
        saveAllInvoices();
        filterInvoicesByCustomer();
    }
}

// زرار "تم التسليم": بيخصم كميات الفاتورة من المخزن (مرة واحدة بس)
window.markInvoiceStockDelivered = function (kind, index) {
    const inv = getInvoiceByKind(kind, index);
    if (!inv) return;
    if (getInvoiceStockState(inv, kind) !== 'pending') return;

    const items = getStockItemsForInvoice(inv);

    // تجميع الكميات المطلوبة لكل منتج/مقاس عشان نحذّر لو أكتر من المتاح
    const need = new Map();
    items.forEach(item => {
        const key = itemReturnKey(item);
        if (!need.has(key)) need.set(key, { item, qty: 0 });
        need.get(key).qty += Number(item.qty) || 0;
    });
    const shortages = [];
    need.forEach(({ item, qty }) => {
        const stock = getStockForItem(item);
        if (stock !== null && qty > stock) {
            shortages.push(`• ${item.productName} (${item.size}): المطلوب ${qty} والمتاح ${formatStockNumber(stock)}`);
        }
    });

    let msg = 'تأكيد التسليم؟\nكميات الفاتورة دي هتتخصم من المخزن دلوقتي.';
    if (shortages.length > 0) {
        msg = 'تنبيه: الكمية المطلوبة أكبر من المتاح في المخزن:\n' + shortages.join('\n')
            + '\n\nتكمّلي وتخصمي من المخزن برضه؟ (المخزون هيقف عند صفر)';
    }
    if (!confirm(msg)) return;

    adjustStockForItems(items, -1);
    inv.stockDeducted = true;
    inv.stockDeductedAt = Date.now();
    persistInvoiceStockChange(kind);
    showToast(' تم خصم الفاتورة من المخزن', 'success');
};

// تراجع لو الزرار اتداس بالغلط: بيرجّع الكميات للمخزن وتبقى الفاتورة "لسه متخصمتش"
window.undoInvoiceStockDelivered = function (kind, index) {
    const inv = getInvoiceByKind(kind, index);
    if (!inv) return;
    if (getInvoiceStockState(inv, kind) !== 'deducted') return;
    if (!confirm('هترجّعي كميات الفاتورة دي للمخزن وتبقى "لسه متخصمتش". متأكد؟')) return;

    adjustStockForItems(getStockItemsForInvoice(inv), +1);
    inv.stockDeducted = false;
    delete inv.stockDeductedAt;
    persistInvoiceStockChange(kind);
    showToast(' اتلغى خصم المخزن ورجعت الكميات', 'warning');
};

// شريط حالة المخزن اللي بيظهر فوق كارت الفاتورة المحفوظة (للشاشة بس، مش بيتطبع)
function stockStatusBlockHtml(inv, kind, index) {
    const state = getInvoiceStockState(inv, kind);
    if (state === 'untracked') return '';
    if (state === 'pending') {
        return `
            <div class="no-print flex items-center justify-between gap-2 flex-wrap mb-3 px-3 py-2 rounded-xl border border-amber-200" style="background:#FFFBEB">
                <span class="text-xs sm:text-sm font-semibold" style="color:#B45309">⏳ لسه متخصمتش من المخزن</span>
                <button onclick="markInvoiceStockDelivered('${kind}', ${index})" class="inv-act inv-act-sm inv-act-green">📦 تم التسليم — اخصم من المخزن</button>
            </div>`;
    }
    return `<div class="no-print text-xs font-semibold mb-2" style="color:#047857">✓ اتخصمت من المخزن</div>`;
}

function stockUndoButtonHtml(inv, kind, index) {
    if (getInvoiceStockState(inv, kind) !== 'deducted') return '';
    return `<button onclick="undoInvoiceStockDelivered('${kind}', ${index})" class="inv-act inv-act-sm">↺ إلغاء خصم المخزن</button>`;
}

// ==================== عرض المخزون جنب المنتج وقت تحضير الفاتورة ====================
// للشاشة بس: كله بـ no-print، والطباعة بتتبني من بيانات الفاتورة المحفوظة (اللي مفيهاش مخزون أصلًا)
function formatStockNumber(n) {
    return String(Number((Number(n) || 0).toFixed(2)));
}

// بيرجّع الكمية المتاحة للمقاس، أو null لو مفيش بيانات مخزون للمقاس ده
function getVariantStock(productName, size, companyId) {
    if (!productName || !size) return null;
    const variant = findProductVariant(productName, size, companyId || '');
    if (!variant) return null;
    if (variant.stock === undefined || variant.stock === null || variant.stock === '') return null;
    return Number(variant.stock) || 0;
}

function getStockForItem(item, fallbackCompany) {
    if (!item) return null;
    return getVariantStock(item.productName, item.size, item.company || fallbackCompany || '');
}

function stockBadgeInfo(stock, qty) {
    if (stock === null) return { text: '—', cls: 'stock-unknown', title: 'مفيش كمية مخزون مسجلة للمقاس ده' };
    if (stock <= 0)     return { text: 'نفد', cls: 'stock-out', title: 'المخزون صفر' };
    if (qty > stock)    return { text: formatStockNumber(stock) + ' ⚠', cls: 'stock-short', title: 'الكمية المطلوبة أكبر من المتاح' };
    return { text: formatStockNumber(stock), cls: 'stock-ok', title: 'الكمية المتاحة في المخزن' };
}

function paintStockBadge(el, stock, qty) {
    if (!el) return;
    const info = stockBadgeInfo(stock, qty);
    el.className = 'stock-badge no-print ' + info.cls;
    el.title = info.title;
    el.textContent = info.text;
}

function stockAttr(s) {
    return String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// بادج المخزون جوه جداول الفاتورة (بيتحدث لوحده لو المخزون اتغير)
function stockBadgeHtml(item, fallbackCompany) {
    const company = item.company || fallbackCompany || '';
    const qty = Number(item.qty) || 0;
    const info = stockBadgeInfo(getVariantStock(item.productName, item.size, company), qty);
    return `<span class="stock-badge no-print ${info.cls}" title="${info.title}" data-stock-badge`
        + ` data-name="${stockAttr(item.productName)}" data-size="${stockAttr(item.size)}"`
        + ` data-company="${stockAttr(company)}" data-qty="${qty}">${info.text}</span>`;
}

function updateInvoiceStockDisplay() {
    const el = document.getElementById('stock-display');
    if (!el) return;
    const nameEl = document.getElementById('product-search');
    const sizeEl = document.getElementById('size-select');
    const qtyEl = document.getElementById('qty-input');
    const name = nameEl ? nameEl.value.trim() : '';
    const size = sizeEl ? sizeEl.value : '';
    const qty = parseInt(qtyEl ? qtyEl.value : 0) || 0;
    paintStockBadge(el, getVariantStock(name, size, invoiceSelectedCompany), qty);
}

function updateRetailStockDisplay() {
    const el = document.getElementById('retail-stock-display');
    if (!el) return;
    const nameEl = document.getElementById('retail-product-search');
    const sizeEl = document.getElementById('retail-size-select');
    const qtyEl = document.getElementById('retail-qty-input');
    const name = nameEl ? nameEl.value.trim() : '';
    const size = sizeEl ? sizeEl.value : '';
    const qty = parseInt(qtyEl ? qtyEl.value : 0) || 0;
    paintStockBadge(el, getVariantStock(name, size, retailSelectedCompany), qty);
}

// تحديث كل عروض المخزون الظاهرة من غير ما نعيد رسم الجداول (عشان مانقطعش كتابة حد في خانة كمية)
function refreshAllStockViews() {
    document.querySelectorAll('[data-stock-badge]').forEach(el => {
        const stock = getVariantStock(el.dataset.name, el.dataset.size, el.dataset.company || '');
        paintStockBadge(el, stock, Number(el.dataset.qty) || 0);
    });
    updateInvoiceStockDisplay();
    updateRetailStockDisplay();
}

function saveRetailInvoice() {
    const customerInput = document.getElementById('retail-customer-name');
    const customer = customerInput ? customerInput.value.trim() : 'عميل غير محدد';

    if (retailInvoice.length === 0) {
        return alert(' الفاتورة فاضية!');
    }

    const { currentTotal, discount } = updateRetailTotalAndRemaining();
    const initialPaidValue = parseFloat(document.getElementById("retail-paid-input").value) || 0;

    const oldInvoice = editingRetailInvoiceIndex !== null ? savedRetailInvoices[editingRetailInvoiceIndex] : null;

    // ==================== سجل الدفعات ====================
    // فاتورة جديدة: خانة "المبلغ المدفوع" فوق الفاتورة بتبقى أول دفعة بتاريخ النهارده.
    // فاتورة بتتعدل (بنضيف منتجات مثلاً): سجل الدفعات القديم بتاعها بيفضل زي ما هو من غير أي تغيير —
    // أي دفعة جديدة تتضاف بعد كده لازم تبقى من زرار "دفع المتبقي" بتاريخها الخاص، مش من هنا،
    // عشان منضربش سجل الدفعات القديم.
    let payments;
    if (oldInvoice) {
        payments = Array.isArray(oldInvoice.payments) ? JSON.parse(JSON.stringify(oldInvoice.payments)) : [];
        if (payments.length === 0 && Number(oldInvoice.paid) > 0) {
            payments = [{ amount: Number(oldInvoice.paid), date: oldInvoice.date }];
        }
    } else {
        payments = initialPaidValue > 0 ? [{ id: Date.now() + '-' + Math.floor(Math.random() * 100000), amount: initialPaidValue, date: Date.now() }] : [];
    }
    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const invoice = {
        customer: customer || 'عميل غير محدد',
        items: JSON.parse(JSON.stringify(retailInvoice)),
        total: Number(currentTotal.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        paid: Number(totalPaid.toFixed(2)),
        payments: payments,
        // الفاتورة كلها بتحتفظ بتاريخها الأصلي حتى لو اتعدلت وأضيفت منتجات جديدة ليها
        date: oldInvoice ? oldInvoice.date : Date.now()
    };

    // سجل المرتجعات بتاع الفاتورة بيفضل زي ما هو حتى لو الفاتورة اتعدلت
    if (oldInvoice && Array.isArray(oldInvoice.returns)) {
        invoice.returns = JSON.parse(JSON.stringify(oldInvoice.returns));
    }

    // المخزون: الفاتورة الجديدة بتتحفظ "لسه متخصمتش"، والخصم بيتم بزرار "تم التسليم" بس.
    if (editingRetailInvoiceIndex !== null) {
        const oldState = getInvoiceStockState(oldInvoice, 'retail');
        if (oldState === 'deducted') {
            // فاتورة اتسلّمت واتخصمت قبل كده وبتتعدل: نظبط المخزن على فرق الكميات بس
            adjustStockForItems(getStockItemsForInvoice(oldInvoice), +1);
            invoice.stockDeducted = true;
            if (oldInvoice.stockDeductedAt) invoice.stockDeductedAt = oldInvoice.stockDeductedAt;
            savedRetailInvoices[editingRetailInvoiceIndex] = invoice;
            adjustStockForItems(getStockItemsForInvoice(invoice), -1);
        } else {
            invoice.stockDeducted = false;
            savedRetailInvoices[editingRetailInvoiceIndex] = invoice;
        }
    } else {
        invoice.stockDeducted = false;
        savedRetailInvoices.push(invoice);
    }

    recalculateAllRetailInvoicesForCustomer(customer);
    saveAllRetailInvoices();

    // تصفير الفاتورة
    retailInvoice = [];
    retailStaging = [];
    editingRetailInvoiceIndex = null;
    retailSessionAddedAt = Date.now();

    renderRetailTable();
    renderRetailStaging();
    renderRetailPercentGroups();
    updateRetailTotalAndRemaining();

    if (customerInput) customerInput.value = '';
    const paidInputAfterSave = document.getElementById('retail-paid-input');
    if (paidInputAfterSave) {
        paidInputAfterSave.value = '0';
        paidInputAfterSave.readOnly = false;
        paidInputAfterSave.classList.remove('opacity-60', 'cursor-not-allowed');
        paidInputAfterSave.title = '';
    }
    const remEl = document.getElementById('retail-remaining-input');
    if (remEl) remEl.value = '0';
    const discountInputAfterSave = document.getElementById('retail-discount-input');
    if (discountInputAfterSave) discountInputAfterSave.value = '0';
    const discountTypeAfterSaveR = document.getElementById('retail-discount-type');
    if (discountTypeAfterSaveR) discountTypeAfterSaveR.value = 'amount';
    const discountHintAfterSaveR = document.getElementById('retail-discount-hint');
    if (discountHintAfterSaveR) discountHintAfterSaveR.textContent = '';

    const cancelBtnAfterSave = document.getElementById('cancel-edit-retail-btn');
    if (cancelBtnAfterSave) cancelBtnAfterSave.classList.add('hidden');

    updateRetailInvoiceHeader();
    renderRetailInvoices();

    setTimeout(getAllUniqueRetailCustomers, 100);

    showToast(' تم حفظ فاتورة القطاعي بنجاح', 'success');
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

        const currentTotal = getNetTotal(inv);   // الصافي بعد المرتجعات
        const paid = Number(inv.paid) || 0;

        const grandTotal = currentTotal + runningDebt;
        const remaining = inv.settled ? 0 : (grandTotal - paid);

        savedRetailInvoices[realIndex].grandTotal = Number(grandTotal.toFixed(2));
        savedRetailInvoices[realIndex].remaining = Number(Math.max(0, remaining).toFixed(2));

        runningDebt = Math.max(0, remaining);
    }
}

// ==================== ضمان إن كل منتج في الفاتورة ليه id ثابت (عشان نقدر نعدّل عليه لوحده) ====================
function ensureRetailItemIds(inv) {
    if (!Array.isArray(inv.items)) return inv.items;
    inv.items.forEach(item => {
        if (item.id === undefined || item.id === null) {
            item.id = Date.now() + '-' + Math.floor(Math.random() * 100000);
        }
    });
    return inv.items;
}

// ==================== التحكم في سعر القطعة الواحدة لمنتج بعينه داخل فاتورة قطاعي محفوظة ====================
// بيغيّر سعر القطعة، والإجمالي بيتحدث تلقائيًا (سعر جديد × الكمية)
// كان/بقى بيتحفظ ويظهر في الشاشة بس، ومش بيظهر في الطباعة
window.editRetailInvoiceItemTotal = function(invIndex, itemId) {
    const inv = savedRetailInvoices[invIndex];
    if (!inv || !Array.isArray(inv.items)) return;

    const item = inv.items.find(it => String(it.id) === String(itemId));
    if (!item) return;

    const oldPrice = Number(item.price) || 0;
    const qty = Number(item.qty) || 1;

    const wantsToEdit = confirm(`سعر القطعة الواحدة من "${item.productName}" حاليًا ${oldPrice.toFixed(2)} جنيه.\nهل تريد تغيير السعر؟`);
    if (!wantsToEdit) return;

    const input = prompt(`اكتب السعر الجديد للقطعة الواحدة من "${item.productName}" (جنيه):`, oldPrice.toFixed(2));
    if (input === null) return; // المستخدم ضغط إلغاء

    const newPrice = Number(input);
    if (isNaN(newPrice) || newPrice <= 0) {
        showToast(' من فضلك أدخل رقم صحيح أكبر من صفر', 'error');
        return;
    }

    // بيتحدث سعر القطعة الواحدة، والإجمالي بيتحسب تلقائيًا (سعر × كمية)
    item.price = Number(newPrice.toFixed(2));
    item.subtotal = Number((item.price * qty).toFixed(2));

    // بنسجل كان بكام وبقى بكام عشان يظهر في الشاشة بس (مش في الطباعة)
    item.priceEdited = true;
    item.priceEditedFrom = oldPrice;

    // إجمالي الفاتورة بيتحدث تلقائيًا كمجموع كل المنتجات
    inv.total = Number(inv.items.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0).toFixed(2));

    recalculateAllRetailInvoicesForCustomer(inv.customer);
    saveAllRetailInvoices();
    renderRetailInvoices();

    showToast(` سعر "${item.productName}" كان ${oldPrice.toFixed(2)} جنيه وبقى ${item.price.toFixed(2)} جنيه`, 'success');
};

// ==================== تنسيق تاريخ/وقت موحّد ====================
function formatRetailDateTime(ts) {
    const d = new Date(ts);
    const date = d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const time = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    return `${date} - ${time}`;
}

// ==================== تجميع منتجات الفاتورة حسب وقت إضافتها ====================
// كل مجموعة بتاريخها: المنتجات القديمة تفضل بتاريخ الفاتورة الأصلي، والمنتج اللي بيتضاف بعدين
// (عند تعديل الفاتورة) بيظهر في مجموعة جديدة فوق بتاريخ إضافته هو
function groupRetailItemsByAddedAt(items, fallbackDate) {
    const map = new Map();
    (items || []).forEach(item => {
        const key = Number(item.addedAt) || Number(fallbackDate) || 0;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
    });
    return Array.from(map.entries())
        .map(([date, its]) => ({ date, items: its }))
        .sort((a, b) => b.date - a.date); // الأحدث فوق
}

function retailItemsRowsHtml(items, invIndex) {
    return items.map(item => `
        <tr class="border-b">
            <td class="py-2 px-4 text-right">${item.productName}</td>
            <td class="py-2 px-4 text-center no-print text-slate-400 text-sm">${getCompanyLabel(item.company)}</td>
            <td class="py-2 px-4 text-center">${item.size}</td>
            <td class="py-2 px-4 text-center">
                <div class="flex flex-col items-center justify-center gap-1">
                    <div class="flex items-center justify-center gap-2">
                        <span>${Number(item.price).toFixed(2)}</span>
                        <button onclick="editRetailInvoiceItemTotal(${invIndex}, '${item.id}')" class="text-purple-600 text-xs underline font-normal"> تحكم</button>
                    </div>
                    ${item.priceEdited ? `<div class="text-[11px] text-amber-600">كان ${Number(item.priceEditedFrom).toFixed(2)} وبقى ${Number(item.price).toFixed(2)}</div>` : ''}
                </div>
            </td>
            <td class="py-2 px-4 text-center">${item.qty}</td>
            <td class="py-2 px-4 text-center font-bold">${Number(item.subtotal).toFixed(2)}</td>
        </tr>
    `).join('');
}

// ==================== ضمان إن كل دفعة ليها id ثابت (ولترحيل الفواتير القديمة اللي معندهاش سجل دفعات) ====================
function ensureRetailPayments(inv) {
    if (!Array.isArray(inv.payments)) inv.payments = [];
    if (inv.payments.length === 0 && Number(inv.paid) > 0) {
        inv.payments.push({ amount: Number(inv.paid), date: inv.date });
    }
    inv.payments.forEach(p => {
        if (p.id === undefined || p.id === null) {
            p.id = Date.now() + '-' + Math.floor(Math.random() * 100000);
        }
    });
    return inv.payments;
}

// ==================== بناء سجل الدفعات مع حساب المتبقي بعد كل دفعة ====================
function computeRetailPaymentsHistory(inv, grandTotal) {
    const list = ensureRetailPayments(inv)
        .filter(p => Number(p.amount) > 0)
        .slice()
        .sort((a, b) => a.date - b.date);

    let cumulative = 0;
    return list.map(p => {
        cumulative += Number(p.amount) || 0;
        return {
            id: p.id,
            amount: Number(p.amount) || 0,
            date: p.date,
            remainingAfter: Math.max(0, Number((grandTotal - cumulative).toFixed(2)))
        };
    });
}

// ==================== عرض الفواتير السابقة (كاملة مثل التجار) ====================
// ==================== كارت فاتورة القطاعي (نسخة واحدة تُستخدم في العرض العادي وفي البحث) ====================
function buildRetailCardHTML(inv, index) {
    const dateObj = new Date(inv.date);
    const formattedDate = dateObj.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const formattedTime = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    const currentTotal = getNetTotal(inv);            // الصافي بعد المرتجعات
    const previousDebt = getRetailCustomerPreviousDebt(inv.customer, index);
    const grandTotal = currentTotal + previousDebt;
    const paid = Number(inv.paid) || 0;
    const actualRemaining = Math.max(0, grandTotal - paid);
    const remaining = inv.settled ? 0 : actualRemaining;

    const itemGroups = groupRetailItemsByAddedAt(inv.items, inv.date);
    ensureRetailItemIds(inv);
    const itemsHtml = itemGroups.length > 1
        ? itemGroups.map(group => `
            <tr class="bg-amber-50">
                <td colspan="6" class="py-2 px-4 text-right text-xs font-semibold text-amber-700">
                     أُضيف بتاريخ: ${formatRetailDateTime(group.date)}
                </td>
            </tr>
            ${retailItemsRowsHtml(group.items, index)}
        `).join('')
        : retailItemsRowsHtml(inv.items, index);

    const paymentsHistory = computeRetailPaymentsHistory(inv, grandTotal);
    const invoiceProfit = computeRetailInvoiceProfitAdjusted(inv);

    return `
            <div class="flex justify-between items-center mb-3">
                <div class="font-semibold">${inv.customer}</div>
                <div class="text-gray-500 text-sm">${formattedDate} - ${formattedTime}</div>
            </div>
            <div class="no-print text-xs font-semibold text-amber-600 mb-2 flex items-center gap-2">
                <span> مكسب هذه الفاتورة:</span>
                <span class="hidden-price-mask select-none">••••</span>
                <span class="hidden-price-value hidden">${invoiceProfit.toFixed(2)} جنيه</span>
                <button type="button" onclick="toggleOriginalPriceCell(this)" title="إظهار/إخفاء المكسب" class="icon-btn-sm">${icon('eye')}</button>
            </div>
            ${stockStatusBlockHtml(inv, 'retail', index)}
            <button onclick="toggleRetailInvoiceDetails(${index})" class="text-green-600 underline mb-3">عرض المنتجات</button>
            <div id="retail-invoice-details-${index}" class="hidden">
                <table class="w-full text-right border-collapse mb-4">
                    <thead class="bg-gray-200"><tr>
                        <th class="py-2 px-4 text-right">المنتج</th>
                        <th class="py-2 px-4 no-print">الشركة</th>
                        <th class="py-2 px-4">المقاس</th>
                        <th class="py-2 px-4">السعر</th>
                        <th class="py-2 px-4">الكمية</th>
                        <th class="py-2 px-4">الإجمالي</th>
                    </tr></thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <!-- سجل المرتجعات (منفصل تمامًا عن جدول المبيعات) -->
                ${returnsSectionHtml('retail', index, inv)}

                <div class="bg-white rounded-2xl p-5 shadow-sm">
                    <div class="text-center">
                        <div class="text-xs text-gray-500 mb-1">${getReturnsTotal(inv) > 0 ? 'إجمالي الفاتورة (بعد خصم المرتجعات)' : 'إجمالي الفاتورة'}</div>
                        <div class="text-2xl font-bold text-blue-600">${grandTotal.toFixed(2)} جنيه</div>
                        ${Number(inv.discount) > 0 ? `<div class="text-xs text-amber-600 mt-1">(بعد خصم ${Number(inv.discount).toFixed(2)} جنيه)</div>` : ''}
                    </div>
                    ${paymentsHistory.length > 0 ? `
                        <div class="space-y-2 mt-4 pt-4 border-t">
                            ${paymentsHistory.map(p => `
                                <div class="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm gap-2 flex-wrap">
                                    <div class="text-slate-400 text-xs">${formatRetailDateTime(p.date)}</div>
                                    <div class="text-green-600 font-semibold">دفع ${p.amount.toFixed(2)} جنيه</div>
                                    <div class="${p.remainingAfter > 0 ? 'text-red-600' : 'text-green-600'} font-bold">متبقي ${p.remainingAfter.toFixed(2)} جنيه</div>
                                    <div class="flex items-center gap-3">
                                        <button onclick="startEditRetailPayment(${index}, '${p.id}')" class="inv-act inv-act-sm inv-act-amber">✎ تعديل</button>
                                        <button onclick="deleteRetailPayment(${index}, '${p.id}')" class="inv-act inv-act-sm inv-act-red">🗑 حذف</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="mt-4 pt-4 border-t text-center">
                        <div class="text-xs text-gray-500 mb-1">المتبقي النهائي</div>
                        <div class="text-3xl font-bold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}">${remaining.toFixed(2)} جنيه</div>
                        ${inv.settled && actualRemaining > 0 ? `<div class="text-xs text-amber-600 mt-1">(اتحطت خالصة يدويًا — المتبقي الفعلي كان ${actualRemaining.toFixed(2)} جنيه)</div>` : ''}
                    </div>
                </div>

                <div id="retail-edit-payment-form-${index}" class="hidden mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <label class="block text-sm font-semibold text-blue-700 mb-2">تعديل مبلغ الدفعة</label>
                    <div class="flex gap-2 flex-wrap">
                        <input id="retail-edit-payment-amount-${index}" type="number" min="0" step="0.01" class="input-base flex-1 min-w-[140px]">
                        <button onclick="saveEditedRetailPayment(${index})" class="btn-success !px-5">حفظ</button>
                        <button onclick="cancelEditRetailPayment(${index})" class="btn-secondary !px-5">إلغاء</button>
                    </div>
                </div>

                <div id="retail-pay-form-${index}" class="hidden mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <label class="block text-sm font-semibold text-amber-700 mb-2">إضافة دفعة جديدة (المتبقي حاليًا ${remaining.toFixed(2)} جنيه)</label>
                    <div class="flex gap-2 flex-wrap">
                        <input id="retail-pay-amount-${index}" type="number" min="0" step="0.01" placeholder="المبلغ..." class="input-base flex-1 min-w-[140px]">
                        <button onclick="submitRetailPayment(${index})" class="btn-success !px-5">حفظ</button>
                        <button onclick="cancelRetailPayForm(${index})" class="btn-secondary !px-5">إلغاء</button>
                    </div>
                </div>

                <div class="inv-actions center no-print">
                    ${inv.settled
                        ? `<span class="inv-badge-done">✓ خالصة (يدوي)</span>
                           <button onclick="toggleRetailInvoiceSettled(${index})" class="inv-act inv-act-sm">↺ إلغاء الخالصة</button>`
                        : (remaining > 0
                            ? `<button onclick="toggleRetailPayForm(${index})" class="inv-act inv-act-green">💵 دفع المتبقي</button>
                               <button onclick="toggleRetailInvoiceSettled(${index})" class="inv-act inv-act-green">✓ اعتبارها خالصة</button>`
                            : `<span class="inv-badge-done">✓ تم السداد بالكامل</span>`)
                    }
                    ${stockUndoButtonHtml(inv, 'retail', index)}
                    <button onclick="openReturnsModal('retail', ${index})" class="inv-act inv-act-purple">↩ مرتجع</button>
                    <button onclick="printRetailSavedInvoice(${index})" class="inv-act inv-act-blue">🖨 طباعة</button>
                    <button onclick="editRetailSavedInvoice(${index})" class="inv-act inv-act-amber">✎ تعديل</button>
                    <button onclick="deleteRetailSavedInvoice(${index})" class="inv-act inv-act-red">🗑 حذف</button>
                </div>
            </div>
    `;
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
        const card = document.createElement('div');
        card.className = 'bg-gray-50 rounded-xl p-4 shadow-sm';
        card.innerHTML = buildRetailCardHTML(inv, index);
        container.appendChild(card);
    });
}

// ==================== اعتبار فاتورة "خالصة" يدويًا حتى لو المدفوع أقل من الإجمالي ====================
// ده مش بيغير المبلغ المدفوع الفعلي ولا يضيف دفعة وهمية، بس بيخلي المتبقي = صفر في العرض
// وفي حساب دين العميل للفواتير الجاية، وقابل للإلغاء في أي وقت لو حبيت ترجع تحصّل الباقي.
window.toggleRetailInvoiceSettled = function(index) {
    const inv = savedRetailInvoices[index];
    if (!inv) return;

    if (inv.settled) {
        if (!confirm('هل تريد إلغاء اعتبار هذه الفاتورة "خالصة"؟ هيرجع المتبقي الفعلي يظهر تاني.')) return;
        inv.settled = false;
    } else {
        if (!confirm('هل تريد اعتبار هذه الفاتورة "خالصة" رغم إن المدفوع أقل من الإجمالي؟ مش هتظهر كدين على العميل تاني.')) return;
        inv.settled = true;
    }

    recalculateAllRetailInvoicesForCustomer(inv.customer);
    saveAllRetailInvoices();
    renderRetailInvoices();
    showToast(inv.settled ? ' تم اعتبار الفاتورة خالصة' : ' تم إلغاء الخالصة', inv.settled ? 'success' : 'warning');
};

// ==================== دفع المتبقي (دفعة جديدة بتاريخها الخاص) ====================
window.toggleRetailPayForm = function(index) {
    // اقفل فورم تعديل الدفعة لو مفتوح
    const editForm = document.getElementById(`retail-edit-payment-form-${index}`);
    if (editForm) editForm.classList.add('hidden');
    retailEditingPaymentContext = null;

    const form = document.getElementById(`retail-pay-form-${index}`);
    if (form) form.classList.toggle('hidden');
};

window.cancelRetailPayForm = function(index) {
    const input = document.getElementById(`retail-pay-amount-${index}`);
    if (input) input.value = '';
    const form = document.getElementById(`retail-pay-form-${index}`);
    if (form) form.classList.add('hidden');
};

window.submitRetailPayment = function(index) {
    const input = document.getElementById(`retail-pay-amount-${index}`);
    if (!input) return;
    const amount = parseFloat(input.value) || 0;
    if (amount <= 0) return alert(' اكتب مبلغ صحيح أكبر من صفر');

    const inv = savedRetailInvoices[index];
    if (!inv) return;
    ensureRetailPayments(inv);

    const currentTotal = getNetTotal(inv);   // الصافي بعد المرتجعات
    const previousDebt = getRetailCustomerPreviousDebt(inv.customer, index);
    const grandTotal = currentTotal + previousDebt;
    const paidSoFar = inv.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const remainingNow = Math.max(0, grandTotal - paidSoFar);

    if (amount > remainingNow + 0.009) {
        return alert(` المبلغ أكبر من المتبقي (المتبقي حاليًا ${remainingNow.toFixed(2)} جنيه)`);
    }

    inv.payments.push({ id: Date.now() + '-' + Math.floor(Math.random() * 100000), amount: amount, date: Date.now() });
    inv.paid = Number((paidSoFar + amount).toFixed(2));

    recalculateAllRetailInvoicesForCustomer(inv.customer);
    saveAllRetailInvoices();
    renderRetailInvoices();

    showToast(' تم تسجيل الدفعة بنجاح', 'success');
};

// ==================== تعديل / حذف دفعة مسجّلة قبل كده ====================
window.startEditRetailPayment = function(index, paymentId) {
    const inv = savedRetailInvoices[index];
    if (!inv) return;
    ensureRetailPayments(inv);

    const payment = inv.payments.find(p => String(p.id) === String(paymentId));
    if (!payment) return;

    retailEditingPaymentContext = { index, paymentId: String(paymentId) };

    // اقفل فورم إضافة دفعة جديدة لو مفتوح
    const addForm = document.getElementById(`retail-pay-form-${index}`);
    if (addForm) addForm.classList.add('hidden');

    const editForm = document.getElementById(`retail-edit-payment-form-${index}`);
    const editInput = document.getElementById(`retail-edit-payment-amount-${index}`);
    if (editInput) editInput.value = Number(payment.amount).toFixed(2);
    if (editForm) editForm.classList.remove('hidden');
};

window.cancelEditRetailPayment = function(index) {
    retailEditingPaymentContext = null;
    const editForm = document.getElementById(`retail-edit-payment-form-${index}`);
    if (editForm) editForm.classList.add('hidden');
};

window.saveEditedRetailPayment = function(index) {
    if (!retailEditingPaymentContext || retailEditingPaymentContext.index !== index) return;

    const inv = savedRetailInvoices[index];
    if (!inv) return;
    ensureRetailPayments(inv);

    const payment = inv.payments.find(p => String(p.id) === String(retailEditingPaymentContext.paymentId));
    if (!payment) return;

    const input = document.getElementById(`retail-edit-payment-amount-${index}`);
    const newAmount = parseFloat(input ? input.value : 0) || 0;
    if (newAmount <= 0) return alert(' اكتب مبلغ صحيح أكبر من صفر');

    const currentTotal = getNetTotal(inv);   // الصافي بعد المرتجعات
    const previousDebt = getRetailCustomerPreviousDebt(inv.customer, index);
    const grandTotal = currentTotal + previousDebt;
    const otherPaymentsSum = inv.payments
        .filter(p => String(p.id) !== String(payment.id))
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    if (otherPaymentsSum + newAmount > grandTotal + 0.009) {
        return alert(` مجموع الدفعات هيتخطى إجمالي الفاتورة (الإجمالي ${grandTotal.toFixed(2)} جنيه)`);
    }

    payment.amount = newAmount;
    inv.paid = Number((otherPaymentsSum + newAmount).toFixed(2));

    recalculateAllRetailInvoicesForCustomer(inv.customer);
    saveAllRetailInvoices();

    retailEditingPaymentContext = null;
    renderRetailInvoices();
    showToast(' تم تعديل الدفعة بنجاح', 'success');
};

window.deleteRetailPayment = function(index, paymentId) {
    const inv = savedRetailInvoices[index];
    if (!inv) return;
    ensureRetailPayments(inv);

    if (!confirm('هل تريد حذف هذه الدفعة؟')) return;

    inv.payments = inv.payments.filter(p => String(p.id) !== String(paymentId));
    inv.paid = Number(inv.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0).toFixed(2));

    if (retailEditingPaymentContext && retailEditingPaymentContext.index === index &&
        String(retailEditingPaymentContext.paymentId) === String(paymentId)) {
        retailEditingPaymentContext = null;
    }

    recalculateAllRetailInvoicesForCustomer(inv.customer);
    saveAllRetailInvoices();
    renderRetailInvoices();
    showToast(' تم حذف الدفعة', 'error');
};

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
    retailSessionAddedAt = Date.now(); // أي منتجات تتضاف أثناء التعديل ده كله هتاخد نفس التاريخ ده

    const customerInput = document.getElementById('retail-customer-name');
    if (customerInput) customerInput.value = invoice.customer;

    const paidInput = document.getElementById('retail-paid-input');
    if (paidInput) {
        paidInput.value = Number(invoice.paid || 0).toFixed(2);
        // المبلغ المدفوع بقى بيتحدث بس من زرار "دفع المتبقي" في قائمة الفواتير،
        // عشان منضربش سجل الدفعات القديم بتاريخه.
        paidInput.readOnly = true;
        paidInput.classList.add('opacity-60', 'cursor-not-allowed');
        paidInput.title = 'لإضافة دفعة جديدة استخدم زرار "دفع المتبقي" في قائمة الفواتير السابقة';
    }

    setDiscountFieldsFromSaved('retail', invoice.discount);

    renderRetailTable();
    renderRetailStaging();
    updateRetailTotalAndRemaining();
    updateRetailInvoiceHeader();

    const cancelBtn = document.getElementById('cancel-edit-retail-btn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    showSection('retail');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    showToast(' جاري تعديل فاتورة القطاعي... (لإضافة دفعة استخدم زرار دفع المتبقي)', 'warning');
};

// ==================== إلغاء التعديل والرجوع للفاتورة الأصلية كما كانت محفوظة ====================
window.cancelEditRetailInvoice = function() {
    if (!confirm('هل تريد إلغاء التعديل؟ أي تغييرات عملتها في الفاتورة دي هتتلغي.')) return;

    editingRetailInvoiceIndex = null;
    retailInvoice = [];
    retailStaging = [];
    retailSessionAddedAt = Date.now();

    const customerInput = document.getElementById('retail-customer-name');
    if (customerInput) customerInput.value = '';

    const paidInput = document.getElementById('retail-paid-input');
    if (paidInput) {
        paidInput.value = '0';
        paidInput.readOnly = false;
        paidInput.classList.remove('opacity-60', 'cursor-not-allowed');
        paidInput.title = '';
    }

    const discountInputCancel = document.getElementById('retail-discount-input');
    if (discountInputCancel) discountInputCancel.value = '0';
    const discountTypeCancel = document.getElementById('retail-discount-type');
    if (discountTypeCancel) discountTypeCancel.value = 'amount';
    const discountHintCancel = document.getElementById('retail-discount-hint');
    if (discountHintCancel) discountHintCancel.textContent = '';

    renderRetailTable();
    renderRetailStaging();
    renderRetailPercentGroups();
    updateRetailTotalAndRemaining();
    updateRetailInvoiceHeader();

    const cancelBtn = document.getElementById('cancel-edit-retail-btn');
    if (cancelBtn) cancelBtn.classList.add('hidden');

    showToast(' تم إلغاء التعديل', 'error');
};

window.deleteRetailSavedInvoice = function(index) {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة القطاعية؟ (هتتنقل لسلة المحذوفات ولو محدش رجّعها هتتحذف نهائي بعد 30 يوم)')) return;
    const inv = savedRetailInvoices[index];
    // لو الفاتورة كانت اتخصمت من المخزن، الكميات ترجع لما تتحذف (ولو لسه متخصمتش منعملش حاجة)
    if (inv && getInvoiceStockState(inv, 'retail') === 'deducted') adjustStockForItems(getStockItemsForInvoice(inv), +1);
    savedRetailInvoices.splice(index, 1);
    if (inv) trashedRetailInvoices.push({ trashId: makeTrashId(), deletedAt: Date.now(), data: JSON.parse(JSON.stringify(inv)) });
    saveAllRetailInvoices();
    saveTrash();
    renderRetailInvoices();
    renderTrash();
    showToast(' تم نقل الفاتورة لسلة المحذوفات', 'error');
};

// ==================== طباعة فاتورة قطاعي (نفس شكل التجار) ====================
// ==================== طباعة فاتورة قطاعي ====================
window.printRetailSavedInvoice = async function(index) {
    const inv = savedRetailInvoices[index];
    if (!inv) return;

    const dateObj = new Date(inv.date);
    const formattedDate = dateObj.toLocaleDateString('ar-EG', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    const formattedTime = dateObj.toLocaleTimeString('ar-EG', { 
        hour: '2-digit', minute: '2-digit' 
    });

    const currentTotal = getNetTotal(inv);   // الصافي بعد المرتجعات
    const previousDebt = getRetailCustomerPreviousDebt(inv.customer, index);
    const grandTotal = currentTotal + previousDebt;
    const paid = Number(inv.paid) || 0;
    const remaining = inv.settled ? 0 : Math.max(0, grandTotal - paid);

    const itemGroups = groupRetailItemsByAddedAt(inv.items, inv.date);
    const paymentsHistory = computeRetailPaymentsHistory(inv, grandTotal);

    const printItemsRows = (items) => items.map(item => `
                        <tr>
                            <td>${item.productName}</td>
                            <td>${item.size}</td>
                            <td>${item.qty}</td>
                            <td>${Number(item.subtotal).toFixed(2)}</td>
                        </tr>
    `).join('');

    const printItemsHtml = itemGroups.length > 1
        ? itemGroups.map(group => `
                        <tr>
                            <td colspan="4" style="background:#FEF3C7; text-align:right; font-weight:600; color:#92400E;">
                                 أُضيف بتاريخ: ${formatRetailDateTime(group.date)}
                            </td>
                        </tr>
                        ${printItemsRows(group.items)}
        `).join('')
        : printItemsRows(inv.items);

    const fbQr = await ensureFacebookQr();

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
                    font-size: 17px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 4px solid #14B8A6;
                    padding-bottom: 15px;
                }
                .header p {
                    font-size: 15px;
                }
                .shop-name {
                    font-size: 24px;
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
                    padding: 8px;
                    text-align: center;
                }
                th {
                    background-color: #F0FDFA;
                    font-weight: 600;
                    color: #0F766E;
                    font-size: 15px;
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
                .total-box h3 {
                    font-size: 17px;
                }
                .amount {
                    font-size: 19px;
                    font-weight: bold;
                }
                .red { color: #dc2626; }
                .green { color: #16a34a; }
                .emerald { color: #14B8A6; }
                .section-title { margin-top: 30px; color: #6D28D9; font-size: 18px; }
                .summary-card {
                    margin-top: 28px; border: 2px solid #14B8A6; border-radius: 10px;
                    overflow: hidden; background: #fff;
                }
                .summary-row {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 9px 18px; border-bottom: 1px solid #E5E7EB; font-size: 15px; color: #374151;
                }
                .summary-row:last-child { border-bottom: none; }
                .summary-row.strong { font-weight: 700; color: #111827; background: #F9FAFB; }
                .summary-row .red { font-weight: 700; color: #dc2626; }
                .summary-row .green { font-weight: 700; color: #16a34a; }
                .summary-row.final {
                    padding: 14px 18px; font-size: 17px; font-weight: 800;
                    border-top: 2px solid #14B8A6;
                }
                .summary-row.final span:last-child { font-size: 20px; }
                .summary-row.final.due { background: #FEF2F2; color: #b91c1c; }
                .summary-row.final.clear { background: #F0FDF4; color: #15803d; }
                .summary-note { padding: 6px 18px 12px; font-size: 12.5px; color: #92400E; text-align: center; }
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

            <div style="margin-bottom: 20px; font-size: 15px;">
                <strong>اسم العميل:</strong> ${inv.customer}
                ${previousDebt > 0 ? `<span style="color:#dc2626;"> (عليه ${previousDebt.toFixed(2)} جنيه سابقًا)</span>` : ''}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>المنتج</th>
                        <th>المقاس</th>
                        <th>الكمية</th>
                        <th>الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${printItemsHtml}
                </tbody>
            </table>

            ${paymentsHistory.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>تاريخ الدفعة</th>
                        <th>المبلغ المدفوع</th>
                        <th>المتبقي بعد الدفعة</th>
                    </tr>
                </thead>
                <tbody>
                    ${paymentsHistory.map(p => `
                        <tr>
                            <td>${formatRetailDateTime(p.date)}</td>
                            <td class="green">${p.amount.toFixed(2)} جنيه</td>
                            <td class="${p.remainingAfter > 0 ? 'red' : 'green'}">${p.remainingAfter.toFixed(2)} جنيه</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}

            ${returnsPrintHtml(inv)}

            ${printSummaryCardHtml({
                gross: getGrossTotal(inv), returnsTotal: getReturnsTotal(inv), net: currentTotal,
                discount: Number(inv.discount) || 0, previousDebt, grandTotal, paid, remaining,
                settled: !!inv.settled
            })}

            <div style="margin-top: 50px; text-align: center; color: #666; font-size: 13px;">
                شكرًا لتعاملك مع مصطفى الازهرى للادوات الصحية<br>
                برجاء الاحتفاظ بالفاتورة
            </div>
            ${shopPrintFooterHtml(fbQr, '#14B8A6')}
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

// ==================== صفحة "الديون": تجميع كل العملاء (تجار + قطاعي) اللي عليهم فلوس ====================
// بتحسب دين كل عميل بنفس المنطق المستخدم في باقي الشاشة (بما فيه أثر "خالصة" اليدوية اللي
// بتصفّر الدين حتى لو فعليًا المبلغ متدفعش)، عشان الرقم هنا يتطابق تمامًا مع كل شاشة تانية.
function getAllCustomersWithDebt() {
    const names = new Set();
    savedRetailInvoices.forEach(inv => {
        if (inv.customer && inv.customer !== 'عميل غير محدد') names.add(inv.customer.trim());
    });
    savedInvoices.forEach(inv => {
        if (inv.customer && inv.customer !== 'عميل غير محدد') names.add(inv.customer.trim());
    });

    const result = [];
    names.forEach(name => {
        const retailDebt = getRetailCustomerPreviousDebt(name);
        const merchantDebt = getCustomerPreviousDebt(name);
        const total = retailDebt + merchantDebt;
        if (total > 0.009) {
            result.push({ name, retailDebt, merchantDebt, total });
        }
    });

    result.sort((a, b) => b.total - a.total);
    return result;
}

window.renderDebtsList = function() {
    const container = document.getElementById('debts-list');
    const countEl = document.getElementById('debts-customers-count');
    const totalEl = document.getElementById('debts-total-value');
    if (!container) return;

    const searchInput = document.getElementById('search-debts-customer');
    const filter = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const allDebts = getAllCustomersWithDebt();
    const overallTotal = allDebts.reduce((sum, d) => sum + d.total, 0);
    if (countEl) countEl.textContent = allDebts.length;
    if (totalEl) totalEl.textContent = `${overallTotal.toFixed(2)} جنيه`;

    const debts = filter ? allDebts.filter(d => d.name.toLowerCase().includes(filter)) : allDebts;

    container.innerHTML = '';

    if (debts.length === 0) {
        container.innerHTML = `
            <div class="bg-white rounded-2xl p-10 text-center text-gray-500">
                <p>${filter ? 'لا يوجد عميل مطابق للبحث' : ' مفيش حد عليه ديون دلوقتي'}</p>
            </div>
        `;
        return;
    }

    debts.forEach(d => {
        const card = document.createElement('div');
        card.className = 'card-pad flex items-center justify-between gap-3 flex-wrap';
        card.innerHTML = `
            <div class="min-w-0">
                <div class="font-bold text-slate-900 truncate">${d.name}</div>
                <div class="text-xs text-slate-400 mt-1">
                    ${d.retailDebt > 0.009 ? `قطاعي: ${d.retailDebt.toFixed(2)} جنيه` : ''}
                    ${d.retailDebt > 0.009 && d.merchantDebt > 0.009 ? ' — ' : ''}
                    ${d.merchantDebt > 0.009 ? `تجار: ${d.merchantDebt.toFixed(2)} جنيه` : ''}
                </div>
            </div>
            <div class="flex items-center gap-3 flex-wrap">
                <div class="text-xl font-extrabold text-red-600">${d.total.toFixed(2)} جنيه</div>
                ${d.retailDebt > 0.009 ? `<button onclick="goToCustomerDebt('${d.name.replace(/'/g, "\\'")}', 'retail')" class="btn-secondary !py-2 !px-3 text-xs">قطاعي</button>` : ''}
                ${d.merchantDebt > 0.009 ? `<button onclick="goToCustomerDebt('${d.name.replace(/'/g, "\\'")}', 'invoice')" class="btn-secondary !py-2 !px-3 text-xs">تجار</button>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
};

// بيودّيك من صفحة الديون لشاشة فواتير التاجر أو القطاعي، وبيبحث فيها باسم العميل على طول
window.goToCustomerDebt = function(customerName, type) {
    showSection(type);
    if (type === 'retail') {
        const input = document.getElementById('search-retail-customer');
        if (input) {
            input.value = customerName;
            filterRetailInvoicesByCustomer();
        }
        const list = document.getElementById('saved-retail-invoices-list');
        if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        const input = document.getElementById('search-customer');
        if (input) {
            input.value = customerName;
            filterInvoicesByCustomer();
        }
        const list = document.getElementById('saved-invoices-list');
        if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

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
        console.log(" فواتير القطاعي تم حفظها على Firebase");
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
        editingRetailInvoiceIndex = null;
        retailSessionAddedAt = Date.now();
        const paidInput = document.getElementById('retail-paid-input');
        if (paidInput) {
            paidInput.readOnly = false;
            paidInput.classList.remove('opacity-60', 'cursor-not-allowed');
            paidInput.title = '';
        }
        renderRetailTable();
        renderRetailStaging();
        renderRetailPercentGroups();
        updateRetailTotalAndRemaining();

        const cancelBtn = document.getElementById('cancel-edit-retail-btn');
        if (cancelBtn) cancelBtn.classList.add('hidden');
    }
}


// ==================== تعديل السعر لفواتير القطاعي (النسخة النهائية) ====================


// تحديث عند اختيار المقاس (يرجع للسعر الأصلي)
function updateRetailPriceDisplay() {
    const productName = document.getElementById('retail-product-search').value.trim();
    const size = document.getElementById('retail-size-select').value;

    const product = findProductByNameAndCompany(productName, retailSelectedCompany);
    const variant = product?.variants.find(v => v.size === size);

    if (variant) {
        retailPriceAdjustment = 0;                    // تصفير التعديل
        const adjustInput = document.getElementById('retail-price-adjust');
        if (adjustInput) adjustInput.value = 0;
        retailItemAdjustmentConfirmed = false;         // لازم يحط النسبة/المبلغ تاني قبل الإضافة
    }
    updateRetailStockDisplay();   // الكمية المتاحة في المخزن (للشاشة بس)
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

    if (!productName) return alert(' اختر المنتج');
    if (!size) return alert(' اختر المقاس');
    if (qty < 1) return alert(' الكمية غلط');

    const product = findProductByNameAndCompany(productName, retailSelectedCompany);
    if (!product) return alert(' المنتج غير موجود');

    const variant = product.variants.find(v => v.size === size);
    if (!variant) return alert(' المقاس غير موجود');

    // ==== لو المنتج ده اتباع قبل كده في نفس الفاتورة، بياخد نفس السعر اللي اتباع بيه هنا ====
    // (السعر ده خاص بالفاتورة دي بس — أي فاتورة تانية هترجع للسعر الأساسي عادي)
    const sameItemInInvoice = retailInvoice.find(it =>
        it.productName === product.name && String(it.size) === String(size)
    );
    if (sameItemInInvoice) {
        const rememberedPrice = Number(sameItemInInvoice.price) || 0;
        retailInvoice.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            productName: product.name,
            size: size,
            basePrice: variant.price,
            originalPrice: Number(variant.originalPrice) || 0,
            price: rememberedPrice,
            qty: qty,
            subtotal: rememberedPrice * qty,
            company: sameItemInInvoice.company || retailSelectedCompany || (Array.isArray(product.companies) ? product.companies[0] : ''),
            isPercentGroup: !!sameItemInInvoice.isPercentGroup,
            adjustType: sameItemInInvoice.adjustType,
            adjustValue: sameItemInInvoice.adjustValue,
            addedAt: retailSessionAddedAt
        });

        renderRetailTable();
        if (typeof renderRetailPercentGroups === 'function') renderRetailPercentGroups();
        updateRetailTotalAndRemaining();

        if (qtyInput) qtyInput.value = 1;
        const productInputSame = document.getElementById('retail-product-search');
        if (productInputSame) productInputSame.value = '';
        const sizeSelectSame = document.getElementById('retail-size-select');
        if (sizeSelectSame) sizeSelectSame.innerHTML = '<option value="">اختر المقاس...</option>';
        updateRetailStockDisplay();

        showToast(`اتضاف بسعر الفاتورة دي ${rememberedPrice.toFixed(2)} ج (السعر الأساسي ${Number(variant.price).toFixed(2)} ج)`, 'success');
        return;
    }

    const isPercentCompany = PERCENT_COMPANIES.includes(retailSelectedCompany);

    if (isPercentCompany) {
        // الشركات الخاصة (البحر الأحمر / أكوا دلتا / Dr): المنتج بيدخل قائمة مؤقتة من غير أي تعديل سعر هنا
        // النسبة أو المبلغ بيتحطوا لاحقًا عند الضغط على "إضافة للفاتورة"
        retailStaging.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            productName: product.name,
            size: size,
            basePrice: variant.price,
            originalPrice: Number(variant.originalPrice) || 0,
            qty: qty
        });

        renderRetailStaging();

        // تصفير خانة المنتج والمقاس والكمية بعد الإضافة، عشان يبقى سهل تختار منتج جديد
        if (qtyInput) qtyInput.value = 1;
        const productInputStaging = document.getElementById('retail-product-search');
        if (productInputStaging) productInputStaging.value = '';
        const sizeSelectStaging = document.getElementById('retail-size-select');
        if (sizeSelectStaging) sizeSelectStaging.innerHTML = '<option value="">اختر المقاس...</option>';
        updateRetailStockDisplay();

        console.log(`تم إضافة ${product.name} للقائمة المؤقتة`);
        return;
    }

    // === باقي الشركات: لازم اليوزر يحط نسبة الزيادة أو النقصان الأول قبل ما يضيف المنتج ===
    if (!retailItemAdjustmentConfirmed) {
        return alert(' لازم تحط نسبة الزيادة أو النقصان الأول (حتى لو صفر) قبل ما تضيف المنتج');
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
        originalPrice: Number(variant.originalPrice) || 0,
        price: finalPrice,
        qty: qty,
        subtotal: finalPrice * qty,
        company: retailSelectedCompany || (Array.isArray(product.companies) ? product.companies[0] : ''),
        addedAt: retailSessionAddedAt
    });

    renderRetailTable();
    updateRetailTotalAndRemaining();

    // تصفير الكمية
    if (qtyInput) qtyInput.value = 1;

    // تصفير خانة المنتج والمقاس بعد الإضافة، عشان يبقى سهل تختار منتج جديد
    const productInputAfterAdd = document.getElementById('retail-product-search');
    if (productInputAfterAdd) productInputAfterAdd.value = '';
    const sizeSelectAfterAdd = document.getElementById('retail-size-select');
    if (sizeSelectAfterAdd) sizeSelectAfterAdd.innerHTML = '<option value="">اختر المقاس...</option>';
    updateRetailStockDisplay();

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
        console.log(" زرار حفظ فاتورة القطاعي تم ربطه بنجاح");
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

/* ==================================================================================
    إضافات جديدة
   1) نظام المرتجعات داخل الفاتورة (سجل مستقل تحت الفاتورة)
   2) صورة اختيارية للمنتج
   ================================================================================== */

/* ======================= إعدادات سريعة ======================= */
// لو مش عايزة المرتجع يزوّد المخزون في قسم معيّن، غيّري true لـ false
const RETURN_RESTOCK = {
    invoice: true,   // فواتير الجملة (التجار)
    retail: true     // فواتير القطاعي
};

/* ======================= حسابات المرتجعات ======================= */

function getInvoiceReturns(inv) {
    return (inv && Array.isArray(inv.returns)) ? inv.returns : [];
}

// إجمالي قيمة المرتجعات في الفاتورة
function getReturnsTotal(inv) {
    const sum = getInvoiceReturns(inv).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return Number(sum.toFixed(2));
}

// الإجمالي الأصلي للفاتورة (زي ما هو متسجّل، من غير أي مرتجعات)
function getGrossTotal(inv) {
    return Number((Number(inv && inv.total) || 0).toFixed(2));
}

// الصافي النهائي = الإجمالي الأصلي - إجمالي المرتجعات
function getNetTotal(inv) {
    return Number(Math.max(0, getGrossTotal(inv) - getReturnsTotal(inv)).toFixed(2));
}

function getInvoiceByKind(kind, index) {
    return kind === 'retail' ? savedRetailInvoices[index] : savedInvoices[index];
}

// مفتاح ثابت للمنتج جوه الفاتورة (اسم + مقاس + شركة) عشان نربط المرتجع بالمنتج الصح
function itemReturnKey(item) {
    return [
        String(item && item.productName || '').trim(),
        String(item && item.size || '').trim(),
        String(item && item.company || '')
    ].join('|');
}

// صفوف قابلة للإرجاع: بنجمّع المنتج المتكرر في صف واحد ونحسب المرجّع منه قبل كده
function getReturnableRows(inv) {
    const map = new Map();
    (Array.isArray(inv && inv.items) ? inv.items : []).forEach(item => {
        const key = itemReturnKey(item);
        if (!map.has(key)) {
            map.set(key, {
                key,
                productName: item.productName,
                size: item.size,
                company: item.company || '',
                price: Number(item.price) || 0,
                qty: 0
            });
        }
        const row = map.get(key);
        row.qty += Number(item.qty) || 0;
        if (Number(item.price) > 0) row.price = Number(item.price);
    });

    const returns = getInvoiceReturns(inv);
    return Array.from(map.values()).map(row => {
        const returned = returns
            .filter(r => r.key === row.key)
            .reduce((s, r) => s + (Number(r.qty) || 0), 0);
        return { ...row, returned, available: Math.max(0, row.qty - returned) };
    });
}

function formatReturnDateTime(ts) {
    const d = new Date(ts);
    const date = d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const time = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    return `${date} - ${time}`;
}

/* ======================= سجل المرتجعات (العرض) ======================= */
// بيظهر بس لما يكون فيه عمليات إرجاع، وتحت جدول المبيعات تمامًا من غير ما يلمسه
function returnsSectionHtml(kind, index, inv) {
    const returns = getInvoiceReturns(inv).slice().sort((a, b) => (b.at || 0) - (a.at || 0));
    if (returns.length === 0) return '';

    const returnsTotal = getReturnsTotal(inv);
    const gross = getGrossTotal(inv);
    const net = getNetTotal(inv);

    return `
        <div class="bg-white border border-purple-100 rounded-2xl overflow-hidden mb-4 shadow-sm">
            <div class="px-4 sm:px-5 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between gap-2 flex-wrap">
                <h4 class="font-bold text-purple-800 text-sm sm:text-base"> سجل المرتجعات</h4>
                <span class="text-xs font-semibold text-purple-600 bg-white border border-purple-100 rounded-full px-3 py-1">
                    ${returns.length} عملية إرجاع
                </span>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-right border-collapse text-sm">
                    <thead class="bg-purple-50/60">
                        <tr>
                            <th class="py-2 px-3 text-right font-semibold text-purple-700">تاريخ ووقت الإرجاع</th>
                            <th class="py-2 px-3 text-center font-semibold text-purple-700">المنتج</th>
                            <th class="py-2 px-3 text-center font-semibold text-purple-700">المقاس</th>
                            <th class="py-2 px-3 text-center font-semibold text-purple-700">الكمية المرجعة</th>
                            <th class="py-2 px-3 text-center font-semibold text-purple-700">إجمالي المرتجع</th>
                            <th class="py-2 px-3 text-center font-semibold text-purple-700 no-print">تراجع</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${returns.map(r => `
                            <tr class="border-b border-slate-100">
                                <td class="py-2 px-3 text-right text-slate-500 text-xs">${formatReturnDateTime(r.at)}</td>
                                <td class="py-2 px-3 text-center font-medium">${r.productName}</td>
                                <td class="py-2 px-3 text-center">${r.size}</td>
                                <td class="py-2 px-3 text-center font-bold text-purple-700">${Number(r.qty)}</td>
                                <td class="py-2 px-3 text-center font-bold text-purple-700">${Number(r.amount).toFixed(2)} جنيه</td>
                                <td class="py-2 px-3 text-center no-print">
                                    <button onclick="deleteReturnEntry('${kind}', ${index}, '${r.id}')" class="text-red-500 hover:text-red-700 text-xs underline">إلغاء</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 space-y-2 text-sm">
                <div class="flex justify-between items-center">
                    <span class="text-slate-500">الإجمالي الأصلي</span>
                    <span class="font-semibold text-slate-700">${gross.toFixed(2)} جنيه</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-slate-500">إجمالي المرتجعات</span>
                    <span class="font-semibold text-purple-700">− ${returnsTotal.toFixed(2)} جنيه</span>
                </div>
                <div class="flex justify-between items-center pt-2 border-t border-slate-200">
                    <span class="font-bold text-slate-800">الصافي النهائي</span>
                    <span class="text-lg font-extrabold text-blue-600">${net.toFixed(2)} جنيه</span>
                </div>
                ${(Number(inv.paid) || 0) > net + 0.009 ? `
                    <div class="text-xs text-amber-600 pt-1">
                         المدفوع أكبر من الصافي بـ ${((Number(inv.paid) || 0) - net).toFixed(2)} جنيه (فرق للعميل)
                    </div>` : ''}
            </div>
        </div>
    `;
}

// نسخة الطباعة من سجل المرتجعات
// (بتعرض المرتجعات نفسها بس — الأرقام الإجمالية (الأصلي/المرتجع/الصافي) بقت مكانها
//  الوحيد "بطاقة الحساب" اللي بترسمها printSummaryCardHtml تحت، عشان ميتكررش نفس
//  الرقم في مكانين بشكل وحاسبي مختلف ويحصل لخبطة زي اللي كانت موجودة قبل كده)
function returnsPrintHtml(inv) {
    const returns = getInvoiceReturns(inv).slice().sort((a, b) => (b.at || 0) - (a.at || 0));
    if (returns.length === 0) return '';

    return `
        <h3 class="section-title">سجل المرتجعات</h3>
        <table>
            <thead>
                <tr>
                    <th>تاريخ ووقت الإرجاع</th>
                    <th>المنتج</th>
                    <th>المقاس</th>
                    <th>الكمية المرجعة</th>
                    <th>إجمالي المرتجع</th>
                </tr>
            </thead>
            <tbody>
                ${returns.map(r => `
                    <tr>
                        <td>${formatReturnDateTime(r.at)}</td>
                        <td>${r.productName}</td>
                        <td>${r.size}</td>
                        <td>${Number(r.qty)}</td>
                        <td>${Number(r.amount).toFixed(2)} جنيه</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// بطاقة حساب موحّدة للطباعة: كل الأرقام (الإجمالي قبل/بعد المرتجع، الخصم، الدين
// السابق، المدفوع، المتبقي) في مكان واحد بس وبترتيب واحد ثابت، عشان تبقى واضحة
// ومفيش رقم بيتكرر في جدول وفي صندوق تاني بشكل مختلف
function printSummaryCardHtml(opts) {
    const {
        gross = 0, returnsTotal = 0, net = 0, discount = 0,
        previousDebt = 0, grandTotal = 0, paid = 0, remaining = 0, settled = false
    } = opts || {};

    const rows = [];
    rows.push({ label: returnsTotal > 0 ? 'إجمالي الفاتورة قبل المرتجعات' : 'إجمالي الفاتورة', value: `${gross.toFixed(2)} جنيه` });

    if (returnsTotal > 0) {
        rows.push({ label: 'إجمالي المرتجعات', value: `− ${returnsTotal.toFixed(2)} جنيه`, minus: true });
        rows.push({ label: 'الصافي بعد المرتجعات', value: `${net.toFixed(2)} جنيه`, strong: true });
    }
    if (discount > 0) {
        rows.push({ label: 'الخصم', value: `− ${discount.toFixed(2)} جنيه`, minus: true });
    }
    if (previousDebt > 0) {
        rows.push({ label: 'متبقي سابق على العميل', value: `${previousDebt.toFixed(2)} جنيه` });
        rows.push({ label: 'الإجمالي المطلوب', value: `${grandTotal.toFixed(2)} جنيه`, strong: true });
    }
    rows.push({ label: 'المبلغ المدفوع', value: `${paid.toFixed(2)} جنيه`, good: true });

    return `
        <div class="summary-card">
            ${rows.map(r => `
                <div class="summary-row${r.strong ? ' strong' : ''}">
                    <span>${r.label}</span>
                    <span class="${r.minus ? 'red' : (r.good ? 'green' : '')}">${r.value}</span>
                </div>
            `).join('')}
            <div class="summary-row final ${remaining > 0 ? 'due' : 'clear'}">
                <span>المتبقي النهائي</span>
                <span>${remaining.toFixed(2)} جنيه</span>
            </div>
            ${settled ? `<div class="summary-note">اتحطت خالصة يدويًا</div>` : ''}
        </div>
    `;
}

/* ======================= نافذة تسجيل المرتجع ======================= */

let returnsContext = null;   // { kind: 'invoice' | 'retail', index }

window.openReturnsModal = function (kind, index) {
    const inv = getInvoiceByKind(kind, index);
    if (!inv) return;

    returnsContext = { kind, index };

    const customerEl = document.getElementById('returns-modal-customer');
    if (customerEl) customerEl.textContent = inv.customer || 'عميل غير محدد';

    const kindEl = document.getElementById('returns-modal-kind');
    if (kindEl) kindEl.textContent = kind === 'retail' ? 'فاتورة قطاعي' : 'فاتورة جملة';

    renderReturnsModalRows();

    const modal = document.getElementById('returns-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.closeReturnsModal = function () {
    returnsContext = null;
    const modal = document.getElementById('returns-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

function renderReturnsModalRows() {
    const container = document.getElementById('returns-rows-container');
    if (!container || !returnsContext) return;

    const inv = getInvoiceByKind(returnsContext.kind, returnsContext.index);
    if (!inv) return;

    const rows = getReturnableRows(inv);

    if (rows.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-6">الفاتورة دي مفيهاش منتجات</div>`;
        return;
    }

    container.innerHTML = rows.map((row, i) => `
        <div class="border border-slate-200 rounded-xl p-3 ${row.available === 0 ? 'opacity-60 bg-slate-50' : 'bg-white'}">
            <div class="flex justify-between items-center gap-3 flex-wrap mb-2">
                <div class="min-w-0">
                    <div class="font-semibold text-slate-800 truncate">${row.productName}</div>
                    <div class="text-xs text-slate-400">مقاس ${row.size} • ${Number(row.price).toFixed(2)} جنيه للقطعة</div>
                </div>
                <div class="text-xs text-slate-500 shrink-0">
                    اتباع ${row.qty}${row.returned > 0 ? ` • مرجّع ${row.returned}` : ''}
                </div>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
                <label class="text-xs text-slate-500">الكمية المرجعة</label>
                <input id="return-qty-${i}"
                       type="number"
                       min="0"
                       step="1"
                       max="${row.available}"
                       value="0"
                       ${row.available === 0 ? 'disabled' : ''}
                       oninput="updateReturnsPreview()"
                       class="input-base !py-2 w-24 text-center font-bold">
                <span class="text-xs ${row.available === 0 ? 'text-red-500' : 'text-slate-400'}">
                    ${row.available === 0 ? 'اترجع بالكامل' : `المتاح للإرجاع: ${row.available}`}
                </span>
            </div>
        </div>
    `).join('');

    updateReturnsPreview();
}

window.updateReturnsPreview = function () {
    if (!returnsContext) return;
    const inv = getInvoiceByKind(returnsContext.kind, returnsContext.index);
    if (!inv) return;

    const rows = getReturnableRows(inv);
    let total = 0;
    rows.forEach((row, i) => {
        const input = document.getElementById(`return-qty-${i}`);
        const qty = Math.max(0, parseFloat(input ? input.value : 0) || 0);
        total += qty * row.price;
    });

    const el = document.getElementById('returns-preview-total');
    if (el) el.textContent = total.toFixed(2) + ' جنيه';
};

window.submitReturns = function () {
    if (!returnsContext) return;
    const { kind, index } = returnsContext;
    const inv = getInvoiceByKind(kind, index);
    if (!inv) return;

    const rows = getReturnableRows(inv);
    const picked = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const input = document.getElementById(`return-qty-${i}`);
        const qty = Math.max(0, parseFloat(input ? input.value : 0) || 0);
        if (qty <= 0) continue;

        if (qty > row.available + 0.0001) {
            return alert(` "${row.productName}" مقاس ${row.size}: المتاح للإرجاع ${row.available} بس`);
        }
        picked.push({
            key: row.key,
            productName: row.productName,
            size: row.size,
            company: row.company,
            price: row.price,
            qty: qty,
            amount: Number((row.price * qty).toFixed(2))
        });
    }

    if (picked.length === 0) {
        return showToast(' اكتبي الكمية المرجعة الأول', 'error');
    }

    const totalAmount = picked.reduce((s, p) => s + p.amount, 0);
    // لو الفاتورة لسه متخصمتش من المخزن، المرتجع ميزودش المخزون (مفيش حاجة خرجت أصلًا)
    const restock = !!RETURN_RESTOCK[kind] && getInvoiceStockState(inv, kind) !== 'pending';
    const msg = `هتسجلي مرتجع بقيمة ${totalAmount.toFixed(2)} جنيه`
        + (restock ? '\nوالكميات هترجع للمخزون تلقائيًا.' : '')
        + '\nتأكيد؟';
    if (!confirm(msg)) return;

    if (!Array.isArray(inv.returns)) inv.returns = [];

    const at = Date.now();
    picked.forEach(p => {
        inv.returns.push({
            id: at + '-' + Math.floor(Math.random() * 100000),
            at: at,
            key: p.key,
            productName: p.productName,
            size: p.size,
            company: p.company,
            qty: p.qty,
            price: p.price,
            amount: p.amount
        });
    });

    // رجوع الكمية للمخزون
    if (restock) {
        adjustStockForItems(picked.map(p => ({
            productName: p.productName,
            size: p.size,
            company: p.company,
            qty: p.qty
        })), +1);
    }

    persistReturnsChange(kind, inv);
    closeReturnsModal();
    showToast(` تم تسجيل مرتجع بقيمة ${totalAmount.toFixed(2)} جنيه`, 'success');
};

// إلغاء عملية إرجاع اتسجلت بالغلط
window.deleteReturnEntry = function (kind, index, returnId) {
    const inv = getInvoiceByKind(kind, index);
    if (!inv || !Array.isArray(inv.returns)) return;

    const entry = inv.returns.find(r => String(r.id) === String(returnId));
    if (!entry) return;

    if (!confirm(`هل تريدين إلغاء إرجاع "${entry.productName}" (${entry.qty} قطعة)؟`)) return;

    inv.returns = inv.returns.filter(r => String(r.id) !== String(returnId));

    // نرجّع المخزون لحالته قبل الإرجاع
    if (RETURN_RESTOCK[kind] && getInvoiceStockState(inv, kind) !== 'pending') {
        adjustStockForItems([{
            productName: entry.productName,
            size: entry.size,
            company: entry.company,
            qty: entry.qty
        }], -1);
    }

    persistReturnsChange(kind, inv);
    showToast(' تم إلغاء عملية الإرجاع', 'warning');
};

function persistReturnsChange(kind, inv) {
    if (kind === 'retail') {
        recalculateAllRetailInvoicesForCustomer(inv.customer);
        saveAllRetailInvoices();
        renderRetailInvoices();
    } else {
        recalculateAllInvoicesForCustomer(inv.customer);
        saveAllInvoices();
        renderSavedInvoices();
    }
    if (typeof renderDebtsList === 'function') renderDebtsList();
}

/* ======================= صور المنتجات (اختيارية) ======================= */

let productImages = {};            // { [productId]: dataURL }
let editingProductImage = '';      // الصورة المختارة حاليًا في المودال

const PRODUCT_IMAGE_MAX_SIDE = 320;   // أكبر بُعد للصورة المصغرة
const PRODUCT_IMAGE_QUALITY = 0.6;    // جودة الضغط
const PRODUCT_IMAGES_SOFT_LIMIT = 700 * 1024;  // حد تحذيري (مستند Firestore أقصاه 1 ميجا)

const SANITARY_PLACEHOLDER_SVG = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
         stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7">
        <path d="M12 2.7 6.9 8.3a7.2 7.2 0 1 0 10.2 0z"></path>
    </svg>
`;

async function saveProductImages() {
    try {
        await db.collection("appData").doc("productImages").set({
            images: productImages,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error("خطأ في حفظ صور المنتجات:", e);
        showToast(' الصور مقدرتش تتحفظ على السيرفر', 'error');
    }
}

async function loadProductImages() {
    try {
        const doc = await db.collection("appData").doc("productImages").get();
        productImages = (doc.exists && doc.data().images) ? doc.data().images : {};
    } catch (e) {
        console.error("خطأ في تحميل صور المنتجات:", e);
        productImages = {};
    }
}

function getProductImage(id) {
    return productImages[String(id)] || '';
}

// ضغط الصورة قبل الحفظ عشان مساحة التخزين
function compressImageFile(file, maxSide = PRODUCT_IMAGE_MAX_SIDE, quality = PRODUCT_IMAGE_QUALITY) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => reject(new Error('صورة غير صالحة'));
            img.src = reader.result;
        };
        reader.onerror = () => reject(new Error('مقدرناش نقرأ الملف'));
        reader.readAsDataURL(file);
    });
}

window.handleProductImageChange = async function (input) {
    const file = input && input.files ? input.files[0] : null;
    if (!file) return;

    if (!String(file.type || '').startsWith('image/')) {
        input.value = '';
        return showToast(' اختاري ملف صورة', 'error');
    }

    try {
        editingProductImage = await compressImageFile(file);
        renderProductImagePreview();
    } catch (e) {
        console.error(e);
        showToast(' مقدرناش نجهّز الصورة، جربي صورة تانية', 'error');
    } finally {
        input.value = '';   // عشان تقدر ترفع نفس الصورة تاني لو حبت
    }
};

window.removeProductImageFromModal = function () {
    editingProductImage = '';
    renderProductImagePreview();
};

function renderProductImagePreview() {
    const box = document.getElementById('product-image-preview');
    const removeBtn = document.getElementById('product-image-remove-btn');
    if (!box) return;

    if (editingProductImage) {
        box.innerHTML = `<img src="${editingProductImage}" alt="صورة المنتج" class="w-full h-full object-cover">`;
        box.classList.remove('text-slate-300');
    } else {
        box.innerHTML = SANITARY_PLACEHOLDER_SVG;
        box.classList.add('text-slate-300');
    }
    if (removeBtn) removeBtn.classList.toggle('hidden', !editingProductImage);
}

// الصورة المصغرة جوه كارت المنتج (أو البديل الأنيق لو مفيش صورة)
function productThumbHtml(product) {
    const src = getProductImage(product.id);
    if (src) {
        return `
            <button type="button" onclick="openProductImageLightbox(${product.id})"
                    class="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-slate-200 shadow-sm shrink-0 bg-white cursor-zoom-in">
                <img src="${src}" alt="صورة المنتج" class="w-full h-full object-cover">
            </button>
        `;
    }
    return `
        <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center shrink-0 text-slate-300">
            ${SANITARY_PLACEHOLDER_SVG}
        </div>
    `;
}

window.openProductImageLightbox = function (productId) {
    const src = getProductImage(productId);
    if (!src) return;
    const box = document.getElementById('image-lightbox');
    const img = document.getElementById('image-lightbox-img');
    if (!box || !img) return;
    img.src = src;
    box.classList.remove('hidden');
    box.classList.add('flex');
};

window.closeProductImageLightbox = function () {
    const box = document.getElementById('image-lightbox');
    if (!box) return;
    box.classList.add('hidden');
    box.classList.remove('flex');
};

// حفظ/مسح صورة منتج بعد ما المنتج نفسه يتحفظ
function persistProductImage(productId) {
    const key = String(productId);
    if (editingProductImage) {
        productImages[key] = editingProductImage;
    } else {
        delete productImages[key];
    }

    const approxSize = JSON.stringify(productImages).length;
    if (approxSize > PRODUCT_IMAGES_SOFT_LIMIT) {
        showToast(' مساحة صور المنتجات قربت تخلص — امسحي صور قديمة', 'warning');
    }

    saveProductImages();
}
