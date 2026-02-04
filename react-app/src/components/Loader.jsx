/**
 * Loader Component
 * 
 * Simple loading spinner for async operations
 * 
 * Props:
 * - size: 'sm' | 'md' | 'lg' (default: 'md')
 * - text: Optional loading text to display
 */
function Loader({ size = 'md', text }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizeClasses[size]} border-indigo-200 border-t-indigo-600 rounded-full animate-spin`}
      />
      {text && <p className="text-gray-600 text-sm">{text}</p>}
    </div>
  );
}

export default Loader;
