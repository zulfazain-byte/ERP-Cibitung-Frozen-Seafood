// js/accounting.js
CFS.Accounting = {
    async getJournals() {
        let j = await CFS.Storage.get(CFS.Storage.JOURNALS_KEY);
        return j || [];
    },
    async addJournalEntry(entry) {
        const journals = await this.getJournals();
        journals.push(entry);
        await CFS.Storage.set(CFS.Storage.JOURNALS_KEY, journals);
    },
    async recordSale(klien, produk, qty, dpp, ppn, hpp) {
        const entry = {
            id: Date.now(),
            tanggal: new Date().toISOString(),
            deskripsi: `Penjualan ${produk} ${qty}kg ke ${klien}`,
            entries: [
                { akun: 'Piutang Dagang', debet: dpp + ppn, kredit: 0 },
                { akun: 'Penjualan', debet: 0, kredit: dpp },
                { akun: 'PPN Keluaran', debet: 0, kredit: ppn },
                { akun: 'HPP', debet: hpp, kredit: 0 },
                { akun: 'Persediaan', debet: 0, kredit: hpp }
            ]
        };
        await this.addJournalEntry(entry);
    },
    async recordPurchase(produk, totalBiaya, qty) {
        const entry = {
            id: Date.now(),
            tanggal: new Date().toISOString(),
            deskripsi: `Pembelian stok ${produk} ${qty}kg`,
            entries: [
                { akun: 'Persediaan', debet: totalBiaya, kredit: 0 },
                { akun: 'Kas', debet: 0, kredit: totalBiaya }
            ]
        };
        await this.addJournalEntry(entry);
    },
    async recordExpense(akun, jumlah, deskripsi) {
        const entry = {
            id: Date.now(),
            tanggal: new Date().toISOString(),
            deskripsi: deskripsi || `Beban ${akun}`,
            entries: [
                { akun: akun, debet: jumlah, kredit: 0 },
                { akun: 'Kas', debet: 0, kredit: jumlah }
            ]
        };
        await this.addJournalEntry(entry);
    },
    async getProfitLoss(startDate, endDate) {
        const journals = await this.getJournals();
        let pendapatan = 0, hpp = 0, beban = 0, pajak = 0;
        journals.forEach(j => {
            const d = new Date(j.tanggal);
            if (d >= startDate && d <= endDate) {
                j.entries.forEach(e => {
                    if (e.akun === 'Penjualan') pendapatan += e.kredit - e.debet;
                    if (e.akun === 'HPP') hpp += e.debet - e.kredit;
                    if (e.akun.includes('Beban')) beban += e.debet - e.kredit;
                    if (e.akun === 'PPh 25' || e.akun === 'PPh 21') pajak += e.debet - e.kredit;
                });
            }
        });
        const labaKotor = pendapatan - hpp;
        const labaBersih = labaKotor - beban - pajak;
        return { pendapatan, hpp, beban, pajak, labaKotor, labaBersih };
    },
    async getNeraca() {
        const journals = await this.getJournals();
        const saldo = {};
        journals.forEach(j => j.entries.forEach(e => { saldo[e.akun] = (saldo[e.akun] || 0) + e.debet - e.kredit; }));
        const aset = ['Kas', 'Piutang Dagang', 'Persediaan'];
        const kewajiban = ['PPN Keluaran', 'Hutang PPh'];
        const ekuitas = ['Modal Owner', 'Penjualan', 'HPP', 'Beban Operasional', 'Beban Listrik', 'Beban Sewa', 'Beban Gaji', 'PPh 25', 'PPh 21'];
        let totalAset = 0, totalKewajiban = 0, totalEkuitas = 0;
        aset.forEach(a => totalAset += saldo[a] || 0);
        kewajiban.forEach(k => totalKewajiban += saldo[k] || 0);
        ekuitas.forEach(e => totalEkuitas += saldo[e] || 0);
        return { aset: totalAset, kewajiban: totalKewajiban, ekuitas: totalEkuitas };
    },
    async exportToExcel(startDate, endDate) {
        const journals = await this.getJournals();
        const filtered = journals.filter(j => {
            const d = new Date(j.tanggal);
            return d >= startDate && d <= endDate;
        });
        const rows = [];
        filtered.forEach(j => {
            j.entries.forEach(e => {
                rows.push({
                    Tanggal: new Date(j.tanggal).toLocaleDateString('id-ID'),
                    Deskripsi: j.deskripsi,
                    Akun: e.akun,
                    Debet: e.debet,
                    Kredit: e.kredit
                });
            });
        });
        return rows;
    }
};
