/**
 * Location Service - GPS-based location verification
 * Phase 1 Demo Only: Browser Geolocation API
 * 
 * ⚠️ IMPORTANT: This module ONLY handles location logic.
 * - No attendance marking
 * - No UI/alerts
 * - No continuous tracking
 * - No Wi-Fi logic (Phase 2+)
 * 
 * Uses Haversine formula for distance calculation.
 * All distances in meters.
 */

/**
 * Location Status Codes
 * Used for clear communication with UI layer
 */
const LocationStatus = {
    SUCCESS: 'SUCCESS',                         // Location obtained successfully
    INSIDE_OFFICE: 'INSIDE_OFFICE',             // User is within office radius
    OUTSIDE_OFFICE: 'OUTSIDE_OFFICE',           // User is outside office radius
    PERMISSION_DENIED: 'PERMISSION_DENIED',     // User denied location permission
    POSITION_UNAVAILABLE: 'POSITION_UNAVAILABLE', // Location unavailable (no GPS, etc.)
    TIMEOUT: 'TIMEOUT',                         // Location request timed out
    NOT_SUPPORTED: 'NOT_SUPPORTED',             // Browser doesn't support Geolocation
    ERROR: 'ERROR'                              // Generic error
};

/**
 * Geolocation options for high accuracy
 */
const GeoOptions = {
    enableHighAccuracy: true,   // Use GPS if available
    timeout: 10000,             // 10 second timeout
    maximumAge: 0               // Don't use cached position
};

/**
 * Location Service Object
 */
const LocationService = {

    /**
     * Check if Geolocation API is supported
     * @returns {boolean}
     */
    isSupported: function() {
        return 'geolocation' in navigator;
    },

    /**
     * Get current location from browser
     * @returns {Promise<Object>} Result object with status and coordinates
     * 
     * Success response:
     * {
     *   status: 'SUCCESS',
     *   latitude: number,
     *   longitude: number,
     *   accuracy: number (meters),
     *   timestamp: string (ISO)
     * }
     * 
     * Error response:
     * {
     *   status: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED' | 'ERROR',
     *   message: string
     * }
     */
    getCurrentLocation: function() {
        return new Promise((resolve) => {
            // Check browser support
            if (!this.isSupported()) {
                console.log('[Location] Geolocation not supported');
                resolve({
                    status: LocationStatus.NOT_SUPPORTED,
                    message: 'Geolocation is not supported by this browser'
                });
                return;
            }

            // Request current position
            navigator.geolocation.getCurrentPosition(
                // Success callback
                (position) => {
                    const result = {
                        status: LocationStatus.SUCCESS,
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy, // in meters
                        timestamp: new Date(position.timestamp).toISOString()
                    };
                    console.log('[Location] Position obtained:', result);
                    resolve(result);
                },
                // Error callback
                (error) => {
                    const result = this._handleGeolocationError(error);
                    console.log('[Location] Error:', result);
                    resolve(result);
                },
                // Options
                GeoOptions
            );
        });
    },

    /**
     * Handle Geolocation API errors
     * @param {GeolocationPositionError} error 
     * @returns {Object} Error result object
     * @private
     */
    _handleGeolocationError: function(error) {
        switch (error.code) {
            case error.PERMISSION_DENIED:
                return {
                    status: LocationStatus.PERMISSION_DENIED,
                    message: 'Location permission was denied. Please enable location access in your browser settings.'
                };
            case error.POSITION_UNAVAILABLE:
                return {
                    status: LocationStatus.POSITION_UNAVAILABLE,
                    message: 'Location information is unavailable. Please check your device\'s GPS settings.'
                };
            case error.TIMEOUT:
                return {
                    status: LocationStatus.TIMEOUT,
                    message: 'Location request timed out. Please try again.'
                };
            default:
                return {
                    status: LocationStatus.ERROR,
                    message: 'An unknown error occurred while getting location.'
                };
        }
    },

    /**
     * Calculate distance between two coordinates using Haversine formula
     * @param {number} lat1 - Latitude of point 1
     * @param {number} lng1 - Longitude of point 1
     * @param {number} lat2 - Latitude of point 2
     * @param {number} lng2 - Longitude of point 2
     * @returns {number} Distance in meters
     */
    calculateDistance: function(lat1, lng1, lat2, lng2) {
        // Earth's radius in meters
        const R = 6371000;

        // Convert degrees to radians
        const toRad = (deg) => deg * (Math.PI / 180);

        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);

        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const distance = R * c;

        // Round to 2 decimal places
        return Math.round(distance * 100) / 100;
    },

    /**
     * Verify if current location is inside office radius
     * This is the main function for attendance verification
     * 
     * @returns {Promise<Object>} Verification result
     * 
     * Success (inside office):
     * {
     *   status: 'INSIDE_OFFICE',
     *   isInside: true,
     *   distanceMeters: number,
     *   accuracyMeters: number,
     *   radiusMeters: number,
     *   userLocation: { latitude, longitude },
     *   officeLocation: { latitude, longitude }
     * }
     * 
     * Success (outside office):
     * {
     *   status: 'OUTSIDE_OFFICE',
     *   isInside: false,
     *   distanceMeters: number,
     *   accuracyMeters: number,
     *   radiusMeters: number,
     *   userLocation: { latitude, longitude },
     *   officeLocation: { latitude, longitude }
     * }
     * 
     * Error:
     * {
     *   status: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED' | 'ERROR',
     *   isInside: false,
     *   message: string
     * }
     */
    verifyInsideOffice: async function() {
        // Get current location
        const locationResult = await this.getCurrentLocation();

        // If location failed, return error with isInside: false
        if (locationResult.status !== LocationStatus.SUCCESS) {
            return {
                ...locationResult,
                isInside: false
            };
        }

        // Get office configuration from storage
        const officeConfig = Storage.getOfficeConfig();

        // Calculate distance from office
        const distance = this.calculateDistance(
            locationResult.latitude,
            locationResult.longitude,
            officeConfig.latitude,
            officeConfig.longitude
        );

        // Check if inside radius
        const isInside = distance <= officeConfig.radiusMeters;

        // Build result object
        const result = {
            status: isInside ? LocationStatus.INSIDE_OFFICE : LocationStatus.OUTSIDE_OFFICE,
            isInside: isInside,
            distanceMeters: distance,
            accuracyMeters: locationResult.accuracy,
            radiusMeters: officeConfig.radiusMeters,
            userLocation: {
                latitude: locationResult.latitude,
                longitude: locationResult.longitude
            },
            officeLocation: {
                latitude: officeConfig.latitude,
                longitude: officeConfig.longitude
            }
        };

        console.log('[Location] Verification result:', result);
        return result;
    },

    /**
     * Get human-readable message for a status code
     * Useful for UI layer to display appropriate messages
     * @param {string} status - Status code from LocationStatus
     * @returns {string} Human-readable message
     */
    getStatusMessage: function(status) {
        const messages = {
            [LocationStatus.SUCCESS]: 'Location obtained successfully.',
            [LocationStatus.INSIDE_OFFICE]: 'You are inside the office area.',
            [LocationStatus.OUTSIDE_OFFICE]: 'You are outside the office area.',
            [LocationStatus.PERMISSION_DENIED]: 'Location permission denied. Please enable location access in your browser settings.',
            [LocationStatus.POSITION_UNAVAILABLE]: 'Unable to determine your location. Please check your GPS settings.',
            [LocationStatus.TIMEOUT]: 'Location request timed out. Please try again.',
            [LocationStatus.NOT_SUPPORTED]: 'Your browser does not support location services.',
            [LocationStatus.ERROR]: 'An error occurred while checking location.'
        };
        return messages[status] || 'Unknown status.';
    },

    /**
     * Format distance for display
     * @param {number} meters - Distance in meters
     * @returns {string} Formatted distance string
     */
    formatDistance: function(meters) {
        if (meters < 1000) {
            return `${Math.round(meters)} meters`;
        } else {
            return `${(meters / 1000).toFixed(2)} km`;
        }
    }
};

// Export for use in other modules
window.LocationService = LocationService;
window.LocationStatus = LocationStatus;
