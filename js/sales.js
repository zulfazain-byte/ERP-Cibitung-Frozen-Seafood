// js/sales.js
CFS.Sales = {
    CUSTOMERS_KEY: 'customers',

    async calculatePricing(productName, qty, tier, manualHarga = null) {
        const settings = await CFS.Settings.get();
        const usedBatches = await CFS.Inventory.allocateStock(productName, qty);
        if (!usedBatches || usedBatches.length === 0) {
            throw new Error('Gagal mengalokasikan stok.');
        }
        let totalHPP = usedBatches.reduce((sum, b) => sum + (b.qty * b.harga_per_kg), 0);
        const batches = await CFS.Inventory.getBatches();
        for (let ub of usedBatches) {
            const batch = batches.find(b => b.id === ub.id);
            if (batch) {
                totalHPP += await CFS.Inventory.getStorageCostForBatch(batch, ub.qty, settings);
            }
        }
        const hppAvg = totalHPP / qty;
        const hargaEcer = hppAvg + settings.marginDefault;
        let hargaJualPerKg;
        if (tier === 'grosir') {
            hargaJualPerKg = hargaEcer - settings.selisihGrosir;
            if (hargaJualPerKg < hppAvg) hargaJualPerKg = hppAvg;
        } else if (tier === 'partai') {
            hargaJualPerKg = manualHarga || hargaEcer;
        } else {
            hargaJualPerKg = hargaEcer;
        }
        if (manualHarga && tier !== 'partai') hargaJualPerKg = manualHarga;
        const dppTotal = hargaJualPerKg * qty;
        const ppn = dppTotal * (settings.ppn / 100);
        const totalInvoice = dppTotal + ppn;
        return {
            usedBatches,
            totalHPP,
            hppAvg,
            hargaEcer,
            hargaJual: hargaJualPerKg,
            dppTotal,
            ppn,
            totalInvoice,
            tier
        };
    },

    async previewPricing(productName, qty, tier, manualHarga = null) {
        if (!productName || qty <= 0) return { error: 'Produk dan jumlah harus diisi.' };
        const settings = await CFS.Settings.get();
        const summary = await CFS.Inventory.getStockSummary();
        const available = summary[productName] || 0;
        if (qty > available) return { error: `Stok tidak cukup! Tersedia ${available.toFixed(1)} kg.` };
        const batches = await CFS.Inventory.getBatches();
        const now = new Date();
        const candidates = batches
            .filter(b => b.produk === productName && b.berat_sisa > 0 && new Date(b.tgl_kadaluarsa) > now)
            .sort((a, b) => settings.fifoMethod === 'fifo' ? new Date(a.created_at) - new Date(b.created_at) : new Date(a.tgl_kadaluarsa) - new Date(b.tgl_kadaluarsa));
        let remaining = qty;
        let totalHPP = 0;
        for (let b of candidates) {
            if (remaining <= 0) break;
            const take = Math.min(b.berat_sisa, remaining);
            totalHPP += take * b.hpp_per_kg;
            remaining -= take;
        }
        const hppAvg = totalHPP / qty;
        const hargaEcer = hppAvg + settings.marginDefault;
        let hargaJual;
        if (tier === 'grosir') {
            hargaJual = hargaEcer - settings.selisihGrosir;
            if (hargaJual < hppAvg) hargaJual = hppAvg;
        } else if (tier === 'partai') {
            hargaJual = manualHarga || hargaEcer;
        } else {
            hargaJual = hargaEcer;
        }
        if (manualHarga && tier !== 'partai') hargaJual = manualHarga;
        const dppTotal = hargaJual * qty;
        const ppn = dppTotal * (settings.ppn / 100);
        return { hargaJual, dppTotal, ppn, totalInvoice: dppTotal + ppn, hppAvg, available };
    },

    async processSale(klien, productName, qty, tier, manualHarga = null) {
        const pricing = await this.calculatePricing(productName, qty, tier, manualHarga);
        if (CFS.Accounting && CFS.Accounting.recordSale) {
            await CFS.Accounting.recordSale(klien, productName, qty, pricing.dppTotal, pricing.ppn, pricing.totalHPP);
        }
        const trx = {
            id: Date.now(),
            klien,
            produk: productName,
            qty,
            tier,
            hargaJual: pricing.hargaJual,
            totalInvoice: pricing.totalInvoice,
            hpp: pricing.totalHPP,
            usedBatches: pricing.usedBatches,
            tanggal: new Date().toISOString()
        };
        const transactions = await CFS.Storage.get(CFS.Storage.TRANSACTIONS_KEY) || [];
        transactions.unshift(trx);
        await CFS.Storage.set(CFS.Storage.TRANSACTIONS_KEY, transactions);
        await this.upsertCustomer(klien, trx);
        return pricing;
    },

    async getTransactions() {
        return await CFS.Storage.get(CFS.Storage.TRANSACTIONS_KEY) || [];
    },

    async getFilteredTransactions(filters = {}) {
        let trx = await this.getTransactions();
        if (filters.produk) trx = trx.filter(t => t.produk === filters.produk);
        if (filters.klien) trx = trx.filter(t => t.klien.toLowerCase().includes(filters.klien.toLowerCase()));
        if (filters.startDate) trx = trx.filter(t => new Date(t.tanggal) >= new Date(filters.startDate));
        if (filters.endDate) trx = trx.filter(t => new Date(t.tanggal) <= new Date(filters.endDate));
        return trx;
    },

    // ========== CRM ==========
    async getCustomers() {
        return await CFS.Storage.get(this.CUSTOMERS_KEY) || [];
    },

    async saveCustomers(customers) {
        await CFS.Storage.set(this.CUSTOMERS_KEY, customers);
    },

    async upsertCustomer(klien, transaksi) {
        const customers = await this.getCustomers();
        let customer = customers.find(c => c.nama.toLowerCase() === klien.toLowerCase());
        if (!customer) {
            customer = {
                id: Date.now(),
                nama: klien,
                totalPembelian: 0,
                totalTransaksi: 0,
                terakhirBeli: null,
                produkFavorit: {}
            };
            customers.push(customer);
        }
        customer.totalPembelian += transaksi.totalInvoice || 0;
        customer.totalTransaksi += 1;
        customer.terakhirBeli = new Date().toISOString();
        if (!customer.produkFavorit[transaksi.produk]) customer.produkFavorit[transaksi.produk] = 0;
        customer.produkFavorit[transaksi.produk] += transaksi.qty || 0;
        await this.saveCustomers(customers);
        return customer;
    },

    async renderCustomerTable() {
        const customers = await this.getCustomers();
        const tbody = document.getElementById('crmTableBody');
        if (!tbody) return;
        if (customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 opacity-50">Belum ada data pelanggan.</td></tr>';
            return;
        }
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        const totalPendapatan = customers.reduce((s, c) => s + c.totalPembelian, 0);
        const activeCustomers = customers.filter(c => new Date(c.terakhirBeli) > thirtyDaysAgo).length;
        const statsTotal = document.getElementById('crmTotalCustomers');
        const statsRevenue = document.getElementById('crmTotalRevenue');
        const statsActive = document.getElementById('crmActiveCustomers');
        if (statsTotal) statsTotal.textContent = customers.length;
        if (statsRevenue) statsRevenue.textContent = CFS.Utils.formatRupiah(totalPendapatan);
        if (statsActive) statsActive.textContent = activeCustomers;
        tbody.innerHTML = customers
            .sort((a, b) => new Date(b.terakhirBeli) - new Date(a.terakhirBeli))
            .map(c => {
                const lastBuy = new Date(c.terakhirBeli);
                const daysSince = Math.floor((now - lastBuy) / (1000 * 60 * 60 * 24));
                const status = daysSince > 30 ? '⚠️ Churn Risk' : '✅ Aktif';
                const color = daysSince > 30 ? 'text-red-600' : 'text-green-600';
                return `<tr class="border-b hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td class="p-2 font-medium">${c.nama}</td>
                    <td class="p-2 text-right">${CFS.Utils.formatRupiah(c.totalPembelian)}</td>
                    <td class="p-2 text-right">${c.totalTransaksi}</td>
                    <td class="p-2 text-right text-xs">${CFS.Utils.formatDate(c.terakhirBeli)}</td>
                    <td class="p-2 text-center"><span class="${color} text-xs font-semibold">${status}</span></td>
                </tr>`;
            }).join('');
    },

    // ========== CETAK PDF INVOICE ==========
    printInvoice(klien, produk, qty, hargaJual, dppTotal, ppn, totalInvoice) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const settings = CFS.Settings.get().then(s => {
            const namaUsaha = s.namaUsaha || 'Cibitung Frozen';
            const alamat = s.alamat || 'Jl. Industri No.1';
            const telepon = s.telepon || '08123456789';
            const invNo = 'INV-CFS-' + Date.now().toString().slice(-6);
            const tgl = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

            // Header
            doc.setFillColor(37, 99, 235);
            doc.rect(0, 0, 210, 35, 'F');
            doc.setFontSize(22);
            doc.setTextColor(255, 255, 255);
            doc.text('INVOICE', 14, 20);
            doc.setFontSize(9);
            doc.text(namaUsaha, 150, 14);
            doc.text(alamat, 150, 18);
            doc.text(telepon, 150, 22);

            doc.setTextColor(0);
            doc.setFontSize(10);
            doc.text('Kepada:', 14, 45);
            doc.text(klien, 14, 50);
            doc.text(`No. Invoice: ${invNo}`, 150, 45);
            doc.text(`Tanggal: ${tgl}`, 150, 50);

            // Tabel
            doc.setDrawColor(220);
            doc.setFillColor(245, 245, 245);
            doc.rect(14, 60, 182, 10, 'F');
            doc.text('Deskripsi', 16, 67);
            doc.text('Qty (kg)', 120, 67);
            doc.text('Harga/kg', 150, 67);
            doc.text('Subtotal', 175, 67);
            doc.rect(14, 70, 182, 12);
            doc.text(produk, 16, 78);
            doc.text(qty.toString(), 120, 78);
            doc.text(CFS.Utils.formatRupiah(hargaJual), 145, 78);
            doc.text(CFS.Utils.formatRupiah(dppTotal), 170, 78);

            doc.line(140, 90, 196, 90);
            doc.text('DPP:', 140, 98);
            doc.text(CFS.Utils.formatRupiah(dppTotal), 175, 98);
            doc.setTextColor(220, 38, 38);
            doc.text(`PPN (${s.ppn || 12}%):`, 140, 106);
            doc.text(CFS.Utils.formatRupiah(ppn), 175, 106);
            doc.setFillColor(37, 99, 235);
            doc.rect(138, 112, 58, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text('TOTAL', 140, 119);
            doc.text(CFS.Utils.formatRupiah(totalInvoice), 175, 119);

            doc.save(`Invoice_${klien}_${invNo}.pdf`);
        });
    }
};
