import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Storage from '../services/storage';
import { AttendanceService, AttendanceStatus } from '../services/attendance';
import { Auth, Roles } from '../services/auth';
import StatusBadge from '../components/StatusBadge';

/**
 * Dashboard Page - Matches original dashboard.html behavior exactly
 * 
 * Behavior:
 * - Summary cards (Arrived / On Time / Slightly Late / Late)
 * - Attendance table with status badges
 * - Auto-refresh every 30 seconds
 * - Admin view: GPS accuracy warnings, late employees panel
 * - Management view: Executive cards (Weekly On-Time Rate, Late Summary), Trend Insights
 * - Derived absence logic (post out-time)
 */
function Dashboard() {
  const navigate = useNavigate();
  const currentUser = Auth.getCurrentUser();
  const isAdmin = currentUser?.role === Roles.ADMIN;
  const isManagement = currentUser?.role === Roles.MANAGEMENT;

  // Time state
  const [currentTime, setCurrentTime] = useState('--:--:--');
  const [currentDate, setCurrentDate] = useState('Loading...');
  
  // Refresh timer state
  const [refreshCountdown, setRefreshCountdown] = useState(30);
  
  // Dashboard data state
  const [summaryData, setSummaryData] = useState({
    arrived: 0,
    onTime: 0,
    slightlyLate: 0,
    late: 0
  });
  
  const [lateEmployees, setLateEmployees] = useState([]);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [hasEmployees, setHasEmployees] = useState(true);
  
  // Management-specific state
  const [weeklyOnTimeRate, setWeeklyOnTimeRate] = useState('--');
  const [lateSummary, setLateSummary] = useState({ count: 0, names: [] });
  const [trendInsight, setTrendInsight] = useState({ show: false, text: '' });

  // Load dashboard data
  const loadDashboardData = useCallback(() => {
    const today = Storage.getTodayDate();
    const employees = Storage.getEmployees();
    const todayAttendance = Storage.getAttendanceByDate(today);
    const officeConfig = Storage.getOfficeConfig();

    // Build attendance map for quick lookup
    const attendanceMap = {};
    todayAttendance.forEach(record => {
      attendanceMap[record.userId] = record;
    });

    // Calculate summary counts
    let arrived = 0;
    let onTime = 0;
    let slightlyLate = 0;
    let late = 0;
    const lateEmps = [];

    todayAttendance.forEach(record => {
      arrived++;
      if (record.status === AttendanceStatus.ON_TIME) onTime++;
      else if (record.status === AttendanceStatus.SLIGHTLY_LATE) slightlyLate++;
      else if (record.status === AttendanceStatus.LATE) {
        late++;
        const emp = employees.find(e => e.id === record.userId);
        if (emp) {
          lateEmps.push({
            name: emp.name,
            markedAt: record.markedAt
          });
        }
      }
    });

    setSummaryData({ arrived, onTime, slightlyLate, late });
    
    // Sort late employees by time (most recent first)
    lateEmps.sort((a, b) => new Date(b.markedAt) - new Date(a.markedAt));
    setLateEmployees(lateEmps);

    // Build table rows
    if (employees.length === 0) {
      setHasEmployees(false);
      setAttendanceRows([]);
      return;
    }

    setHasEmployees(true);

    // Sort employees: arrived first, then pending/absent
    const sortedEmployees = employees.slice().sort((a, b) => {
      const aHasAttendance = attendanceMap[a.id] ? 1 : 0;
      const bHasAttendance = attendanceMap[b.id] ? 1 : 0;
      return bHasAttendance - aHasAttendance;
    });

    // Generate row data
    const rows = sortedEmployees.map(employee => {
      const attendance = attendanceMap[employee.id];
      return generateRowData(employee, attendance, officeConfig);
    });

    setAttendanceRows(rows);
  }, []);

  // Generate row data for an employee
  const generateRowData = (employee, attendance, officeConfig) => {
    const now = new Date();
    const currentHour = now.getHours();
    const outHour = parseInt(officeConfig.outTime.split(':')[0]);

    if (attendance) {
      const markedTime = new Date(attendance.markedAt);
      const inTime = markedTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const hasLowAccuracy = attendance.accuracyMeters &&
        attendance.accuracyMeters > officeConfig.radiusMeters;

      return {
        id: employee.id,
        name: employee.name,
        inTime,
        status: attendance.status,
        distance: Math.round(attendance.distanceMeters),
        hasLowAccuracy,
        accuracyMeters: attendance.accuracyMeters ? Math.round(attendance.accuracyMeters) : null,
        hasAttendance: true
      };
    } else {
      // No attendance - determine Pending or Absent
      const status = currentHour >= outHour ? 'absent' : 'pending';
      return {
        id: employee.id,
        name: employee.name,
        inTime: '-',
        status,
        distance: null,
        hasLowAccuracy: false,
        accuracyMeters: null,
        hasAttendance: false
      };
    }
  };

  // Analyze late arrival patterns (helper - used by loadManagementInsights)
  const analyzeLateArrivalPattern = (lateRecords) => {
    const timeWindows = {};

    lateRecords.forEach(record => {
      const time = new Date(record.markedAt);
      const hours = time.getHours();
      const minutes = Math.floor(time.getMinutes() / 10) * 10;
      const windowKey = `${hours}:${minutes.toString().padStart(2, '0')}`;
      timeWindows[windowKey] = (timeWindows[windowKey] || 0) + 1;
    });

    let maxCount = 0;
    let maxWindow = '';

    Object.keys(timeWindows).forEach(window => {
      if (timeWindows[window] > maxCount) {
        maxCount = timeWindows[window];
        maxWindow = window;
      }
    });

    if (maxWindow && maxCount >= 2) {
      const [hours, mins] = maxWindow.split(':').map(Number);
      const endMins = mins + 10;
      const formatTime = (h, m) => {
        const period = h >= 12 ? 'PM' : 'AM';
        const hour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
      };
      const startTime = formatTime(hours, mins);
      const endTime = formatTime(hours, endMins >= 60 ? 0 : endMins);
      return `⏰ Most late arrivals occur between ${startTime}–${endTime}`;
    }

    return '📊 Tracking attendance patterns for better insights.';
  };

  // Load Management-specific insights
  const loadManagementInsights = useCallback(() => {
    const employees = Storage.getEmployees();
    const allAttendance = Storage.getAttendance();
    const officeConfig = Storage.getOfficeConfig();
    const today = Storage.getTodayDate();

    // Calculate weekly on-time percentage
    const todayDate = new Date(today + 'T00:00:00');
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const dayOfWeek = d.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        days.push(d.toISOString().split('T')[0]);
      }
    }
    let totalRecords = 0;
    let onTimeRecords = 0;
    days.forEach(dateStr => {
      const dayRecords = allAttendance.filter(a => a.date === dateStr);
      dayRecords.forEach(record => {
        totalRecords++;
        if (record.status === 'on_time') {
          onTimeRecords++;
        }
      });
    });
    if (totalRecords > 0) {
      setWeeklyOnTimeRate(Math.round((onTimeRecords / totalRecords) * 100) + '%');
    } else {
      setWeeklyOnTimeRate('N/A');
    }

    // Update simplified late summary for today
    const todayRecords = allAttendance.filter(a => a.date === today && a.status === 'late');
    if (todayRecords.length === 0) {
      setLateSummary({ count: 0, names: [] });
    } else {
      const names = todayRecords.map(record => {
        const emp = employees.find(e => e.id === record.userId);
        return emp ? emp.name.split(' ')[0] : 'Unknown';
      });
      setLateSummary({ count: todayRecords.length, names });
    }

    // Generate trend insight
    const thisWeekDates = [];
    const lastWeekDates = [];
    for (let i = 0; i < 7; i++) {
      const d1 = new Date(todayDate);
      d1.setDate(d1.getDate() - i);
      thisWeekDates.push(d1.toISOString().split('T')[0]);
      const d2 = new Date(todayDate);
      d2.setDate(d2.getDate() - 7 - i);
      lastWeekDates.push(d2.toISOString().split('T')[0]);
    }
    const thisWeekRecords = allAttendance.filter(a => thisWeekDates.includes(a.date));
    const lastWeekRecords = allAttendance.filter(a => lastWeekDates.includes(a.date));
    const thisWeekOnTime = thisWeekRecords.filter(a => a.status === 'on_time').length;
    const lastWeekOnTime = lastWeekRecords.filter(a => a.status === 'on_time').length;
    const thisWeekRate = thisWeekRecords.length > 0 ? (thisWeekOnTime / thisWeekRecords.length) : 0;
    const lastWeekRate = lastWeekRecords.length > 0 ? (lastWeekOnTime / lastWeekRecords.length) : 0;
    const lateRecords = allAttendance.filter(a => a.status === 'late');

    let insight = '';
    if (thisWeekRecords.length >= 3 && lastWeekRecords.length >= 3) {
      if (thisWeekRate > lastWeekRate + 0.05) {
        const improvement = Math.round((thisWeekRate - lastWeekRate) * 100);
        insight = `📈 On-time rate improved by ${improvement}% compared to last week.`;
      } else if (thisWeekRate < lastWeekRate - 0.05) {
        const decline = Math.round((lastWeekRate - thisWeekRate) * 100);
        insight = `📉 On-time rate decreased by ${decline}% compared to last week.`;
      } else if (lateRecords.length >= 3) {
        insight = analyzeLateArrivalPattern(lateRecords, officeConfig);
      } else {
        insight = '✅ Attendance patterns are stable this week.';
      }
    } else if (lateRecords.length >= 2) {
      insight = analyzeLateArrivalPattern(lateRecords, officeConfig);
    } else if (thisWeekRecords.length > 0) {
      const onTimePercent = Math.round(thisWeekRate * 100);
      insight = `📊 Current week on-time rate: ${onTimePercent}%`;
    } else {
      setTrendInsight({ show: false, text: '' });
      return;
    }
    setTrendInsight({ show: true, text: insight });
  }, []);

  // Update date and time
  const updateDateTime = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    setCurrentTime(timeStr);

    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setCurrentDate(now.toLocaleDateString('en-US', dateOptions));
  };

  // Handle logout
  const handleLogout = (e) => {
    e.preventDefault();
    Auth.logout();
    navigate('/');
  };

  // Initialize page
  useEffect(() => {
    updateDateTime();
    const clockInterval = setInterval(updateDateTime, 1000);

    loadDashboardData();
    if (isManagement) {
      loadManagementInsights();
    }

    return () => clearInterval(clockInterval);
  }, [loadDashboardData, loadManagementInsights, isManagement]);

  // Auto-refresh timer
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          loadDashboardData();
          if (isManagement) {
            loadManagementInsights();
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(refreshInterval);
  }, [loadDashboardData, loadManagementInsights, isManagement]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Phase indicator */}
      <div className="fixed bottom-2.5 right-2.5 bg-black/70 px-3 py-1.5 rounded-full text-xs font-semibold text-white z-50">
        Phase 1 Demo
      </div>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="px-4 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-lg font-bold text-indigo-600">🏢 Nexon Attendance</span>
            <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-700 rounded-full">
              {currentUser?.role?.charAt(0).toUpperCase() + currentUser?.role?.slice(1)}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/dashboard"
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md bg-indigo-600 text-white"
            >
              Dashboard
            </Link>
            <Link
              to="/reports"
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md text-gray-600 hover:bg-gray-100"
            >
              Reports
            </Link>
            {isAdmin && (
              <Link
                to="/settings"
                className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md text-gray-600 hover:bg-gray-100"
              >
                Settings
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-red-500 text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-5">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
          <div className="text-center sm:text-left mb-4 sm:mb-0">
            <h1 className="text-2xl font-bold text-gray-800">📊 Attendance Dashboard</h1>
            <p className="text-gray-600 text-sm">Real-time attendance overview</p>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-3xl font-bold text-indigo-600 font-mono">{currentTime}</div>
            <div className="text-sm text-gray-600">{currentDate}</div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-bold text-indigo-600">{summaryData.arrived}</div>
            <div className="text-xs text-gray-600 mt-1">Arrived Today</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-bold text-green-500">{summaryData.onTime}</div>
            <div className="text-xs text-gray-600 mt-1">On Time</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-bold text-yellow-500">{summaryData.slightlyLate}</div>
            <div className="text-xs text-gray-600 mt-1">Slightly Late</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-bold text-red-500">{summaryData.late}</div>
            <div className="text-xs text-gray-600 mt-1">Late</div>
          </div>
        </div>

        {/* Management Executive Section */}
        {isManagement && (
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Weekly On-Time Rate */}
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">📈</span>
                  <h3 className="text-sm font-semibold text-gray-600">Weekly On-Time Rate</h3>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-bold text-green-500">{weeklyOnTimeRate}</span>
                  <span className="text-sm text-gray-600">on time this week</span>
                </div>
                <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                  ℹ️ "On Time" means attendance marked before the scheduled office in-time.
                </div>
              </div>

              {/* Late Arrivals Today */}
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">⏰</span>
                  <h3 className="text-sm font-semibold text-gray-600">Late Arrivals Today</h3>
                </div>
                {lateSummary.count === 0 ? (
                  <p className="text-green-500 font-medium">✅ No late arrivals today!</p>
                ) : (
                  <>
                    <p className="text-gray-800">
                      <strong className="text-red-500 text-xl">{lateSummary.count}</strong> employee{lateSummary.count > 1 ? 's' : ''} arrived late today
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {lateSummary.names.map((name, idx) => (
                        <span key={idx} className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-medium">
                          {name}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Trend Insight */}
            {trendInsight.show && (
              <div className="mt-4 bg-linear-to-r from-indigo-100 to-indigo-50 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">💡</span>
                <span className="text-indigo-700 font-medium text-sm">{trendInsight.text}</span>
              </div>
            )}
          </div>
        )}

        {/* Late Panel (Admin only) */}
        {isAdmin && lateEmployees.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-red-700">⏰ Who Is Late Today</h3>
              <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                {lateEmployees.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lateEmployees.map((emp, idx) => (
                <div key={idx} className="bg-white border border-red-200 rounded-lg px-3 py-2 flex items-center gap-3">
                  <span className="font-semibold text-gray-800 text-sm">{emp.name}</span>
                  <span className="text-red-600 text-xs font-mono">
                    {new Date(emp.markedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attendance Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-base font-semibold text-gray-800">👥 Employee Attendance</h2>
            <span className="text-xs text-gray-400">Auto-refresh in {refreshCountdown}s</span>
          </div>

          {hasEmployees && attendanceRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Employee</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">In-Time</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-50 last:border-b-0">
                      <td className="py-3.5 px-4 font-semibold text-gray-800 text-sm">{row.name}</td>
                      <td className="py-3.5 px-4 text-gray-700 text-sm">{row.inTime}</td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={row.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-sm">
                        {row.hasAttendance ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-600">{row.distance}m</span>
                            {isAdmin && row.hasLowAccuracy && (
                              <span className="relative group cursor-help">
                                <span className="text-sm">⚠️</span>
                                <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg">
                                  Low GPS accuracy (±{row.accuracyMeters}m) — location may be approximate
                                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></span>
                                </span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-base text-gray-600">No attendance records yet today</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
