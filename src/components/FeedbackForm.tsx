import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  Bug, 
  Lightbulb, 
  Calendar, 
  MoreHorizontal, 
  Check,
  X
} from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FeedbackFormProps {
  whatsappNumber?: string;
  onClose: () => void;
}

type FeedbackType = 'bug' | 'suggestion' | 'schedule' | 'other';

const FEEDBACK_TYPES = [
  { id: 'bug' as FeedbackType, label: 'Bug / Erreur', icon: Bug, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  { id: 'suggestion' as FeedbackType, label: 'Suggestion', icon: Lightbulb, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  { id: 'schedule' as FeedbackType, label: 'Emploi du temps', icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { id: 'other' as FeedbackType, label: 'Autre', icon: MoreHorizontal, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
];

export const FeedbackForm: React.FC<FeedbackFormProps> = ({ whatsappNumber = "33600000000", onClose }) => {
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
  const [description, setDescription] = useState('');
  const [followUp, setFollowUp] = useState<'yes' | 'no' | null>(null);

  const handleWhatsAppFeedback = () => {
    if (!selectedType) return;

    const typeLabel = FEEDBACK_TYPES.find(t => t.id === selectedType)?.label || selectedType;
    
    const message = `Bonjour,

Je vous contacte depuis l’application SMART EDT.

*Type de demande :* ${typeLabel}
*Suivi souhaité :* ${followUp === 'yes' ? 'Oui' : 'Non'}

*Description :*
${description || 'Pas de description supplémentaire.'}

Merci.`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="relative pt-4">
      {/* Close button like in the image */}
      <button 
        onClick={onClose}
        className="absolute -top-2 -right-2 p-2 rounded-full bg-white text-gray-500 hover:text-gray-900 transition-colors shadow-sm appearance-none -webkit-tap-highlight-color-transparent"
      >
        <X size={20} />
      </button>

      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text)]">Feedback</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Une question ou un problème ? Notre équipe vous répond directement sur WhatsApp.
          </p>
        </div>

        {/* Icon Selection (Like the emojis in image) */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-[var(--text)]">Que pensez-vous de nous ?</p>
            {selectedType && (
              <span className="text-[10px] font-bold text-[#F27D26] uppercase tracking-wider bg-[#F27D26]/10 px-2 py-0.5 rounded-full">
                {FEEDBACK_TYPES.find(t => t.id === selectedType)?.label}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center gap-2 px-2">
            {FEEDBACK_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                title={type.label}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-300 relative group aspect-square w-14 appearance-none -webkit-tap-highlight-color-transparent ${
                  selectedType === type.id 
                    ? 'border-[#F27D26] bg-[#F27D26]/5 scale-110 shadow-md' 
                    : 'border-transparent bg-white hover:border-gray-200'
                }`}
              >
                <div className={`${type.color} transition-transform group-hover:scale-110`}>
                  <type.icon size={24} strokeWidth={selectedType === type.id ? 2.5 : 2} />
                </div>
                {selectedType === type.id && (
                  <div className="absolute -top-1 -right-1 bg-[#F27D26] text-white rounded-full p-0.5 shadow-sm">
                    <Check size={10} strokeWidth={4} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Text Area */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-[var(--text)]">Avez-vous des idées à partager ?</label>
            <span className={cn(
              "text-[10px] font-mono",
              description.length > 400 ? "text-red-500" : "text-[var(--text-secondary)]"
            )}>
              {description.length}/500
            </span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            placeholder="Détaillez votre demande ici..."
            rows={4}
            className="w-full px-4 py-3 bg-white border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-sm focus:ring-2 focus:ring-[#F27D26]/20 focus:border-[#F27D26] transition-all resize-none shadow-sm appearance-none -webkit-tap-highlight-color-transparent"
          />
        </div>

        {/* Follow up */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[var(--text)]">Pouvons-nous vous recontacter ?</p>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${followUp === 'yes' ? 'border-[#F27D26] bg-[#F27D26]' : 'border-gray-300 dark:border-gray-600 group-hover:border-gray-400'}`}>
                <input 
                  type="radio" 
                  className="sr-only" 
                  name="followup" 
                  checked={followUp === 'yes'} 
                  onChange={() => setFollowUp('yes')} 
                />
                {followUp === 'yes' && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text)] transition-colors">Oui</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${followUp === 'no' ? 'border-[#F27D26] bg-[#F27D26]' : 'border-gray-300 dark:border-gray-600 group-hover:border-gray-400'}`}>
                <input 
                  type="radio" 
                  className="sr-only" 
                  name="followup" 
                  checked={followUp === 'no'} 
                  onChange={() => setFollowUp('no')} 
                />
                {followUp === 'no' && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text)] transition-colors">Non</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleWhatsAppFeedback}
            disabled={!selectedType}
            className="flex-1 bg-[#F27D26] text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[#F27D26]/20 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
          >
            {/* WhatsApp Logo SVG */}
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            Envoyer
          </button>
          <button
            onClick={onClose}
            className="px-8 py-3.5 rounded-xl font-bold border-2 border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-all appearance-none -webkit-tap-highlight-color-transparent"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};
