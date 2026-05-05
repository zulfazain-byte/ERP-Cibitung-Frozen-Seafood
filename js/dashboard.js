// js/dashboard.js
CFS.Dashboard = {
    async refreshAll() {
        await this.renderStockSummary();
        await this.renderExpiringBatches();
        await this.renderRevenueChart();
        await this.renderFinanceSummary();
        await this.renderStokReport();
        await this.renderMarginReport();
        await this.renderProyeksi();
    },

    async renderStockSummary() {
        const summary = await CFS.Inventory.getStockSummary();
        const container = document.getElementById('dashboardSummaryCards');
        if (!container) return;
        container.innerHTML = CFS.Inventory.PRODUCT_LIST.map(p => {
            const kg = summary[p]?.toFixed(1) || '0.0';
            return `<div class="card p-3 text-center"><p class="text-xs font-medium">${p}</p><p class="text-xl font-bold">${kg} kg</p></div>`;
        }).join('');
    },

    async renderExpiringBatches() {
        const batches = await CFS.Inventory.getExpiringBatches(7);
        const container = document.getElementById('expiringBatches');
        if (!container) return;
        container.innerHTML = batches.length === 0
            ? '<p class="text-green-600">✅ Tidak ada batch kritis.</p>'
            : batches.map(b => `<div class="text-red-600 text-sm">⚠ ${b.produk} (${b.id}) - sisa ${b.berat_sisa.toFixed(1)} kg</div>`).join('');
    },

    async renderRevenueChart() {
        const ctx = document.getElementById('chartRevenue')?.getContext('2d');
        if (!ctx) return;
        const trx = await CFS.Sales.getTransactions();
        const daily = {};
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today); d.setDate(d.getDate() - i);
            daily[d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })] = 0;
        }
        trx.forEach(t => {
            const key = new Date(t.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            if (daily[key] !== undefined) daily[key] += t.totalInvoice;
        });
        if (window._revenueChart) window._revenueChart.destroy();
        window._revenueChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: Object.keys(daily), datasets: [{ label: 'Pendapatan', data: Object.values(daily), backgroundColor: '#3b82f6' }] },
            options: { responsive: true }
        });
    },

    async renderFinanceSummary() {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const pl = await CFS.Accounting.getProfitLoss(start, today);
        const container = document.getElementById('financeSummary');
        if (!container) return;
        container.innerHTML = `
            <div class="card p-3"><p class="text-xs opacity-50">Pendapatan</p><p class="font-bold">${CFS.Utils.formatRupiah(pl.pendapatan)}</p></div>
            <div class="card p-3"><p class="text-xs opacity-50">HPP</p><p class="font-bold">${CFS.Utils.formatRupiah(pl.hpp)}</p></div>
            <div class="card p-3"><p class="text-xs opacity-50">Laba Kotor</p><p class="font-bold">${CFS.Utils.formatRupiah(pl.labaKotor)}</p></div>
            <div class="card p-3"><p class="text-xs opacity-50">Laba Bersih</p><p class="font-bold text-emerald-600">${CFS.Utils.formatRupiah(pl.labaBersih)}</p></div>`;
    },

    // ========== LAPORAN BARU ==========
    async renderStokReport() {
        const container = document.getElementById('reportStok');
        if (!container) return;
        const summary = await CFS.Inventory.getStockSummary();
        container.innerHTML = Object.entries(summary).map(([produk, kg]) => `<div class="flex justify-between"><span>${produk}</span><span>${kg.toFixed(1)} kg</span></div>`).join('');
    },

    async renderMarginReport() {
        const container = document.getElementById('reportMargin');
        if (!container) return;
        const trx = await CFS.Sales.getTransactions();
        const marginByProduct = {};
        CFS.Inventory.PRODUCT_LIST.forEach(p => marginByProduct[p] = 0);
        trx.forEach(t => {
            const margin = (t.totalInvoice - (t.hpp || 0)) || 0;
            marginByProduct[t.produk] = (marginByProduct[t.produk] || 0) + margin;
        });
        container.innerHTML = Object.entries(marginByProduct).map(([produk, margin]) => `<div class="flex justify-between"><span>${produk}</span><span>${CFS.Utils.formatRupiah(margin)}</span></div>`).join('');
    },

    async renderProyeksi() {
        const container = document.getElementById('reportProyeksi');
        if (!container) return;
        const trx = await CFS.Sales.getTransactions();
        const totalPendapatan = trx.reduce((s, t) => s + t.totalInvoice, 0);
        const totalTransaksi = trx.length;
        const rata2 = totalTransaksi > 0 ? totalPendapatan / Math.max(1, Math.ceil((new Date() - new Date(trx[trx.length-1]?.tanggal)) / (1000*3600*24*30))) : 0;
        container.innerHTML = `
            <p>Total transaksi: ${totalTransaksi}</p>
            <p>Rata-rata pendapatan/bulan: ${CFS.Utils.formatRupiah(rata2)}</p>
            <p>Proyeksi 3 bulan ke depan: ${CFS.Utils.formatRupiah(rata2 * 3)}</p>`;
    }
};
