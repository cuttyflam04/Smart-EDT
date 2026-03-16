import React from 'react';
import { motion } from 'motion/react';
import { 
  MessageSquare, 
  Phone,
  Info
} from 'lucide-react';

interface FeedbackFormProps {
  whatsappNumber?: string;
  onClose: () => void;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({ whatsappNumber = "33600000000" }) => {
  const handleWhatsAppFeedback = () => {
    const phoneNumber = whatsappNumber;
    const message = `Bonjour,

Je vous contacte depuis l’application SMART EDT.

Type de feedback :
[Bug / Suggestion / Problème d’emploi du temps / Autre]

Classe ou filière :
[à compléter par l’utilisateur]

Description du problème ou de la suggestion :
[à compléter]

Merci.`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="space-y-8 py-4">
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
          <MessageSquare size={40} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold">Besoin d'aide ?</h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-[280px]">
            Signalez un bug, proposez une idée ou posez une question directement via WhatsApp.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <button
          type="button"
          onClick={handleWhatsAppFeedback}
          className="w-full bg-[#25D366] text-white py-5 rounded-[2rem] font-bold flex items-center justify-center gap-3 hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-[#25D366]/30"
        >
          <Phone size={22} />
          <span className="text-lg">Ouvrir WhatsApp</span>
        </button>

        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl text-xs leading-relaxed">
          <Info size={18} className="shrink-0 mt-0.5" />
          <p>
            Un message pré-rempli sera généré. Il vous suffira de compléter les informations manquantes avant d'envoyer.
          </p>
        </div>
      </div>
    </div>
  );
};
