import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Storage from '../services/storage';
import { Settings as SettingsService } from '../services/settings';
import { LocationService, LocationStatus } from '../services/location';
import { Auth } from '../services/auth';
import ConfirmModal from '../components/ConfirmModal';

/**
 * Settings Page - Matches original settings.html behavior exactly
 * 
 * Features:
 * - Office config form (lat, lng, radius, timings, grace)
 * - Radius presets (50m / 80m / 150m)
 * - "Use My Current Location" button
 * - User management table (add / activate / deactivate / delete)
 * - Safety rules: No self-delete, No deleting last admin
 * - Custom confirmation modal
 * - Reset Demo Data functionality
 */

// Helper to get initial form data from config (lazy initializer)
function getInitialFormData() {
  const config = SettingsService.getConfig();
  return {
    latitude: config.latitude?.toString() || '',
    longitude: config.longitude?.toString() || '',
    radiusMeters: config.radiusMeters?.toString() || '',
    inTime: config.inTime || '',
    outTime: config.outTime || '',
    gracePeriodMinutes: config.gracePeriodMinutes?.toString() || ''
  };
}

// Helper to get initial sorted users (lazy initializer)
function getInitialUsers() {
  const allUsers = Storage.getUsers();
  const roleOrder = { admin: 1, management: 2, employee: 3 };
  return allUsers.slice().sort((a, b) => {
    return (roleOrder[a.role] || 4) - (roleOrder[b.role] || 4);
  });
}

function Settings() {
  const navigate = useNavigate();
  const currentUser = Auth.getCurrentUser();

  // ==================== FORM STATE (lazy initialized from localStorage) ====================
  const [formData, setFormData] = useState(getInitialFormData);
  const [formErrors, setFormErrors] = useState({});
  const [formMessage, setFormMessage] = useState({ text: '', type: '' });

  // ==================== LOCATION STATE ====================
  const [locationStatus, setLocationStatus] = useState({ show: false, type: '', text: '' });
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // ==================== USER MANAGEMENT STATE (lazy initialized from localStorage) ====================
  const [users, setUsers] = useState(getInitialUsers);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'employee' });
  const [userMessage, setUserMessage] = useState({ text: '', type: '' });

  // ==================== MODAL STATE ====================
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    confirmLabel: 'Confirm',
    onConfirm: () => {}
  });

  // ==================== RELOAD FUNCTION (for use after mutations) ====================
  const reloadUsers = () => {
    setUsers(getInitialUsers());
  };

  // No useEffect needed for initial load - using lazy initialization

  // ==================== FORM HANDLERS ====================
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleRadiusPreset = (radius) => {
    setFormData(prev => ({ ...prev, radiusMeters: radius.toString() }));
    setFormErrors(prev => ({ ...prev, radiusMeters: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormMessage({ text: '', type: '' });
    setFormErrors({});

    const result = SettingsService.saveConfig(formData);

    if (result.success) {
      setFormMessage({ text: result.message, type: 'success' });
      setTimeout(() => setFormMessage({ text: '', type: '' }), 3000);
    } else {
      setFormMessage({ text: result.message, type: 'error' });
      // Map errors to fields
      const errors = {};
      result.errors?.forEach(err => {
        errors[err.field] = err.message;
      });
      setFormErrors(errors);
    }
  };

  // ==================== LOCATION HANDLER ====================
  const handleUseCurrentLocation = async () => {
    setIsGettingLocation(true);
    setLocationStatus({ show: true, type: 'loading', text: 'Requesting location access...' });

    try {
      const result = await LocationService.getCurrentLocation();

      if (result.status === LocationStatus.SUCCESS) {
        setFormData(prev => ({
          ...prev,
          latitude: result.latitude.toFixed(6),
          longitude: result.longitude.toFixed(6)
        }));
        setFormErrors(prev => ({ ...prev, latitude: '', longitude: '' }));
        setLocationStatus({
          show: true,
          type: 'success',
          text: `✅ Location captured! Accuracy: ±${Math.round(result.accuracy)} meters`
        });
        // Hide after 5 seconds
        setTimeout(() => setLocationStatus({ show: false, type: '', text: '' }), 5000);
      } else {
        setLocationStatus({
          show: true,
          type: 'error',
          text: '❌ ' + (result.message || LocationService.getStatusMessage(result.status))
        });
      }
    } catch {
      setLocationStatus({
        show: true,
        type: 'error',
        text: '❌ Failed to get location. Please try again.'
      });
    }

    setIsGettingLocation(false);
  };

  // ==================== USER MANAGEMENT HANDLERS ====================
  const handleNewUserChange = (e) => {
    const { name, value } = e.target;
    setNewUser(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateUser = () => {
    const { name, email, password, role } = newUser;

    // Validate
    if (!name.trim()) {
      setUserMessage({ text: 'Please enter a name', type: 'error' });
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setUserMessage({ text: 'Please enter a valid email', type: 'error' });
      return;
    }
    if (!password || password.length < 4) {
      setUserMessage({ text: 'Password must be at least 4 characters', type: 'error' });
      return;
    }

    const result = Storage.addUser({ name: name.trim(), email: email.trim(), password, role });

    if (result.success) {
      setUserMessage({ text: `User "${name}" created successfully!`, type: 'success' });
      setShowAddForm(false);
      setNewUser({ name: '', email: '', password: '', role: 'employee' });
      reloadUsers();
      setTimeout(() => setUserMessage({ text: '', type: '' }), 3000);
    } else {
      setUserMessage({ text: result.message, type: 'error' });
    }
  };

  const handleCancelAddUser = () => {
    setShowAddForm(false);
    setNewUser({ name: '', email: '', password: '', role: 'employee' });
    setUserMessage({ text: '', type: '' });
  };

  // ==================== USER ACTIONS ====================
  const confirmDeactivate = (userId) => {
    const user = Storage.getUserById(userId);
    if (!user) return;

    setModal({
      isOpen: true,
      title: '⚠️ Deactivate User',
      message: `Deactivate "${user.name}"? They will no longer be able to log in.`,
      type: 'warning',
      confirmLabel: 'Deactivate',
      onConfirm: () => deactivateUser(userId)
    });
  };

  const deactivateUser = (userId) => {
    const user = Storage.getUserById(userId);
    if (!user) return;

    const result = Storage.updateUser(userId, { isActive: false });

    if (result.success) {
      setUserMessage({ text: `User "${user.name}" deactivated`, type: 'success' });
      reloadUsers();
      setTimeout(() => setUserMessage({ text: '', type: '' }), 3000);
    } else {
      setUserMessage({ text: result.message || 'Failed to deactivate user', type: 'error' });
    }
    closeModal();
  };

  const activateUser = (userId) => {
    const user = Storage.getUserById(userId);
    if (!user) return;

    const result = Storage.updateUser(userId, { isActive: true });

    if (result.success) {
      setUserMessage({ text: `User "${user.name}" activated`, type: 'success' });
      reloadUsers();
      setTimeout(() => setUserMessage({ text: '', type: '' }), 3000);
    } else {
      setUserMessage({ text: result.message || 'Failed to activate user', type: 'error' });
    }
  };

  const confirmDelete = (userId) => {
    const user = Storage.getUserById(userId);
    if (!user) return;

    setModal({
      isOpen: true,
      title: '🗑️ Delete User',
      message: `Permanently delete "${user.name}"? This will also remove their attendance records. This action cannot be undone.`,
      type: 'danger',
      confirmLabel: 'Delete',
      onConfirm: () => deleteUser(userId)
    });
  };

  const deleteUser = (userId) => {
    const user = Storage.getUserById(userId);
    if (!user) return;

    const result = Storage.deleteUser(userId);

    if (result.success) {
      setUserMessage({ text: `User "${user.name}" deleted`, type: 'success' });
      reloadUsers();
      setTimeout(() => setUserMessage({ text: '', type: '' }), 3000);
    } else {
      setUserMessage({ text: result.message, type: 'error' });
    }
    closeModal();
  };

  const closeModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  // ==================== RESET DEMO DATA ====================
  const handleResetDemoData = () => {
    const result = SettingsService.resetDemoData();
    if (result.success) {
      Auth.logout();
      navigate('/');
    }
  };

  // ==================== LOGOUT ====================
  const handleLogout = (e) => {
    e.preventDefault();
    Auth.logout();
    navigate('/');
  };

  // ==================== HELPERS ====================
  const activeAdmins = users.filter(u => u.role === 'admin' && u.isActive !== false).length;

  const getRoleClass = (role) => {
    switch (role) {
      case 'admin': return 'bg-amber-100 text-amber-700';
      case 'management': return 'bg-indigo-100 text-indigo-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

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
            <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">
              Admin
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
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md text-gray-600 hover:bg-gray-100"
            >
              Reports
            </Link>
            <Link
              to="/settings"
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md bg-indigo-600 text-white"
            >
              Settings
            </Link>
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
      <div className="max-w-xl mx-auto p-5">
        
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">⚙️ System Settings</h1>
          <p className="text-gray-600 text-sm">Configure office location, timings, and attendance rules</p>
        </div>

        {/* Form Message */}
        {formMessage.text && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            formMessage.type === 'success' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {formMessage.text}
          </div>
        )}

        {/* User Management Section */}
        <div className="bg-white rounded-xl shadow-sm mb-5 overflow-hidden">
          <div className="bg-gray-50 px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">👥 User Management</h2>
            <p className="text-xs text-gray-600 mt-1">Add, view, and remove system users</p>
          </div>
          <div className="p-5">
            {/* User Message */}
            {userMessage.text && (
              <div className={`mb-3 p-2.5 rounded-lg text-sm ${
                userMessage.type === 'success' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {userMessage.text}
              </div>
            )}

            {/* Add User Form */}
            {showAddForm && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex flex-wrap gap-3 mb-3">
                  <div className="flex-1 min-w-37.5">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={newUser.name}
                      onChange={handleNewUserChange}
                      placeholder="e.g., John Doe"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex-1 min-w-37.5">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={newUser.email}
                      onChange={handleNewUserChange}
                      placeholder="e.g., john@company.com"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mb-3">
                  <div className="flex-1 min-w-37.5">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                    <input
                      type="text"
                      name="password"
                      value={newUser.password}
                      onChange={handleNewUserChange}
                      placeholder="Enter password"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex-1 min-w-37.5">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                    <select
                      name="role"
                      value={newUser.role}
                      onChange={handleNewUserChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                      <option value="management">Management</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2.5 justify-end">
                  <button
                    type="button"
                    onClick={handleCancelAddUser}
                    className="px-4 py-2 text-sm rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateUser}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-green-500 text-white hover:bg-green-600"
                  >
                    Create User
                  </button>
                </div>
              </div>
            )}

            {/* Add User Button */}
            {!showAddForm && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="px-5 py-2.5 text-sm font-semibold rounded-md bg-green-500 text-white hover:bg-green-600"
              >
                ➕ Add New User
              </button>
            )}

            {/* Users Table */}
            <div className="mt-4 overflow-x-auto">
              {users.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => {
                      const isCurrentUser = currentUser && currentUser.userId === user.id;
                      const isActive = user.isActive !== false;
                      const isLastActiveAdmin = user.role === 'admin' && isActive && activeAdmins <= 1;

                      return (
                        <tr key={user.id} className="border-b border-gray-100 last:border-b-0">
                          <td className="py-3 px-3 text-sm font-medium text-gray-800">
                            {user.name}
                            {isCurrentUser && <em className="text-gray-500 ml-1">(you)</em>}
                          </td>
                          <td className="py-3 px-3 text-sm text-gray-600">{user.email}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getRoleClass(user.role)}`}>
                              {capitalize(user.role)}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {isCurrentUser ? (
                              <span className="text-gray-400 text-xs">You</span>
                            ) : isLastActiveAdmin ? (
                              <span className="text-gray-400 text-xs">Last Admin</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {isActive ? (
                                  <button
                                    onClick={() => confirmDeactivate(user.id)}
                                    className="px-2.5 py-1 text-xs rounded bg-amber-100 text-amber-700 hover:bg-amber-200"
                                  >
                                    Deactivate
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => activateUser(user.id)}
                                    className="px-2.5 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200"
                                  >
                                    Activate
                                  </button>
                                )}
                                <button
                                  onClick={() => confirmDelete(user.id)}
                                  className="px-2.5 py-1 text-xs rounded bg-red-100 text-red-800 hover:bg-red-200"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="py-8 text-center text-gray-400">
                  No users found. Add your first user above.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Office Location Settings */}
        <div className="bg-white rounded-xl shadow-sm mb-5 overflow-hidden">
          <div className="bg-gray-50 px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">📍 Office Location</h2>
            <p className="text-xs text-gray-600 mt-1">Set the GPS coordinates and allowed radius for attendance</p>
          </div>
          <div className="p-5">
            <form onSubmit={handleSubmit}>
              {/* Use Current Location */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isGettingLocation}
                  className="w-full py-3 text-sm font-semibold rounded-lg bg-indigo-100 border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white disabled:bg-gray-100 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isGettingLocation ? '⏳ Getting Location...' : '📍 Use My Current Location'}
                </button>
                <p className="text-xs text-gray-500 mt-1">Click to auto-fill latitude and longitude from your current position</p>
                
                {locationStatus.show && (
                  <div className={`mt-2 p-2.5 rounded-md text-sm ${
                    locationStatus.type === 'loading' ? 'bg-indigo-100 text-indigo-700' :
                    locationStatus.type === 'success' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {locationStatus.text}
                  </div>
                )}
              </div>

              {/* Lat/Lng Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleInputChange}
                    step="any"
                    placeholder="e.g., 28.6139"
                    className={`w-full px-3.5 py-2.5 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.latitude ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Range: -90 to +90</p>
                  {formErrors.latitude && <p className="text-xs text-red-600 mt-1">{formErrors.latitude}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleInputChange}
                    step="any"
                    placeholder="e.g., 77.2090"
                    className={`w-full px-3.5 py-2.5 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.longitude ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Range: -180 to +180</p>
                  {formErrors.longitude && <p className="text-xs text-red-600 mt-1">{formErrors.longitude}</p>}
                </div>
              </div>

              {/* Radius */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Allowed Radius</label>
                <div className="flex flex-wrap gap-2 mb-2.5">
                  {[
                    { value: 50, label: 'Small Office (50m)' },
                    { value: 80, label: 'Medium Office (80m)' },
                    { value: 150, label: 'Large Office (150m)' }
                  ].map(preset => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => handleRadiusPreset(preset.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                        formData.radiusMeters === String(preset.value)
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-indigo-100 hover:border-indigo-600 hover:text-indigo-600'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex">
                  <input
                    type="number"
                    name="radiusMeters"
                    value={formData.radiusMeters}
                    onChange={handleInputChange}
                    min="20"
                    max="500"
                    placeholder="e.g., 80"
                    className={`flex-1 px-3.5 py-2.5 text-base border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.radiusMeters ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <span className="px-4 py-2.5 bg-gray-50 border border-l-0 border-gray-300 rounded-r-lg text-gray-600 text-sm">
                    meters
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Click a preset or enter a custom value. Range: 20m - 500m.</p>
                {formErrors.radiusMeters && <p className="text-xs text-red-600 mt-1">{formErrors.radiusMeters}</p>}
              </div>

              {/* Divider */}
              <div className="flex items-center my-5 text-gray-400 text-xs">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="px-3">Office Timings</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              {/* In/Out Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Office In-Time</label>
                  <input
                    type="time"
                    name="inTime"
                    value={formData.inTime}
                    onChange={handleInputChange}
                    className={`w-full px-3.5 py-2.5 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.inTime ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Attendance before this = On Time</p>
                  {formErrors.inTime && <p className="text-xs text-red-600 mt-1">{formErrors.inTime}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Office Out-Time</label>
                  <input
                    type="time"
                    name="outTime"
                    value={formData.outTime}
                    onChange={handleInputChange}
                    className={`w-full px-3.5 py-2.5 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.outTime ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Absence calculated after this time</p>
                  {formErrors.outTime && <p className="text-xs text-red-600 mt-1">{formErrors.outTime}</p>}
                </div>
              </div>

              {/* Grace Period */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period</label>
                <div className="flex">
                  <input
                    type="number"
                    name="gracePeriodMinutes"
                    value={formData.gracePeriodMinutes}
                    onChange={handleInputChange}
                    min="0"
                    max="60"
                    placeholder="e.g., 15"
                    className={`flex-1 px-3.5 py-2.5 text-base border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.gracePeriodMinutes ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <span className="px-4 py-2.5 bg-gray-50 border border-l-0 border-gray-300 rounded-r-lg text-gray-600 text-sm">
                    minutes
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Arrival within grace period = Slightly Late (not Late)</p>
                {formErrors.gracePeriodMinutes && <p className="text-xs text-red-600 mt-1">{formErrors.gracePeriodMinutes}</p>}
              </div>

              {/* Save Button */}
              <button
                type="submit"
                className="w-full py-3 text-base font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                💾 Save Settings
              </button>
            </form>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl shadow-sm border-2 border-red-200 overflow-hidden">
          <div className="bg-red-50 px-5 py-4 border-b border-red-200">
            <h2 className="text-base font-semibold text-red-800">⚠️ Danger Zone</h2>
          </div>
          <div className="p-5">
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800 mb-4">
              <strong>Warning:</strong> This will reset ALL data including attendance records, 
              settings, and users back to demo defaults. You will be logged out.
            </div>
            <button
              type="button"
              onClick={handleResetDemoData}
              className="w-full py-3 text-base font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              🔄 Reset Demo Data
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        confirmLabel={modal.confirmLabel}
        onConfirm={modal.onConfirm}
        onCancel={closeModal}
      />
    </div>
  );
}

export default Settings;
