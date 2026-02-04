import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Storage from '../services/storage';
import { Auth, Roles } from '../services/auth';
import StatusBadge from '../components/StatusBadge';

/**
 * Reports Page - Matches original reports.html behavior exactly
 * 
 * Features:
 * - Date range filters (default: last 7 days)
 * - Employee filter (All / specific employee)
 * - Derived absence logic (never stored)
 * - Status badges (On Time / Slightly Late / Late / Absent)
 * - Summary stats (counts)
 * - CSV export (frontend-only)
 * - Admin & Management access only
 */
function Reports() {
  const navigate = useNavigate();
  const currentUser = Auth.getCurrentUser();
  const isManagement = currentUser?.role === Roles.MANAGEMENT;

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [employees, setEmployees] = useState([]);

  // Report data state
  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({
    onTime: 0,
    slightlyLate: 0,
    late: 0,
    absent: 0
  });

  // ==================== HELPERS ====================
  const formatDateForInput = (date) => {
    return date.toISOString().split('T')[0];
  };

  // ==================== LOAD FUNCTIONS ====================
  const initDateFilters = useCallback(() => {
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);

    setEndDate(formatDateForInput(today));
    setStartDate(formatDateForInput(weekAgo));
  }, []);

  const loadEmployees = useCallback(() => {
    const emps = Storage.getEmployees();
    setEmployees(emps);
  }, []);

  // ==================== INITIALIZATION ====================
  useEffect(() => {
    initDateFilters();
    loadEmployees();
  }, [initDateFilters, loadEmployees]);

  // Load initial report after filters are set
  useEffect(() => {
    if (startDate && endDate) {
      loadReport();
    }
  }, [startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDisplayDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // ==================== LOAD REPORT ====================
  const loadReport = useCallback(() => {
    if (!startDate || !endDate) {
      return;
    }

    if (startDate > endDate) {
      alert('Start date must be before end date');
      return;
    }

    // Get employees based on filter
    const filteredEmployees = employeeFilter === 'all'
      ? Storage.getEmployees()
      : Storage.getEmployees().filter(e => e.id === employeeFilter);

    // Get all attendance records
    const allAttendance = Storage.getAttendance();

    // Build attendance map
    const attendanceMap = {};
    allAttendance.forEach(record => {
      const key = `${record.userId}_${record.date}`;
      attendanceMap[key] = record;
    });

    // Generate report data
    const data = [];
    const today = Storage.getTodayDate();
    const now = new Date();
    const currentHour = now.getHours();
    const officeConfig = Storage.getOfficeConfig();
    const outHour = parseInt(officeConfig.outTime.split(':')[0]);

    // Iterate through date range
    let currentDate = new Date(startDate + 'T00:00:00');
    const endDateObj = new Date(endDate + 'T00:00:00');

    while (currentDate <= endDateObj) {
      const dateStr = formatDateForInput(currentDate);

      filteredEmployees.forEach(employee => {
        const key = `${employee.id}_${dateStr}`;
        const attendance = attendanceMap[key];

        let status, inTime;

        if (attendance) {
          // Has attendance record
          status = attendance.status;
          inTime = new Date(attendance.markedAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
        } else {
          // No attendance - determine if Absent
          // Absent if: date is before today, OR (date is today AND time >= outTime)
          const isPastDate = dateStr < today;
          const isTodayAfterOut = (dateStr === today && currentHour >= outHour);

          if (isPastDate || isTodayAfterOut) {
            status = 'absent';
            inTime = '—';
          } else {
            // Skip future dates or today before out time (pending)
            // Don't include pending in reports
            return;
          }
        }

        data.push({
          date: dateStr,
          dateFormatted: formatDisplayDate(dateStr),
          employeeId: employee.id,
          employeeName: employee.name,
          inTime: inTime,
          status: status
        });
      });

      // Next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sort by date (newest first), then by employee name
    data.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return a.employeeName.localeCompare(b.employeeName);
    });

    setReportData(data);

    // Update summary
    let onTime = 0, slightlyLate = 0, late = 0, absent = 0;
    data.forEach(record => {
      switch (record.status) {
        case 'on_time': onTime++; break;
        case 'slightly_late': slightlyLate++; break;
        case 'late': late++; break;
        case 'absent': absent++; break;
        default: break;
      }
    });
    setSummary({ onTime, slightlyLate, late, absent });
  }, [startDate, endDate, employeeFilter]);

  // ==================== EXPORT CSV ====================
  const exportToCsv = () => {
    if (reportData.length === 0) return;

    // Build CSV content
    const headers = ['Date', 'Employee', 'In-Time', 'Status'];
    const rows = reportData.map(record => [
      record.date,
      record.employeeName,
      record.inTime,
      record.status.replace('_', ' ').toUpperCase()
    ]);

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const filename = `attendance_report_${startDate}_to_${endDate}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==================== HANDLERS ====================
  const handleApplyFilter = () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }
    loadReport();
  };

  const handleLogout = (e) => {
    e.preventDefault();
    Auth.logout();
    navigate('/');
  };

  const capitalize = (str) => str?.charAt(0).toUpperCase() + str?.slice(1);

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
              {capitalize(currentUser?.role)}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/dashboard"
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md text-gray-600 hover:bg-gray-100"
            >
              Dashboard
            </Link>
            <Link
              to="/reports"
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md bg-indigo-600 text-white"
            >
              Reports
            </Link>
            {!isManagement && (
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">📈 Attendance Reports</h1>
          <p className="text-gray-600 text-sm">View and export historical attendance data</p>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">🔍 Filter Records</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-37.5">
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex-1 min-w-37.5">
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex-1 min-w-37.5">
              <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleApplyFilter}
              className="px-5 py-2 text-sm font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Apply Filter
            </button>
            <button
              onClick={exportToCsv}
              disabled={reportData.length === 0}
              className="px-4 py-2 text-sm font-semibold rounded-md bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              📥 Export CSV
            </button>
          </div>
        </div>

        {/* Report Table Card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center flex-wrap gap-2.5">
            <h2 className="text-base font-semibold text-gray-800">📋 Attendance Records</h2>
            <span className="text-sm text-gray-600">
              {reportData.length} record{reportData.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Summary Stats */}
          {reportData.length > 0 && (
            <div className="flex flex-wrap gap-4 px-5 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                <span>On Time: <strong>{summary.onTime}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                <span>Slightly Late: <strong>{summary.slightlyLate}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span>Late: <strong>{summary.late}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-red-800"></span>
                <span>Absent: <strong>{summary.absent}</strong></span>
              </div>
            </div>
          )}

          {/* Table */}
          {reportData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Date</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Employee</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">In-Time</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((record, idx) => (
                    <tr key={`${record.employeeId}_${record.date}_${idx}`} className="border-b border-gray-50 last:border-b-0">
                      <td className="py-3.5 px-4 text-sm text-gray-700">{record.dateFormatted}</td>
                      <td className="py-3.5 px-4 text-sm font-semibold text-gray-800">{record.employeeName}</td>
                      <td className="py-3.5 px-4 text-sm text-gray-700">{record.inTime}</td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={record.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-base text-gray-600">No records found. Adjust filters and try again.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Reports;
