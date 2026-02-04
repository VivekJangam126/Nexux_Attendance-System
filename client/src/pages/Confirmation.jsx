import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AttendanceService } from '../services/attendance';
import { Auth } from '../services/auth';
import Storage from '../services/storage';
import StatusBadge from '../components/StatusBadge';

/**
 * Confirmation Page - Matches original confirmation.html behavior exactly
 * 
 * Behavior:
 * - Redirect to Mark Attendance if no attendance exists for today
 * - Show today's attendance details (date, time, status, location)
 * - Locked notice ("Attendance is locked for today")
 * - Attendance history (last 7 days)
 * - Derived absence logic (never stored, calculated on the fly)
 * - Status badges with tooltip explanations
 */
function Confirmation() {
  const navigate = useNavigate();
  const currentUser = Auth.getCurrentUser();
  const attendance = AttendanceService.getMyTodayAttendance();

  // Redirect to mark-attendance if no attendance exists
  useEffect(() => {
    if (!attendance) {
      navigate('/mark-attendance');
    }
  }, [attendance, navigate]);

  // Handle logout
  const handleLogout = (e) => {
    e.preventDefault();
    Auth.logout();
    navigate('/');
  };

  // If no attendance, don't render (will redirect)
  if (!attendance) {
    return null;
  }

  // Format attendance date
  const formatAttendanceDate = () => {
    const date = new Date(attendance.date + 'T00:00:00');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  // Format attendance time
  const formatAttendanceTime = () => {
    const markedTime = new Date(attendance.markedAt);
    const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    return markedTime.toLocaleTimeString('en-US', options);
  };

  // Get last 7 days history data
  const getHistoryData = () => {
    if (!currentUser) return [];

    const days = [];
    const today = new Date();

    // Generate last 7 days (including today)
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      days.push({ date, dateStr });
    }

    // Get all attendance records for this user
    const allAttendance = Storage.getAttendance();
    const userAttendance = allAttendance.filter(a => a.userId === currentUser.userId);

    // Create attendance map for quick lookup
    const attendanceMap = {};
    userAttendance.forEach(a => {
      attendanceMap[a.date] = a;
    });

    // Build history data with derived absences
    return days.map((day, index) => {
      const record = attendanceMap[day.dateStr];
      const isToday = index === 0;

      if (record) {
        return {
          date: day.date,
          dateStr: day.dateStr,
          inTime: new Date(record.markedAt),
          status: record.status,
          isToday,
          hasAttendance: true
        };
      } else {
        // Derive absence (only for past workdays, not today)
        const isAbsent = !isToday && isWorkday(day.date);
        return {
          date: day.date,
          dateStr: day.dateStr,
          inTime: null,
          status: isAbsent ? 'absent' : null,
          isToday,
          hasAttendance: false
        };
      }
    });
  };

  // Check if a date is a workday (Mon-Fri by default)
  const isWorkday = (date) => {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  };

  // Format date for history table
  const formatHistoryDate = (date) => {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  // Format time for history table
  const formatHistoryTime = (date) => {
    const options = { hour: '2-digit', minute: '2-digit', hour12: true };
    return date.toLocaleTimeString('en-US', options);
  };

  const historyData = getHistoryData();
  const hasHistoryData = historyData.some(d => d.hasAttendance || d.status === 'absent');

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
        
        {/* Success Card */}
        <div className="bg-white rounded-2xl p-8 mb-5 shadow-sm text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Attendance Confirmed!
          </h1>
          <p className="text-gray-600 text-sm">
            {currentUser ? `Great job, ${currentUser.name}! Your attendance has been recorded.` : 'Your attendance has been recorded.'}
          </p>
        </div>

        {/* Attendance Details Card */}
        <div className="bg-white rounded-2xl p-6 mb-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-700 mb-5 text-center">
            📋 Attendance Details
          </h3>

          {/* Date */}
          <div className="flex justify-between items-center py-3 border-b border-gray-100">
            <span className="text-gray-600 text-sm">Date</span>
            <span className="font-semibold text-gray-800 text-sm">{formatAttendanceDate()}</span>
          </div>

          {/* In-Time */}
          <div className="flex justify-between items-center py-3 border-b border-gray-100">
            <span className="text-gray-600 text-sm">In-Time</span>
            <span className="font-semibold text-gray-800 text-sm">{formatAttendanceTime()}</span>
          </div>

          {/* Status */}
          <div className="flex justify-between items-center py-3 border-b border-gray-100">
            <span className="text-gray-600 text-sm">Status</span>
            <StatusBadge status={attendance.status} showTooltip={true} />
          </div>

          {/* Location Verified */}
          <div className="flex justify-between items-center py-3">
            <span className="text-gray-600 text-sm">Location Verified</span>
            <span className="font-semibold text-gray-800 text-sm">
              ✅ Yes ({Math.round(attendance.distanceMeters)}m)
            </span>
          </div>
        </div>

        {/* Locked Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-center text-blue-700 text-sm">
          <span className="mr-2">🔒</span>
          Attendance is locked for today. See you tomorrow!
        </div>

        {/* Attendance History (Last 7 Days) */}
        <div className="bg-white rounded-2xl p-6 mb-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-700 mb-4 text-center">
            📅 Last 7 Days
          </h3>

          {hasHistoryData ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2.5 px-2 border-b-2 border-gray-200 text-gray-500 font-semibold text-xs uppercase">
                      Date
                    </th>
                    <th className="text-left py-2.5 px-2 border-b-2 border-gray-200 text-gray-500 font-semibold text-xs uppercase">
                      In-Time
                    </th>
                    <th className="text-left py-2.5 px-2 border-b-2 border-gray-200 text-gray-500 font-semibold text-xs uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map((row) => (
                    <tr
                      key={row.dateStr}
                      className={row.isToday ? 'bg-blue-50' : ''}
                    >
                      <td className="py-3 px-2 border-b border-gray-100 text-gray-800">
                        {formatHistoryDate(row.date)}
                        {row.isToday && (
                          <span className="text-xs text-blue-600 font-medium ml-1">(Today)</span>
                        )}
                      </td>
                      <td className="py-3 px-2 border-b border-gray-100 text-gray-800">
                        {row.inTime ? formatHistoryTime(row.inTime) : '—'}
                      </td>
                      <td className="py-3 px-2 border-b border-gray-100">
                        {row.status ? (
                          <StatusBadge status={row.status} size="sm" showTooltip={true} />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-sm">No attendance history yet</p>
            </div>
          )}
        </div>

        {/* Back Link (logout) */}
        <button
          onClick={handleLogout}
          className="block w-full text-center text-indigo-600 hover:underline font-medium text-sm"
        >
          ← Back to Login
        </button>
      </div>
    </div>
  );
}

export default Confirmation;
