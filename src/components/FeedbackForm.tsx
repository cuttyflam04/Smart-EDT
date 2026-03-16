import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  ChevronDown,
  Info
} from 'lucide-react';
import { submitFeedback, FeedbackType, FeedbackSeverity } from '../services/feedbackService';

interface FeedbackFormProps {
  onClose: () => void;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({ onClose }) => {
  const [type, setType] = useState<FeedbackType>('idea');
  const [severity, setSeverity] = useState<FeedbackSeverity>('low');
  const [category, setCategory] = useState('Général');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = [
    'Général',
    'Interface (UI)',
    'Performance',
    'Emploi du temps',
    'Compte / Profil',
    'Autre'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await submitFeedback({
        type,
        severity: type === 'bug' ? severity : undefined,
        category,
        title,
        description
      });
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError("Impossible d'envoyer le feedback. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-12 text-center space-y-4"
      >
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
          <CheckCircle2 size={32} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold">Merci !</h3>
          <p className="text-[var(--text-secondary)]">Votre retour a été enregistré avec succès.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Type Selection */}
      <div className="flex p-1 bg-[var(--surface-secondary)] rounded-2xl">
        {[
          { id: 'idea', label: 'Idée', icon: <Lightbulb size={16} />, color: 'text-amber-600', bg: 'bg-amber-100' },
          { id: 'bug', label: 'Bug', icon: <Bug size={16} />, color: 'text-red-600', bg: 'bg-red-100' },
          { id: 'other', label: 'Autre', icon: <MessageSquare size={16} />, color: 'text-blue-600', bg: 'bg-blue-100' }
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setType(item.id as FeedbackType)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              type === item.id 
                ? `${item.bg} ${item.color} shadow-sm` 
                : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Category */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
            Catégorie
          </label>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-accent)]"
            >
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
          </div>
        </div>

        {/* Severity (Only for bugs) */}
        <AnimatePresence mode="wait">
          {type === 'bug' && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-2"
            >
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                Priorité
              </label>
              <div className="relative">
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as FeedbackSeverity)}
                  className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-accent)]"
                >
                  <option value="low">Basse</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                  <option value="critical">Critique</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Sujet
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type === 'bug' ? "Ex: L'export PDF ne fonctionne pas" : "Ex: Ajouter un mode sombre"}
          className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-accent)]"
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Description détaillée
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Dites-nous en plus..."
          rows={4}
          className="w-full bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-accent)] resize-none"
          required
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting || !title || !description}
          className="w-full bg-[var(--color-brand-accent)] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[var(--color-brand-accent)]/20"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Send size={18} />
              Envoyer le retour
            </>
          )}
        </button>
      </div>

      <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-600 rounded-xl text-[10px]">
        <Info size={14} className="shrink-0" />
        <p>Vos informations système (appareil, version) sont automatiquement jointes pour nous aider.</p>
      </div>
    </form>
  );
};
