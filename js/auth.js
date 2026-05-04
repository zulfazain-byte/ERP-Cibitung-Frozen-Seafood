// js/auth.js
CFS.Auth = {
    ROLES: {
        OWNER: { name: 'Owner', canEditSettings: true, canViewReports: true, canDeleteData: true },
        STAFF: { name: 'Staff', canEditSettings: false, canViewReports: false, canDeleteData: false }
    },

    // Data user (simulasi, tidak aman untuk produksi)
    DEFAULT_USERS: [
        { username: 'owner', pin: '1234', role: 'OWNER' },
        { username: 'staff', pin: '5678', role: 'STAFF' }
    ],

    currentUser: null,

    async loadUsers() {
        let users = await CFS.Storage.get('users');
        if (!users) {
            users = this.DEFAULT_USERS;
            await CFS.Storage.set('users', users);
        }
        return users;
    },

    async login(username, pin) {
        const users = await this.loadUsers();
        const user = users.find(u => u.username === username && u.pin === pin);
        if (user) {
            this.currentUser = { ...user, role: this.ROLES[user.role] };
            localStorage.setItem('cfs_current_user', JSON.stringify(this.currentUser));
            return true;
        }
        return false;
    },

    async logout() {
        this.currentUser = null;
        localStorage.removeItem('cfs_current_user');
        // Sembunyikan UI sensitif
        document.getElementById('settingsTab')?.classList.add('hidden');
    },

    checkAuth() {
        const saved = localStorage.getItem('cfs_current_user');
        if (saved) {
            this.currentUser = JSON.parse(saved);
        }
        return this.currentUser !== null;
    },

    getCurrentUser() {
        return this.currentUser;
    },

    hasPermission(permission) {
        if (!this.currentUser) return false;
        return this.currentUser.role[permission] === true;
    }
};
