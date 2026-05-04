// js/api.js
CFS.API = {
    // Simulasi kirim data penjualan ke webhook eksternal (contoh: Discord, Zapier)
    async sendSalesWebhook(transaction) {
        const webhookURL = localStorage.getItem('cfs_webhook_url');
        if (!webhookURL) return false;
        try {
            const payload = {
                embeds: [{
                    title: '🛒 Penjualan Baru',
                    fields: [
                        { name: 'Klien', value: transaction.klien },
                        { name: 'Produk', value: `${transaction.produk} (${transaction.qty} kg)` },
                        { name: 'Total', value: CFS.Utils.formatRupiah(transaction.totalInvoice) },
                        { name: 'Tanggal', value: new Date(transaction.tanggal).toLocaleString('id-ID') }
                    ],
                    color: 0x22c55e
                }]
            };
            await fetch(webhookURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return true;
        } catch (e) {
            console.warn('Webhook gagal:', e);
            return false;
        }
    },

    // Simulasi cek harga pasar ikan (dummy API)
    async getMarketPrice(fishName) {
        // Simulasi delay jaringan
        await new Promise(resolve => setTimeout(resolve, 300));
        const basePrices = {
            'Ikan Banjar': 42000,
            'Ikan Dori Fillet': 78000,
            'Ikan Layang': 28000,
            'Ikan Belo': 35000,
            'Ikan Tongkol': 38000,
            'Ikan Salem': 25000,
            'Ikan Tenggiri': 95000,
            'Ikan Bawal Laut': 65000,
            'Cumi Cumi': 72000
        };
        const base = basePrices[fishName] || 40000;
        // Tambahkan variasi acak ±10%
        const variation = (Math.random() - 0.5) * 0.2;
        return Math.round(base * (1 + variation));
    },

    // Simpan URL webhook
    setWebhookURL(url) {
        localStorage.setItem('cfs_webhook_url', url);
    },

    getWebhookURL() {
        return localStorage.getItem('cfs_webhook_url') || '';
    }
};
