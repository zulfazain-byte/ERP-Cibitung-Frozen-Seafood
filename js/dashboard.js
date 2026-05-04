// js/dashboard.js
CFS.Dashboard = {
    async renderStockSummary() {
        const summary = await CFS.Inventory.getStockSummary();
        const container = document.getElementById('dashboardSummaryCards');
        if (!container) return;
        container.innerHTML = CFS.Inventory.PRODUCT_LIST.map(p => {
            const kg = summary[p]?.toFixed(1) || '0.0';
            const threshold = 5; // bisa dari settings
            const progressWidth = Math.min((summary[p] / threshold) * 100, 100);
            return `<div class="card p-4 text-center hover-scale">
                <p class="text-sm font-medium">${p}</p>
                <p class="text-2xl font-bold mt-1">${kg} kg</p>
                <div class="progress mt-2"><div class="progress-fill ${summary[p] < threshold ? 'bg-red-500' : 'bg-primary-500'}" style="width:${progressWidth}%"></div></div>
            </div>`;
        }).join('');
    },

    async renderExpiringBatches() {
        const expBatches = await CFS.Inventory.getExpiringBatches(7);
        const container = document.getElementById('expiringBatches');
        if (!container) return;
        if (expBatches.length === 0) {
            container.innerHTML = '<div class="text-green-600 font-medium">✅ Tidak ada batch mendekati kadaluarsa.</div>';
            return;
        }
        container.innerHTML = expBatches.map(b => {
            const daysLeft = Math.ceil((new Date(b.tgl_kadaluarsa) - new Date()) / (1000*3600*24));
            return `<div class="flex justify-between items-center bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                <span>${b.produk} (${b.id})</span>
                <span>${b.berat_sisa.toFixed(1)} kg</span>
                <span class="text-red-600 font-semibold text-xs">${daysLeft} hari</span>
            </div>`;
        }).join('');
    },

    async renderRevenueChart() {
        const ctx = document.getElementById('chartRevenue')?.getContext('2d');
        if (!ctx) return;
        const trx = (await CFS.Storage.get(CFS.Storage.TRANSACTIONS_KEY)) || [];
        const daily = {};
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            daily[key] = 0;
        }
        trx.forEach(t => {
            const key = new Date(t.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            if (daily[key] !== undefined) daily[key] += t.totalInvoice;
        });
        if (window._revenueChart) window._revenueChart.destroy();
        window._revenueChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: Object.keys(daily), datasets: [{ label: 'Pendapatan', data: Object.values(daily), backgroundColor: '#3b82f6', borderRadius: 8 }] },
            options: { responsive: true, scales: { y: { ticks: { callback: v => CFS.Utils.formatRupiah(v) } } } }
        });
    },

    async renderFinanceSummary() {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const pl = await CFS.Accounting.getProfitLoss(start, today);
        const html = `
            <div class="card p-4"><p class="text-xs opacity-70">Pendapatan</p><p class="text-xl font-bold">${CFS.Utils.formatRupiah(pl.pendapatan)}</p></div>
            <div class="card p-4"><p class="text-xs opacity-70">HPP</p><p class="text-xl font-bold">${CFS.Utils.formatRupiah(pl.hpp)}</p></div>
            <div class="card p-4"><p class="text-xs opacity-70">Laba Kotor</p><p class="text-xl font-bold">${CFS.Utils.formatRupiah(pl.labaKotor)}</p></div>
            <div class="card p-4"><p class="text-xs opacity-70">Laba Bersih</p><p class="text-xl font-bold text-emerald-600">${CFS.Utils.formatRupiah(pl.labaBersih)}</p></div>`;
        document.getElementById('financeSummary').innerHTML = html;
        const container2 = document.getElementById('financeSummaryContainer');
        if (container2) container2.innerHTML = html;
    },

    async renderCRMStats() {
        const analytics = await CFS.Sales.getCustomerAnalytics();
        document.getElementById('crmTotalCustomers').textContent = analytics.totalPelanggan;
        document.getElementById('crmTotalRevenue').textContent = CFS.Utils.formatRupiah(analytics.totalPendapatan);
        document.getElementById('crmActiveCustomers').textContent = analytics.activeCustomers;
    },

    async renderNeraca() {
        const n = await CFS.Accounting.getNeraca();
        const container = document.getElementById('reportNeraca');
        if (!container) return;
        container.innerHTML = `
            <div class="flex justify-between"><span>Aset</span><span>${CFS.Utils.formatRupiah(n.aset)}</span></div>
            <div class="flex justify-between"><span>Kewajiban</span><span>${CFS.Utils.formatRupiah(n.kewajiban)}</span></div>
            <div class="flex justify-between"><span>Ekuitas</span><span>${CFS.Utils.formatRupiah(n.ekuitas)}</span></div>
            <hr class="my-2"><div class="flex justify-between font-bold"><span>Balance</span><span>${n.aset === n.kewajiban + n.ekuitas ? '✅' : '❌'}</span></div>`;
    },

    async renderLabaRugiReport() {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const pl = await CFS.Accounting.getProfitLoss(start, today);
        const container = document.getElementById('reportLabaRugi');
        if (!container) return;
        container.innerHTML = `
            <div class="flex justify-between"><span>Pendapatan</span><span>${CFS.Utils.formatRupiah(pl.pendapatan)}</span></div>
            <div class="flex justify-between"><span>HPP</span><span>${CFS.Utils.formatRupiah(pl.hpp)}</span></div>
            <div class="flex justify-between"><span>Beban</span><span>${CFS.Utils.formatRupiah(pl.beban)}</span></div>
            <div class="flex justify-between"><span>Pajak</span><span>${CFS.Utils.formatRupiah(pl.pajak)}</span></div>
            <hr class="my-1"><div class="flex justify-between font-bold"><span>Laba Bersih</span><span>${CFS.Utils.formatRupiah(pl.labaBersih)}</span></div>`;
    },

    async refreshAll() {
        await this.renderStockSummary();
        await this.renderExpiringBatches();
        await this.renderRevenueChart();
        await this.renderFinanceSummary();
        await this.renderCRMStats();
        await this.renderNeraca();
        await this.renderLabaRugiReport();
    }
};
