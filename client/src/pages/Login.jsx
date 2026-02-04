import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Auth from '../services/auth';

/**
 * Login Page - Matches original index.html behavior exactly
 * 
 * Behavior:
 * - Form with email and password fields
 * - On submit: call Auth.login()
 * - Success: redirect to role-appropriate page
 * - Error: show error message
 * - If already logged in: redirect to default page (handled by ProtectedRoute)
 */
function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous messages
    setMessage({ text: '', type: '' });
    
    // Disable button during login
    setIsLoading(true);
    
    // Attempt login
    const result = Auth.login(email.trim(), password);
    
    if (result.success) {
      // Show success message briefly
      setMessage({ text: 'Login successful! Redirecting...', type: 'success' });
      
      // Redirect to role-appropriate page
      setTimeout(() => {
        navigate(Auth.getDefaultRoute());
      }, 500);
    } else {
      // Show error message
      setMessage({ text: result.message, type: 'error' });
      
      // Re-enable button
      setIsLoading(false);
    }
  };

  const handleInputChange = (setter) => (e) => {
    setter(e.target.value);
    // Clear error on input
    setMessage({ text: '', type: '' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-indigo-500 to-purple-600 p-5">
      {/* Phase indicator */}
      <div className="fixed top-2.5 right-2.5 bg-white/90 px-3 py-1.5 rounded-full text-xs font-semibold text-purple-600">
        Phase 1 Demo
      </div>
      
      {/* Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            🏢 Nexon Attendance
          </h1>
          <p className="text-gray-600 text-sm">
            Location-based attendance system
          </p>
        </div>
        
        {/* Error/Success Message */}
        {message.text && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}
            role="alert"
          >
            {message.text}
          </div>
        )}
        
        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={handleInputChange(setEmail)}
              placeholder="Enter your email"
              autoComplete="email"
              required
              className="w-full px-4 py-3 text-base border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-colors"
            />
          </div>
          
          <div className="mb-4">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={handleInputChange(setPassword)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              className="w-full px-4 py-3 text-base border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-colors"
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3.5 text-lg font-semibold rounded-lg text-white mt-2.5 transition-colors ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-500 hover:bg-indigo-600'
            }`}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        {/* Demo Credentials */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm">
          <h6 className="font-semibold text-gray-600 mb-2.5">
            📋 Login Credentials
          </h6>
          <div>
            <strong>Admin:</strong>{' '}
            <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">
              admin@company.com
            </code>{' '}
            /{' '}
            <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">
              admin123
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
