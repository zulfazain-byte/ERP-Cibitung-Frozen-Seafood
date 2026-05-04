// js/aiForecast.js
CFS.AI = {
    // Regresi linear sederhana untuk memprediksi permintaan 7 hari ke depan
    async predictDemand(productName, daysAhead = 7) {
        const trx = (await CFS.Storage.get(CFS.Storage.TRANSACTIONS_KEY)) || [];
        const now = new Date();
        const ninetyDaysAgo = new Date(now);
        ninetyDaysAgo.setDate(now.getDate() - 90);

        // Filter transaksi produk ini dalam 90 hari, urutkan berdasarkan tanggal
        const filtered = trx
            .filter(t => t.produk === productName && new Date(t.tanggal) >= ninetyDaysAgo)
            .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

        if (filtered.length < 7) {
            // Data tidak cukup, gunakan rata-rata sederhana
            const avg = filtered.length > 0 
                ? filtered.reduce((s, t) => s + t.qty, 0) / filtered.length 
                : 0;
            return Array(daysAhead).fill(avg);
        }

        // Agregasi per hari
        const dailyAgg = {};
        filtered.forEach(t => {
            const day = new Date(t.tanggal).toISOString().split('T')[0];
            dailyAgg[day] = (dailyAgg[day] || 0) + t.qty;
        });

        const dates = Object.keys(dailyAgg).sort();
        const values = dates.map(d => dailyAgg[d]);

        // Regresi linear: y = a + b*x
        const n = values.length;
        if (n < 2) return Array(daysAhead).fill(values[0] || 0);

        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += values[i];
            sumXY += i * values[i];
            sumX2 += i * i;
        }

        const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const a = (sumY - b * sumX) / n;

        // Prediksi untuk daysAhead ke depan
        const predictions = [];
        for (let i = 0; i < daysAhead; i++) {
            const predicted = a + b * (n + i);
            predictions.push(Math.max(0, Math.round(predicted)));
        }
        return predictions;
    },

    // Render grafik peramalan di dashboard (jika elemen ada)
    async renderForecastChart(productName) {
        const ctx = document.getElementById('chartForecast')?.getContext('2d');
        if (!ctx) return;
        const predictions = await this.predictDemand(productName, 7);
        const labels = [];
        const today = new Date();
        for (let i = 1; i <= 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            labels.push(d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }));
        }
        if (window._forecastChart) window._forecastChart.destroy();
        window._forecastChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Prediksi Permintaan (kg)',
                    data: predictions,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139,92,246,0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: { title: { display: true, text: `Peramalan ${productName}` } }
            }
        });
    }
};
