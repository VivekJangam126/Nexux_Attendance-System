/**
 * StatusBadge Component
 * 
 * Displays attendance status with appropriate styling
 * 
 * Props:
 * - status: 'on_time' | 'slightly_late' | 'late'
 */
function StatusBadge({ status }) {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'on_time':
        return {
          label: 'On Time',
          className: 'bg-green-100 text-green-800 border-green-200'
        };
      case 'slightly_late':
        return {
          label: 'Slightly Late',
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        };
      case 'late':
        return {
          label: 'Late',
          className: 'bg-red-100 text-red-800 border-red-200'
        };
      default:
        return {
          label: status,
          className: 'bg-gray-100 text-gray-800 border-gray-200'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export default StatusBadge;
