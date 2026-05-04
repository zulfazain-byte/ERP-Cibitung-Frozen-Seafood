// js/settings.js
CFS.Settings = {
    DEFAULTS: {
        ppn: 12,
        pph25: 2,
        pph21: 5,
        ptShare: 60,
        minGrosir: 10,
        minPartai: 500,
        selisihGrosir: 5000,
        marginDefault: 15000,
        storageMethod: 'none',
        storageFlatMonthly: 0,
        storagePerKgPerDay: 0,
        fifoMethod: 'fefo',
        widgetVisibility: {
            stockSummary: true,
            expiringBatches: true,
            revenueChart: true,
            profitLoss: true,
            quickActions: true
        },
        productThresholds: {}
    },

    async get() {
        let s = await CFS.Storage.get(CFS.Storage.SETTINGS_KEY);
        if (!s) {
            s = { ...this.DEFAULTS };
            await CFS.Storage.set(CFS.Storage.SETTINGS_KEY, s);
        }
        return s;
    },

    async save(settings) {
        await CFS.Storage.set(CFS.Storage.SETTINGS_KEY, settings);
    },

    async update(changes) {
        const current = await this.get();
        const updated = { ...current, ...changes };
        await this.save(updated);
        return updated;
    }
};
