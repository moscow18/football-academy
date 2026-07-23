import Modal from './Modal';
import { AlertTriangle, Trash2, Info } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'تأكيد الإجراء',
  cancelText = 'إلغاء',
  variant = 'danger',
  isLoading = false,
}: ConfirmModalProps) {
  const iconMap = {
    danger: <Trash2 className="w-8 h-8 text-red-600" />,
    warning: <AlertTriangle className="w-8 h-8 text-amber-600" />,
    info: <Info className="w-8 h-8 text-blue-600" />,
  };

  const bgMap = {
    danger: 'bg-red-50 border-red-100',
    warning: 'bg-amber-50 border-amber-100',
    info: 'bg-blue-50 border-blue-100',
  };

  const buttonMap = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    info: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex items-center gap-3 w-full justify-end font-[Cairo]">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 shadow-sm cursor-pointer ${buttonMap[variant]}`}
          >
            {isLoading ? 'جاري التنفيذ...' : confirmText}
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center py-2 font-[Cairo]">
        <div className={`w-16 h-16 rounded-2xl ${bgMap[variant]} border flex items-center justify-center mb-4`}>
          {iconMap[variant]}
        </div>
        <p className="text-slate-600 text-sm font-medium leading-relaxed whitespace-pre-line">
          {message}
        </p>
      </div>
    </Modal>
  );
}
