// js/sales.js
CFS.Sales = {
    async calculatePricing(productName, qty, tier, manualHarga = null) {
        const settings = await CFS.Settings.get();
        const usedBatches = await CFS.Inventory.allocateStock(productName, qty);
        let totalHPP = usedBatches.reduce((sum, b) => sum + b.qty * b.harga_per_kg, 0);
        for (let u of usedBatches) {
            const batch = (await CFS.Inventory.getBatches()).find(b => b.id === u.id);
            if (batch) totalHPP += await CFS.Inventory.getStorageCostForBatch(batch, u.qty, settings);
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
        const totalInvoice = dppTotal + ppn;
        return { usedBatches, totalHPP, hppAvg, hargaEcer, hargaJual, dppTotal, ppn, totalInvoice, tier };
    },

    async previewPricing(productName, qty, tier, manualHarga = null) {
        if (!productName || qty <= 0) return null;
        const settings = await CFS.Settings.get();
        const summary = await CFS.Inventory.getStockSummary();
        const available = summary[productName] || 0;
        if (qty > available) return { error: `Stok tidak cukup! Tersedia ${available.toFixed(1)} kg.` };
        const batches = await CFS.Inventory.getBatches();
        const now = new Date();
        const candidates = batches
            .filter(b => b.produk === productName && b.berat_sisa > 0 && new Date(b.tgl_kadaluarsa) > now)
            .sort((a, b) => new Date(a.tgl_kadaluarsa) - new Date(b.tgl_kadaluarsa));
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
        await CFS.Accounting.recordSale(klien, productName, qty, pricing.dppTotal, pricing.ppn, pricing.totalHPP);
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
        const transactions = (await CFS.Storage.get(CFS.Storage.TRANSACTIONS_KEY)) || [];
        transactions.unshift(trx);
        await CFS.Storage.set(CFS.Storage.TRANSACTIONS_KEY, transactions);
        // Update CRM
        await this.upsertCustomer(klien, trx);
        return pricing;
    },

    async getTransactions() {
        return (await CFS.Storage.get(CFS.Storage.TRANSACTIONS_KEY)) || [];
    },

    async getFilteredTransactions(filters = {}) {
        let trx = await this.getTransactions();
        if (filters.produk) trx = trx.filter(t => t.produk === filters.produk);
        if (filters.klien) trx = trx.filter(t => t.klien.toLowerCase().includes(filters.klien.toLowerCase()));
        if (filters.startDate) trx = trx.filter(t => new Date(t.tanggal) >= new Date(filters.startDate));
        if (filters.endDate) trx = trx.filter(t => new Date(t.tanggal) <= new Date(filters.endDate));
        return trx;
    },

    // --- CRM Functions ---
    async getCustomers() {
        return (await CFS.Storage.get(CFS.Storage.CUSTOMERS_KEY)) || [];
    },

    async saveCustomers(customers) {
        await CFS.Storage.set(CFS.Storage.CUSTOMERS_KEY, customers);
    },

    async upsertCustomer(klien, trx) {
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
        customer.totalPembelian += trx.totalInvoice;
        customer.totalTransaksi += 1;
        customer.terakhirBeli = new Date().toISOString();
        if (!customer.produkFavorit[trx.produk]) customer.produkFavorit[trx.produk] = 0;
        customer.produkFavorit[trx.produk] += trx.qty;
        await this.saveCustomers(customers);
    },

    async getCustomerAnalytics() {
        const customers = await this.getCustomers();
        const totalPendapatan = customers.reduce((s, c) => s + c.totalPembelian, 0);
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        const activeCustomers = customers.filter(c => new Date(c.terakhirBeli) >= thirtyDaysAgo).length;
        const topCustomers = customers.sort((a, b) => b.totalPembelian - a.totalPembelian).slice(0, 5);
        const churnRisk = customers.filter(c => new Date(c.terakhirBeli) < thirtyDaysAgo).length;
        return { totalPelanggan: customers.length, totalPendapatan, activeCustomers, topCustomers, churnRisk };
    },

    async renderCRMTable() {
        const customers = await this.getCustomers();
        const tbody = document.getElementById('crmTableBody');
        if (!tbody) return;
        if (customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 opacity-50">Belum ada data pelanggan</td></tr>';
            return;
        }
        tbody.innerHTML = customers.sort((a, b) => b.totalPembelian - a.totalPembelian).map(c => {
            const last = c.terakhirBeli ? new Date(c.terakhirBeli).toLocaleDateString('id-ID') : '-';
            const now = new Date();
            const daysSinceLast = c.terakhirBeli ? Math.floor((now - new Date(c.terakhirBeli)) / (1000*3600*24)) : Infinity;
            const status = daysSinceLast <= 30 ? '<span class="badge bg-green-100 text-green-700">Aktif</span>' :
                           (daysSinceLast <= 60 ? '<span class="badge bg-yellow-100 text-yellow-700">Jarang</span>' :
                            '<span class="badge bg-red-100 text-red-700">Churn Risk</span>');
            return `<tr class="border-b hover:bg-slate-50">
                <td class="p-2 font-medium">${c.nama}</td>
                <td class="p-2 text-right">${CFS.Utils.formatRupiah(c.totalPembelian)}</td>
                <td class="p-2 text-right">${c.totalTransaksi}x</td>
                <td class="p-2 text-right text-xs">${last}</td>
                <td class="p-2 text-center">${status}</td>
            </tr>`;
        }).join('');
    }
};
