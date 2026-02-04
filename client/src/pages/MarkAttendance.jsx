import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocationService, LocationStatus } from '../services/location';
import { AttendanceService, AttendanceResult } from '../services/attendance';
import { Auth } from '../services/auth';

/**
 * Mark Attendance Page - Matches original mark-attendance.html behavior exactly
 * 
 * Behavior:
 * - Shows welcome message with current user name
 * - Real-time clock display
 * - Location verification with status updates
 * - Mark attendance button with proper disabled states
 * - Same success/error messages and redirects
 * - Handles already marked attendance case
 */
// Helper function to get initial time string
function getInitialTime() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

// Helper function to get initial date string
function getInitialDate() {
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return new Date().toLocaleDateString('en-US', dateOptions);
}

// Helper to check if already marked and get initial states
function getInitialStates() {
  const alreadyMarked = AttendanceService.hasMarkedToday();
  
  if (alreadyMarked) {
    const attendance = AttendanceService.getMyTodayAttendance();
    return {
      alreadyMarked: true,
      locationStatus: {
        type: 'success',
        icon: '✅',
        text: 'Attendance Already Marked',
        detail: `Marked at ${new Date(attendance.markedAt).toLocaleTimeString()}`
      },
      message: { text: 'You have already marked attendance today. Redirecting...', type: 'info' },
      buttonState: { disabled: true, text: 'Mark In-Time', showRetry: false },
      disabledReason: {
        show: true,
        type: 'already',
        icon: '✅',
        text: 'Attendance already marked for today'
      }
    };
  }
  
  return {
    alreadyMarked: false,
    locationStatus: {
      type: 'checking',
      icon: '🔄',
      text: 'Checking location...',
      detail: 'Please allow location access when prompted'
    },
    message: { text: '', type: '' },
    buttonState: { disabled: true, text: 'Mark In-Time', showRetry: false },
    disabledReason: {
      show: true,
      type: 'waiting',
      icon: '⏳',
      text: 'Waiting for location verification...'
    }
  };
}

function MarkAttendance() {
  const navigate = useNavigate();
  
  // Get initial states based on whether already marked (computed once)
  const [initialStates] = useState(getInitialStates);
  
  // State management (lazy initialized for time/date)
  const [currentTime, setCurrentTime] = useState(getInitialTime);
  const [currentDate, setCurrentDate] = useState(getInitialDate);
  const [locationVerified, setLocationVerified] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState(() => initialStates.message);
  
  // Location status state (initialized based on already marked check)
  const [locationStatus, setLocationStatus] = useState(() => initialStates.locationStatus);
  
  // Location details state
  const [locationDetails, setLocationDetails] = useState({
    show: false,
    distance: '--',
    radius: '--',
    accuracy: '--'
  });
  
  // Button state (initialized based on already marked check)
  const [buttonState, setButtonState] = useState(() => initialStates.buttonState);
  
  // Disabled reason state (initialized based on already marked check)
  const [disabledReason, setDisabledReason] = useState(() => initialStates.disabledReason);
  
  // Accuracy warning state
  const [accuracyWarning, setAccuracyWarning] = useState({
    show: false,
    text: ''
  });

  // Get current user
  const currentUser = Auth.getCurrentUser();

  // Update date and time display
  const updateDateTime = useCallback(() => {
    const now = new Date();
    
    // Update date
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setCurrentDate(now.toLocaleDateString('en-US', dateOptions));
    
    // Update time
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    setCurrentTime(timeStr);
  }, []);

  // Check location verification (assumes initial state already set to "checking")
  const checkLocation = useCallback(async () => {
    // Note: Initial "checking" state is set via lazy initialization
    // Only reset state if this is a retry (not initial load)
    // The resetState function can be called separately for retries
    
    // Verify location
    const result = await LocationService.verifyInsideOffice();
    
    // Handle result
    if (result.status === LocationStatus.INSIDE_OFFICE) {
      // Success - inside office
      setLocationVerified(true);
      setLocationStatus({
        type: 'success',
        icon: '✅',
        text: 'You are inside the office!',
        detail: `${LocationService.formatDistance(result.distanceMeters)} from office center`
      });
      setLocationDetails({
        show: true,
        distance: LocationService.formatDistance(result.distanceMeters),
        radius: result.radiusMeters + ' meters',
        accuracy: '±' + Math.round(result.accuracyMeters) + ' meters'
      });
      setButtonState({ disabled: false, text: 'Mark In-Time', showRetry: false });
      setDisabledReason({ show: false, type: '', icon: '', text: '' });
      
      // Check GPS accuracy warning
      if (result.accuracyMeters > result.radiusMeters) {
        setAccuracyWarning({
          show: true,
          text: `GPS accuracy (±${Math.round(result.accuracyMeters)}m) is lower than office radius (${result.radiusMeters}m). Your location may not be precise. Consider waiting for better GPS signal.`
        });
      }
      
    } else if (result.status === LocationStatus.OUTSIDE_OFFICE) {
      // Outside office radius
      setLocationStatus({
        type: 'warning',
        icon: '📍',
        text: 'You are outside the office area',
        detail: `Move closer to mark attendance (${LocationService.formatDistance(result.distanceMeters)} away)`
      });
      setLocationDetails({
        show: true,
        distance: LocationService.formatDistance(result.distanceMeters),
        radius: result.radiusMeters + ' meters',
        accuracy: '±' + Math.round(result.accuracyMeters) + ' meters'
      });
      setButtonState({ disabled: true, text: 'Mark In-Time', showRetry: true });
      setDisabledReason({
        show: true,
        type: 'warning',
        icon: '📍',
        text: `You are ${LocationService.formatDistance(result.distanceMeters)} away from office`
      });
      
    } else if (result.status === LocationStatus.PERMISSION_DENIED) {
      // Permission denied
      setLocationStatus({
        type: 'error',
        icon: '🚫',
        text: 'Location Permission Denied',
        detail: 'Please enable location access in your browser settings'
      });
      setButtonState({ disabled: true, text: 'Mark In-Time', showRetry: true });
      setDisabledReason({
        show: true,
        type: 'error',
        icon: '⚠️',
        text: 'Location permission is required to mark attendance'
      });
      
    } else if (result.status === LocationStatus.POSITION_UNAVAILABLE) {
      // GPS unavailable
      setLocationStatus({
        type: 'error',
        icon: '📡',
        text: 'Location Unavailable',
        detail: 'Unable to determine your location. Check GPS settings.'
      });
      setButtonState({ disabled: true, text: 'Mark In-Time', showRetry: true });
      setDisabledReason({
        show: true,
        type: 'error',
        icon: '⚠️',
        text: 'GPS signal not available'
      });
      
    } else if (result.status === LocationStatus.TIMEOUT) {
      // Timeout
      setLocationStatus({
        type: 'error',
        icon: '⏱️',
        text: 'Location Request Timed Out',
        detail: 'Please try again in an area with better GPS signal'
      });
      setButtonState({ disabled: true, text: 'Mark In-Time', showRetry: true });
      setDisabledReason({
        show: true,
        type: 'error',
        icon: '⚠️',
        text: 'Location request timed out'
      });
      
    } else {
      // Other location error
      setLocationStatus({
        type: 'error',
        icon: '❌',
        text: 'Location Error',
        detail: result.message || LocationService.getStatusMessage(result.status)
      });
      setButtonState({ disabled: true, text: 'Mark In-Time', showRetry: true });
      setDisabledReason({
        show: true,
        type: 'error',
        icon: '⚠️',
        text: 'Unable to verify location'
      });
    }
  }, []);

  // Retry location check (resets state and re-checks)
  const retryCheckLocation = useCallback(() => {
    // Reset to checking state
    setLocationVerified(false);
    setButtonState({ disabled: true, text: 'Mark In-Time', showRetry: false });
    setLocationStatus({
      type: 'checking',
      icon: '🔄',
      text: 'Verifying your location...',
      detail: 'Please allow location access when prompted'
    });
    setLocationDetails({ show: false, distance: '--', radius: '--', accuracy: '--' });
    setAccuracyWarning({ show: false, text: '' });
    setDisabledReason({
      show: true,
      type: 'waiting',
      icon: '⏳',
      text: 'Verifying your location...'
    });
    
    // Then check location
    checkLocation();
  }, [checkLocation]);

  // Initialize page
  useEffect(() => {
    // Start clock interval (initial values already set via lazy initialization)
    const clockInterval = setInterval(updateDateTime, 1000);
    
    // If already marked today, redirect after delay (states already initialized)
    if (initialStates.alreadyMarked) {
      const redirectTimer = setTimeout(() => {
        navigate('/confirmation');
      }, 2000);
      return () => {
        clearInterval(clockInterval);
        clearTimeout(redirectTimer);
      };
    }
    
    // Start location check - async operation that updates state after geolocation resolves
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkLocation();
    
    return () => clearInterval(clockInterval);
  }, [updateDateTime, checkLocation, initialStates.alreadyMarked, navigate]);

  // Handle mark attendance button click
  const handleMarkAttendance = async () => {
    if (!locationVerified || isProcessing) return;
    
    setIsProcessing(true);
    setButtonState({ disabled: true, text: 'Marking...', showRetry: false });
    
    // Call attendance service
    const result = await AttendanceService.markInTime();
    
    if (result.result === AttendanceResult.SUCCESS) {
      // Success - redirect to confirmation
      setMessage({ text: result.message, type: 'success' });
      setTimeout(() => {
        navigate('/confirmation');
      }, 1000);
      
    } else if (result.result === AttendanceResult.ALREADY_MARKED) {
      // Already marked - redirect to confirmation
      setMessage({ text: 'Attendance already marked today!', type: 'info' });
      setTimeout(() => {
        navigate('/confirmation');
      }, 1000);
      
    } else if (result.result === AttendanceResult.OUTSIDE_OFFICE) {
      // Location changed - re-check
      setMessage({ text: 'Location changed. Please verify again.', type: 'warning' });
      setIsProcessing(false);
      retryCheckLocation();
      
    } else {
      // Other error
      setMessage({ text: result.message, type: 'error' });
      setIsProcessing(false);
      setButtonState({ disabled: false, text: 'Mark In-Time', showRetry: false });
    }
  };

  // Handle logout
  const handleLogout = (e) => {
    e.preventDefault();
    Auth.logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Phase indicator */}
      <div className="fixed bottom-2.5 right-2.5 bg-black/70 px-3 py-1.5 rounded-full text-xs font-semibold text-white">
        Phase 1 Demo
      </div>
      
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="px-4 py-3 flex justify-between items-center">
          <span className="text-lg font-bold text-indigo-600">🏢 Nexon Attendance</span>
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-red-500 text-sm transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>
      
      {/* Main Content */}
      <div className="max-w-md mx-auto p-5">
        
        {/* Message Container */}
        {message.text && (
          <div className="mb-5">
            <div
              className={`p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : message.type === 'warning'
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                  : message.type === 'info'
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}
              role="alert"
            >
              {message.text}
            </div>
          </div>
        )}
        
        {/* Welcome Card */}
        <div className="bg-white rounded-2xl p-6 mb-5 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-800 mb-1">
            Welcome{currentUser ? `, ${currentUser.name}` : ''}!
          </h2>
          <div className="text-gray-600 text-sm mb-4">{currentDate}</div>
          <div className="text-4xl font-bold text-indigo-600 font-mono">
            {currentTime}
          </div>
        </div>
        
        {/* Location Status Card */}
        <div className="bg-white rounded-2xl p-6 mb-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-700 mb-4">
            📍 Location Verification
          </h3>
          
          {/* Status Box */}
          <div
            className={`p-4 rounded-xl text-center mb-4 ${
              locationStatus.type === 'checking'
                ? 'bg-indigo-50 text-indigo-700'
                : locationStatus.type === 'success'
                ? 'bg-green-50 text-green-700'
                : locationStatus.type === 'warning'
                ? 'bg-yellow-50 text-yellow-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            <div className={`text-2xl mb-2 ${locationStatus.type === 'checking' ? 'animate-spin' : ''}`}>
              {locationStatus.icon}
            </div>
            <div className="font-semibold text-base">{locationStatus.text}</div>
            <div className="text-sm mt-1 opacity-90">{locationStatus.detail}</div>
          </div>
          
          {/* Location Details */}
          {locationDetails.show && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Distance from office:</span>
                <span className="font-semibold text-gray-800">{locationDetails.distance}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Allowed radius:</span>
                <span className="font-semibold text-gray-800">{locationDetails.radius}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">GPS accuracy:</span>
                <span className="font-semibold text-gray-800">{locationDetails.accuracy}</span>
              </div>
            </div>
          )}
          
          {/* Wi-Fi Notice */}
          <div className="text-center p-2.5 bg-blue-50 rounded-lg text-xs text-blue-700">
            🔒 Wi-Fi verification will be available in Phase 2
          </div>
        </div>
        
        {/* Mark Attendance Button */}
        {!buttonState.showRetry && (
          <button
            onClick={handleMarkAttendance}
            disabled={buttonState.disabled}
            className={`w-full py-4.5 text-lg font-bold rounded-xl text-white transition-all ${
              buttonState.disabled
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 hover:-translate-y-0.5 shadow-lg hover:shadow-xl'
            }`}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Marking...
              </span>
            ) : (
              buttonState.text
            )}
          </button>
        )}
        
        {/* Retry Button */}
        {buttonState.showRetry && (
          <button
            onClick={retryCheckLocation}
            className="w-full py-3.5 text-base font-semibold rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-colors"
          >
            🔄 Retry Location Check
          </button>
        )}
        
        {/* Button Disabled Reason */}
        {disabledReason.show && (
          <div
            className={`text-center mt-2.5 p-2 rounded-lg text-sm ${
              disabledReason.type === 'warning'
                ? 'bg-yellow-50 text-yellow-700'
                : disabledReason.type === 'error'
                ? 'bg-red-50 text-red-700'
                : 'bg-gray-50 text-gray-600'
            }`}
          >
            <span className="mr-1.5">{disabledReason.icon}</span>
            <span>{disabledReason.text}</span>
          </div>
        )}
        
        {/* GPS Accuracy Warning */}
        {accuracyWarning.show && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 mt-3 text-xs text-yellow-700 flex items-start gap-2">
            <span className="text-sm shrink-0">⚠️</span>
            <span>{accuracyWarning.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default MarkAttendance;