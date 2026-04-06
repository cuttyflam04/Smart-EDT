import React from 'react';
import { motion } from 'motion/react';
import { Construction, Hammer } from 'lucide-react';

interface AccountTabProps {
  key?: string | number;
  activeTab: string;
  setActiveTab: (tab: 'home' | 'account' | 'settings' | 'feedback') => void;
}

export function AccountTab({ activeTab, setActiveTab }: AccountTabProps) {
  if (activeTab !== 'account') return null;
  return (
    <motion.div
      key="account-view"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-2xl mx-auto py-12"
    >
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3rem] p-12 text-center space-y-8 shadow-xl relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-[var(--color-brand-accent)]/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full translate-x-1/4 translate-y-1/4 blur-3xl" />
        
        <div className="relative space-y-6">
          <motion.div 
            animate={{ 
              rotate: [0, -10, 10, -10, 0],
              y: [0, -5, 0]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-24 h-24 bg-[var(--bg)] rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-[var(--border)]"
          >
            <Construction size={48} className="text-[var(--color-brand-accent)]" />
          </motion.div>
          
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tight">Espace Personnel</h2>
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[var(--color-brand-accent)]/10 text-[var(--color-brand-accent)] text-xs font-bold uppercase tracking-wider">
              <Hammer size={12} />
              En cours de construction
            </div>
          </div>
          
          <p className="text-[var(--text-secondary)] text-lg max-w-md mx-auto leading-relaxed">
            Nous préparons un espace dédié pour sauvegarder et synchroniser tous vos emplois du temps.
          </p>
          
          <div className="pt-4">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
              <div className="w-2 h-2 rounded-full bg-[var(--color-brand-accent)] animate-pulse" />
              Lancement prévu prochainement
            </div>
          </div>

          <button 
            onClick={() => setActiveTab('home')}
            className="mt-8 px-8 py-3 bg-[var(--text)] text-[var(--bg)] rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    </motion.div>
  );
}
