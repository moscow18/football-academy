import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ToastMessage, ToastType } from '../lib/types';

interface ToastState {
  toasts: ToastMessage[];
  toast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastState | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, removeToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-5 left-5 z-[9999] flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            className={`toast-enter cursor-pointer flex items-center gap-3 px-5 py-3.5 rounded-lg text-white font-semibold text-sm min-w-[300px] shadow-lg
              ${t.type === 'success' ? 'bg-gradient-to-l from-emerald-600 to-emerald-500' : ''}
              ${t.type === 'error' ? 'bg-gradient-to-l from-red-600 to-red-500' : ''}
              ${t.type === 'warning' ? 'bg-gradient-to-l from-amber-600 to-amber-500' : ''}
              ${t.type === 'info' ? 'bg-gradient-to-l from-blue-600 to-blue-500' : ''}
            `}
          >
            <span className="text-base">
              {t.type === 'success' && '✓'}
              {t.type === 'error' && '✕'}
              {t.type === 'warning' && '⚠'}
              {t.type === 'info' && 'ℹ'}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
