// js/app.js
// Controller utama aplikasi Cibitung Frozen ERP v5.0

// Pastikan namespace CFS sudah ada
window.CFS = window.CFS || {};

// ---------- Utilitas ----------
CFS.Utils = {
    formatRupiah: (num) => {
        if (isNaN(num) || num === null || num === undefined) return 'Rp 0';
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(num);
    },
    formatDate: (iso) => {
        try {
            return new Date(iso).toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return iso;
        }
    }
};

// ---------- Notifikasi ----------
let toastTimeout;

function showToast(title, msg, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const titleEl = document.getElementById('toastTitle');
    const msgEl = document.getElementById('toastMsg');
    if (!toast || !icon || !titleEl || !msgEl) return;
    
    titleEl.innerText = title;
    msgEl.innerText = msg;
    
    icon.className = 'w-9 h-9 rounded-full flex items-center justify-center text-white';
    icon.innerHTML = '';
    
    if (type === 'success') {
        icon.classList.add('bg-emerald-500');
        icon.innerHTML = '<i class="ph ph-check text-lg"></i>';
    } else if (type === 'error') {
        icon.classList.add('bg-red-500');
        icon.innerHTML = '<i class="ph ph-warning text-lg"></i>';
    } else {
        icon.classList.add('bg-blue-500');
        icon.innerHTML = '<i class="ph ph-info text-lg"></i>';
    }
    
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

// ---------- Tab Switching ----------
function switchTab(tabId) {
    // Sembunyikan semua tab content
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
    });
    
    // Tampilkan tab yang dipilih
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
        targetTab.classList.add('animate-fade-in');
    }
    
    // Update sidebar buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-primary-50', 'text-primary-700', 'font-semibold');
        btn.classList.add('opacity-70');
        
        const iconContainer = btn.querySelector('.tab-icon');
        if (iconContainer) {
            iconContainer.classList.remove('bg-primary-600', 'text-white', 'shadow-md');
            iconContainer.classList.add('bg-slate-100', 'text-slate-500');
        }
        
        if (btn.dataset.tab === tabId) {
            btn.classList.add('bg-primary-50', 'text-primary-700', 'font-semibold');
            btn.classList.remove('opacity-70');
            
            if (iconContainer) {
                iconContainer.classList.add('bg-primary-600', 'text-white', 'shadow-md');
                iconContainer.classList.remove('bg-slate-100', 'text-slate-500');
            }
        }
    });
    
    // Trigger refresh untuk tab tertentu
    if (typeof CFS.App !== 'undefined' && CFS.App.onTabSwitch) {
        CFS.App.onTabSwitch(tabId);
    }
}

// ---------- App Controller ----------
CFS.App = {
    notificationCount: 0,
    notifications: [],

    init() {
        console.log('🚀 Inisialisasi Cibitung Frozen ERP...');
        
        try {
            this.setupTabs();
            this.setupForms();
            this.populateDropdowns();
            this.loadSettings();
            this.setupDashboardToggles();
            this.setupBackupRestore();
            this.setupBatchModal();
            this.setupNotificationCenter();
            this.requestNotificationPermission();
            this.checkCriticalBatches();
            this.setupKeyboardShortcuts();
            this.setupAutoSave();
            
            // Render data awal
            if (typeof CFS.Dashboard !== 'undefined' && CFS.Dashboard.refreshAll) {
                CFS.Dashboard.refreshAll().catch(err => console.warn('Dashboard refresh warning:', err));
            }
            if (typeof CFS.Inventory !== 'undefined' && CFS.Inventory.renderStockTable) {
                CFS.Inventory.renderStockTable().catch(err => console.warn('Stock table render warning:', err));
            }
            if (typeof CFS.Sales !== 'undefined' && CFS.Sales.renderCustomerTable) {
                CFS.Sales.renderCustomerTable().catch(err => console.warn('CRM render warning:', err));
            }
            
            // Set tanggal dashboard
            const dateEl = document.getElementById('dashDate');
            if (dateEl) {
                dateEl.innerText = new Date().toLocaleDateString('id-ID', {
                    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
                });
            }
            
            console.log('✅ Cibitung Frozen ERP siap digunakan!');
        } catch (err) {
            console.error('❌ Error saat inisialisasi:', err);
            showToast('Error', 'Gagal menginisialisasi aplikasi. Silakan refresh halaman.', 'error');
        }
    },

    onTabSwitch(tabId) {
        try {
            if (tabId === 'tab-dashboard' && CFS.Dashboard && CFS.Dashboard.refreshAll) {
                CFS.Dashboard.refreshAll();
            }
            if (tabId === 'tab-stock' && CFS.Inventory && CFS.Inventory.renderStockTable) {
                CFS.Inventory.renderStockTable();
            }
            if (tabId === 'tab-crm' && CFS.Sales && CFS.Sales.renderCustomerTable) {
                CFS.Sales.renderCustomerTable();
            }
            if (tabId === 'tab-finance') {
                if (CFS.Dashboard && CFS.Dashboard.renderFinanceSummary) CFS.Dashboard.renderFinanceSummary();
                if (CFS.Dashboard && CFS.Dashboard.renderNeraca) CFS.Dashboard.renderNeraca();
            }
            if (tabId === 'tab-reports') {
                if (CFS.Dashboard && CFS.Dashboard.renderLabaRugiReport) CFS.Dashboard.renderLabaRugiReport();
                if (CFS.Dashboard && CFS.Dashboard.renderNeraca) CFS.Dashboard.renderNeraca();
            }
            if (tabId === 'tab-history') {
                // Load semua transaksi
                const historyBody = document.getElementById('historyTableBody');
                if (historyBody) {
                    CFS.App.renderAllTransactions();
                }
            }
        } catch (err) {
            console.warn('Warning onTabSwitch:', err);
        }
    },

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                if (tabId) switchTab(tabId);
            });
        });
    },

    setupForms() {
        // ========== FORM TAMBAH BATCH ==========
        const addStockForm = document.getElementById('addStockForm');
        if (addStockForm) {
            addStockForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const produk = document.getElementById('stockProduk')?.value;
                    if (!produk) {
                        showToast('Error', 'Pilih produk terlebih dahulu.', 'error');
                        return;
                    }
                    
                    const data = {
                        produk: produk,
                        berat: parseFloat(document.getElementById('stockBerat')?.value) || 0,
                        hargaBeli: parseFloat(document.getElementById('stockHargaBeli')?.value) || 0,
                        ongkir: parseFloat(document.getElementById('stockOngkir')?.value) || 0,
                        biayaBensin: parseFloat(document.getElementById('stockBensin')?.value) || 0,
                        toggleBongkar: document.getElementById('stockToggleBongkar')?.checked || false,
                        bongkarNominal: parseFloat(document.getElementById('stockBongkarNominal')?.value) || 0,
                        pajakPersen: document.getElementById('stockPajakType')?.value === 'persen' ? (parseFloat(document.getElementById('stockPajakValue')?.value) || 0) : null,
                        pajakNominal: document.getElementById('stockPajakType')?.value === 'nominal' ? (parseFloat(document.getElementById('stockPajakValue')?.value) || 0) : null,
                        tglProduksi: document.getElementById('stockTglProduksi')?.value,
                        tglKadaluarsa: document.getElementById('stockTglKadaluarsa')?.value
                    };
                    
                    if (data.berat <= 0 || data.hargaBeli <= 0 || !data.tglProduksi || !data.tglKadaluarsa) {
                        showToast('Error', 'Lengkapi semua field wajib (berat, harga, tanggal).', 'error');
                        return;
                    }
                    
                    if (typeof CFS.Inventory === 'undefined' || !CFS.Inventory.addBatch) {
                        throw new Error('Modul Inventory belum dimuat');
                    }
                    
                    await CFS.Inventory.addBatch(data);
                    showToast('Berhasil', 'Batch berhasil ditambahkan.', 'success');
                    addStockForm.reset();
                    
                    if (CFS.Dashboard && CFS.Dashboard.refreshAll) CFS.Dashboard.refreshAll();
                    if (CFS.Inventory && CFS.Inventory.renderStockTable) CFS.Inventory.renderStockTable();
                    
                    // Tambahkan notifikasi
                    CFS.App.addNotification('Stok Baru', `Batch ${data.produk} ${data.berat} kg berhasil ditambahkan.`);
                } catch (err) {
                    console.error('Error tambah batch:', err);
                    showToast('Gagal', err.message || 'Gagal menambahkan batch.', 'error');
                }
            });
        }

        // ========== FORM PENJUALAN ==========
        const salesForm = document.getElementById('salesForm');
        if (salesForm) {
            salesForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const klien = document.getElementById('salesKlien')?.value;
                    const produk = document.getElementById('salesProduk')?.value;
                    const qty = parseFloat(document.getElementById('salesQty')?.value) || 0;
                    const tier = document.getElementById('salesTier')?.value || 'ecer';
                    const manualHarga = parseFloat(document.getElementById('salesHargaManual')?.value) || null;
                    
                    if (!klien || !produk || qty <= 0) {
                        showToast('Error', 'Lengkapi semua field wajib (klien, produk, jumlah).', 'error');
                        return;
                    }
                    
                    if (typeof CFS.Sales === 'undefined' || !CFS.Sales.processSale) {
                        throw new Error('Modul Sales belum dimuat');
                    }
                    
                    const result = await CFS.Sales.processSale(klien, produk, qty, tier, manualHarga);
                    
                    const resultDiv = document.getElementById('salesResult');
                    if (resultDiv) {
                        resultDiv.classList.remove('hidden');
                        resultDiv.innerHTML = `
                            <div class="text-emerald-700 dark:text-emerald-400">
                                ✅ <strong>Penjualan berhasil!</strong><br>
                                Invoice: <strong>${CFS.Utils.formatRupiah(result.totalInvoice)}</strong><br>
                                Batch terpakai: ${result.usedBatches?.map(b => `${b.nama_produk} ${b.qty}kg`).join(', ') || 'N/A'}
                            </div>`;
                    }
                    
                    showToast('Sukses', `Penjualan ${produk} ke ${klien} tercatat.`, 'success');
                    
                    if (CFS.Dashboard && CFS.Dashboard.refreshAll) CFS.Dashboard.refreshAll();
                    if (CFS.Inventory && CFS.Inventory.renderStockTable) CFS.Inventory.renderStockTable();
                    if (CFS.Sales && CFS.Sales.renderCustomerTable) CFS.Sales.renderCustomerTable();
                    
                    CFS.App.addNotification('Penjualan Baru', `${produk} ${qty} kg terjual ke ${klien}. Invoice: ${CFS.Utils.formatRupiah(result.totalInvoice)}`);
                } catch (err) {
                    console.error('Error penjualan:', err);
                    showToast('Gagal', err.message || 'Gagal memproses penjualan.', 'error');
                }
            });
        }

        // ========== PREVIEW HARGA ==========
        const previewBtn = document.getElementById('previewPriceBtn');
        if (previewBtn) {
            previewBtn.addEventListener('click', async () => {
                try {
                    const produk = document.getElementById('salesProduk')?.value;
                    const qty = parseFloat(document.getElementById('salesQty')?.value) || 0;
                    const tier = document.getElementById('salesTier')?.value || 'ecer';
                    const manual = parseFloat(document.getElementById('salesHargaManual')?.value) || null;
                    
                    if (!produk || qty <= 0) {
                        showToast('Info', 'Pilih produk dan isi jumlah terlebih dahulu.', 'info');
                        return;
                    }
                    
                    if (typeof CFS.Sales === 'undefined' || !CFS.Sales.previewPricing) {
                        throw new Error('Modul Sales belum dimuat');
                    }
                    
                    const preview = await CFS.Sales.previewPricing(produk, qty, tier, manual);
                    
                    const resultDiv = document.getElementById('salesResult');
                    if (resultDiv) {
                        resultDiv.classList.remove('hidden');
                        if (preview.error) {
                            resultDiv.innerHTML = `<div class="text-red-600">❌ ${preview.error}</div>`;
                        } else {
                            resultDiv.innerHTML = `
                                <div class="text-slate-700 dark:text-slate-300">
                                    📊 <strong>Preview Harga:</strong><br>
                                    HPP rata-rata: ${CFS.Utils.formatRupiah(preview.hppAvg)}<br>
                                    Harga Jual/kg: ${CFS.Utils.formatRupiah(preview.hargaJual)}<br>
                                    Estimasi Invoice: ${CFS.Utils.formatRupiah(preview.totalInvoice)}<br>
                                    Stok tersedia: ${preview.available?.toFixed(1) || '0'} kg
                                </div>`;
                        }
                    }
                } catch (err) {
                    console.error('Error preview:', err);
                    showToast('Error', 'Gagal menghitung preview harga.', 'error');
                }
            });
        }

        // ========== FORM BEBAN ==========
        const expenseForm = document.getElementById('expenseForm');
        if (expenseForm) {
            expenseForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const akun = document.getElementById('expenseAkun')?.value;
                    const jumlah = parseFloat(document.getElementById('expenseJumlah')?.value) || 0;
                    const deskripsi = document.getElementById('expenseDeskripsi')?.value || '';
                    
                    if (!akun || jumlah <= 0) {
                        showToast('Error', 'Pilih akun dan isi jumlah beban.', 'error');
                        return;
                    }
                    
                    if (typeof CFS.Accounting === 'undefined' || !CFS.Accounting.recordExpense) {
                        throw new Error('Modul Accounting belum dimuat');
                    }
                    
                    await CFS.Accounting.recordExpense(akun, jumlah, deskripsi);
                    showToast('Tercatat', `Beban ${akun} sebesar ${CFS.Utils.formatRupiah(jumlah)} dicatat.`, 'success');
                    expenseForm.reset();
                    
                    if (CFS.Dashboard && CFS.Dashboard.refreshAll) CFS.Dashboard.refreshAll();
                } catch (err) {
                    console.error('Error beban:', err);
                    showToast('Gagal', 'Gagal mencatat beban.', 'error');
                }
            });
        }

        // ========== FILTER RIWAYAT ==========
        const filterForm = document.getElementById('filterTransaksi');
        if (filterForm) {
            filterForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const filters = {
                        produk: document.getElementById('filterProduk')?.value,
                        klien: document.getElementById('filterKlien')?.value,
                        startDate: document.getElementById('filterStart')?.value,
                        endDate: document.getElementById('filterEnd')?.value
                    };
                    
                    if (typeof CFS.Sales === 'undefined' || !CFS.Sales.getFilteredTransactions) {
                        throw new Error('Modul Sales belum dimuat');
                    }
                    
                    const trx = await CFS.Sales.getFilteredTransactions(filters);
                    CFS.App.renderTransactionTable(trx);
                } catch (err) {
                    console.error('Error filter:', err);
                    showToast('Error', 'Gagal memfilter transaksi.', 'error');
                }
            });
        }

        // ========== EKSPOR EXCEL ==========
        const exportBtn = document.getElementById('exportExcelBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                try {
                    const today = new Date();
                    const start = new Date(today.getFullYear(), today.getMonth(), 1);
                    
                    if (typeof CFS.Accounting === 'undefined' || !CFS.Accounting.exportToExcel) {
                        throw new Error('Modul Accounting belum dimuat');
                    }
                    
                    const rows = await CFS.Accounting.exportToExcel(start, today);
                    if (!rows || rows.length === 0) {
                        showToast('Info', 'Tidak ada data jurnal di bulan ini.', 'info');
                        return;
                    }
                    
                    if (typeof XLSX === 'undefined') {
                        throw new Error('Library XLSX belum dimuat');
                    }
                    
                    const ws = XLSX.utils.json_to_sheet(rows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Jurnal');
                    const filename = `jurnal_${start.toISOString().slice(0,7)}.xlsx`;
                    XLSX.writeFile(wb, filename);
                    
                    showToast('Sukses', `File Excel "${filename}" diunduh.`, 'success');
                } catch (err) {
                    console.error('Error export:', err);
                    showToast('Error', 'Gagal mengekspor data.', 'error');
                }
            });
        }

        // ========== LIHAT JURNAL ==========
        const viewJournalBtn = document.getElementById('viewJournalBtn');
        if (viewJournalBtn) {
            viewJournalBtn.addEventListener('click', async () => {
                try {
                    const viewer = document.getElementById('journalViewer');
                    const tbody = document.getElementById('journalTableBody');
                    if (!viewer || !tbody) return;
                    
                    viewer.classList.toggle('hidden');
                    
                    if (!viewer.classList.contains('hidden')) {
                        if (typeof CFS.Accounting === 'undefined' || !CFS.Accounting.getJournals) {
                            throw new Error('Modul Accounting belum dimuat');
                        }
                        
                        const journals = await CFS.Accounting.getJournals();
                        const allEntries = [];
                        journals.forEach(j => {
                            j.entries.forEach(e => {
                                allEntries.push({
                                    tanggal: new Date(j.tanggal).toLocaleDateString('id-ID'),
                                    deskripsi: j.deskripsi,
                                    akun: e.akun,
                                    debet: e.debet || 0,
                                    kredit: e.kredit || 0
                                });
                            });
                        });
                        
                        tbody.innerHTML = allEntries.length > 0 
                            ? allEntries.map(e => `<tr class="border-b">
                                <td class="p-2">${e.tanggal}</td>
                                <td class="p-2">${e.deskripsi}</td>
                                <td class="p-2">${e.akun}</td>
                                <td class="p-2 text-right">${e.debet > 0 ? CFS.Utils.formatRupiah(e.debet) : ''}</td>
                                <td class="p-2 text-right">${e.kredit > 0 ? CFS.Utils.formatRupiah(e.kredit) : ''}</td>
                            </tr>`).join('')
                            : '<tr><td colspan="5" class="text-center p-4">Tidak ada jurnal.</td></tr>';
                    }
                } catch (err) {
                    console.error('Error view journal:', err);
                    showToast('Error', 'Gagal menampilkan jurnal.', 'error');
                }
            });
        }

        // ========== SIMPAN PENGATURAN ==========
        const saveSettingsBtn = document.getElementById('saveSettingsBtn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', async () => {
                try {
                    const settings = {
                        ppn: parseFloat(document.getElementById('setPPN')?.value) || 12,
                        pph25: parseFloat(document.getElementById('setPPh25')?.value) || 2,
                        pph21: parseFloat(document.getElementById('setPPh21')?.value) || 5,
                        ptShare: parseFloat(document.getElementById('setPTShare')?.value) || 60,
                        minGrosir: parseFloat(document.getElementById('setMinGrosir')?.value) || 10,
                        minPartai: parseFloat(document.getElementById('setMinPartai')?.value) || 500,
                        selisihGrosir: parseFloat(document.getElementById('setSelisihGrosir')?.value) || 5000,
                        marginDefault: parseFloat(document.getElementById('setMarginDefault')?.value) || 15000,
                        storageMethod: document.getElementById('setStorageMethod')?.value || 'none',
                        storageFlatMonthly: parseFloat(document.getElementById('setStorageFlat')?.value) || 0,
                        storagePerKgPerDay: parseFloat(document.getElementById('setStoragePerKg')?.value) || 0,
                        fifoMethod: document.getElementById('setFifoMethod')?.value || 'fefo'
                    };
                    
                    if (typeof CFS.Settings === 'undefined' || !CFS.Settings.save) {
                        throw new Error('Modul Settings belum dimuat');
                    }
                    
                    await CFS.Settings.save(settings);
                    showToast('Tersimpan', 'Pengaturan berhasil diperbarui.', 'success');
                } catch (err) {
                    console.error('Error save settings:', err);
                    showToast('Error', 'Gagal menyimpan pengaturan.', 'error');
                }
            });
        }

        // ========== TOGGLE BONGKAR & PAJAK ==========
        document.getElementById('stockToggleBongkar')?.addEventListener('change', function() {
            const nominal = document.getElementById('stockBongkarNominal');
            if (nominal) nominal.classList.toggle('hidden', !this.checked);
        });
        
        document.getElementById('stockPajakType')?.addEventListener('change', function() {
            const valueInput = document.getElementById('stockPajakValue');
            if (valueInput) {
                valueInput.classList.toggle('hidden', this.value === 'none');
                valueInput.placeholder = this.value === 'persen' ? 'Persentase (%)' : 'Nominal (Rp)';
            }
        });

        // ========== STORAGE METHOD DI SETTINGS ==========
        document.getElementById('setStorageMethod')?.addEventListener('change', function() {
            const flatInput = document.getElementById('storageFlatInput');
            const perKgInput = document.getElementById('storagePerKgInput');
            if (flatInput) flatInput.classList.toggle('hidden', this.value !== 'flat_monthly');
            if (perKgInput) perKgInput.classList.toggle('hidden', this.value !== 'per_kg_day');
        });
    },

    populateDropdowns() {
        try {
            if (typeof CFS.Inventory === 'undefined' || !CFS.Inventory.PRODUCT_LIST) {
                console.warn('PRODUCT_LIST belum tersedia');
                return;
            }
            
            const productOptions = CFS.Inventory.PRODUCT_LIST.map(p => `<option value="${p}">${p}</option>`).join('');
            document.querySelectorAll('#stockProduk, #salesProduk, #filterProduk, #batchProdukSelect').forEach(sel => {
                if (sel) sel.innerHTML = '<option value="">Pilih Produk</option>' + productOptions;
            });
        } catch (err) {
            console.warn('Error populateDropdowns:', err);
        }
    },

    async loadSettings() {
        try {
            if (typeof CFS.Settings === 'undefined' || !CFS.Settings.get) {
                console.warn('Settings module belum dimuat');
                return;
            }
            
            const s = await CFS.Settings.get();
            
            const setValue = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.value = value;
            };
            
            setValue('setPPN', s.ppn);
            setValue('setPPh25', s.pph25);
            setValue('setPPh21', s.pph21);
            setValue('setPTShare', s.ptShare);
            setValue('setMinGrosir', s.minGrosir);
            setValue('setMinPartai', s.minPartai);
            setValue('setSelisihGrosir', s.selisihGrosir);
            setValue('setMarginDefault', s.marginDefault);
            setValue('setStorageMethod', s.storageMethod || 'none');
            setValue('setStorageFlat', s.storageFlatMonthly || 0);
            setValue('setStoragePerKg', s.storagePerKgPerDay || 0);
            setValue('setFifoMethod', s.fifoMethod || 'fefo');
            
            // Tampilkan field storage yang sesuai
            const flatInput = document.getElementById('storageFlatInput');
            const perKgInput = document.getElementById('storagePerKgInput');
            if (flatInput) flatInput.classList.toggle('hidden', s.storageMethod !== 'flat_monthly');
            if (perKgInput) perKgInput.classList.toggle('hidden', s.storageMethod !== 'per_kg_day');
            
            // Widget visibility checkboxes
            const vis = s.widgetVisibility || CFS.Settings.DEFAULTS?.widgetVisibility || {};
            document.querySelectorAll('.widget-toggle').forEach(cb => {
                if (cb.dataset.widget && vis[cb.dataset.widget] !== undefined) {
                    cb.checked = vis[cb.dataset.widget];
                }
            });
        } catch (err) {
            console.error('Error loadSettings:', err);
        }
    },

    setupDashboardToggles() {
        document.querySelectorAll('.widget-toggle').forEach(checkbox => {
            checkbox.addEventListener('change', async () => {
                try {
                    const key = checkbox.dataset.widget;
                    if (!key) return;
                    
                    const widgetEl = document.getElementById(`widget-${key}`);
                    if (widgetEl) widgetEl.classList.toggle('hidden', !checkbox.checked);
                    
                    if (typeof CFS.Settings !== 'undefined' && CFS.Settings.update) {
                        const s = await CFS.Settings.get();
                        if (!s.widgetVisibility) s.widgetVisibility = {};
                        s.widgetVisibility[key] = checkbox.checked;
                        await CFS.Settings.save(s);
                    }
                } catch (err) {
                    console.warn('Error widget toggle:', err);
                }
            });
        });
    },

    setupBackupRestore() {
        // Backup
        CFS.App.backupData = async () => {
            try {
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
                
                showToast('Backup Sukses', 'Semua data berhasil diekspor.', 'success');
                CFS.App.addNotification('Backup', 'Data berhasil dibackup.');
            } catch (err) {
                console.error('Error backup:', err);
                showToast('Gagal Backup', 'Terjadi kesalahan saat backup.', 'error');
            }
        };
        
        // Restore
        CFS.App.restorePrompt = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                try {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    const text = await file.text();
                    const data = JSON.parse(text);
                    
                    if (data.batches) await CFS.Storage.set(CFS.Storage.STOCK_KEY, data.batches);
                    if (data.journals) await CFS.Storage.set(CFS.Storage.JOURNALS_KEY, data.journals);
                    if (data.settings) await CFS.Storage.set(CFS.Storage.SETTINGS_KEY, data.settings);
                    if (data.transactions) await CFS.Storage.set(CFS.Storage.TRANSACTIONS_KEY, data.transactions);
                    if (data.customers) await CFS.Storage.set('customers', data.customers);
                    
                    alert('✅ Data berhasil dipulihkan! Halaman akan dimuat ulang.');
                    location.reload();
                } catch (err) {
                    console.error('Error restore:', err);
                    alert('❌ Gagal memulihkan data. Pastikan file backup valid.');
                }
            };
            input.click();
        };
    },

    setupBatchModal() {
        const modal = document.getElementById('batchDetailModal');
        const closeBtn = modal?.querySelector('button');
        const select = document.getElementById('batchProdukSelect');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal?.classList.add('hidden'));
        }
        
        if (select) {
            select.addEventListener('change', async () => {
                const produk = select.value;
                await CFS.Inventory.renderBatchDetail(produk, 'batchDetailContent');
            });
            // Isi awal
            CFS.Inventory.renderBatchDetail('', 'batchDetailContent');
        }
        
        // Klik di luar modal untuk menutup
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        }
        
        // Escape key untuk menutup
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        });
    },

    // ========== NOTIFICATION CENTER ==========
    setupNotificationCenter() {
        const bell = document.getElementById('notificationBell');
        const panel = document.getElementById('notificationPanel');
        
        if (bell && panel) {
            bell.addEventListener('click', () => {
                panel.classList.toggle('hidden');
                this.renderNotifications();
            });
            
            // Klik di luar panel
            document.addEventListener('click', (e) => {
                if (!bell.contains(e.target) && !panel.contains(e.target)) {
                    panel.classList.add('hidden');
                }
            });
        }
    },

    addNotification(title, message) {
        this.notifications.unshift({
            title,
            message,
            time: new Date().toISOString()
        });
        if (this.notifications.length > 50) this.notifications = this.notifications.slice(0, 50);
        this.notificationCount++;
        window.updateNotifBadge?.(this.notificationCount);
    },

    renderNotifications() {
        const list = document.getElementById('notifList');
        if (!list) return;
        
        if (this.notifications.length === 0) {
            list.innerHTML = '<p class="opacity-50 text-center py-2">Tidak ada notifikasi.</p>';
        } else {
            list.innerHTML = this.notifications.slice(0, 10).map(n => `
                <div class="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <p class="font-semibold text-xs">${n.title}</p>
                    <p class="text-[10px] opacity-60">${n.message}</p>
                    <p class="text-[10px] opacity-30">${new Date(n.time).toLocaleString('id-ID')}</p>
                </div>
            `).join('');
        }
    },

    // ========== DESKTOP NOTIFICATION ==========
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    },

    sendDesktopNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🐟</text></svg>'
            });
        }
    },

    checkCriticalBatches() {
        setInterval(async () => {
            try {
                if (typeof CFS.Inventory === 'undefined' || !CFS.Inventory.getExpiringBatches) return;
                
                const expiring = await CFS.Inventory.getExpiringBatches(3);
                if (expiring.length > 0) {
                    const msg = `${expiring.length} batch akan kadaluarsa dalam 3 hari.`;
                    this.sendDesktopNotification('⚠ Batch Kritis', msg);
                    CFS.App.addNotification('Batch Kritis', msg);
                }
            } catch (err) {
                console.warn('Error checkCriticalBatches:', err);
            }
        }, 3600000); // Setiap jam
    },

    // ========== KEYBOARD SHORTCUTS ==========
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                CFS.App.backupData();
            } else if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                switchTab('tab-dashboard');
            } else if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                switchTab('tab-stock');
            }
        });
    },

    // ========== AUTO SAVE ==========
    setupAutoSave() {
        setInterval(async () => {
            try {
                const state = {
                    lastActiveTab: document.querySelector('.tab-content.active')?.id || 'tab-dashboard',
                    timestamp: new Date().toISOString()
                };
                await CFS.Storage.set('app_state', state);
            } catch (err) {
                // Silent
            }
        }, 30000);
    },

    // ========== RENDER TABLES ==========
    renderTransactionTable(transactions) {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;
        
        if (!transactions || transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center p-4 opacity-50">Tidak ada transaksi.</td></tr>';
            return;
        }
        
        tbody.innerHTML = transactions.map(t => `
            <tr class="border-b hover:bg-slate-50 dark:hover:bg-slate-800">
                <td class="p-2 text-xs">${CFS.Utils.formatDate(t.tanggal)}</td>
                <td class="p-2 font-medium">${t.klien}</td>
                <td class="p-2">${t.produk}</td>
                <td class="p-2 text-right">${t.qty} kg</td>
                <td class="p-2 text-right font-semibold">${CFS.Utils.formatRupiah(t.totalInvoice)}</td>
                <td class="p-2 text-center"><span class="badge">${t.tier}</span></td>
            </tr>
        `).join('');
    },

    async renderAllTransactions() {
        try {
            if (typeof CFS.Sales !== 'undefined' && CFS.Sales.getFilteredTransactions) {
                const trx = await CFS.Sales.getFilteredTransactions({});
                this.renderTransactionTable(trx);
            } else {
                const trx = await CFS.Storage.get(CFS.Storage.TRANSACTIONS_KEY) || [];
                this.renderTransactionTable(trx);
            }
        } catch (err) {
            console.warn('Error renderAllTransactions:', err);
        }
    }
};

// ========== TAMBAHKAN FUNGSI GLOBAL ==========
CFS.App.lihatBatch = (produk) => {
    const select = document.getElementById('batchProdukSelect');
    const modal = document.getElementById('batchDetailModal');
    if (select) {
        select.value = produk;
        select.dispatchEvent(new Event('change'));
    }
    if (modal) modal.classList.remove('hidden');
};

// ========== INIT SETELAH DOM SIAP ==========
document.addEventListener('DOMContentLoaded', () => {
    // Cek apakah semua dependencies sudah load
    if (typeof localforage === 'undefined') {
        console.error('localforage tidak ditemukan. Pastikan CDN terhubung.');
        return;
    }
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js tidak ditemukan. Grafik tidak akan berfungsi.');
    }
    if (typeof XLSX === 'undefined') {
        console.warn('SheetJS tidak ditemukan. Ekspor Excel tidak akan berfungsi.');
    }
    
    // Init app
    CFS.App.init();
});

// ========== DARK MODE TOGGLE (GLOBAL) ==========
function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('cfs_dark', isDark ? '1' : '0');
    const icon = document.getElementById('darkIcon');
    if (icon) {
        icon.className = isDark ? 'ph ph-sun text-lg text-yellow-400' : 'ph ph-moon text-lg';
    }
}

// Init dark mode dari localStorage
(function() {
    if (localStorage.getItem('cfs_dark') === '1') {
        document.documentElement.classList.add('dark');
        const icon = document.getElementById('darkIcon');
        if (icon) icon.className = 'ph ph-sun text-lg text-yellow-400';
    }
})();
