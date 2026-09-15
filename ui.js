/* =====================================================================================
   طبقة الواجهة الجديدة (UI Layer)
   -------------------------------------------------------------------------------------
   الملف ده بيتحمّل بعد script.js وبيستبدل دوال العرض القديمة فقط.
   كل منطق الشغل (Firebase / الحسابات / المخزون / الفواتير) زي ما هو في script.js.
   ===================================================================================== */

/* ============================== 1) نظام الأيقونات ============================== */

const ICON_PATHS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    box: '<path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    receipt: '<path d="M4 2v20l2.5-1.5L9 22l2.5-1.5L14 22l2.5-1.5L19 22V2l-2.5 1.5L14 2l-2.5 1.5L9 2 6.5 3.5z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.5 3h2l2.6 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/>',
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M17 12h.01"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-3 3.9"/><path d="M6.6 6.6A18 18 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M20 14v.01"/><path d="M14 20v.01"/><path d="M20 20v.01"/><path d="M17.5 17.5h.01"/>',
    printer: '<path d="M6 9V3h12v6"/><path d="M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1"/><rect x="6" y="14" width="12" height="7" rx="1"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    filter: '<path d="M3 5h18"/><path d="M7 12h10"/><path d="M10 19h4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 7h1"/><path d="M14 7h1"/><path d="M9 11h1"/><path d="M14 11h1"/><path d="M10 22v-4h4v4"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    droplet: '<path d="M12 2.7 6.9 8.3a7.2 7.2 0 1 0 10.2 0z"/>',
    trending: '<path d="m3 17 6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
    restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 8v4l3 2"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M3 12h18"/>'
};

function icon(name, cls) {
    const d = ICON_PATHS[name];
    if (!d) return '';
    return `<svg class="${cls || 'w-4 h-4'}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}
window.icon = icon;

/* ============================== 2) أدوات مساعدة ============================== */

const PALETTE = {
    bg: '#F6F7FB', dark: '#1E2233', primary: '#6D5CE7', accent: '#8B5CF6',
    surface: '#FFFFFF', success: '#10B981', danger: '#EF4444'
};

function fmtMoney(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtNum(n) {
    return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function esc(s) {
    return String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function dayKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shortDate(ts) {
    return new Date(ts).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}
function fullDate(ts) {
    return new Date(ts).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

// حالة المقاس من ناحية المخزون
function variantStatus(v) {
    const has = v.stock !== undefined && v.stock !== null && v.stock !== '';
    const stock = Number(v.stock) || 0;
    const threshold = Number(v.alertThreshold) || 0;
    if (!has) return 'unknown';
    if (stock <= 0) return 'out';
    if (threshold > 0 && stock <= threshold) return 'low';
    return 'ok';
}
function productStatus(p) {
    const list = (p.variants || []).map(variantStatus);
    if (list.some(s => s === 'out')) return 'out';
    if (list.some(s => s === 'low')) return 'low';
    if (list.every(s => s === 'unknown')) return 'unknown';
    return 'ok';
}
const STATUS_META = {
    ok:      { label: 'متاح',        cls: 'status-ok' },
    low:     { label: 'مخزون منخفض', cls: 'status-low' },
    out:     { label: 'نفد',          cls: 'status-out' },
    unknown: { label: 'غير محدد',     cls: 'status-muted' }
};
function statusBadge(status) {
    const m = STATUS_META[status] || STATUS_META.unknown;
    return `<span class="status-pill ${m.cls}">${m.label}</span>`;
}

/* ============================== 3) رسوم بيانية SVG خفيفة ============================== */

// رسم مساحة/خط — بيانات: [{label, value}]
function areaChart(data, opts) {
    opts = opts || {};
    const w = 720, h = 220, padX = 34, padY = 22;
    if (!data.length) return emptyChart('لا توجد بيانات كافية');

    const values = data.map(d => d.value);
    const max = Math.max(...values, 1);
    const stepX = (w - padX * 2) / Math.max(1, data.length - 1);
    const y = v => h - padY - (v / max) * (h - padY * 2);

    const pts = data.map((d, i) => [padX + i * stepX, y(d.value)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - padY} L${pts[0][0].toFixed(1)},${h - padY} Z`;

    const gridLines = [0, 0.5, 1].map(f => {
        const gy = padY + f * (h - padY * 2);
        return `<line x1="${padX}" y1="${gy}" x2="${w - padX}" y2="${gy}" class="chart-grid"/>`;
    }).join('');

    const labelEvery = Math.ceil(data.length / 7);
    const labels = data.map((d, i) => (i % labelEvery === 0 || i === data.length - 1)
        ? `<text x="${padX + i * stepX}" y="${h - 4}" class="chart-label" text-anchor="middle">${esc(d.label)}</text>` : '').join('');

    const dots = pts.map((p, i) => `
        <g class="chart-point">
            <circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="9" fill="transparent"/>
            <circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" class="chart-dot"/>
            <title>${esc(data[i].label)} — ${fmtMoney(data[i].value)} جنيه</title>
        </g>`).join('');

    return `
    <svg viewBox="0 0 ${w} ${h}" class="w-full h-[220px]" preserveAspectRatio="none">
        <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${PALETTE.accent}" stop-opacity="0.22"/>
                <stop offset="100%" stop-color="${PALETTE.accent}" stop-opacity="0"/>
            </linearGradient>
        </defs>
        ${gridLines}
        <path d="${area}" fill="url(#areaFill)"/>
        <path d="${line}" fill="none" stroke="${PALETTE.accent}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
        ${labels}
        <text x="${padX}" y="${padY - 8}" class="chart-label">${fmtNum(max)}</text>
    </svg>`;
}

// أعمدة أفقية — بيانات: [{label, value}]
function barList(data, opts) {
    opts = opts || {};
    if (!data.length) return emptyChart(opts.empty || 'لا توجد بيانات كافية');
    const max = Math.max(...data.map(d => d.value), 1);
    return `<div class="space-y-3">` + data.map(d => `
        <div>
            <div class="flex items-center justify-between text-[13px] mb-1.5">
                <span class="text-ink-700 truncate ml-3">${esc(d.label)}</span>
                <span class="tabular font-semibold text-ink-900">${opts.money ? fmtMoney(d.value) : fmtNum(d.value)}</span>
            </div>
            <div class="h-1.5 rounded-full bg-line overflow-hidden">
                <div class="h-full rounded-full" style="width:${Math.max(2, (d.value / max) * 100).toFixed(1)}%;background:${opts.color || PALETTE.primary}"></div>
            </div>
        </div>`).join('') + `</div>`;
}

// دونات — بيانات: [{label, value, color}]
function donutChart(data) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total <= 0) return emptyChart('لا توجد بيانات مخزون');

    const r = 54, c = 2 * Math.PI * r;
    let offset = 0;
    const arcs = data.map(d => {
        const len = (d.value / total) * c;
        const seg = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${d.color}" stroke-width="16"
            stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"
            transform="rotate(-90 70 70)"><title>${esc(d.label)}: ${fmtNum(d.value)}</title></circle>`;
        offset += len;
        return seg;
    }).join('');

    return `
    <div class="flex items-center gap-6 flex-wrap">
        <svg viewBox="0 0 140 140" class="w-[140px] h-[140px] shrink-0">
            <circle cx="70" cy="70" r="${r}" fill="none" stroke="#EDE8E0" stroke-width="16"/>
            ${arcs}
            <text x="70" y="66" text-anchor="middle" class="chart-donut-value">${fmtNum(total)}</text>
            <text x="70" y="84" text-anchor="middle" class="chart-label">مقاس</text>
        </svg>
        <div class="space-y-2.5 flex-1 min-w-[140px]">
            ${data.map(d => `
                <div class="flex items-center justify-between gap-3 text-[13px]">
                    <span class="flex items-center gap-2 text-ink-700">
                        <span class="w-2.5 h-2.5 rounded-sm" style="background:${d.color}"></span>${esc(d.label)}
                    </span>
                    <span class="tabular font-semibold text-ink-900">${fmtNum(d.value)}</span>
                </div>`).join('')}
        </div>
    </div>`;
}

function emptyChart(msg) {
    return `<div class="flex items-center justify-center h-[180px] text-sm text-ink-400">${esc(msg)}</div>`;
}

/* ============================== 4) لوحة المعلومات ============================== */

function allInvoicesUnified() {
    const a = (savedInvoices || []).map((inv, i) => ({ inv, index: i, type: 'invoice' }));
    const b = (savedRetailInvoices || []).map((inv, i) => ({ inv, index: i, type: 'retail' }));
    return a.concat(b);
}

function computeDashboard() {
    const valid = (products || []).filter(p => p && Array.isArray(p.variants));
    const variants = valid.reduce((s, p) => s + p.variants.length, 0);

    let unitsInStock = 0, low = 0, out = 0, ok = 0;
    valid.forEach(p => p.variants.forEach(v => {
        const st = variantStatus(v);
        if (st !== 'unknown') unitsInStock += Number(v.stock) || 0;
        if (st === 'low') low++; else if (st === 'out') out++; else if (st === 'ok') ok++;
    }));

    const all = allInvoicesUnified();
    const salesValue = all.reduce((s, x) => s + getNetTotal(x.inv), 0);

    let profit = 0;
    (savedRetailInvoices || []).forEach(inv => {
        try { profit += computeRetailInvoiceProfitAdjusted(inv) || 0; } catch (e) { /* تجاهل */ }
    });

    // آخر 14 يوم
    const days = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        days.push({ key: dayKey(d.getTime()), label: shortDate(d.getTime()), value: 0, count: 0 });
    }
    const dayMap = new Map(days.map(d => [d.key, d]));
    all.forEach(x => {
        const rec = dayMap.get(dayKey(x.inv.date));
        if (rec) { rec.value += getNetTotal(x.inv); rec.count += 1; }
    });

    // مبيعات حسب الشركة + أكثر المنتجات مبيعًا
    const byCompany = new Map(), byProduct = new Map();
    all.forEach(x => {
        (x.inv.items || []).forEach(it => {
            const cid = it.company || '';
            byCompany.set(cid, (byCompany.get(cid) || 0) + (Number(it.subtotal) || 0));
            const pn = it.productName || '—';
            byProduct.set(pn, (byProduct.get(pn) || 0) + (Number(it.qty) || 0));
        });
    });

    const companies = Array.from(byCompany.entries())
        .map(([id, value]) => ({ label: getCompanyLabel(id) || 'غير محدد', value }))
        .sort((a, b) => b.value - a.value).slice(0, 6);

    const topProducts = Array.from(byProduct.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value).slice(0, 6);

    let debtTotal = 0;
    try { debtTotal = (getAllCustomersWithDebt() || []).reduce((s, c) => s + c.total, 0); } catch (e) { debtTotal = 0; }

    return {
        productsCount: valid.length, variants, unitsInStock, low, out, ok,
        invoicesCount: all.length, salesValue, profit, days, companies, topProducts, debtTotal
    };
}

function kpi(label, value, sub, iconName, tone) {
    return `
    <div class="kpi">
        <div class="kpi-icon ${tone || ''}">${icon(iconName, 'w-[18px] h-[18px]')}</div>
        <div class="min-w-0">
            <div class="kpi-label">${esc(label)}</div>
            <div class="kpi-value tabular">${value}</div>
            ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
        </div>
    </div>`;
}

function renderDashboard() {
    const root = document.getElementById('dashboard-body');
    if (!root) return;
    const d = computeDashboard();

    root.innerHTML = `
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            ${kpi('إجمالي المبيعات', fmtMoney(d.salesValue) + '<span class="unit"> ج.م</span>', `${fmtNum(d.invoicesCount)} فاتورة`, 'trending', 'tone-accent')}
            ${kpi('صافي الأرباح (قطاعي)', fmtMoney(d.profit) + '<span class="unit"> ج.م</span>', 'محسوبة من فواتير القطاعي', 'wallet', 'tone-success')}
            ${kpi('المستحقات على العملاء', fmtMoney(d.debtTotal) + '<span class="unit"> ج.م</span>', 'جملة + قطاعي', 'users', 'tone-danger')}
            ${kpi('إجمالي المخزون', fmtNum(d.unitsInStock) + '<span class="unit"> قطعة</span>', `${fmtNum(d.productsCount)} منتج · ${fmtNum(d.variants)} مقاس`, 'box', 'tone-primary')}
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
            <section class="panel xl:col-span-2">
                <header class="panel-head">
                    <div>
                        <h3 class="panel-title">حركة المبيعات</h3>
                        <p class="panel-sub">آخر 14 يوم — جملة وقطاعي</p>
                    </div>
                    <span class="tabular text-sm font-semibold text-ink-900">
                        ${fmtMoney(d.days.reduce((s, x) => s + x.value, 0))} ج.م
                    </span>
                </header>
                <div class="panel-body">${areaChart(d.days)}</div>
            </section>

            <section class="panel">
                <header class="panel-head">
                    <div>
                        <h3 class="panel-title">حالة المخزون</h3>
                        <p class="panel-sub">توزيع المقاسات</p>
                    </div>
                </header>
                <div class="panel-body">
                    ${donutChart([
                        { label: 'متاح', value: d.ok, color: PALETTE.success },
                        { label: 'مخزون منخفض', value: d.low, color: PALETTE.accent },
                        { label: 'نفد', value: d.out, color: PALETTE.danger }
                    ])}
                    ${d.low + d.out > 0 ? `
                        <button onclick="goToLowStock()" class="btn-tertiary w-full mt-4 justify-between">
                            <span>عرض المقاسات المنخفضة (${fmtNum(d.low + d.out)})</span>
                            ${icon('chevronLeft', 'w-4 h-4')}
                        </button>` : ''}
                </div>
            </section>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <section class="panel">
                <header class="panel-head">
                    <div>
                        <h3 class="panel-title">المبيعات حسب الشركة</h3>
                        <p class="panel-sub">قيمة المبيعات لكل شركة</p>
                    </div>
                </header>
                <div class="panel-body">${barList(d.companies, { money: true, color: PALETTE.primary, empty: 'مفيش مبيعات مسجلة' })}</div>
            </section>

            <section class="panel">
                <header class="panel-head">
                    <div>
                        <h3 class="panel-title">الأكثر مبيعًا</h3>
                        <p class="panel-sub">بعدد القطع المباعة</p>
                    </div>
                </header>
                <div class="panel-body">${barList(d.topProducts, { color: PALETTE.accent, empty: 'مفيش مبيعات مسجلة' })}</div>
            </section>
        </div>

        <section class="panel mt-4">
            <header class="panel-head">
                <div>
                    <h3 class="panel-title">نشاط الفواتير</h3>
                    <p class="panel-sub">عدد الفواتير اليومية خلال آخر 14 يوم</p>
                </div>
            </header>
            <div class="panel-body">
                <div class="flex items-end gap-1.5 h-[120px]">
                    ${(() => {
                        const max = Math.max(...d.days.map(x => x.count), 1);
                        return d.days.map(x => `
                            <div class="flex-1 flex flex-col items-center gap-2 group">
                                <div class="w-full rounded-t-[4px] transition-colors"
                                     style="height:${Math.max(3, (x.count / max) * 96)}px;background:${x.count ? PALETTE.primary : '#E6E1D8'}"
                                     title="${esc(x.label)}: ${x.count} فاتورة"></div>
                                <span class="text-[10px] text-ink-400 whitespace-nowrap">${esc(x.label)}</span>
                            </div>`).join('');
                    })()}
                </div>
            </div>
        </section>
    `;
}
window.renderDashboard = renderDashboard;

function goToLowStock() {
    showSection('products');
    setProductStockFilter('low');
}
window.goToLowStock = goToLowStock;

/* ============================== 5) جدول المخزون + الفلاتر ============================== */

let productStockFilter = '';   // '' | 'ok' | 'low' | 'out'

function setProductStockFilter(value) {
    productStockFilter = value === productStockFilter ? '' : value;
    document.querySelectorAll('[data-stock-filter]').forEach(btn => {
        btn.classList.toggle('chip-active', btn.getAttribute('data-stock-filter') === productStockFilter);
    });
    applyProductsFilter();
}
window.setProductStockFilter = setProductStockFilter;

// إعادة تعريف: فلترة المنتجات (بحث + شركة + حالة المخزون)
window.applyProductsFilter = function () {
    const searchBox = document.getElementById('product-search-box');
    const query = searchBox ? searchBox.value.trim().toLowerCase() : '';

    let filtered = Array.isArray(products) ? products : [];

    if (productsSelectedCompany) {
        filtered = filtered.filter(p => Array.isArray(p.companies) && p.companies.includes(productsSelectedCompany));
    }
    if (query) {
        filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(query));
    }
    if (productStockFilter) {
        filtered = filtered.filter(p => productStatus(p) === productStockFilter);
    }

    renderProducts(filtered);
};

// إعادة تعريف: ملخص أعلى صفحة المخزون
window.updateProductsStats = function () {
    const valid = (products || []).filter(p => p && Array.isArray(p.variants));
    const variants = valid.reduce((s, p) => s + p.variants.length, 0);
    let units = 0, low = 0, out = 0;
    valid.forEach(p => p.variants.forEach(v => {
        const st = variantStatus(v);
        if (st !== 'unknown') units += Number(v.stock) || 0;
        if (st === 'low') low++;
        if (st === 'out') out++;
    }));

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-products-count', fmtNum(valid.length));
    set('stat-variants-count', fmtNum(variants));
    set('stat-units-count', fmtNum(units));
    set('stat-low-count', fmtNum(low + out));

    const lowChip = document.getElementById('chip-low-count');
    if (lowChip) lowChip.textContent = fmtNum(low + out);
};

// إعادة تعريف: تنبيه المخزون المنخفض (شريط هادي مش لون أحمر على الشاشة كلها)
window.updateLowStockAlert = function () {
    const bar = document.getElementById('low-stock-bar');
    const text = document.getElementById('low-stock-text');
    if (!bar || !text) return;

    const items = [];
    (products || []).forEach(p => {
        if (!p || !Array.isArray(p.variants)) return;
        p.variants.forEach(v => {
            const st = variantStatus(v);
            if (st === 'low' || st === 'out') items.push({ name: p.name, size: v.size, stock: Number(v.stock) || 0, st });
        });
    });

    if (items.length === 0) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    const outCount = items.filter(i => i.st === 'out').length;
    text.textContent = outCount
        ? `${items.length} مقاس يحتاج إعادة طلب — منهم ${outCount} نفد بالكامل`
        : `${items.length} مقاس وصل لحد التنبيه`;
};

window.toggleLowStockPanel = function () { setProductStockFilter('low'); };

// إعادة تعريف: إظهار/إخفاء السعر الأصلي
window.toggleOriginalPriceCell = function (btn) {
    const wrapper = btn.parentElement;
    if (!wrapper) return;
    const maskEl = wrapper.querySelector('.hidden-price-mask');
    const valueEl = wrapper.querySelector('.hidden-price-value');
    if (!maskEl || !valueEl) return;
    const isHidden = valueEl.classList.contains('hidden');
    maskEl.classList.toggle('hidden', isHidden);
    valueEl.classList.toggle('hidden', !isHidden);
    btn.innerHTML = icon(isHidden ? 'eyeOff' : 'eye', 'w-4 h-4');
};

// إعادة تعريف: عرض المنتجات كجدول مخزون احترافي
window.renderProducts = function (filtered) {
    if (filtered === undefined) filtered = products;
    updateProductsStats();
    updateLowStockAlert();

    const container = document.getElementById('products-list');
    if (!container) return;

    const list = (Array.isArray(filtered) ? filtered : []).filter(p => p && Array.isArray(p.variants));

    if (list.length === 0) {
        container.innerHTML = `
            <div class="panel">
                <div class="empty-state">
                    ${icon('box', 'w-8 h-8 mb-3 text-ink-300')}
                    <p class="font-semibold text-ink-700">لا توجد منتجات مطابقة</p>
                    <p class="text-sm text-ink-400 mt-1">جرّبي تغيير كلمة البحث أو الفلاتر</p>
                    <button onclick="resetProductFilters()" class="btn-tertiary mt-4">مسح الفلاتر</button>
                </div>
            </div>`;
        return;
    }

    const rows = list.map(product => {
        const prices = product.variants.map(v => Number(v.price) || 0).filter(n => n > 0);
        const priceRange = prices.length
            ? (Math.min(...prices) === Math.max(...prices)
                ? fmtMoney(prices[0])
                : `${fmtMoney(Math.min(...prices))} – ${fmtMoney(Math.max(...prices))}`)
            : '—';
        const stock = product.variants.reduce((s, v) => {
            const has = v.stock !== undefined && v.stock !== null && v.stock !== '';
            return s + (has ? (Number(v.stock) || 0) : 0);
        }, 0);
        const companies = (product.companies || []).map(c => getCompanyLabel(c)).filter(Boolean);
        const st = productStatus(product);

        return `
        <tr class="row" onclick="openProductDrawer(${product.id})">
            <td class="cell-main">
                <div class="flex items-center gap-3 min-w-0">
                    ${productThumbHtml(product)}
                    <div class="min-w-0">
                        <div class="font-semibold text-ink-900 truncate">${esc(product.name)}</div>
                        <div class="text-xs text-ink-400 mt-0.5">${product.variants.length} مقاس</div>
                    </div>
                </div>
            </td>
            <td class="cell hide-md">
                <span class="text-ink-600 text-[13px]">${companies.length ? esc(companies.join('، ')) : '—'}</span>
            </td>
            <td class="cell text-center tabular hide-sm">${fmtNum(product.variants.length)}</td>
            <td class="cell text-center tabular font-semibold">${fmtNum(stock)}</td>
            <td class="cell text-center tabular hide-sm">${priceRange}</td>
            <td class="cell text-center">${statusBadge(st)}</td>
            <td class="cell text-left no-print" onclick="event.stopPropagation()">
                <div class="relative inline-block">
                    <button type="button" class="icon-btn" title="إجراءات" onclick="toggleMenu('pmenu-${product.id}')">${icon('more', 'w-[18px] h-[18px]')}</button>
                    <div id="pmenu-${product.id}" class="menu hidden">
                        <button type="button" onclick="closeAllMenus(); openProductDrawer(${product.id})">${icon('eye')} عرض التفاصيل</button>
                        <button type="button" onclick="closeAllMenus(); editProduct(${product.id})">${icon('edit')} تعديل</button>
                        <button type="button" onclick="closeAllMenus(); openQrPanel(${product.id})">${icon('qr')} كود QR</button>
                        <button type="button" class="menu-danger" onclick="closeAllMenus(); deleteProduct(${product.id})">${icon('trash')} حذف</button>
                    </div>
                </div>
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="panel overflow-hidden">
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="text-right">المنتج</th>
                            <th class="text-right hide-md">الشركة</th>
                            <th class="text-center hide-sm">المقاسات</th>
                            <th class="text-center">المخزون</th>
                            <th class="text-center hide-sm">السعر</th>
                            <th class="text-center">الحالة</th>
                            <th class="text-left no-print"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div class="table-foot">
                <span>${fmtNum(list.length)} منتج معروض</span>
            </div>
        </div>`;
};

function resetProductFilters() {
    const searchBox = document.getElementById('product-search-box');
    if (searchBox) searchBox.value = '';
    productsSelectedCompany = '';
    productStockFilter = '';
    updateProductsCompanyFilterActiveState();
    document.querySelectorAll('[data-stock-filter]').forEach(b => b.classList.remove('chip-active'));
    applyProductsFilter();
}
window.resetProductFilters = resetProductFilters;

/* ============================== 6) درج تفاصيل المنتج ============================== */

let drawerProductId = null;

function openProductDrawer(id) {
    const product = (products || []).find(p => p.id === id);
    if (!product) return;
    drawerProductId = id;

    const body = document.getElementById('drawer-body');
    const title = document.getElementById('drawer-title');
    const subtitle = document.getElementById('drawer-subtitle');
    if (!body) return;

    const companies = (product.companies || []).map(c => getCompanyLabel(c)).filter(Boolean);
    if (title) title.textContent = product.name;
    if (subtitle) subtitle.textContent = companies.length ? companies.join('، ') : 'بدون شركة';

    const img = getProductImage(product.id);
    const totalStock = product.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);

    body.innerHTML = `
        <div class="flex items-start gap-4 pb-5 border-b border-line">
            ${img
                ? `<img src="${img}" alt="" class="w-20 h-20 rounded-lg object-cover border border-line">`
                : `<div class="w-20 h-20 rounded-lg border border-line bg-bg flex items-center justify-center text-ink-300">${icon('droplet', 'w-7 h-7')}</div>`}
            <div class="min-w-0 flex-1">
                <div class="flex flex-wrap gap-1.5 mb-2">
                    ${companies.map(c => `<span class="tag">${esc(c)}</span>`).join('') || '<span class="tag">غير مصنّف</span>'}
                </div>
                <div class="grid grid-cols-2 gap-3 text-[13px]">
                    <div><div class="text-ink-400">إجمالي المخزون</div><div class="tabular font-semibold text-ink-900">${fmtNum(totalStock)} قطعة</div></div>
                    <div><div class="text-ink-400">عدد المقاسات</div><div class="tabular font-semibold text-ink-900">${fmtNum(product.variants.length)}</div></div>
                </div>
            </div>
        </div>

        <div class="py-5">
            <h4 class="drawer-section-title">المقاسات والأسعار</h4>
            <div class="table-wrap border border-line rounded-lg">
                <table class="data-table compact">
                    <thead>
                        <tr>
                            <th class="text-right">المقاس</th>
                            <th class="text-center">السعر</th>
                            <th class="text-center no-print">سعر الشراء</th>
                            <th class="text-center">المخزون</th>
                            <th class="text-center">الحالة</th>
                            <th class="text-left no-print"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${product.variants.map(v => {
                            const st = variantStatus(v);
                            const original = Number(v.originalPrice) || 0;
                            return `
                            <tr>
                                <td class="cell font-medium">${esc(v.size || '—')}</td>
                                <td class="cell text-center tabular">${fmtMoney(v.price)}</td>
                                <td class="cell text-center no-print">
                                    <div class="flex items-center justify-center gap-2">
                                        <span class="hidden-price-mask text-ink-300 select-none">••••</span>
                                        <span class="hidden-price-value hidden tabular text-ink-600">${fmtMoney(original)}</span>
                                        <button type="button" class="icon-btn-sm" onclick="toggleOriginalPriceCell(this)">${icon('eye', 'w-4 h-4')}</button>
                                    </div>
                                </td>
                                <td class="cell text-center tabular">${v.stock === '' || v.stock === undefined || v.stock === null ? '—' : fmtNum(v.stock)}</td>
                                <td class="cell text-center">${statusBadge(st)}</td>
                                <td class="cell text-left no-print">
                                    <button type="button" class="icon-btn-sm" title="كود QR"
                                            onclick="openQrPanel(${product.id}, '${esc(v.size).replace(/'/g, "\\'")}')">${icon('qr', 'w-4 h-4')}</button>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="drawer-actions">
            <button onclick="editProduct(${product.id}); closeProductDrawer();" class="btn-primary flex-1">${icon('edit')} تعديل المنتج</button>
            <button onclick="openQrPanel(${product.id})" class="btn-secondary">${icon('qr')} QR</button>
            <button onclick="closeProductDrawer(); deleteProduct(${product.id});" class="btn-danger">${icon('trash')}</button>
        </div>
    `;

    const drawer = document.getElementById('product-drawer');
    if (drawer) {
        drawer.classList.remove('hidden');
        requestAnimationFrame(() => drawer.classList.add('drawer-open'));
    }
}
window.openProductDrawer = openProductDrawer;

function closeProductDrawer() {
    const drawer = document.getElementById('product-drawer');
    if (!drawer) return;
    drawer.classList.remove('drawer-open');
    setTimeout(() => drawer.classList.add('hidden'), 200);
    drawerProductId = null;
}
window.closeProductDrawer = closeProductDrawer;

// التوافق مع الكود القديم
window.toggleProductDetails = function (id) { openProductDrawer(id); };

/* ============================== 7) أكواد QR ============================== */

// معرّف ثابت لكل مقاس: MA-<productId>-<size>
function variantCode(productId, size) {
    return `MA-${productId}-${String(size || '').trim()}`;
}
window.variantCode = variantCode;

function parseVariantCode(code) {
    const raw = String(code || '').trim();
    const m = raw.match(/^MA-(\d+)-(.+)$/);
    if (!m) return null;
    const product = (products || []).find(p => String(p.id) === m[1]);
    if (!product) return null;
    const variant = (product.variants || []).find(v => String(v.size).trim() === m[2].trim());
    if (!variant) return null;
    return { product, variant };
}
window.parseVariantCode = parseVariantCode;

function renderQrInto(el, text, attempt) {
    if (!el) return;
    attempt = attempt || 0;
    // أحيانًا الصفحة توصل هنا قبل ما مكتبة الأكواد تخلّص تحميل (خصوصًا لو الاتصال
    // بطيء)، فبدل ما نطلّع رسالة خطأ على طول، بنستنى شوية ونجرب تاني لحد 2 ثانية.
    if (typeof QRCode === 'undefined' || !QRCode.toCanvas) {
        if (attempt < 20) {
            setTimeout(() => renderQrInto(el, text, attempt + 1), 100);
            return;
        }
        el.innerHTML = `<div class="text-xs text-ink-400 text-center px-3">تعذّر تحميل مكتبة الأكواد. جرّبي تقفلي وتفتحي الصفحة تاني</div>`;
        return;
    }
    el.innerHTML = '';
    const canvas = document.createElement('canvas');
    el.appendChild(canvas);
    QRCode.toCanvas(canvas, text, {
        width: 168, margin: 1,
        color: { dark: PALETTE.dark, light: '#FFFFFF' }
    }, function (err) {
        if (err) el.innerHTML = `<div class="text-xs text-danger">تعذّر توليد الكود</div>`;
    });
}

let qrContext = null;

function openQrPanel(productId, size) {
    const product = (products || []).find(p => p.id === productId);
    if (!product || !product.variants.length) return;

    const modal = document.getElementById('qr-modal');
    const select = document.getElementById('qr-variant-select');
    if (!modal || !select) return;

    qrContext = { productId };
    document.getElementById('qr-product-name').textContent = product.name;
    document.getElementById('qr-product-company').textContent =
        (product.companies || []).map(c => getCompanyLabel(c)).filter(Boolean).join('، ') || 'غير مصنّف';

    select.innerHTML = product.variants
        .map(v => `<option value="${esc(v.size)}">${esc(v.size)}</option>`).join('');
    if (size) select.value = size;

    updateQrPanel();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}
window.openQrPanel = openQrPanel;

function updateQrPanel() {
    if (!qrContext) return;
    const product = (products || []).find(p => p.id === qrContext.productId);
    const select = document.getElementById('qr-variant-select');
    if (!product || !select) return;

    const size = select.value;
    const variant = product.variants.find(v => String(v.size) === String(size));
    const code = variantCode(product.id, size);

    document.getElementById('qr-code-text').textContent = code;
    const meta = document.getElementById('qr-variant-meta');
    if (meta && variant) {
        meta.innerHTML = `المقاس ${esc(size)} · السعر ${fmtMoney(variant.price)} ج.م · المخزون ${fmtNum(variant.stock)}`;
    }
    renderQrInto(document.getElementById('qr-canvas-box'), code);
}
window.updateQrPanel = updateQrPanel;

function closeQrPanel() {
    const modal = document.getElementById('qr-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    qrContext = null;
}
window.closeQrPanel = closeQrPanel;

// طباعة ملصق المنتج
function printQrLabel() {
    if (!qrContext) return;
    const product = (products || []).find(p => p.id === qrContext.productId);
    const select = document.getElementById('qr-variant-select');
    if (!product || !select) return;

    const size = select.value;
    const variant = product.variants.find(v => String(v.size) === String(size));
    const code = variantCode(product.id, size);
    const canvas = document.querySelector('#qr-canvas-box canvas');
    const dataUrl = canvas ? canvas.toDataURL('image/png') : '';

    const win = window.open('', '_blank');
    win.document.write(`
        <html dir="rtl" lang="ar"><head><title>${esc(product.name)} - ${esc(size)}</title>
        <style>
            body { font-family: 'Cairo', Arial, sans-serif; margin:0; padding:24px; color:#1E2233; }
            .label { width: 260px; border:1px solid #DDD6C9; border-radius:8px; padding:16px; text-align:center; }
            .name { font-size:15px; font-weight:700; margin-bottom:2px; }
            .meta { font-size:12px; color:#6D5CE7; margin-bottom:10px; }
            .code { font-size:11px; letter-spacing:.06em; color:#6D5CE7; margin-top:8px; }
            .price { font-size:16px; font-weight:700; margin-top:6px; }
            img { width: 150px; height: 150px; }
        </style></head><body>
        <div class="label">
            <div class="name">${esc(product.name)}</div>
            <div class="meta">مقاس ${esc(size)}</div>
            ${dataUrl ? `<img src="${dataUrl}" alt="">` : ''}
            <div class="code">${esc(code)}</div>
            <div class="price">${variant ? fmtMoney(variant.price) : ''} ج.م</div>
        </div>
        </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
}
window.printQrLabel = printQrLabel;

// نسخ نص الكود بضغطة واحدة
function copyQrCode() {
    const el = document.getElementById('qr-code-text');
    const text = el ? el.textContent.trim() : '';
    if (!text) return;
    const done = () => showToast('اتنسخ الكود ✓', 'success');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
        fallbackCopy(text, done);
    }
}
window.copyQrCode = copyQrCode;

function fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); if (cb) cb(); } catch (e) { /* تجاهل */ }
    document.body.removeChild(ta);
}

// تنزيل صورة الكود كملف PNG — عشان تتحفظ أو تتطبع بأي طريقة تانية
function downloadQrImage() {
    if (!qrContext) return;
    const product = (products || []).find(p => p.id === qrContext.productId);
    const select = document.getElementById('qr-variant-select');
    const canvas = document.querySelector('#qr-canvas-box canvas');
    if (!canvas) { showToast('الكود لسه بيتحمّل، لحظة وجرّبي تاني', 'error'); return; }

    const size = select ? select.value : '';
    const fileName = `QR-${(product && product.name || 'product').replace(/\s+/g, '_')}${size ? '-' + size : ''}.png`;

    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('اتحفظت صورة الكود', 'success');
}
window.downloadQrImage = downloadQrImage;

/* ============================== 7ب) مسح كود المنتج بالكاميرا ============================== */

let cameraScanState = { stream: null, timer: null, mode: null, busy: false };

function openCameraScanModal(mode) {
    const modal = document.getElementById('camera-scan-modal');
    if (!modal) return;
    cameraScanState.mode = mode || null;

    const resultBox = document.getElementById('camera-scan-result');
    if (resultBox) resultBox.classList.add('hidden');
    setCameraScanStatus('بنجهّز الكاميرا…');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    startCameraScanLoop();
}
window.openCameraScanModal = openCameraScanModal;

function setCameraScanStatus(msg) {
    const el = document.getElementById('camera-scan-status');
    if (el) el.textContent = msg;
}

async function startCameraScanLoop() {
    const resultBox = document.getElementById('camera-scan-result');
    if (resultBox) resultBox.classList.add('hidden');
    setCameraScanStatus('وجّهي الكاميرا ناحية كود المنتج…');
    cameraScanState.busy = false;

    if (!('BarcodeDetector' in window)) {
        setCameraScanStatus('المتصفح ده مش بيدعم قراءة الكاميرا مباشرة. استخدمي قارئ باركود خارجي أو اكتبي الكود بإيدك في خانة المسح.');
        return;
    }

    const video = document.getElementById('camera-scan-video');
    if (!video) return;

    try {
        if (!cameraScanState.stream) {
            cameraScanState.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
        }
        video.srcObject = cameraScanState.stream;
        await video.play();
    } catch (err) {
        if (err && err.name === 'NotAllowedError') {
            setCameraScanStatus('محتاجة إذن استخدام الكاميرا من المتصفح عشان تقدري تمسحي الكود.');
        } else if (err && err.name === 'NotFoundError') {
            setCameraScanStatus('مفيش كاميرا متاحة على الجهاز ده.');
        } else {
            setCameraScanStatus('تعذّر فتح الكاميرا. جرّبي تاني.');
        }
        return;
    }

    let detector;
    try {
        detector = new BarcodeDetector({ formats: ['qr_code'] });
    } catch (e) {
        setCameraScanStatus('تعذّر تشغيل قارئ الكود على المتصفح ده.');
        return;
    }

    if (cameraScanState.timer) clearInterval(cameraScanState.timer);
    cameraScanState.timer = setInterval(async () => {
        if (cameraScanState.busy || !video.srcObject) return;
        cameraScanState.busy = true;
        try {
            const codes = await detector.detect(video);
            if (codes && codes.length > 0) {
                handleCameraScanResult(codes[0].rawValue);
            }
        } catch (e) { /* تجاهل أخطاء الفريم الواحد، هيحاول تاني الفريم اللي بعده */ }
        cameraScanState.busy = false;
    }, 350);
}
window.startCameraScanLoop = startCameraScanLoop;

function stopCameraScanLoop() {
    if (cameraScanState.timer) { clearInterval(cameraScanState.timer); cameraScanState.timer = null; }
    const video = document.getElementById('camera-scan-video');
    if (video) video.srcObject = null;
}

function handleCameraScanResult(code) {
    const found = parseVariantCode(code);
    if (!found) {
        setCameraScanStatus('الكود ده مش معروف عندنا — جرّبي كود تاني');
        return;
    }

    stopCameraScanLoop();
    setCameraScanStatus('لقيت المنتج ✓');

    const resultBox = document.getElementById('camera-scan-result');
    const nameEl = document.getElementById('camera-scan-result-name');
    const metaEl = document.getElementById('camera-scan-result-meta');
    const priceEl = document.getElementById('camera-scan-result-price');
    if (nameEl) nameEl.textContent = found.product.name;
    if (metaEl) metaEl.textContent = `المقاس ${found.variant.size} · المخزون ${fmtNum(found.variant.stock)}`;
    if (priceEl) priceEl.textContent = `${fmtMoney(found.variant.price)} ج.م`;
    if (resultBox) resultBox.classList.remove('hidden');

    // لو الكاميرا اتفتحت من جوّه شاشة بيع (قطاعي/تجار)، نحط المنتج جوه الفاتورة على طول
    if (cameraScanState.mode === 'retail' || cameraScanState.mode === 'invoice') {
        const isRetail = cameraScanState.mode === 'retail';
        const searchEl = document.getElementById(isRetail ? 'retail-product-search' : 'product-search');
        if (searchEl) searchEl.value = found.product.name;
        if (isRetail && typeof handleRetailProductSearch === 'function') handleRetailProductSearch(found.product.name);
        if (!isRetail && typeof handleProductSearch === 'function') handleProductSearch(found.product.name);
        const sizeEl = document.getElementById(isRetail ? 'retail-size-select' : 'size-select');
        if (sizeEl) sizeEl.value = found.variant.size;
        if (isRetail && typeof updateRetailPriceDisplay === 'function') updateRetailPriceDisplay();
        if (!isRetail && typeof updatePriceDisplay === 'function') updatePriceDisplay();
        showToast(`${found.product.name} — مقاس ${found.variant.size}`, 'success');
        setTimeout(closeCameraScanModal, 700);
    }
}

function closeCameraScanModal() {
    const modal = document.getElementById('camera-scan-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    stopCameraScanLoop();
    if (cameraScanState.stream) {
        cameraScanState.stream.getTracks().forEach(t => t.stop());
        cameraScanState.stream = null;
    }
    cameraScanState.mode = null;
}
window.closeCameraScanModal = closeCameraScanModal;

/* ============================== 8) مسح / تعريف المنتج في نقطة البيع ============================== */

function handleScanInput(event, mode) {
    if (event.key && event.key !== 'Enter') return;
    const input = document.getElementById(mode === 'retail' ? 'retail-scan-input' : 'invoice-scan-input');
    if (!input) return;
    const found = parseVariantCode(input.value);
    if (!found) {
        showToast('الكود غير معروف — تأكدي من الكود أو ابحثي بالاسم', 'error');
        return;
    }

    if (mode === 'retail') {
        const searchEl = document.getElementById('retail-product-search');
        if (searchEl) searchEl.value = found.product.name;
        if (typeof handleRetailProductSearch === 'function') handleRetailProductSearch(found.product.name);
        const sizeEl = document.getElementById('retail-size-select');
        if (sizeEl) { sizeEl.value = found.variant.size; }
        if (typeof updateRetailPriceDisplay === 'function') updateRetailPriceDisplay();
    } else {
        const searchEl = document.getElementById('product-search');
        if (searchEl) searchEl.value = found.product.name;
        if (typeof handleProductSearch === 'function') handleProductSearch(found.product.name);
        const sizeEl = document.getElementById('size-select');
        if (sizeEl) { sizeEl.value = found.variant.size; }
        if (typeof updatePriceDisplay === 'function') updatePriceDisplay();
    }

    input.value = '';
    showToast(`${found.product.name} — مقاس ${found.variant.size}`, 'success');
}
window.handleScanInput = handleScanInput;

/* ============================== 9) التنقل بين الأقسام ============================== */

const SECTION_META = {
    dashboard: { el: 'dashboard-section', title: 'لوحة المعلومات', sub: 'نظرة عامة على المبيعات والمخزون' },
    products:  { el: 'products-section',  title: 'المخزون',        sub: 'المنتجات والمقاسات والكميات' },
    invoice:   { el: 'invoice-section',   title: 'فواتير التجار',   sub: 'إنشاء ومتابعة فواتير الجملة' },
    retail:    { el: 'retail-section',    title: 'نقطة البيع',      sub: 'فواتير القطاعي السريعة' },
    debts:     { el: 'debts-section',     title: 'المستحقات',       sub: 'أرصدة العملاء والتجار' },
    trash:     { el: 'trash-section',     title: 'المحذوفات',       sub: 'استرجاع أو حذف نهائي خلال 30 يوم' }
};

window.showSection = function (section) {
    if (!SECTION_META[section]) section = 'dashboard';

    Object.keys(SECTION_META).forEach(key => {
        const el = document.getElementById(SECTION_META[key].el);
        if (el) el.classList.toggle('hidden', key !== section);
    });

    document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.classList.toggle('nav-active', btn.getAttribute('data-nav') === section);
    });

    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-subtitle');
    if (titleEl) titleEl.textContent = SECTION_META[section].title;
    if (subEl) subEl.textContent = SECTION_META[section].sub;

    const actions = document.getElementById('page-actions');
    if (actions) {
        actions.innerHTML = section === 'products'
            ? `<button onclick="openAddProductModal()" class="btn-primary">${icon('plus')} إضافة منتج</button>
               <div class="relative">
                   <button type="button" class="btn-secondary" onclick="toggleMenu('page-more-menu')">${icon('more')}</button>
                   <div id="page-more-menu" class="menu hidden">
                       <button type="button" onclick="closeAllMenus(); openCompanyManager()">${icon('building')} إدارة الشركات</button>
                       <button type="button" onclick="closeAllMenus(); openBulkPriceModal()">${icon('layers')} تعديل الأسعار جماعيًا</button>
                       <button type="button" onclick="closeAllMenus(); openProfitModal()">${icon('wallet')} تقرير الأرباح</button>
                   </div>
               </div>`
            : '';
    }

    closeMobileNav();

    if (section === 'dashboard') {
        renderDashboard();
    } else if (section === 'invoice') {
        populateProductDatalist();
        updateInvoiceHeader();
        populateInvoiceCompanyFilter();
    } else if (section === 'retail') {
        populateRetailCompanyFilter();
        populateInvoiceCompanyFilter();
        populateRetailProductDatalist(retailSelectedCompany);
        toggleRetailAdjustmentUI();
        updateRetailInvoiceHeader();
    } else if (section === 'debts') {
        if (typeof renderDebtsList === 'function') renderDebtsList();
    } else if (section === 'trash') {
        purgeExpiredTrash();
    }

    const main = document.getElementById('main-scroll');
    if (main) main.scrollTop = 0;
};

function toggleMobileNav() {
    const nav = document.getElementById('mobile-nav');
    if (!nav) return;
    nav.classList.toggle('hidden');
}
window.toggleMobileNav = toggleMobileNav;

function closeMobileNav() {
    const nav = document.getElementById('mobile-nav');
    if (nav) nav.classList.add('hidden');
}
window.closeMobileNav = closeMobileNav;

/* ============================== 10) التنبيهات (Toasts) ============================== */

window.showToast = function (message, type) {
    const host = document.getElementById('toast-host') || (function () {
        const el = document.createElement('div');
        el.id = 'toast-host';
        el.className = 'toast-host';
        document.body.appendChild(el);
        return el;
    })();

    const clean = String(message || '')
        .replace(/[\u2190-\u21FF\u2300-\u27BF\uFE0F\u2600-\u26FF]/g, '')
        .replace(/[\u{1F000}-\u{1FAFF}]/gu, '')
        .trim();

    const kind = type === 'error' ? 'error' : (type === 'warning' ? 'warning' : 'success');
    const iconName = kind === 'error' ? 'alert' : (kind === 'warning' ? 'alert' : 'check');

    const toast = document.createElement('div');
    toast.className = `toast toast-${kind}`;
    toast.innerHTML = `<span class="toast-icon">${icon(iconName, 'w-4 h-4')}</span><span>${esc(clean)}</span>`;
    host.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast-in'));
    setTimeout(() => {
        toast.classList.remove('toast-in');
        setTimeout(() => toast.remove(), 220);
    }, 3200);
};

/* ============================== 11) التشغيل ============================== */

document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeProductDrawer();
    closeQrPanel();
    closeMobileNav();
});

document.addEventListener('DOMContentLoaded', function () {
    const searchBox = document.getElementById('product-search-box');
    if (searchBox) searchBox.addEventListener('input', applyProductsFilter);

    const companySelect = document.getElementById('products-company-filter');
    if (companySelect) {
        companySelect.addEventListener('change', function () { selectProductsCompanyFilter(this.value); });
    }
});

/* ============================== 12) بناء القائمة والأيقونات الثابتة ============================== */

const NAV_ITEMS = [
    { group: 'عام',       id: 'btn-dashboard', nav: 'dashboard', icon: 'dashboard', label: 'لوحة المعلومات' },
    { group: 'المبيعات',  id: 'btn-retail',    nav: 'retail',    icon: 'cart',      label: 'نقطة البيع' },
    { group: 'المبيعات',  id: 'btn-invoice',   nav: 'invoice',   icon: 'receipt',   label: 'فواتير التجار' },
    { group: 'المبيعات',  id: 'btn-debts',     nav: 'debts',     icon: 'users',     label: 'المستحقات' },
    { group: 'المخزون',   id: 'btn-products',  nav: 'products',  icon: 'box',       label: 'المنتجات' },
    { group: 'المخزون',   id: 'btn-scan-camera', action: 'openCameraScanModal()', icon: 'scan',  label: 'مسح كود بالكاميرا' },
    { group: 'المخزون',   id: 'btn-bulk-price', action: 'openBulkPriceModal()', icon: 'layers',   label: 'تعديل الأسعار' },
    { group: 'المخزون',   id: 'btn-companies',  action: 'openCompanyManager()', icon: 'building', label: 'الشركات' },
    { group: 'الإدارة',   id: 'btn-profit',     action: 'openProfitModal()',    icon: 'wallet',   label: 'تقرير الأرباح' },
    { group: 'الإدارة',   id: 'btn-trash',      nav: 'trash',    icon: 'trash',     label: 'المحذوفات' }
];

function paintStaticIcons() {
    NAV_ITEMS.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) el.innerHTML = `${icon(item.icon, 'w-[17px] h-[17px]')}<span>${item.label}</span>`;
    });

    const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    set('btn-logout', `${icon('logout', 'w-[17px] h-[17px]')}<span>تسجيل الخروج</span>`);
    set('btn-logout-top', icon('logout', 'w-[18px] h-[18px]'));
    set('btn-open-nav', icon('menu', 'w-[18px] h-[18px]'));
    set('btn-close-nav', icon('x', 'w-[18px] h-[18px]'));
    set('btn-close-drawer', icon('x', 'w-[18px] h-[18px]'));
    set('btn-close-qr', icon('x', 'w-[18px] h-[18px]'));
    set('btn-close-camera-scan', icon('x', 'w-[18px] h-[18px]'));
    set('search-icon-slot', icon('search', 'w-[16px] h-[16px]'));
    set('low-stock-icon', icon('alert', 'w-[16px] h-[16px]'));
    set('ki-products', icon('box', 'w-[18px] h-[18px]'));
    set('ki-variants', icon('layers', 'w-[18px] h-[18px]'));
    set('ki-units', icon('box', 'w-[18px] h-[18px]'));
    set('ki-low', icon('alert', 'w-[18px] h-[18px]'));

    // قائمة الموبايل — نفس العناصر بالظبط
    const mobile = document.getElementById('mobile-nav-items');
    if (mobile) {
        let html = '', lastGroup = '';
        NAV_ITEMS.forEach(item => {
            if (item.group !== lastGroup) {
                html += `<div class="nav-group-label">${item.group}</div>`;
                lastGroup = item.group;
            }
            const click = item.nav ? `showSection('${item.nav}')` : `closeMobileNav(); ${item.action}`;
            html += `<button type="button" ${item.nav ? `data-nav="${item.nav}"` : ''} onclick="${click}" class="nav-item">
                        ${icon(item.icon, 'w-[17px] h-[17px]')}<span>${item.label}</span>
                     </button>`;
        });
        html += `<div class="nav-group-label">الحساب</div>
                 <button type="button" onclick="logoutUser()" class="nav-item">${icon('logout', 'w-[17px] h-[17px]')}<span>تسجيل الخروج</span></button>`;
        mobile.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', paintStaticIcons);
if (document.readyState !== 'loading') paintStaticIcons();

// أيقونات العناصر الثابتة المعلّمة بـ data-icon
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-icon]').forEach(el => {
        el.innerHTML = icon(el.getAttribute('data-icon'), 'w-[16px] h-[16px]');
    });
});

/* ============================== 13) قوائم الإجراءات داخل الجداول ============================== */
// الجدول بيبقى قابل للتمرير أفقيًا، فالقائمة بتتفتح بموضع ثابت عشان متتقصّش

window.toggleMenu = function (menuId) {
    const menu = document.getElementById(menuId);
    if (!menu) return;

    const wasOpen = menu.getAttribute('data-open-menu') === 'true';
    closeAllMenus();
    if (wasOpen) return;

    menu.classList.remove('hidden');
    menu.setAttribute('data-open-menu', 'true');

    const trigger = menu.parentElement ? menu.parentElement.querySelector('button') : null;
    if (trigger && menu.closest('.table-wrap')) {
        const r = trigger.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.zIndex = '65';
        menu.style.top = Math.min(window.innerHeight - 190, r.bottom + 4) + 'px';
        menu.style.left = Math.max(10, r.left - 150) + 'px';
    }
};

document.addEventListener('scroll', function () {
    if (document.querySelector('[data-open-menu="true"]')) closeAllMenus();
}, true);
