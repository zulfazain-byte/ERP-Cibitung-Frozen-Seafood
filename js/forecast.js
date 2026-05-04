// js/forecast.js
CFS.Forecast = {
    async getDailyAverage(productName) {
        const trx = (await CFS.Storage.get(CFS.Storage.TRANSACTIONS_KEY)) || [];
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        const filtered = trx.filter(t => 
            t.produk === productName && 
            new Date(t.tanggal) >= thirtyDaysAgo &&
            new Date(t.tanggal) <= now
        );
        const totalQty = filtered.reduce((sum, t) => sum + t.qty, 0);
        return totalQty / 30;
    },

    async predictStockDepletion(productName) {
        const summary = await CFS.Inventory.getStockSummary();
        const currentStock = summary[productName] || 0;
        const dailyAvg = await this.getDailyAverage(productName);
        if (dailyAvg <= 0) return { daysRemaining: Infinity, status: 'no_data' };
        const daysRemaining = currentStock / dailyAvg;
        return {
            daysRemaining: Math.floor(daysRemaining),
            status: daysRemaining <= 3 ? 'critical' : (daysRemaining <= 7 ? 'warning' : 'safe'),
            dailyAvg: dailyAvg.toFixed(1)
        };
    },

    async getRestockRecommendation(productName) {
        const summary = await CFS.Inventory.getStockSummary();
        const currentStock = summary[productName] || 0;
        const dailyAvg = await this.getDailyAverage(productName);
        const leadTime = 3;
        const safetyStock = dailyAvg * leadTime * 1.5;
        const recommendedRestock = Math.max(0, (dailyAvg * 7) + safetyStock - currentStock);
        return {
            recommendedRestock: Math.ceil(recommendedRestock),
            safetyStock: Math.ceil(safetyStock),
            currentStock,
            dailyAvg: dailyAvg.toFixed(1)
        };
    },

    async renderForecastTable(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const products = CFS.Inventory.PRODUCT_LIST;
        const rows = [];
        for (let p of products) {
            const prediction = await this.predictStockDepletion(p);
            const rec = await this.getRestockRecommendation(p);
            const summary = await CFS.Inventory.getStockSummary();
            rows.push({
                produk: p,
                stok: summary[p]?.toFixed(1) || '0',
                dailyAvg: rec.dailyAvg,
                daysLeft: prediction.daysRemaining === Infinity ? '∞' : prediction.daysRemaining,
                status: prediction.status,
                restock: rec.recommendedRestock
            });
        }
        container.innerHTML = rows.map(r => `
            <tr class="border-b">
                <td class="p-2">${r.produk}</td>
                <td class="p-2 text-right">${r.stok} kg</td>
                <td class="p-2 text-right">${r.dailyAvg} kg/hari</td>
                <td class="p-2 text-center"><span class="badge ${r.status==='critical'?'bg-red-100 text-red-700':(r.status==='warning'?'bg-yellow-100 text-yellow-700':'bg-green-100 text-green-700')}">${r.daysLeft} hari</span></td>
                <td class="p-2 text-right font-semibold">${r.restock > 0 ? r.restock + ' kg' : '✅ Cukup'}</td>
            </tr>
        `).join('');
    }
};
