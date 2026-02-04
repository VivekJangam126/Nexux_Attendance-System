/**
 * Storage Service - localStorage CRUD wrapper with auto-seed
 * Phase 1 Demo Only: All data stored in browser localStorage
 * 
 * ⚠️ SECURITY NOTE: Passwords are plain-text for Phase 1 demo only.
 * Will be replaced by secure backend authentication in Phase 2.
 * 
 * ⏰ TIME SOURCE: All timestamps are taken from client device in Phase 1.
 * Server-side time validation will be enforced in Phase 2.
 */

const StorageKeys = {
    USERS: 'nexon_users',
    SESSION: 'nexon_session',
    OFFICE_CONFIG: 'nexon_office_config',
    ATTENDANCE: 'nexon_attendance',
    INITIALIZED: 'nexon_initialized'
};

// Default demo users (plain-text passwords - Phase 1 only)
// Minimal set for initial setup - Admin can add more users in Phase 2
const DEFAULT_USERS = [
    { id: 'adm001', name: 'Admin', email: 'admin@company.com', role: 'admin', password: 'admin123' }
];

// Default office configuration (80m radius for ~1000 sq ft office)
const DEFAULT_OFFICE_CONFIG = {
    latitude: 28.6139,
    longitude: 77.2090,
    radiusMeters: 80,
    inTime: '10:00',
    outTime: '18:00',
    gracePeriodMinutes: 15
};

// Sample attendance records for demo
const DEFAULT_ATTENDANCE = [];

/**
 * Storage Service Object
 */
const Storage = {
    
    /**
     * Initialize storage with seed data on first visit
     * Idempotent: Also re-seeds if any core key is missing (handles partial clears)
     */
    init: function() {
        const isInitialized = localStorage.getItem(StorageKeys.INITIALIZED);
        const hasUsers = localStorage.getItem(StorageKeys.USERS);
        const hasConfig = localStorage.getItem(StorageKeys.OFFICE_CONFIG);
        const hasAttendance = localStorage.getItem(StorageKeys.ATTENDANCE);
        
        // Re-seed if not initialized OR any core key is missing
        if (!isInitialized || !hasUsers || !hasConfig || !hasAttendance) {
            console.log('[Storage] Missing data detected, seeding...');
            this.seedData();
        }
    },

    /**
     * Seed all default data into localStorage
     * Uses deep clone to prevent accidental mutation of default objects
     */
    seedData: function() {
        // Deep clone defaults before storing to prevent mutation
        localStorage.setItem(StorageKeys.USERS, JSON.stringify(JSON.parse(JSON.stringify(DEFAULT_USERS))));
        localStorage.setItem(StorageKeys.OFFICE_CONFIG, JSON.stringify(JSON.parse(JSON.stringify(DEFAULT_OFFICE_CONFIG))));
        localStorage.setItem(StorageKeys.ATTENDANCE, JSON.stringify(JSON.parse(JSON.stringify(DEFAULT_ATTENDANCE))));
        localStorage.setItem(StorageKeys.INITIALIZED, 'true');
        console.log('[Storage] Demo data seeded successfully');
    },

    /**
     * Reset all data to default demo state (Admin only)
     * Uses deep clone to prevent accidental mutation of default objects
     */
    resetDemoData: function() {
        // Clear session first
        localStorage.removeItem(StorageKeys.SESSION);
        
        // Re-seed all data with fresh clones
        localStorage.setItem(StorageKeys.USERS, JSON.stringify(JSON.parse(JSON.stringify(DEFAULT_USERS))));
        localStorage.setItem(StorageKeys.OFFICE_CONFIG, JSON.stringify(JSON.parse(JSON.stringify(DEFAULT_OFFICE_CONFIG))));
        localStorage.setItem(StorageKeys.ATTENDANCE, JSON.stringify(JSON.parse(JSON.stringify(DEFAULT_ATTENDANCE))));
        localStorage.setItem(StorageKeys.INITIALIZED, 'true');
        
        console.log('[Storage] Demo data reset successfully');
        return true;
    },

    // ==================== USERS ====================

    /**
     * Get all users
     * @returns {Array} Array of user objects
     */
    getUsers: function() {
        const data = localStorage.getItem(StorageKeys.USERS);
        return data ? JSON.parse(data) : [];
    },

    /**
     * Get user by ID
     * @param {string} userId 
     * @returns {Object|null} User object or null
     */
    getUserById: function(userId) {
        const users = this.getUsers();
        return users.find(u => u.id === userId) || null;
    },

    /**
     * Get user by email
     * @param {string} email 
     * @returns {Object|null} User object or null
     */
    getUserByEmail: function(email) {
        const users = this.getUsers();
        return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    },

    /**
     * Get all employees (excludes admin and management)
     * @returns {Array} Array of employee user objects
     */
    getEmployees: function() {
        const users = this.getUsers();
        return users.filter(u => u.role === 'employee');
    },

    /**
     * Add a new user
     * @param {Object} userData - { name, email, password, role }
     * @returns {Object} Result { success: boolean, message: string, user?: Object }
     */
    addUser: function(userData) {
        const users = this.getUsers();
        
        // Check if email already exists
        const existingUser = users.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
        if (existingUser) {
            return { success: false, message: 'A user with this email already exists' };
        }
        
        // Generate unique ID based on role
        const rolePrefix = userData.role === 'employee' ? 'emp' : 
                          userData.role === 'admin' ? 'adm' : 'mgmt';
        const id = rolePrefix + '_' + Date.now();
        
        const newUser = {
            id: id,
            name: userData.name.trim(),
            email: userData.email.trim().toLowerCase(),
            password: userData.password,
            role: userData.role
        };
        
        users.push(newUser);
        localStorage.setItem(StorageKeys.USERS, JSON.stringify(users));
        
        console.log('[Storage] User added:', newUser.name, '(' + newUser.role + ')');
        return { success: true, message: 'User created successfully', user: newUser };
    },

    /**
     * Update an existing user
     * @param {string} userId 
     * @param {Object} updates - Partial user object
     * @returns {Object} Result { success: boolean, message: string }
     */
    updateUser: function(userId, updates) {
        const users = this.getUsers();
        const index = users.findIndex(u => u.id === userId);
        
        if (index === -1) {
            return { success: false, message: 'User not found' };
        }
        
        // If email is being updated, check for duplicates
        if (updates.email) {
            const existingUser = users.find(u => 
                u.email.toLowerCase() === updates.email.toLowerCase() && u.id !== userId
            );
            if (existingUser) {
                return { success: false, message: 'A user with this email already exists' };
            }
        }
        
        // Update user
        users[index] = { ...users[index], ...updates };
        localStorage.setItem(StorageKeys.USERS, JSON.stringify(users));
        
        console.log('[Storage] User updated:', users[index].name);
        return { success: true, message: 'User updated successfully' };
    },

    /**
     * Delete a user
     * @param {string} userId 
     * @returns {Object} Result { success: boolean, message: string }
     */
    deleteUser: function(userId) {
        const users = this.getUsers();
        const user = users.find(u => u.id === userId);
        
        if (!user) {
            return { success: false, message: 'User not found' };
        }
        
        // Prevent deleting the last admin
        if (user.role === 'admin') {
            const adminCount = users.filter(u => u.role === 'admin').length;
            if (adminCount <= 1) {
                return { success: false, message: 'Cannot delete the last admin user' };
            }
        }
        
        // Prevent deleting yourself
        const session = this.getSession();
        if (session && session.userId === userId) {
            return { success: false, message: 'Cannot delete your own account' };
        }
        
        const filteredUsers = users.filter(u => u.id !== userId);
        localStorage.setItem(StorageKeys.USERS, JSON.stringify(filteredUsers));
        
        console.log('[Storage] User deleted:', user.name);
        return { success: true, message: 'User deleted successfully' };
    },

    // ==================== SESSION ====================

    /**
     * Set current session
     * @param {Object} sessionData - { userId, role, loginTime }
     */
    setSession: function(sessionData) {
        localStorage.setItem(StorageKeys.SESSION, JSON.stringify(sessionData));
    },

    /**
     * Get current session
     * @returns {Object|null} Session object or null
     */
    getSession: function() {
        const data = localStorage.getItem(StorageKeys.SESSION);
        return data ? JSON.parse(data) : null;
    },

    /**
     * Clear current session (logout)
     */
    clearSession: function() {
        localStorage.removeItem(StorageKeys.SESSION);
    },

    /**
     * Check if user is logged in
     * @returns {boolean}
     */
    isLoggedIn: function() {
        return this.getSession() !== null;
    },

    // ==================== OFFICE CONFIG ====================

    /**
     * Get office configuration
     * @returns {Object} Office config object
     */
    getOfficeConfig: function() {
        const data = localStorage.getItem(StorageKeys.OFFICE_CONFIG);
        return data ? JSON.parse(data) : DEFAULT_OFFICE_CONFIG;
    },

    /**
     * Update office configuration
     * @param {Object} config - Partial or full config object
     */
    setOfficeConfig: function(config) {
        const current = this.getOfficeConfig();
        const updated = { ...current, ...config };
        localStorage.setItem(StorageKeys.OFFICE_CONFIG, JSON.stringify(updated));
        return updated;
    },

    // ==================== ATTENDANCE ====================

    /**
     * Get all attendance records
     * @returns {Array} Array of attendance objects
     */
    getAttendance: function() {
        const data = localStorage.getItem(StorageKeys.ATTENDANCE);
        return data ? JSON.parse(data) : [];
    },

    /**
     * Get attendance records for a specific date
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Array} Array of attendance objects
     */
    getAttendanceByDate: function(date) {
        const records = this.getAttendance();
        return records.filter(r => r.date === date);
    },

    /**
     * Get attendance records for a specific user
     * @param {string} userId 
     * @returns {Array} Array of attendance objects
     */
    getAttendanceByUser: function(userId) {
        const records = this.getAttendance();
        return records.filter(r => r.userId === userId);
    },

    /**
     * Get attendance record for a specific user on a specific date
     * @param {string} userId 
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Object|null} Attendance record or null
     */
    getAttendanceRecord: function(userId, date) {
        const records = this.getAttendance();
        return records.find(r => r.userId === userId && r.date === date) || null;
    },

    /**
     * Check if user has already marked attendance today
     * @param {string} userId 
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {boolean}
     */
    hasMarkedAttendance: function(userId, date) {
        return this.getAttendanceRecord(userId, date) !== null;
    },

    /**
     * Add new attendance record
     * @param {Object} record - Attendance record object
     * @returns {Object} The saved record
     */
    addAttendance: function(record) {
        const records = this.getAttendance();
        
        // Generate unique ID using timestamp + random suffix (no global counter needed)
        const id = 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const newRecord = { id, ...record };
        
        records.push(newRecord);
        localStorage.setItem(StorageKeys.ATTENDANCE, JSON.stringify(records));
        
        console.log('[Storage] Attendance recorded:', newRecord);
        return newRecord;
    },

    // ==================== UTILITIES ====================

    /**
     * Get today's date in YYYY-MM-DD format
     * @returns {string}
     */
    getTodayDate: function() {
        const today = new Date();
        return today.toISOString().split('T')[0];
    },

    /**
     * Get current time in HH:MM format
     * @returns {string}
     */
    getCurrentTime: function() {
        const now = new Date();
        return now.toTimeString().slice(0, 5);
    },

    /**
     * Get current ISO timestamp
     * @returns {string}
     */
    getCurrentTimestamp: function() {
        return new Date().toISOString();
    }
};

// Auto-initialize on script load
Storage.init();

// Export for use in other modules
window.Storage = Storage;
window.StorageKeys = StorageKeys;
