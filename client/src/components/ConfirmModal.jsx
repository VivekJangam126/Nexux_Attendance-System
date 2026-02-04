/**
 * Confirm Modal Component
 * Matches original settings.html confirmation modal
 * 
 * Props:
 * - isOpen: boolean
 * - title: string
 * - message: string
 * - type: 'warning' | 'danger'
 * - confirmLabel: string
 * - onConfirm: function
 * - onCancel: function
 */
function ConfirmModal({ isOpen, title, message, type = 'warning', confirmLabel = 'Confirm', onConfirm, onCancel }) {
  if (!isOpen) return null;

  const headerClass = type === 'danger' ? 'text-red-800' : 'text-yellow-700';
  const buttonClass = type === 'danger' 
    ? 'bg-red-500 hover:bg-red-600' 
    : 'bg-yellow-500 hover:bg-yellow-600';

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-1000 p-5"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white rounded-xl max-w-100 w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className={`text-lg font-semibold ${headerClass}`}>{title}</h3>
        </div>

        {/* Body */}
        <div className="p-5 text-gray-600 text-[0.95rem]">
          <p>{message}</p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex gap-2.5 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-md text-white ${buttonClass} transition-colors`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
