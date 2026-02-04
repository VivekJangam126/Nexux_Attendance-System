/**
 * Settings Module - Admin configuration panel
 * Phase 1 Demo Only: All settings stored in localStorage
 * 
 * Features:
 * - Load and display office configuration
 * - Validate and save settings
 * - Reset Demo Data functionality
 * 
 * Admin-only access (enforced by Auth.guardPage in HTML)
 */

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

    // Form element references (populated on init)
    form: null,
    fields: {},
    messageContainer: null,

    /**
     * Initialize settings page
     * Call this after DOM is loaded
     */
    init: function() {
        // Cache form elements
        this.form = document.getElementById('settingsForm');
        this.fields = {
            latitude: document.getElementById('latitude'),
            longitude: document.getElementById('longitude'),
            radiusMeters: document.getElementById('radiusMeters'),
            inTime: document.getElementById('inTime'),
            outTime: document.getElementById('outTime'),
            gracePeriodMinutes: document.getElementById('gracePeriodMinutes')
        };
        this.messageContainer = document.getElementById('messageContainer');

        // Load current config
        this.loadConfig();

        // Bind event handlers
        this.bindEvents();

        console.log('[Settings] Initialized');
    },

    /**
     * Load current office configuration and populate form
     */
    loadConfig: function() {
        const config = Storage.getOfficeConfig();

        // Populate form fields
        if (this.fields.latitude) this.fields.latitude.value = config.latitude;
        if (this.fields.longitude) this.fields.longitude.value = config.longitude;
        if (this.fields.radiusMeters) this.fields.radiusMeters.value = config.radiusMeters;
        if (this.fields.inTime) this.fields.inTime.value = config.inTime;
        if (this.fields.outTime) this.fields.outTime.value = config.outTime;
        if (this.fields.gracePeriodMinutes) this.fields.gracePeriodMinutes.value = config.gracePeriodMinutes;

        console.log('[Settings] Config loaded:', config);
    },

    /**
     * Bind form events
     */
    bindEvents: function() {
        // Save settings form submission
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveConfig();
            });
        }

        // Reset Demo Data button
        const resetBtn = document.getElementById('resetDemoDataBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.handleResetDemoData();
            });
        }

        // Real-time validation on input
        Object.values(this.fields).forEach(field => {
            if (field) {
                field.addEventListener('input', () => {
                    this.clearFieldError(field);
                });
            }
        });
    },

    // ==================== VALIDATION ====================

    /**
     * Validate all form fields
     * @returns {Object} { isValid: boolean, errors: Array }
     */
    validateForm: function() {
        const errors = [];

        // Latitude validation (-90 to +90)
        const lat = parseFloat(this.fields.latitude?.value);
        if (isNaN(lat) || lat < ValidationRules.LATITUDE_MIN || lat > ValidationRules.LATITUDE_MAX) {
            errors.push({
                field: 'latitude',
                message: `Latitude must be between ${ValidationRules.LATITUDE_MIN} and ${ValidationRules.LATITUDE_MAX}`
            });
        }

        // Longitude validation (-180 to +180)
        const lng = parseFloat(this.fields.longitude?.value);
        if (isNaN(lng) || lng < ValidationRules.LONGITUDE_MIN || lng > ValidationRules.LONGITUDE_MAX) {
            errors.push({
                field: 'longitude',
                message: `Longitude must be between ${ValidationRules.LONGITUDE_MIN} and ${ValidationRules.LONGITUDE_MAX}`
            });
        }

        // Radius validation (≥ 20m)
        const radius = parseInt(this.fields.radiusMeters?.value);
        if (isNaN(radius) || radius < ValidationRules.RADIUS_MIN || radius > ValidationRules.RADIUS_MAX) {
            errors.push({
                field: 'radiusMeters',
                message: `Radius must be between ${ValidationRules.RADIUS_MIN}m and ${ValidationRules.RADIUS_MAX}m`
            });
        }

        // In-Time validation (HH:MM format)
        const inTime = this.fields.inTime?.value;
        if (!this.isValidTimeFormat(inTime)) {
            errors.push({
                field: 'inTime',
                message: 'In-Time must be in HH:MM format (e.g., 10:00)'
            });
        }

        // Out-Time validation (HH:MM format)
        const outTime = this.fields.outTime?.value;
        if (!this.isValidTimeFormat(outTime)) {
            errors.push({
                field: 'outTime',
                message: 'Out-Time must be in HH:MM format (e.g., 18:00)'
            });
        }

        // Out-Time must be after In-Time
        if (this.isValidTimeFormat(inTime) && this.isValidTimeFormat(outTime)) {
            if (outTime <= inTime) {
                errors.push({
                    field: 'outTime',
                    message: 'Out-Time must be after In-Time'
                });
            }
        }

        // Grace Period validation (0-60 minutes)
        const gracePeriod = parseInt(this.fields.gracePeriodMinutes?.value);
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
     * Show validation errors on fields
     * @param {Array} errors - Array of { field, message }
     */
    showFieldErrors: function(errors) {
        errors.forEach(error => {
            const field = this.fields[error.field];
            if (field) {
                field.classList.add('is-invalid');
                
                // Create or update error message
                let errorDiv = field.nextElementSibling;
                if (!errorDiv || !errorDiv.classList.contains('invalid-feedback')) {
                    errorDiv = document.createElement('div');
                    errorDiv.className = 'invalid-feedback';
                    field.parentNode.insertBefore(errorDiv, field.nextSibling);
                }
                errorDiv.textContent = error.message;
            }
        });
    },

    /**
     * Clear error state from a field
     * @param {HTMLElement} field 
     */
    clearFieldError: function(field) {
        if (field) {
            field.classList.remove('is-invalid');
        }
    },

    /**
     * Clear all field errors
     */
    clearAllErrors: function() {
        Object.values(this.fields).forEach(field => {
            this.clearFieldError(field);
        });
    },

    // ==================== SAVE CONFIG ====================

    /**
     * Validate and save configuration
     */
    saveConfig: function() {
        // Clear previous errors
        this.clearAllErrors();
        this.clearMessage();

        // Validate form
        const validation = this.validateForm();

        if (!validation.isValid) {
            this.showFieldErrors(validation.errors);
            this.showMessage('Please fix the errors below', 'error');
            return;
        }

        // Build config object
        const config = {
            latitude: parseFloat(this.fields.latitude.value),
            longitude: parseFloat(this.fields.longitude.value),
            radiusMeters: parseInt(this.fields.radiusMeters.value),
            inTime: this.fields.inTime.value,
            outTime: this.fields.outTime.value,
            gracePeriodMinutes: parseInt(this.fields.gracePeriodMinutes.value)
        };

        // Save to storage
        Storage.setOfficeConfig(config);

        console.log('[Settings] Config saved:', config);
        this.showMessage('Settings saved successfully!', 'success');
    },

    // ==================== RESET DEMO DATA ====================

    /**
     * Handle Reset Demo Data button click
     * Shows confirmation dialog before resetting
     */
    handleResetDemoData: function() {
        const confirmed = confirm(
            '⚠️ Reset Demo Data?\n\n' +
            'This will:\n' +
            '• Clear all attendance records\n' +
            '• Reset office settings to defaults\n' +
            '• Restore demo users\n' +
            '• Log out all users\n\n' +
            'This action cannot be undone.'
        );

        if (confirmed) {
            this.resetDemoData();
        }
    },

    /**
     * Execute demo data reset
     */
    resetDemoData: function() {
        // Reset all data
        Storage.resetDemoData();

        // Show success message briefly
        this.showMessage('Demo data reset successfully! Redirecting to login...', 'success');

        // Redirect to login after short delay
        setTimeout(() => {
            Auth.redirectTo(PagePaths.LOGIN);
        }, 1500);
    },

    // ==================== MESSAGES ====================

    /**
     * Show a message to the user
     * @param {string} message - Message text
     * @param {string} type - 'success', 'error', or 'info'
     */
    showMessage: function(message, type = 'info') {
        if (!this.messageContainer) return;

        // Map type to Bootstrap alert classes
        const alertClass = {
            'success': 'alert-success',
            'error': 'alert-danger',
            'info': 'alert-info'
        }[type] || 'alert-info';

        this.messageContainer.innerHTML = `
            <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;

        // Auto-hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                this.clearMessage();
            }, 3000);
        }
    },

    /**
     * Clear message container
     */
    clearMessage: function() {
        if (this.messageContainer) {
            this.messageContainer.innerHTML = '';
        }
    }
};

// Export for use in HTML
window.Settings = Settings;
window.ValidationRules = ValidationRules;
