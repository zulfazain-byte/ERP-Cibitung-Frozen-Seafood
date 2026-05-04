// js/app.js
CFS.Utils = {
    formatRupiah: (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num),
    formatDate: (iso) => new Date(iso).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
};

CFS.App = {
    init() {
        this.setupTabs();
        this.setupForms();
        this.populateDropdowns();
        this.loadSettings();
        this.setupToggles();
        this.setupBackup();
        this.setupBatchModal();
        this.requestNotificationPermission();
        this.checkCriticalBatches();
        this.checkStockThresholds();
        CFS.Dashboard.refreshAll();
        CFS.Inventory.renderStockTable();
        document.getElementById('dashDate').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    },

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });
    },

    onTabSwitch(tab) {
        if (tab === 'tab-stock') CFS.Inventory.renderStockTable();
        if (tab === 'tab-dashboard') CFS.Dashboard.refreshAll();
        if (tab === 'tab-finance') { CFS.Dashboard.renderFinanceSummary(); CFS.Dashboard.renderNeraca(); }
        if (tab === 'tab-reports') { CFS.Dashboard.renderLabaRugiReport(); CFS.Dashboard.renderNeraca(); }
        if (tab === 'tab-crm') { CFS.Dashboard.renderCRMStats(); CFS.Sales.renderCRMTable(); }
    },

    setupForms() {
        // Tambah batch
        document.getElementById('addStockForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                produk: document.getElementById('stockProduk').value,
                berat: parseFloat(document.getElementById('stockBerat').value),
                hargaBeli: parseFloat(document.getElementById('stockHargaBeli').value),
                ongkir: parseFloat(document.getElementById('stockOngkir').value) || 0,
                biayaBensin: parseFloat(document.getElementById('stockBensin').value) || 0,
                toggleBongkar: document.getElementById('stockToggleBongkar').checked,
                bongkarNominal: document.getElementById('stockToggleBongkar').checked ? parseFloat(document.getElementById('stockBongkarNominal').value) || 0 : 0,
                pajakPersen: document.getElementById('stockPajakType').value === 'persen' ? parseFloat(document.getElementById('stockPajakValue').value) || 0 : null,
                pajakNominal: document.getElementById('stockPajakType').value === 'nominal' ? parseFloat(document.getElementById('stockPajakValue').value) || 0 : null,
                tglProduksi: document.getElementById('stockTglProduksi').value,
                tglKadaluarsa: document.getElementById('stockTglKadaluarsa').value
            };
            await CFS.Inventory.addBatch(data);
            await CFS.Accounting.recordPurchase(data.produk, (data.hargaBeli * data.berat) + data.ongkir + data.biayaBensin + (data.toggleBongkar ? data.bongkarNominal : 0), data.berat);
            showToast('Berhasil', 'Batch ditambahkan.', 'success');
            e.target.reset();
            CFS.Dashboard.refreshAll();
            CFS.Inventory.renderStockTable();
        });

        // Penjualan
        document.getElementById('salesForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const res = await CFS.Sales.processSale(
                    document.getElementById('salesKlien').value,
                    document.getElementById('salesProduk').value,
                    parseFloat(document.getElementById('salesQty').value),
                    document.getElementById('salesTier').value,
                    parseFloat(document.getElementById('salesHargaManual').value) || null
                );
                document.getElementById('salesResult').classList.remove('hidden');
                document.getElementById('salesResult').innerHTML = `✅ Invoice: ${CFS.Utils.formatRupiah(res.totalInvoice)}`;
                showToast('Sukses', 'Penjualan tercatat.', 'success');
                CFS.Dashboard.refreshAll();
                CFS.Inventory.renderStockTable();
            } catch (err) { showToast('Gagal', err.message, 'error'); }
        });

        // Preview harga
        document.getElementById('previewPriceBtn')?.addEventListener('click', async () => {
            const produk = document.getElementById('salesProduk').value;
            const qty = parseFloat(document.getElementById('salesQty').value);
            const tier = document.getElementById('salesTier').value;
            const manual = parseFloat(document.getElementById('salesHargaManual').value) || null;
            const preview = await CFS.Sales.previewPricing(produk, qty, tier, manual);
            const div = document.getElementById('salesResult');
            div.classList.remove('hidden');
            if (preview.error) div.innerHTML = `<span class="text-red-600">${preview.error}</span>`;
            else div.innerHTML = `📊 Harga Jual: ${CFS.Utils.formatRupiah(preview.hargaJual)}/kg | Estimasi Invoice: ${CFS.Utils.formatRupiah(preview.totalInvoice)}`;
        });

        // Beban operasional
        document.getElementById('expenseForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await CFS.Accounting.recordExpense(document.getElementById('expenseAkun').value, parseFloat(document.getElementById('expenseJumlah').value), document.getElementById('expenseDeskripsi').value);
            showToast('Tercatat', 'Beban ditambahkan.', 'success');
            e.target.reset();
            CFS.Dashboard.refreshAll();
        });

        // Filter riwayat
        document.getElementById('filterTransaksi')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const filters = {
                produk: document.getElementById('filterProduk').value,
                klien: document.getElementById('filterKlien').value,
                startDate: document.getElementById('filterStart').value,
                endDate: document.getElementById('filterEnd').value
            };
            const trx = await CFS.Sales.getFilteredTransactions(filters);
            const tbody = document.getElementById('historyTableBody');
            tbody.innerHTML = trx.length ? trx.map(t => `<tr><td>${new Date(t.tanggal).toLocaleDateString('id-ID')}</td><td>${t.klien}</td><td>${t.produk}</td><td>${t.qty} kg</td><td>${CFS.Utils.formatRupiah(t.totalInvoice)}</td><td>${t.tier}</td></tr>`).join('') : '<tr><td colspan="6" class="p-4 text-center">Tidak ada data</td></tr>';
        });

        // Ekspor Excel
        document.getElementById('exportExcelBtn')?.addEventListener('click', async () => {
            const today = new Date();
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            const rows = await CFS.Accounting.exportToExcel(start, today);
            if (rows.length === 0) return showToast('Info', 'Tidak ada jurnal.', 'info');
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Jurnal');
            XLSX.writeFile(wb, `jurnal_${start.toISOString().slice(0,7)}.xlsx`);
            showToast('Sukses', 'Excel diunduh.', 'success');
        });

        // Lihat buku besar
        document.getElementById('viewJournalBtn')?.addEventListener('click', async () => {
            const journals = await CFS.Accounting.getJournals();
            const tbody = document.getElementById('journalTableBody');
            const viewer = document.getElementById('journalViewer');
            viewer.classList.toggle('hidden');
            const rows = [];
            journals.forEach(j => j.entries.forEach(e => rows.push({
                tanggal: new Date(j.tanggal).toLocaleDateString('id-ID'),
                deskripsi: j.deskripsi,
                akun: e.akun,
                debet: e.debet,
                kredit: e.kredit
            })));
            tbody.innerHTML = rows.map(r => `<tr><td>${r.tanggal}</td><td>${r.deskripsi}</td><td>${r.akun}</td><td>${r.debet||''}</td><td>${r.kredit||''}</td></tr>`).join('');
        });

        // Simpan pengaturan
        document.getElementById('saveSettingsBtn')?.addEventListener('click', async () => {
            const s = {
                ppn: +document.getElementById('setPPN').value,
                pph25: +document.getElementById('setPPh25').value,
                pph21: +document.getElementById('setPPh21').value,
                ptShare: +document.getElementById('setPTShare').value,
                minGrosir: +document.getElementById('setMinGrosir').value,
                minPartai: +document.getElementById('setMinPartai').value,
                selisihGrosir: +document.getElementById('setSelisihGrosir').value,
                marginDefault: +document.getElementById('setMarginDefault').value,
                storageMethod: document.getElementById('setStorageMethod').value,
                storageFlatMonthly: +document.getElementById('setStorageFlat').value,
                storagePerKgPerDay: +document.getElementById('setStoragePerKg').value,
                fifoMethod: document.getElementById('setFifoMethod').value
            };
            await CFS.Settings.save(s);
            showToast('Tersimpan', 'Pengaturan diperbarui.', 'success');
        });

        // Toggle bongkar muat
        document.getElementById('stockToggleBongkar')?.addEventListener('change', function() {
            document.getElementById('stockBongkarNominal').classList.toggle('hidden', !this.checked);
        });

        // Pajak type
        document.getElementById('stockPajakType')?.addEventListener('change', function() {
            const val = document.getElementById('stockPajakValue');
            val.classList.toggle('hidden', this.value === 'none');
            val.placeholder = this.value === 'persen' ? 'Persentase (%)' : 'Nominal (Rp)';
        });
    },

    populateDropdowns() {
        const opts = CFS.Inventory.PRODUCT_LIST.map(p => `<option value="${p}">${p}</option>`).join('');
        document.querySelectorAll('#stockProduk, #salesProduk, #filterProduk, #batchProdukSelect').forEach(sel => {
            sel.innerHTML = '<option value="">Pilih</option>' + opts;
        });
    },

    async loadSettings() {
        const s = await CFS.Settings.get();
        document.getElementById('setPPN').value = s.ppn;
        document.getElementById('setPPh25').value = s.pph25;
        document.getElementById('setPPh21').value = s.pph21;
        document.getElementById('setPTShare').value = s.ptShare;
        document.getElementById('setMinGrosir').value = s.minGrosir;
        document.getElementById('setMinPartai').value = s.minPartai;
        document.getElementById('setSelisihGrosir').value = s.selisihGrosir;
        document.getElementById('setMarginDefault').value = s.marginDefault;
        document.getElementById('setStorageMethod').value = s.storageMethod || 'none';
        document.getElementById('setStorageFlat').value = s.storageFlatMonthly || 0;
        document.getElementById('setStoragePerKg').value = s.storagePerKgPerDay || 0;
        document.getElementById('setFifoMethod').value = s.fifoMethod || 'fefo';
        document.getElementById('storageFlatInput').classList.toggle('hidden', s.storageMethod !== 'flat_monthly');
        document.getElementById('storagePerKgInput').classList.toggle('hidden', s.storageMethod !== 'per_kg_day');
        document.querySelectorAll('.widget-toggle').forEach(cb => {
            const vis = s.widgetVisibility || CFS.Settings.DEFAULTS.widgetVisibility;
            if (vis[cb.dataset.widget] !== undefined) cb.checked = vis[cb.dataset.widget];
        });
    },

    setupToggles() {
        document.querySelectorAll('.widget-toggle').forEach(cb => cb.addEventListener('change', async () => {
            const s = await CFS.Settings.get();
            s.widgetVisibility[cb.dataset.widget] = cb.checked;
            await CFS.Settings.save(s);
            document.getElementById(`widget-${cb.dataset.widget}`).classList.toggle('hidden', !cb.checked);
        }));
    },

    setupBackup() {
        CFS.App.backupData = async () => {
            const data = {
                batches: await CFS.Storage.get(CFS.Storage.STOCK_KEY),
                journals: await CFS.Storage.get(CFS.Storage.JOURNALS_KEY),
                settings: await CFS.Storage.get(CFS.Storage.SETTINGS_KEY),
                transactions: await CFS.Storage.get(CFS.Storage.TRANSACTIONS_KEY),
                customers: await CFS.Storage.get(CFS.Storage.CUSTOMERS_KEY)
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `cfs_backup_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            showToast('Backup', 'Data berhasil diekspor.', 'success');
        };

        CFS.App.restorePrompt = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                const text = await file.text();
                const data = JSON.parse(text);
                if (data.batches) await CFS.Storage.set(CFS.Storage.STOCK_KEY, data.batches);
                if (data.journals) await CFS.Storage.set(CFS.Storage.JOURNALS_KEY, data.journals);
                if (data.settings) await CFS.Storage.set(CFS.Storage.SETTINGS_KEY, data.settings);
                if (data.transactions) await CFS.Storage.set(CFS.Storage.TRANSACTIONS_KEY, data.transactions);
                if (data.customers) await CFS.Storage.set(CFS.Storage.CUSTOMERS_KEY, data.customers);
                alert('Data berhasil dipulihkan!');
                location.reload();
            };
            input.click();
        };
    },

    setupBatchModal() {
        const select = document.getElementById('batchProdukSelect');
        select.addEventListener('change', async () => {
            await CFS.Inventory.renderBatchDetail(select.value, 'batchDetailContent');
        });
        select.dispatchEvent(new Event('change'));
    },

    lihatBatch(produk) {
        document.getElementById('batchProdukSelect').value = produk;
        document.getElementById('batchProdukSelect').dispatchEvent(new Event('change'));
        document.getElementById('batchDetailModal').classList.remove('hidden');
    },

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    },

    async checkCriticalBatches() {
        const expiring = await CFS.Inventory.getExpiringBatches(3);
        const count = expiring.length;
        window.updateNotifBadge(count);
        if (count > 0 && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('⚠ Batch Hampir Kadaluarsa', { body: `${count} batch akan expired dalam 3 hari.` });
        }
        setInterval(async () => {
            const exp = await CFS.Inventory.getExpiringBatches(3);
            window.updateNotifBadge(exp.length);
        }, 3600000);
    },

    async checkStockThresholds() {
        const summary = await CFS.Inventory.getStockSummary();
        const settings = await CFS.Settings.get();
        const thresholds = settings.productThresholds || {};
        let notifCount = 0;
        for (let [produk, qty] of Object.entries(summary)) {
            const threshold = thresholds[produk] || 5;
            if (qty < threshold) notifCount++;
        }
        window.updateNotifBadge(notifCount);
    }
};

// Global switch tab
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('bg-primary-50', 'text-primary-700', 'font-semibold');
        if (b.dataset.tab === tabId) {
            b.classList.add('bg-primary-50', 'text-primary-700', 'font-semibold');
        }
    });
    if (CFS.App.onTabSwitch) CFS.App.onTabSwitch(tabId);
}

// Toast
function showToast(title, msg, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    document.getElementById('toastTitle').innerText = title;
    document.getElementById('toastMsg').innerText = msg;
    icon.className = `w-9 h-9 rounded-full flex items-center justify-center text-white ${type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`;
    icon.innerHTML = type === 'success' ? '<i class="ph ph-check text-lg"></i>' : '<i class="ph ph-warning text-lg"></i>';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Start
window.addEventListener('DOMContentLoaded', () => CFS.App.init());
