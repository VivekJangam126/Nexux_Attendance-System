/**
 * Settings Module - Admin configuration logic
 * Phase 1 Demo Only: All settings stored in localStorage
 * 
 * Features:
 * - Validate settings
 * - Reset Demo Data functionality
 * 
 * Admin-only access (enforced by ProtectedRoute in React)
 */

import Storage from './storage';

/**
 * Validation rules and limits
 */
const ValidationRules = {
    LATITUDE_MIN: -90,
    LATITUDE_MAX: 90,
    LONGITUDE_MIN: -180,
    LONGITUDE_MAX: 180,
    RADIUS_MIN: 20,
    RADIUS_MAX: 500,
    GRACE_PERIOD_MIN: 0,
    GRACE_PERIOD_MAX: 60
};

/**
 * Settings Manager Object
 */
const Settings = {

    /**
     * Get current office configuration
     * @returns {Object} Office config
     */
    getConfig: function() {
        return Storage.getOfficeConfig();
    },

    /**
     * Validate time format (HH:MM)
     * @param {string} time 
     * @returns {boolean}
     */
    isValidTimeFormat: function(time) {
        if (!time) return false;
        const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return regex.test(time);
    },

    /**
     * Validate form data
     * @param {Object} formData - Form data object
     * @returns {Object} { isValid: boolean, errors: Array }
     */
    validateForm: function(formData) {
        const errors = [];

        // Latitude validation (-90 to +90)
        const lat = parseFloat(formData.latitude);
        if (isNaN(lat) || lat < ValidationRules.LATITUDE_MIN || lat > ValidationRules.LATITUDE_MAX) {
            errors.push({
                field: 'latitude',
                message: `Latitude must be between ${ValidationRules.LATITUDE_MIN} and ${ValidationRules.LATITUDE_MAX}`
            });
        }

        // Longitude validation (-180 to +180)
        const lng = parseFloat(formData.longitude);
        if (isNaN(lng) || lng < ValidationRules.LONGITUDE_MIN || lng > ValidationRules.LONGITUDE_MAX) {
            errors.push({
                field: 'longitude',
                message: `Longitude must be between ${ValidationRules.LONGITUDE_MIN} and ${ValidationRules.LONGITUDE_MAX}`
            });
        }

        // Radius validation (≥ 20m)
        const radius = parseInt(formData.radiusMeters);
        if (isNaN(radius) || radius < ValidationRules.RADIUS_MIN || radius > ValidationRules.RADIUS_MAX) {
            errors.push({
                field: 'radiusMeters',
                message: `Radius must be between ${ValidationRules.RADIUS_MIN}m and ${ValidationRules.RADIUS_MAX}m`
            });
        }

        // In-Time validation (HH:MM format)
        if (!this.isValidTimeFormat(formData.inTime)) {
            errors.push({
                field: 'inTime',
                message: 'In-Time must be in HH:MM format (e.g., 10:00)'
            });
        }

        // Out-Time validation (HH:MM format)
        if (!this.isValidTimeFormat(formData.outTime)) {
            errors.push({
                field: 'outTime',
                message: 'Out-Time must be in HH:MM format (e.g., 18:00)'
            });
        }

        // Out-Time must be after In-Time
        if (this.isValidTimeFormat(formData.inTime) && this.isValidTimeFormat(formData.outTime)) {
            if (formData.outTime <= formData.inTime) {
                errors.push({
                    field: 'outTime',
                    message: 'Out-Time must be after In-Time'
                });
            }
        }

        // Grace Period validation (0-60 minutes)
        const gracePeriod = parseInt(formData.gracePeriodMinutes);
        if (isNaN(gracePeriod) || gracePeriod < ValidationRules.GRACE_PERIOD_MIN || gracePeriod > ValidationRules.GRACE_PERIOD_MAX) {
            errors.push({
                field: 'gracePeriodMinutes',
                message: `Grace period must be between ${ValidationRules.GRACE_PERIOD_MIN} and ${ValidationRules.GRACE_PERIOD_MAX} minutes`
            });
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    },

    /**
     * Save configuration
     * @param {Object} formData - Form data object
     * @returns {Object} { success: boolean, message: string, errors?: Array }
     */
    saveConfig: function(formData) {
        // Validate first
        const validation = this.validateForm(formData);
        if (!validation.isValid) {
            return {
                success: false,
                message: 'Please fix the errors below.',
                errors: validation.errors
            };
        }

        // Build config object
        const config = {
            latitude: parseFloat(formData.latitude),
            longitude: parseFloat(formData.longitude),
            radiusMeters: parseInt(formData.radiusMeters),
            inTime: formData.inTime,
            outTime: formData.outTime,
            gracePeriodMinutes: parseInt(formData.gracePeriodMinutes)
        };

        // Save to storage
        Storage.setOfficeConfig(config);
        console.log('[Settings] Config saved:', config);

        return {
            success: true,
            message: 'Settings saved successfully!'
        };
    },

    /**
     * Reset demo data
     * @returns {Object} { success: boolean, message: string }
     */
    resetDemoData: function() {
        Storage.resetDemoData();
        return {
            success: true,
            message: 'Demo data has been reset. You will be logged out.'
        };
    }
};

// ES module exports
export { Settings, ValidationRules };
export default Settings;
