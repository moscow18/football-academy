import { createContext, useContext, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import Modal from '../components/ui/Modal';
import { useToast } from './ToastContext';

interface PasswordContextType {
  requirePassword: () => Promise<boolean>;
}

const PasswordContext = createContext<PasswordContextType | undefined>(undefined);

export function PasswordProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState('');
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const { toast } = useToast();

  const requirePassword = () => {
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  };

  const handleConfirm = () => {
    // Hardcoded generic system password for VFC Academy actions.
    // In production, this could be an environment variable or checked against the backend.
    if (password === 'VFC123') {
      setIsOpen(false);
      if (resolveRef.current) resolveRef.current(true);
    } else {
      toast('error', 'كلمة المرور غير صحيحة');
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolveRef.current) resolveRef.current(false);
  };

  return (
    <PasswordContext.Provider value={{ requirePassword }}>
      {children}
      <Modal isOpen={isOpen} onClose={handleCancel} title="تأكيد كلمة المرور">
        <div className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="أدخل كلمة المرور"
          />
          <div className="flex justify-end gap-2">
            <button onClick={handleCancel} className="px-4 py-2 text-gray-600">إلغاء</button>
            <button onClick={handleConfirm} className="px-4 py-2 bg-blue-600 text-white rounded">تأكيد</button>
          </div>
        </div>
      </Modal>
    </PasswordContext.Provider>
  );
}

export function usePasswordConfirm() {
  const context = useContext(PasswordContext);
  if (context === undefined) {
    throw new Error('usePasswordConfirm must be used within a PasswordProvider');
  }
  return context;
}
