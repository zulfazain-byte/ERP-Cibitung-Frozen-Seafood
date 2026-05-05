// js/inventory.js
CFS.Inventory = {
    PRODUCT_LIST: [
        'Ikan Banjar', 'Ikan Dori Fillet', 'Ikan Layang', 'Ikan Belo',
        'Ikan Tongkol', 'Ikan Salem', 'Ikan Tenggiri', 'Ikan Bawal Laut', 'Cumi Cumi'
    ],

    async getBatches() {
        let batches = await CFS.Storage.get(CFS.Storage.STOCK_KEY);
        if (!batches) batches = [];
        return batches;
    },

    async saveBatches(batches) {
        await CFS.Storage.set(CFS.Storage.STOCK_KEY, batches);
    },

    async addBatch(batchData) {
        const batches = await this.getBatches();
        let totalModal = (batchData.hargaBeli * batchData.berat) + (batchData.ongkir || 0) + (batchData.biayaBensin || 0);
        if (batchData.toggleBongkar && batchData.bongkarNominal) totalModal += batchData.bongkarNominal;
        if (batchData.pajakPersen) totalModal += totalModal * (batchData.pajakPersen / 100);
        else if (batchData.pajakNominal) totalModal += batchData.pajakNominal;
        const hppPerKg = totalModal / batchData.berat;
        const batch = {
            id: 'BATCH_' + Date.now(),
            produk: batchData.produk,
            berat_awal: batchData.berat,
            berat_sisa: batchData.berat,
            harga_beli: batchData.hargaBeli,
            ongkir: batchData.ongkir || 0,
            biaya_bensin: batchData.biayaBensin || 0,
            bongkar: batchData.toggleBongkar ? (batchData.bongkarNominal || 0) : 0,
            pajak: batchData.pajakPersen ? { type: 'persen', value: batchData.pajakPersen } : (batchData.pajakNominal ? { type: 'nominal', value: batchData.pajakNominal } : null),
            tgl_produksi: batchData.tglProduksi,
            tgl_kadaluarsa: batchData.tglKadaluarsa,
            hpp_per_kg: hppPerKg,
            status: 'aktif',
            created_at: new Date().toISOString()
        };
        batches.push(batch);
        await this.saveBatches(batches);
        return batch;
    },

    async allocateStock(productName, qtyNeeded) {
        const batches = await this.getBatches();
        const now = new Date();
        const candidates = batches.filter(b =>
            b.produk === productName &&
            b.berat_sisa > 0 &&
            new Date(b.tgl_kadaluarsa) > now
        );
        const settings = await CFS.Settings.get();
        candidates.sort((a, b) => {
            if (settings.fifoMethod === 'fifo') {
                return new Date(a.created_at) - new Date(b.created_at);
            } else {
                return new Date(a.tgl_kadaluarsa) - new Date(b.tgl_kadaluarsa);
            }
        });
        let remaining = qtyNeeded;
        const usedBatches = [];
        for (let b of candidates) {
            if (remaining <= 0) break;
            const take = Math.min(b.berat_sisa, remaining);
            b.berat_sisa -= take;
            remaining -= take;
            usedBatches.push({
                id: b.id,
                nama_produk: b.produk,
                qty: take,
                harga_per_kg: b.hpp_per_kg
            });
            if (b.berat_sisa === 0) b.status = 'habis';
        }
        if (remaining > 0) {
            throw new Error(`Stok ${productName} tidak mencukupi. Kurang ${remaining.toFixed(1)} kg.`);
        }
        await this.saveBatches(batches);
        return usedBatches; // Pastikan selalu mengembalikan array
    },

    async getStockSummary() {
        const batches = await this.getBatches();
        const sum = {};
        this.PRODUCT_LIST.forEach(p => sum[p] = 0);
        batches.forEach(b => {
            if (b.berat_sisa > 0) sum[b.produk] = (sum[b.produk] || 0) + b.berat_sisa;
        });
        return sum;
    },

    async getStorageCostForBatch(batch, qty, settings) {
        if (!settings || settings.storageMethod === 'none') return 0;
        const now = new Date();
        const days = Math.ceil((now - new Date(batch.created_at)) / (1000 * 3600 * 24));
        if (settings.storageMethod === 'per_kg_day') {
            return qty * days * (settings.storagePerKgPerDay || 0);
        }
        if (settings.storageMethod === 'flat_monthly') {
            const summary = await this.getStockSummary();
            const total = Object.values(summary).reduce((a, b) => a + b, 0);
            if (total > 0 && settings.storageFlatMonthly) {
                return qty * (settings.storageFlatMonthly / total);
            }
        }
        return 0;
    },

    async renderBatchDetail(produk, containerId) {
        const batches = await this.getBatches();
        const filtered = produk ? batches.filter(b => b.produk === produk) : batches;
        const container = document.getElementById(containerId);
        if (!container) return;
        const now = new Date();
        if (filtered.length === 0) {
            container.innerHTML = '<p class="text-slate-500 p-2">Tidak ada batch.</p>';
            return;
        }
        container.innerHTML = `<table class="w-full text-sm mt-2">
            <thead><tr class="bg-slate-50 dark:bg-slate-800">
                <th class="p-2 text-left">ID Batch</th><th class="p-2 text-left">Produk</th>
                <th class="p-2 text-right">Berat Awal</th><th class="p-2 text-right">Sisa</th>
                <th class="p-2 text-right">HPP/kg</th><th class="p-2 text-center">Expired</th>
            </tr></thead>
            <tbody>${filtered.map(b => {
                const daysLeft = Math.ceil((new Date(b.tgl_kadaluarsa) - now) / (1000*3600*24));
                const rowClass = daysLeft <= 7 ? 'bg-red-50 dark:bg-red-900/20' : (daysLeft <= 30 ? 'bg-yellow-50 dark:bg-yellow-900/20' : '');
                return `<tr class="${rowClass} border-b">
                    <td class="p-2 text-xs">${b.id}</td><td class="p-2">${b.produk}</td>
                    <td class="p-2 text-right">${b.berat_awal.toFixed(1)}</td>
                    <td class="p-2 text-right font-semibold">${b.berat_sisa.toFixed(1)}</td>
                    <td class="p-2 text-right">${CFS.Utils.formatRupiah(b.hpp_per_kg)}</td>
                    <td class="p-2 text-center text-xs">${b.tgl_kadaluarsa} (${daysLeft} hari)</td>
                </tr>`;
            }).join('')}</tbody></table>`;
    }
};
