import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

const ToastCtx = createContext({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s, { id, message, type }].slice(-4));
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  const Icon = { success: CheckCircle2, error: AlertTriangle, info: Info };
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" role="status">
        {items.map((t) => {
          const I = Icon[t.type] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <I size={18} aria-hidden="true" />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
