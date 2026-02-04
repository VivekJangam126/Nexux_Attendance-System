/**
 * Authentication Module - Login, session, and role-based guards
 * Phase 1 Demo Only: Plain-text password matching
 * 
 * ⚠️ SECURITY NOTE: Passwords are plain-text for Phase 1 demo only.
 * Will be replaced by secure backend authentication in Phase 2.
 * 
 * Role-Page Access Matrix:
 * -------------------------
 * | Page             | Employee | Admin | Management |
 * |------------------|----------|-------|------------|
 * | Login            | ✅        | ✅     | ✅          |
 * | Mark Attendance  | ✅        | ❌     | ❌          |
 * | Confirmation     | ✅        | ❌     | ❌          |
 * | Dashboard        | ❌        | ✅     | ✅          |
 * | Settings         | ❌        | ✅     | ❌          |
 * | Reports          | ❌        | ✅     | ✅          |
 */

// Page types for role guards
const PageType = {
    LOGIN: 'login',
    MARK_ATTENDANCE: 'mark_attendance',
    CONFIRMATION: 'confirmation',
    DASHBOARD: 'dashboard',
    SETTINGS: 'settings',
    REPORTS: 'reports'
};

// Role definitions
const Roles = {
    EMPLOYEE: 'employee',
    ADMIN: 'admin',
    MANAGEMENT: 'management'
};

// Page paths for redirects
const PagePaths = {
    LOGIN: '/index.html',
    MARK_ATTENDANCE: '/pages/mark-attendance.html',
    CONFIRMATION: '/pages/confirmation.html',
    DASHBOARD: '/pages/dashboard.html',
    SETTINGS: '/pages/settings.html',
    REPORTS: '/pages/reports.html'
};

/**
 * Authentication Service Object
 */
const Auth = {

    /**
     * Attempt to login with email and password
     * @param {string} email - User email
     * @param {string} password - User password (plain-text in Phase 1)
     * @returns {Object} Result object { success: boolean, message: string, user?: Object }
     */
    login: function(email, password) {
        // Validate inputs
        if (!email || !password) {
            return { success: false, message: 'Email and password are required' };
        }

        // Find user by email
        const user = Storage.getUserByEmail(email.trim());
        
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        // Plain-text password check (Phase 1 only)
        if (user.password !== password) {
            return { success: false, message: 'Incorrect password' };
        }

        // Create session
        const session = {
            userId: user.id,
            role: user.role,
            userName: user.name,
            userEmail: user.email,
            loginTime: Storage.getCurrentTimestamp()
        };

        Storage.setSession(session);
        console.log('[Auth] Login successful:', user.name, '(' + user.role + ')');

        return { 
            success: true, 
            message: 'Login successful',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        };
    },

    /**
     * Logout current user and redirect to login page
     */
    logout: function() {
        const session = Storage.getSession();
        if (session) {
            console.log('[Auth] Logging out:', session.userName);
        }
        Storage.clearSession();
        this.redirectTo(PagePaths.LOGIN);
    },

    /**
     * Get current logged-in user info
     * Handles edge case where session exists but user was deleted (e.g., after Reset Demo Data)
     * @returns {Object|null} Current user info or null
     */
    getCurrentUser: function() {
        const session = Storage.getSession();
        if (!session) return null;

        // Validate that user still exists in storage
        // Handles edge case: Admin resets demo data while another user is logged in
        const user = Storage.getUserById(session.userId);
        if (!user) {
            console.log('[Auth] Session user no longer exists, forcing logout');
            Storage.clearSession();
            return null;
        }

        return {
            userId: session.userId,
            role: session.role,
            name: session.userName,
            email: session.userEmail,
            loginTime: session.loginTime
        };
    },

    /**
     * Get current user's role
     * Validates user still exists before returning role
     * @returns {string|null} Role or null if not logged in or user deleted
     */
    getCurrentRole: function() {
        const session = Storage.getSession();
        if (!session) return null;

        // Validate that user still exists in storage
        const user = Storage.getUserById(session.userId);
        if (!user) {
            console.log('[Auth] Session user no longer exists, forcing logout');
            Storage.clearSession();
            return null;
        }

        return session.role;
    },

    /**
     * Check if current user has a specific role
     * @param {string} role - Role to check
     * @returns {boolean}
     */
    hasRole: function(role) {
        return this.getCurrentRole() === role;
    },

    /**
     * Check if user is logged in
     * @returns {boolean}
     */
    isLoggedIn: function() {
        return Storage.isLoggedIn();
    },

    /**
     * Redirect to a specific page
     * @param {string} path - Page path to redirect to
     */
    redirectTo: function(path) {
        // Handle relative paths from different page locations
        const currentPath = window.location.pathname;
        let targetPath = path;

        // If we're in /pages/ subdirectory, adjust path
        if (currentPath.includes('/pages/') && path.startsWith('/')) {
            targetPath = '..' + path;
        } else if (!currentPath.includes('/pages/') && path.startsWith('/pages/')) {
            targetPath = '.' + path;
        }

        window.location.href = targetPath;
    },

    /**
     * Get the default landing page for a role after login
     * @param {string} role - User role
     * @returns {string} Page path
     */
    getDefaultPageForRole: function(role) {
        switch (role) {
            case Roles.EMPLOYEE:
                return PagePaths.MARK_ATTENDANCE;
            case Roles.ADMIN:
            case Roles.MANAGEMENT:
                return PagePaths.DASHBOARD;
            default:
                return PagePaths.LOGIN;
        }
    },

    /**
     * Redirect user to their default page based on role
     */
    redirectToDefaultPage: function() {
        const role = this.getCurrentRole();
        if (role) {
            this.redirectTo(this.getDefaultPageForRole(role));
        } else {
            this.redirectTo(PagePaths.LOGIN);
        }
    },

    // ==================== ROLE GUARDS ====================

    /**
     * Check if current role can access a page type
     * @param {string} pageType - Type of page (from PageType enum)
     * @returns {boolean}
     */
    canAccessPage: function(pageType) {
        const role = this.getCurrentRole();
        
        if (!role) return false;

        switch (pageType) {
            case PageType.LOGIN:
                // Everyone can access login (will redirect if already logged in)
                return true;

            case PageType.MARK_ATTENDANCE:
            case PageType.CONFIRMATION:
                // Employee only
                return role === Roles.EMPLOYEE;

            case PageType.DASHBOARD:
            case PageType.REPORTS:
                // Admin and Management only
                return role === Roles.ADMIN || role === Roles.MANAGEMENT;

            case PageType.SETTINGS:
                // Admin only
                return role === Roles.ADMIN;

            default:
                return false;
        }
    },

    /**
     * Guard for login page
     * If already logged in, redirect to default page
     */
    guardLoginPage: function() {
        if (this.isLoggedIn()) {
            console.log('[Auth] Already logged in, redirecting to default page');
            this.redirectToDefaultPage();
            return false;
        }
        return true;
    },

    /**
     * Guard for employee-only pages (Mark Attendance, Confirmation)
     * Redirects non-employees to their default page
     */
    guardEmployeePage: function() {
        if (!this.isLoggedIn()) {
            console.log('[Auth] Not logged in, redirecting to login');
            this.redirectTo(PagePaths.LOGIN);
            return false;
        }

        const role = this.getCurrentRole();
        if (role !== Roles.EMPLOYEE) {
            console.log('[Auth] Access denied for role:', role, '- redirecting to default page');
            this.redirectToDefaultPage();
            return false;
        }

        return true;
    },

    /**
     * Guard for admin-only pages (Settings)
     * Redirects non-admins to their default page
     */
    guardAdminPage: function() {
        if (!this.isLoggedIn()) {
            console.log('[Auth] Not logged in, redirecting to login');
            this.redirectTo(PagePaths.LOGIN);
            return false;
        }

        const role = this.getCurrentRole();
        if (role !== Roles.ADMIN) {
            console.log('[Auth] Access denied for role:', role, '- redirecting to default page');
            this.redirectToDefaultPage();
            return false;
        }

        return true;
    },

    /**
     * Guard for admin and management pages (Dashboard, Reports)
     * Redirects employees to their default page
     */
    guardAdminOrManagementPage: function() {
        if (!this.isLoggedIn()) {
            console.log('[Auth] Not logged in, redirecting to login');
            this.redirectTo(PagePaths.LOGIN);
            return false;
        }

        const role = this.getCurrentRole();
        if (role !== Roles.ADMIN && role !== Roles.MANAGEMENT) {
            console.log('[Auth] Access denied for role:', role, '- redirecting to default page');
            this.redirectToDefaultPage();
            return false;
        }

        return true;
    },

    /**
     * Generic page guard - call at the top of each page's script
     * @param {string} pageType - Type of page (from PageType enum)
     * @returns {boolean} True if access granted, false if redirecting
     */
    guardPage: function(pageType) {
        switch (pageType) {
            case PageType.LOGIN:
                return this.guardLoginPage();

            case PageType.MARK_ATTENDANCE:
            case PageType.CONFIRMATION:
                return this.guardEmployeePage();

            case PageType.SETTINGS:
                return this.guardAdminPage();

            case PageType.DASHBOARD:
            case PageType.REPORTS:
                return this.guardAdminOrManagementPage();

            default:
                console.log('[Auth] Unknown page type:', pageType);
                this.redirectTo(PagePaths.LOGIN);
                return false;
        }
    }
};

// Export for use in other modules
window.Auth = Auth;
window.PageType = PageType;
window.Roles = Roles;
window.PagePaths = PagePaths;
