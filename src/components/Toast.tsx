import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Bug, Loader2, X } from 'lucide-react';
import { cn } from '../lib/utils';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastProps {
  key?: string | number;
  message: string;
  type: 'success' | 'error' | 'info';
  onDismiss: () => void;
}

export function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const styles = {
    success: 'bg-emerald-950/90 text-emerald-50 border-emerald-500/20',
    error: 'bg-rose-950/90 text-rose-50 border-rose-500/20',
    info: 'bg-sky-950/90 text-sky-50 border-sky-500/20'
  }[type];

  const iconColor = {
    success: 'text-emerald-400',
    error: 'text-rose-400',
    info: 'text-sky-400'
  }[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={cn(
        "px-3.5 py-2 backdrop-blur-xl border rounded-full text-xs font-semibold shadow-2xl flex items-center gap-2.5 pointer-events-auto min-w-[180px] max-w-[85vw]",
        styles
      )}
    >
      <div className={cn("shrink-0", iconColor)}>
        {type === 'success' && <CheckCircle2 size={16} />}
        {type === 'error' && <Bug size={16} />}
        {type === 'info' && <Loader2 size={16} className="animate-spin" />}
      </div>
      <span className="flex-1 truncate leading-none">{message}</span>
      <button onClick={onDismiss} className="p-1 hover:bg-white/10 rounded-full transition-all opacity-40 hover:opacity-100">
        <X size={12} />
      </button>
    </motion.div>
  );
}
