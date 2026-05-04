// js/app.js - Controller Utama Cibitung Frozen ERP v5.0
// Pastikan namespace CFS ada
window.CFS = window.CFS || {};

// ---------- UTILITAS GLOBAL ----------
CFS.Utils = CFS.Utils || {
    formatRupiah: (num) => {
        if (num === undefined || num === null || isNaN(num)) return 'Rp 0';
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
    },
    formatDate: (iso) => {
        try { return new Date(iso).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }); }
        catch (e) { return iso || ''; }
    }
};

// ---------- TOAST GLOBAL ----------
function showToast(title, msg, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const titleEl = document.getElementById('toastTitle');
    const msgEl = document.getElementById('toastMsg');
    if (!toast || !icon || !titleEl || !msgEl) return;
    titleEl.innerText = title;
    msgEl.innerText = msg;
    icon.className = 'w-9 h-9 rounded-full flex items-center justify-center text-white';
    if (type === 'success') { icon.classList.add('bg-emerald-500'); icon.innerHTML = '<i class="ph ph-check text-lg"></i>'; }
    else if (type === 'error') { icon.classList.add('bg-red-500'); icon.innerHTML = '<i class="ph ph-warning text-lg"></i>'; }
    else { icon.classList.add('bg-blue-500'); icon.innerHTML = '<i class="ph ph-info text-lg"></i>'; }
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// ---------- TAB SWITCHING GLOBAL ----------
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(tabId);
    if (target) { target.classList.add('active'); target.classList.add('animate-fade-in'); }
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-primary-50', 'text-primary-700', 'font-semibold');
        btn.classList.add('opacity-70');
        if (btn.dataset.tab === tabId) {
            btn.classList.add('bg-primary-50', 'text-primary-700', 'font-semibold');
            btn.classList.remove('opacity-70');
        }
    });
    if (CFS.App && CFS.App.onTabSwitch) CFS.App.onTabSwitch(tabId);
}

// ---------- APP CONTROLLER ----------
CFS.App = {
    notifications: [],
    notifCount: 0,

    init() {
        console.log('🚀 Initializing Cibitung Frozen ERP...');
        try {
            this.setupTabs();
            this.setupForms();
            this.populateAllDropdowns();
            this.loadSettingsToForm();
            this.setupWidgetToggles();
            this.setupBackupRestore();
            this.setupBatchModal();
            this.setupNotificationPanel();
            this.requestNotifPermission();
            this.startCriticalBatchCheck();
            this.setupKeyboardShortcuts();
            this.setupStorageMethodToggle();
            this.restoreLastTab();
            
            // Initial renders dengan penundaan untuk memastikan modul siap
            setTimeout(() => {
                this.safeRender('Dashboard.refreshAll');
                this.safeRender('Inventory.renderStockTable');
                this.safeRender('Sales.renderCustomerTable');
                this.updateDashboardDate();
            }, 100);
            
            console.log('✅ App initialized successfully');
        } catch (e) {
            console.error('Init error:', e);
            showToast('Error', 'Gagal memulai aplikasi. Silakan refresh halaman.', 'error');
        }
    },

    safeRender(moduleFunc) {
        try {
            const [mod, func] = moduleFunc.split('.');
            if (CFS[mod] && CFS[mod][func]) CFS[mod][func]();
        } catch (e) { console.warn(`Render ${moduleFunc} failed:`, e); }
    },

    onTabSwitch(tabId) {
        const actions = {
            'tab-dashboard': () => this.safeRender('Dashboard.refreshAll'),
            'tab-stock': () => this.safeRender('Inventory.renderStockTable'),
            'tab-crm': () => this.safeRender('Sales.renderCustomerTable'),
            'tab-finance': () => { this.safeRender('Dashboard.renderFinanceSummary'); this.safeRender('Dashboard.renderNeraca'); },
            'tab-reports': () => { this.safeRender('Dashboard.renderLabaRugiReport'); this.safeRender('Dashboard.renderNeraca'); },
            'tab-history': () => this.renderAllTransactions()
        };
        if (actions[tabId]) actions[tabId]();
    },

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = btn.dataset.tab;
                if (tabId) switchTab(tabId);
            });
        });
    },

    // ========== FORM HANDLERS ==========
    setupForms() {
        this.setupAddStockForm();
        this.setupSalesForm();
        this.setupExpenseForm();
        this.setupFilterForm();
        this.setupExportButton();
        this.setupJournalViewer();
        this.setupSettingsSave();
        this.setupToggleFields();
    },

    setupAddStockForm() {
        const form = document.getElementById('addStockForm');
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const data = this.collectBatchData();
                if (!data.produk || data.berat <= 0 || data.hargaBeli <= 0 || !data.tglProduksi || !data.tglKadaluarsa) {
                    return showToast('Error', 'Lengkapi semua field wajib.', 'error');
                }
                await CFS.Inventory.addBatch(data);
                showToast('Berhasil', 'Batch ditambahkan.', 'success');
                form.reset();
                this.safeRender('Dashboard.refreshAll');
                this.safeRender('Inventory.renderStockTable');
            } catch (err) {
                showToast('Gagal', err.message || 'Gagal menambah batch.', 'error');
            }
        });
    },

    collectBatchData() {
        return {
            produk: document.getElementById('stockProduk')?.value || '',
            berat: parseFloat(document.getElementById('stockBerat')?.value) || 0,
            hargaBeli: parseFloat(document.getElementById('stockHargaBeli')?.value) || 0,
            ongkir: parseFloat(document.getElementById('stockOngkir')?.value) || 0,
            biayaBensin: parseFloat(document.getElementById('stockBensin')?.value) || 0,
            toggleBongkar: document.getElementById('stockToggleBongkar')?.checked || false,
            bongkarNominal: document.getElementById('stockToggleBongkar')?.checked ? (parseFloat(document.getElementById('stockBongkarNominal')?.value) || 0) : 0,
            pajakPersen: document.getElementById('stockPajakType')?.value === 'persen' ? (parseFloat(document.getElementById('stockPajakValue')?.value) || 0) : null,
            pajakNominal: document.getElementById('stockPajakType')?.value === 'nominal' ? (parseFloat(document.getElementById('stockPajakValue')?.value) || 0) : null,
            tglProduksi: document.getElementById('stockTglProduksi')?.value || '',
            tglKadaluarsa: document.getElementById('stockTglKadaluarsa')?.value || ''
        };
    },

    setupSalesForm() {
        const form = document.getElementById('salesForm');
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const klien = document.getElementById('salesKlien')?.value?.trim();
                const produk = document.getElementById('salesProduk')?.value;
                const qty = parseFloat(document.getElementById('salesQty')?.value) || 0;
                const tier = document.getElementById('salesTier')?.value || 'ecer';
                const manual = parseFloat(document.getElementById('salesHargaManual')?.value) || null;
                if (!klien || !produk || qty <= 0) return showToast('Error', 'Data tidak lengkap.', 'error');
                
                const result = await CFS.Sales.processSale(klien, produk, qty, tier, manual);
                this.showSalesResult(result);
                showToast('Sukses', 'Penjualan tercatat.', 'success');
                this.safeRender('Dashboard.refreshAll');
                this.safeRender('Inventory.renderStockTable');
                this.safeRender('Sales.renderCustomerTable');
            } catch (err) {
                showToast('Gagal', err.message || 'Gagal memproses penjualan.', 'error');
            }
        });
        // Preview
        document.getElementById('previewPriceBtn')?.addEventListener('click', () => this.handlePreview());
    },

    async handlePreview() {
        const produk = document.getElementById('salesProduk')?.value;
        const qty = parseFloat(document.getElementById('salesQty')?.value) || 0;
        if (!produk || qty <= 0) return showToast('Info', 'Pilih produk dan jumlah.', 'info');
        try {
            const preview = await CFS.Sales.previewPricing(produk, qty, document.getElementById('salesTier')?.value, parseFloat(document.getElementById('salesHargaManual')?.value) || null);
            this.showSalesResult(preview, true);
        } catch (err) {
            showToast('Error', 'Gagal preview harga.', 'error');
        }
    },

    showSalesResult(data, isPreview = false) {
        const div = document.getElementById('salesResult');
        if (!div) return;
        div.classList.remove('hidden');
        if (data.error) {
            div.innerHTML = `<div class="text-red-600">❌ ${data.error}</div>`;
        } else if (isPreview) {
            div.innerHTML = `<div class="text-slate-700 dark:text-slate-300">
                📊 <strong>Preview:</strong><br>
                HPP: ${CFS.Utils.formatRupiah(data.hppAvg)}<br>
                Harga Jual: ${CFS.Utils.formatRupiah(data.hargaJual)}/kg<br>
                Estimasi Invoice: ${CFS.Utils.formatRupiah(data.totalInvoice)}<br>
                Stok tersedia: ${data.available?.toFixed(1) || 0} kg</div>`;
        } else {
            div.innerHTML = `<div class="text-emerald-700 dark:text-emerald-400">
                ✅ <strong>Berhasil!</strong><br>
                Invoice: ${CFS.Utils.formatRupiah(data.totalInvoice)}</div>`;
        }
    },

    setupExpenseForm() {
        const form = document.getElementById('expenseForm');
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const akun = document.getElementById('expenseAkun')?.value;
            const jumlah = parseFloat(document.getElementById('expenseJumlah')?.value) || 0;
            if (!akun || jumlah <= 0) return showToast('Error', 'Data tidak lengkap.', 'error');
            try {
                await CFS.Accounting.recordExpense(akun, jumlah, document.getElementById('expenseDeskripsi')?.value || '');
                showToast('Tercatat', 'Beban disimpan.', 'success');
                form.reset();
                this.safeRender('Dashboard.refreshAll');
            } catch (err) {
                showToast('Gagal', 'Gagal mencatat beban.', 'error');
            }
        });
    },

    setupFilterForm() {
        const form = document.getElementById('filterTransaksi');
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const filters = {
                produk: document.getElementById('filterProduk')?.value,
                klien: document.getElementById('filterKlien')?.value,
                startDate: document.getElementById('filterStart')?.value,
                endDate: document.getElementById('filterEnd')?.value
            };
            try {
                const trx = await CFS.Sales.getFilteredTransactions(filters);
                this.renderTransactionTable(trx);
            } catch (err) {
                showToast('Error', 'Gagal filter transaksi.', 'error');
            }
        });
    },

    setupExportButton() {
        document.getElementById('exportExcelBtn')?.addEventListener('click', async () => {
            try {
                const today = new Date();
                const start = new Date(today.getFullYear(), today.getMonth(), 1);
                const rows = await CFS.Accounting.exportToExcel(start, today);
                if (!rows.length) return showToast('Info', 'Tidak ada data.', 'info');
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Jurnal');
                XLSX.writeFile(wb, `jurnal_${start.toISOString().slice(0,7)}.xlsx`);
                showToast('Sukses', 'Excel terunduh.', 'success');
            } catch (err) {
                showToast('Error', 'Gagal ekspor.', 'error');
            }
        });
    },

    setupJournalViewer() {
        document.getElementById('viewJournalBtn')?.addEventListener('click', async () => {
            const viewer = document.getElementById('journalViewer');
            const tbody = document.getElementById('journalTableBody');
            if (!viewer || !tbody) return;
            viewer.classList.toggle('hidden');
            if (!viewer.classList.contains('hidden')) {
                const journals = await CFS.Accounting.getJournals();
                const entries = [];
                journals.forEach(j => j.entries.forEach(e => entries.push({ ...e, tanggal: j.tanggal, deskripsi: j.deskripsi })));
                tbody.innerHTML = entries.length ? entries.map(e => `<tr><td>${CFS.Utils.formatDate(e.tanggal)}</td><td>${e.deskripsi}</td><td>${e.akun}</td><td>${e.debet?CFS.Utils.formatRupiah(e.debet):''}</td><td>${e.kredit?CFS.Utils.formatRupiah(e.kredit):''}</td></tr>`).join('') : '<tr><td colspan="5" class="text-center p-4">Kosong</td></tr>';
            }
        });
    },

    setupSettingsSave() {
        document.getElementById('saveSettingsBtn')?.addEventListener('click', async () => {
            const s = {
                ppn: +document.getElementById('setPPN')?.value || 12,
                pph25: +document.getElementById('setPPh25')?.value || 2,
                pph21: +document.getElementById('setPPh21')?.value || 5,
                ptShare: +document.getElementById('setPTShare')?.value || 60,
                minGrosir: +document.getElementById('setMinGrosir')?.value || 10,
                minPartai: +document.getElementById('setMinPartai')?.value || 500,
                selisihGrosir: +document.getElementById('setSelisihGrosir')?.value || 5000,
                marginDefault: +document.getElementById('setMarginDefault')?.value || 15000,
                storageMethod: document.getElementById('setStorageMethod')?.value || 'none',
                storageFlatMonthly: +document.getElementById('setStorageFlat')?.value || 0,
                storagePerKgPerDay: +document.getElementById('setStoragePerKg')?.value || 0,
                fifoMethod: document.getElementById('setFifoMethod')?.value || 'fefo'
            };
            await CFS.Settings.save(s);
            showToast('Tersimpan', 'Pengaturan diperbarui.', 'success');
        });
    },

    setupToggleFields() {
        document.getElementById('stockToggleBongkar')?.addEventListener('change', function() {
            document.getElementById('stockBongkarNominal')?.classList.toggle('hidden', !this.checked);
        });
        document.getElementById('stockPajakType')?.addEventListener('change', function() {
            const v = document.getElementById('stockPajakValue');
            if (v) { v.classList.toggle('hidden', this.value === 'none'); v.placeholder = this.value === 'persen' ? 'Persentase (%)' : 'Nominal (Rp)'; }
        });
    },

    setupStorageMethodToggle() {
        document.getElementById('setStorageMethod')?.addEventListener('change', function() {
            document.getElementById('storageFlatInput')?.classList.toggle('hidden', this.value !== 'flat_monthly');
            document.getElementById('storagePerKgInput')?.classList.toggle('hidden', this.value !== 'per_kg_day');
        });
    },

    // ========== POPULATE DROPDOWNS ==========
    populateAllDropdowns() {
        if (!CFS.Inventory || !CFS.Inventory.PRODUCT_LIST) return;
        const opts = CFS.Inventory.PRODUCT_LIST.map(p => `<option value="${p}">${p}</option>`).join('');
        ['stockProduk', 'salesProduk', 'filterProduk', 'batchProdukSelect'].forEach(id => {
            const sel = document.getElementById(id);
            if (sel) sel.innerHTML = '<option value="">Pilih Produk</option>' + opts;
        });
    },

    // ========== LOAD SETTINGS ==========
    async loadSettingsToForm() {
        if (!CFS.Settings || !CFS.Settings.get) return;
        const s = await CFS.Settings.get();
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        set('setPPN', s.ppn); set('setPPh25', s.pph25); set('setPPh21', s.pph21);
        set('setPTShare', s.ptShare); set('setMinGrosir', s.minGrosir); set('setMinPartai', s.minPartai);
        set('setSelisihGrosir', s.selisihGrosir); set('setMarginDefault', s.marginDefault);
        set('setStorageMethod', s.storageMethod || 'none'); set('setStorageFlat', s.storageFlatMonthly || 0);
        set('setStoragePerKg', s.storagePerKgPerDay || 0); set('setFifoMethod', s.fifoMethod || 'fefo');
        document.getElementById('storageFlatInput')?.classList.toggle('hidden', s.storageMethod !== 'flat_monthly');
        document.getElementById('storagePerKgInput')?.classList.toggle('hidden', s.storageMethod !== 'per_kg_day');
        const vis = s.widgetVisibility || {};
        document.querySelectorAll('.widget-toggle').forEach(cb => { if (vis[cb.dataset.widget] !== undefined) cb.checked = vis[cb.dataset.widget]; });
    },

    setupWidgetToggles() {
        document.querySelectorAll('.widget-toggle').forEach(cb => {
            cb.addEventListener('change', async () => {
                const key = cb.dataset.widget;
                if (!key) return;
                document.getElementById(`widget-${key}`)?.classList.toggle('hidden', !cb.checked);
                const s = await CFS.Settings.get();
                s.widgetVisibility = s.widgetVisibility || {};
                s.widgetVisibility[key] = cb.checked;
                await CFS.Settings.save(s);
            });
        });
    },

    // ========== BACKUP RESTORE ==========
    setupBackupRestore() {
        CFS.App.backupData = async () => {
            const data = {
                batches: await CFS.Storage.get(CFS.Storage.STOCK_KEY) || [],
                journals: await CFS.Storage.get(CFS.Storage.JOURNALS_KEY) || [],
                settings: await CFS.Storage.get(CFS.Storage.SETTINGS_KEY) || {},
                transactions: await CFS.Storage.get(CFS.Storage.TRANSACTIONS_KEY) || [],
                customers: await CFS.Storage.get('customers') || []
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `cfs_backup_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            showToast('Backup', 'Data diekspor.', 'success');
        };
        CFS.App.restorePrompt = () => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.json';
            input.onchange = async (e) => {
                try {
                    const text = await e.target.files[0].text();
                    const data = JSON.parse(text);
                    if (data.batches) await CFS.Storage.set(CFS.Storage.STOCK_KEY, data.batches);
                    if (data.journals) await CFS.Storage.set(CFS.Storage.JOURNALS_KEY, data.journals);
                    if (data.settings) await CFS.Storage.set(CFS.Storage.SETTINGS_KEY, data.settings);
                    if (data.transactions) await CFS.Storage.set(CFS.Storage.TRANSACTIONS_KEY, data.transactions);
                    if (data.customers) await CFS.Storage.set('customers', data.customers);
                    alert('Data dipulihkan! Memuat ulang...');
                    location.reload();
                } catch (err) {
                    alert('Gagal restore: ' + err.message);
                }
            };
            input.click();
        };
    },

    setupBatchModal() {
        const modal = document.getElementById('batchDetailModal');
        if (!modal) return;
        modal.querySelector('button')?.addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) modal.classList.add('hidden'); });
        document.getElementById('batchProdukSelect')?.addEventListener('change', async function() {
            await CFS.Inventory.renderBatchDetail(this.value, 'batchDetailContent');
        });
        CFS.App.lihatBatch = (produk) => {
            const sel = document.getElementById('batchProdukSelect');
            if (sel) { sel.value = produk; sel.dispatchEvent(new Event('change')); }
            modal.classList.remove('hidden');
        };
    },

    // ========== NOTIFICATION ==========
    setupNotificationPanel() {
        const bell = document.getElementById('notificationBell');
        const panel = document.getElementById('notificationPanel');
        if (!bell || !panel) return;
        bell.addEventListener('click', () => {
            panel.classList.toggle('hidden');
            this.renderNotificationList();
        });
        document.addEventListener('click', (e) => {
            if (!bell.contains(e.target) && !panel.contains(e.target)) panel.classList.add('hidden');
        });
    },

    addNotification(title, msg) {
        this.notifications.unshift({ title, msg, time: new Date().toISOString() });
        if (this.notifications.length > 50) this.notifications.length = 50;
        this.notifCount++;
        const badge = document.getElementById('notifBadge');
        if (badge) { badge.textContent = this.notifCount; badge.classList.toggle('hidden', this.notifCount === 0); }
    },

    renderNotificationList() {
        const list = document.getElementById('notifList');
        if (!list) return;
        list.innerHTML = this.notifications.length ? this.notifications.slice(0, 10).map(n => `<div class="p-2 bg-slate-50 dark:bg-slate-700 rounded"><p class="font-semibold text-xs">${n.title}</p><p class="text-[10px] opacity-60">${n.msg}</p></div>`).join('') : '<p class="text-xs opacity-50">Tidak ada notifikasi.</p>';
    },

    requestNotifPermission() {
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    },

    sendDesktopNotif(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🐟</text></svg>' });
    },

    startCriticalBatchCheck() {
        setInterval(async () => {
            try {
                const exp = await CFS.Inventory.getExpiringBatches(3);
                if (exp.length > 0) {
                    const msg = `${exp.length} batch hampir expired!`;
                    this.sendDesktopNotif('⚠ Batch Kritis', msg);
                    this.addNotification('Batch Kritis', msg);
                }
            } catch (e) {}
        }, 3600000);
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'b') { e.preventDefault(); CFS.App.backupData(); }
            else if (e.ctrlKey && e.key === 'd') { e.preventDefault(); switchTab('tab-dashboard'); }
        });
    },

    restoreLastTab() {
        try {
            const lastTab = localStorage.getItem('cfs_last_tab');
            if (lastTab) switchTab(lastTab);
        } catch (e) {}
    },

    // ========== TABLE RENDERING ==========
    renderTransactionTable(trx) {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;
        if (!trx || !trx.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center p-4 opacity-50">Tidak ada data.</td></tr>';
            return;
        }
        tbody.innerHTML = trx.map(t => `
            <tr class="border-b">
                <td class="p-2 text-xs">${CFS.Utils.formatDate(t.tanggal)}</td>
                <td class="p-2">${t.klien}</td>
                <td class="p-2">${t.produk}</td>
                <td class="p-2 text-right">${t.qty} kg</td>
                <td class="p-2 text-right font-semibold">${CFS.Utils.formatRupiah(t.totalInvoice)}</td>
                <td class="p-2 text-center"><span class="badge">${t.tier}</span></td>
            </tr>`).join('');
    },

    async renderAllTransactions() {
        try {
            const trx = await CFS.Sales.getFilteredTransactions({});
            this.renderTransactionTable(trx);
        } catch (e) {
            const trx = await CFS.Storage.get(CFS.Storage.TRANSACTIONS_KEY) || [];
            this.renderTransactionTable(trx);
        }
    },

    updateDashboardDate() {
        const el = document.getElementById('dashDate');
        if (el) el.innerText = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    }
};

// ========== DARK MODE ==========
function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('cfs_dark', isDark ? '1' : '0');
    const icon = document.getElementById('darkIcon');
    if (icon) icon.className = isDark ? 'ph ph-sun text-lg text-yellow-400' : 'ph ph-moon text-lg';
}
(function() {
    if (localStorage.getItem('cfs_dark') === '1') {
        document.documentElement.classList.add('dark');
        const icon = document.getElementById('darkIcon');
        if (icon) icon.className = 'ph ph-sun text-lg text-yellow-400';
    }
})();

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    if (typeof localforage === 'undefined') return console.error('localforage missing');
    CFS.App.init();
});
