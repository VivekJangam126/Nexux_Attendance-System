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

import Storage from './storage';
import { Auth, Roles } from './auth';
import { LocationService, LocationStatus } from './location';

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
     * Calculate attendance status based on time
     * @param {string} time - Time in HH:MM format
     * @returns {string} AttendanceStatus value
     */
    calculateStatus: function(time) {
        const config = Storage.getOfficeConfig();
        const inTime = config.inTime;           // e.g., "10:00"
        const graceMinutes = config.gracePeriodMinutes; // e.g., 15

        // Convert times to minutes for easier comparison
        const currentMinutes = this._timeToMinutes(time);
        const inTimeMinutes = this._timeToMinutes(inTime);
        const graceEndMinutes = inTimeMinutes + graceMinutes;

        if (currentMinutes <= inTimeMinutes) {
            return AttendanceStatus.ON_TIME;
        } else if (currentMinutes <= graceEndMinutes) {
            return AttendanceStatus.SLIGHTLY_LATE;
        } else {
            return AttendanceStatus.LATE;
        }
    },

    /**
     * Convert HH:MM time string to minutes since midnight
     * @param {string} time - Time in HH:MM format
     * @returns {number} Minutes since midnight
     * @private
     */
    _timeToMinutes: function(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    },

    /**
     * Get success message based on status
     * @param {string} status - AttendanceStatus value
     * @param {string} time - Time when marked
     * @returns {string} User-friendly message
     * @private
     */
    _getSuccessMessage: function(status, time) {
        switch (status) {
            case AttendanceStatus.ON_TIME:
                return `Great! Attendance marked on time at ${time}.`;
            case AttendanceStatus.SLIGHTLY_LATE:
                return `Attendance marked at ${time}. You're slightly late but within grace period.`;
            case AttendanceStatus.LATE:
                return `Attendance marked at ${time}. Please try to arrive on time tomorrow.`;
            default:
                return `Attendance marked at ${time}.`;
        }
    },

    /**
     * Get human-readable status label
     * @param {string} status - AttendanceStatus value
     * @returns {string} Display label
     */
    getStatusLabel: function(status) {
        switch (status) {
            case AttendanceStatus.ON_TIME:
                return 'On Time';
            case AttendanceStatus.SLIGHTLY_LATE:
                return 'Slightly Late';
            case AttendanceStatus.LATE:
                return 'Late';
            default:
                return status;
        }
    },

    /**
     * Get status color class for styling
     * @param {string} status - AttendanceStatus value
     * @returns {string} Tailwind color class
     */
    getStatusColor: function(status) {
        switch (status) {
            case AttendanceStatus.ON_TIME:
                return 'text-green-600 bg-green-100';
            case AttendanceStatus.SLIGHTLY_LATE:
                return 'text-yellow-600 bg-yellow-100';
            case AttendanceStatus.LATE:
                return 'text-red-600 bg-red-100';
            default:
                return 'text-gray-600 bg-gray-100';
        }
    }
};

// ES module exports
export { AttendanceService, AttendanceStatus, AttendanceResult };
export default AttendanceService;
