/**
 * Attendance Service - Core attendance marking logic
 * Phase 1 Demo Only: All data stored in localStorage
 * 
 * ⏰ TIME SOURCE: All timestamps are taken from client device in Phase 1.
 * Server-side time validation will be enforced in Phase 2.
 * 
 * Business Rules:
 * - One attendance per user per day
 * - Must be inside office radius to mark
 * - Status based on office in-time and grace period
 * 
 * Status Logic (default 10:00 AM in-time, 15 min grace):
 * - ≤ 10:00 → on_time
 * - 10:01 – 10:15 → slightly_late
 * - After 10:15 → late
 */

/**
 * Attendance Status Types
 */
const AttendanceStatus = {
    ON_TIME: 'on_time',
    SLIGHTLY_LATE: 'slightly_late',
    LATE: 'late'
};

/**
 * Attendance Result Codes
 * Used for clear communication with UI layer
 */
const AttendanceResult = {
    SUCCESS: 'SUCCESS',                         // Attendance marked successfully
    ALREADY_MARKED: 'ALREADY_MARKED',           // Already marked today
    OUTSIDE_OFFICE: 'OUTSIDE_OFFICE',           // Not inside office radius
    LOCATION_ERROR: 'LOCATION_ERROR',           // Location service error
    NOT_LOGGED_IN: 'NOT_LOGGED_IN',             // No active session
    NOT_EMPLOYEE: 'NOT_EMPLOYEE',               // User is not an employee
    ERROR: 'ERROR'                              // Generic error
};

/**
 * Attendance Service Object
 */
const AttendanceService = {

    /**
     * Mark attendance for current user
     * This is the main function called from the UI
     * 
     * Flow:
     * 1. Check user is logged in and is employee
     * 2. Check if already marked today
     * 3. Verify location is inside office
     * 4. Calculate attendance status
     * 5. Save attendance record
     * 
     * @returns {Promise<Object>} Result object for UI
     * 
     * Success:
     * {
     *   result: 'SUCCESS',
     *   attendance: { id, userId, date, markedAt, status, location, distanceMeters },
     *   message: string
     * }
     * 
     * Already Marked:
     * {
     *   result: 'ALREADY_MARKED',
     *   attendance: { existing record },
     *   message: string
     * }
     * 
     * Error:
     * {
     *   result: 'OUTSIDE_OFFICE' | 'LOCATION_ERROR' | 'NOT_LOGGED_IN' | 'NOT_EMPLOYEE' | 'ERROR',
     *   message: string,
     *   details?: object
     * }
     */
    markInTime: async function() {
        console.log('[Attendance] Starting mark attendance flow...');

        // Step 1: Check user is logged in
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) {
            return {
                result: AttendanceResult.NOT_LOGGED_IN,
                message: 'You must be logged in to mark attendance.'
            };
        }

        // Step 2: Check user is an employee
        if (currentUser.role !== Roles.EMPLOYEE) {
            return {
                result: AttendanceResult.NOT_EMPLOYEE,
                message: 'Only employees can mark attendance.'
            };
        }

        const userId = currentUser.userId;
        const today = Storage.getTodayDate();

        // Step 3: Check if already marked today
        const existingAttendance = Storage.getAttendanceRecord(userId, today);
        if (existingAttendance) {
            console.log('[Attendance] Already marked today:', existingAttendance);
            return {
                result: AttendanceResult.ALREADY_MARKED,
                attendance: existingAttendance,
                message: 'You have already marked attendance today.'
            };
        }

        // Step 4: Verify location
        const locationResult = await LocationService.verifyInsideOffice();

        // Handle location errors
        if (locationResult.status !== LocationStatus.INSIDE_OFFICE && 
            locationResult.status !== LocationStatus.OUTSIDE_OFFICE) {
            return {
                result: AttendanceResult.LOCATION_ERROR,
                message: LocationService.getStatusMessage(locationResult.status),
                details: locationResult
            };
        }

        // Check if outside office
        if (!locationResult.isInside) {
            return {
                result: AttendanceResult.OUTSIDE_OFFICE,
                message: `You are ${LocationService.formatDistance(locationResult.distanceMeters)} away from the office. ` +
                         `Please move within ${locationResult.radiusMeters} meters of the office to mark attendance.`,
                details: {
                    distanceMeters: locationResult.distanceMeters,
                    radiusMeters: locationResult.radiusMeters,
                    userLocation: locationResult.userLocation
                }
            };
        }

        // Step 5: Calculate attendance status based on current time
        const currentTime = Storage.getCurrentTime();
        const status = this.calculateStatus(currentTime);

        // Step 6: Create and save attendance record
        const attendanceRecord = {
            userId: userId,
            date: today,
            markedAt: Storage.getCurrentTimestamp(),
            status: status,
            location: {
                lat: locationResult.userLocation.latitude,
                lng: locationResult.userLocation.longitude
            },
            distanceMeters: locationResult.distanceMeters
        };

        const savedRecord = Storage.addAttendance(attendanceRecord);

        console.log('[Attendance] Marked successfully:', savedRecord);

        return {
            result: AttendanceResult.SUCCESS,
            attendance: savedRecord,
            message: this._getSuccessMessage(status, currentTime)
        };
    },

    /**
     * Get today's attendance for a specific user
     * @param {string} userId 
     * @returns {Object|null} Attendance record or null
     */
    getTodayAttendance: function(userId) {
        const today = Storage.getTodayDate();
        return Storage.getAttendanceRecord(userId, today);
    },

    /**
     * Get today's attendance for current logged-in user
     * @returns {Object|null} Attendance record or null
     */
    getMyTodayAttendance: function() {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) return null;
        return this.getTodayAttendance(currentUser.userId);
    },

    /**
     * Check if current user has already marked attendance today
     * @returns {boolean}
     */
    hasMarkedToday: function() {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) return false;
        return Storage.hasMarkedAttendance(currentUser.userId, Storage.getTodayDate());
    },

    /**
     * Calculate attendance status based on marked time
     * Uses office config for in-time and grace period
     * 
     * @param {string} markedTime - Time in HH:MM format
     * @returns {string} Status: 'on_time' | 'slightly_late' | 'late'
     */
    calculateStatus: function(markedTime) {
        const config = Storage.getOfficeConfig();
        
        // Parse times to minutes since midnight for comparison
        const markedMinutes = this._timeToMinutes(markedTime);
        const inTimeMinutes = this._timeToMinutes(config.inTime);
        const graceEndMinutes = inTimeMinutes + config.gracePeriodMinutes;

        // Status logic:
        // ≤ inTime → on_time
        // inTime < marked ≤ inTime + grace → slightly_late
        // > inTime + grace → late
        
        if (markedMinutes <= inTimeMinutes) {
            return AttendanceStatus.ON_TIME;
        } else if (markedMinutes <= graceEndMinutes) {
            return AttendanceStatus.SLIGHTLY_LATE;
        } else {
            return AttendanceStatus.LATE;
        }
    },

    /**
     * Convert time string (HH:MM) to minutes since midnight
     * @param {string} time - Time in HH:MM format
     * @returns {number} Minutes since midnight
     * @private
     */
    _timeToMinutes: function(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    },

    /**
     * Get human-readable success message based on status
     * @param {string} status - Attendance status
     * @param {string} time - Time attendance was marked
     * @returns {string}
     * @private
     */
    _getSuccessMessage: function(status, time) {
        const config = Storage.getOfficeConfig();
        
        switch (status) {
            case AttendanceStatus.ON_TIME:
                return `Great! Attendance marked at ${time}. You're on time! 🎉`;
            case AttendanceStatus.SLIGHTLY_LATE:
                return `Attendance marked at ${time}. You're slightly late (within ${config.gracePeriodMinutes} min grace period).`;
            case AttendanceStatus.LATE:
                return `Attendance marked at ${time}. You're late. Office in-time is ${config.inTime}.`;
            default:
                return `Attendance marked at ${time}.`;
        }
    },

    /**
     * Get display-friendly status label
     * @param {string} status - Attendance status code
     * @returns {string} Display label
     */
    getStatusLabel: function(status) {
        const labels = {
            [AttendanceStatus.ON_TIME]: 'On Time',
            [AttendanceStatus.SLIGHTLY_LATE]: 'Slightly Late',
            [AttendanceStatus.LATE]: 'Late'
        };
        return labels[status] || status;
    },

    /**
     * Get CSS class for status styling
     * @param {string} status - Attendance status code
     * @returns {string} CSS class name
     */
    getStatusClass: function(status) {
        const classes = {
            [AttendanceStatus.ON_TIME]: 'status-on-time',
            [AttendanceStatus.SLIGHTLY_LATE]: 'status-slightly-late',
            [AttendanceStatus.LATE]: 'status-late'
        };
        return classes[status] || '';
    },

    /**
     * Get Bootstrap badge class for status
     * @param {string} status - Attendance status code
     * @returns {string} Bootstrap badge class
     */
    getStatusBadgeClass: function(status) {
        const classes = {
            [AttendanceStatus.ON_TIME]: 'bg-success',
            [AttendanceStatus.SLIGHTLY_LATE]: 'bg-warning text-dark',
            [AttendanceStatus.LATE]: 'bg-danger'
        };
        return classes[status] || 'bg-secondary';
    }
};

// Export for use in other modules
window.AttendanceService = AttendanceService;
window.AttendanceStatus = AttendanceStatus;
window.AttendanceResult = AttendanceResult;
