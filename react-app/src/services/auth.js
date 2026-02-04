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

import Storage from './storage';

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

// Route paths for React Router (adapted from PagePaths)
const RoutePaths = {
    LOGIN: '/',
    MARK_ATTENDANCE: '/mark-attendance',
    CONFIRMATION: '/confirmation',
    DASHBOARD: '/dashboard',
    SETTINGS: '/settings',
    REPORTS: '/reports'
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
     * Logout current user
     */
    logout: function() {
        const session = Storage.getSession();
        if (session) {
            console.log('[Auth] Logging out:', session.userName);
        }
        Storage.clearSession();
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
     * Get the default landing page for a role after login
     * @param {string} role - User role
     * @returns {string} Route path
     */
    getDefaultPageForRole: function(role) {
        switch (role) {
            case Roles.EMPLOYEE:
                return RoutePaths.MARK_ATTENDANCE;
            case Roles.ADMIN:
            case Roles.MANAGEMENT:
                return RoutePaths.DASHBOARD;
            default:
                return RoutePaths.LOGIN;
        }
    },

    /**
     * Get the default route for the current user based on role
     * @returns {string} Route path
     */
    getDefaultRoute: function() {
        const role = this.getCurrentRole();
        if (role) {
            return this.getDefaultPageForRole(role);
        }
        return RoutePaths.LOGIN;
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
     * Check if current user can access employee pages
     * @returns {boolean}
     */
    canAccessEmployeePages: function() {
        const role = this.getCurrentRole();
        return role === Roles.EMPLOYEE;
    },

    /**
     * Check if current user can access admin pages
     * @returns {boolean}
     */
    canAccessAdminPages: function() {
        const role = this.getCurrentRole();
        return role === Roles.ADMIN;
    },

    /**
     * Check if current user can access admin or management pages
     * @returns {boolean}
     */
    canAccessAdminOrManagementPages: function() {
        const role = this.getCurrentRole();
        return role === Roles.ADMIN || role === Roles.MANAGEMENT;
    }
};

// ES module exports
export { Auth, PageType, Roles, RoutePaths };
export default Auth;
