/**
 * StatusBadge Component
 * 
 * Displays attendance status with appropriate styling
 * 
 * Props:
 * - status: 'on_time' | 'slightly_late' | 'late' | 'absent'
 * - size: 'sm' | 'md' (default: 'md')
 * - showTooltip: boolean (default: false)
 */
function StatusBadge({ status, size = 'md', showTooltip = false }) {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'on_time':
        return {
          label: 'On Time',
          className: 'bg-green-100 text-green-800 border-green-200',
          tooltip: 'Marked before office in-time'
        };
      case 'slightly_late':
        return {
          label: 'Slightly Late',
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          tooltip: 'Marked within grace period'
        };
      case 'late':
        return {
          label: 'Late',
          className: 'bg-red-100 text-red-800 border-red-200',
          tooltip: 'Marked after grace period'
        };
      case 'absent':
        return {
          label: 'Absent',
          className: 'bg-gray-100 text-gray-500 border-gray-200',
          tooltip: 'No attendance marked for the day'
        };
      default:
        return {
          label: status,
          className: 'bg-gray-100 text-gray-800 border-gray-200',
          tooltip: 'Status information'
        };
    }
  };

  const config = getStatusConfig(status);
  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs' 
    : 'px-3.5 py-1.5 text-sm';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full font-semibold border ${sizeClasses} ${config.className}`}
      >
        {config.label}
      </span>
      {showTooltip && (
        <span className="relative group cursor-help">
          <span className="text-sm opacity-70 hover:opacity-100">ℹ️</span>
          <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg">
            {config.tooltip}
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></span>
          </span>
        </span>
      )}
    </span>
  );
}

export default StatusBadge;
