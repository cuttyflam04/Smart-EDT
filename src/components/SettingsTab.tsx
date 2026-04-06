import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { Shield, Phone, CheckCircle2, Link2, Cpu, Loader2, Copy, Edit2, Wand2, Type, Eraser, Maximize, Undo, Scan } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { cn } from '../lib/utils';

interface SettingsTabProps {
  key?: string | number;
  activeTab: string;
  autoRotateEnabled: boolean;
  setAutoRotateEnabled: (enabled: boolean) => void;
  isDarkMode: boolean;
  setIsDarkMode: (enabled: boolean) => void;
  isDeveloperMode: boolean;
  setIsDeveloperMode: (enabled: boolean) => void;
  whatsappNumber: string;
  setWhatsappNumber: (num: string) => void;
  logoLinkEnabled: boolean;
  setLogoLinkEnabled: (enabled: boolean) => void;
  logoLinkUrl: string;
  setLogoLinkUrl: (url: string) => void;
  onCapturePage: () => void;
  isCapturing: boolean;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  enabledFeatures: any;
  setEnabledFeatures: (features: any) => void;
}

export function SettingsTab({ 
  activeTab,
  autoRotateEnabled, 
  setAutoRotateEnabled, 
  isDarkMode, 
  setIsDarkMode, 
  isDeveloperMode, 
  setIsDeveloperMode, 
  whatsappNumber, 
  setWhatsappNumber, 
  logoLinkEnabled, 
  setLogoLinkEnabled, 
  logoLinkUrl, 
  setLogoLinkUrl, 
  onCapturePage, 
  isCapturing, 
  addNotification, 
  enabledFeatures, 
  setEnabledFeatures
}: SettingsTabProps) {
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  if (activeTab !== 'settings') return null;

  return (
    <motion.div
      key="settings-view"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-md space-y-8"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Réglages</h2>
        <p className="text-sm text-[var(--text-secondary)]">Personnalisez votre expérience Smart EDT.</p>
      </div>
      
      <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-sm">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-bold">Rotation automatique</p>
              <p className="text-sm text-[var(--text-secondary)]">Pivote l'interface d'édition sur mobile</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={autoRotateEnabled}
                onChange={(e) => setAutoRotateEnabled(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-brand-accent)]"></div>
            </label>
          </div>

          <div className="h-px bg-[var(--border)]" />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-bold">Mode sombre</p>
              <p className="text-sm text-[var(--text-secondary)]">Interface plus sombre pour la nuit</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={isDarkMode}
                onChange={(e) => setIsDarkMode(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-brand-accent)]"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Support & Diagnostic section removed */}
      {/* Support & Diagnostic section removed */}

      {isDeveloperMode && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Shield size={20} />
              <h3 className="font-bold text-lg">Dashboard Admin</h3>
            </div>
            <button 
              onClick={() => {
                setIsDeveloperMode(false);
              }}
              className="text-[10px] font-bold text-amber-600/60 uppercase hover:text-amber-600 transition-colors"
            >
              Quitter le mode admin
            </button>
          </div>

           <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 space-y-8">
              {/* WhatsApp Config */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone size={18} className="text-amber-600" />
                    <p className="font-bold">Configuration WhatsApp</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-amber-600/60 uppercase ml-1">Numéro (Format international sans +)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="Ex: 33612345678"
                      className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none text-sm focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                    />
                    <button 
                      onClick={() => {
                        localStorage.setItem('smartedt_whatsapp', whatsappNumber);
                        addNotification('Numéro WhatsApp sauvegardé localement !', 'success');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-amber-600 text-white rounded-lg hover:brightness-95 transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="h-px bg-amber-200 dark:bg-amber-800/40" />

              {/* Logo Hypertexte */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 size={18} className="text-amber-600" />
                    <p className="font-bold">Logo Hypertexte</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={logoLinkEnabled}
                      onChange={(e) => setLogoLinkEnabled(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 opacity-50 peer-enabled:opacity-100"></div>
                  </label>
                </div>
                
                {logoLinkEnabled && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-amber-600/60 uppercase ml-1">URL du lien</p>
                    <input 
                      type="text" 
                      value={logoLinkUrl}
                      onChange={(e) => setLogoLinkUrl(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-50"
                      placeholder="https://example.com"
                    />
                  </div>
                )}
              </div>

              <div className="h-px bg-amber-200 dark:bg-amber-800/40" />

              {/* Tools & Status */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu size={18} className="text-amber-600" />
                    <p className="font-bold">Outils & Status</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-2xl border border-[var(--border)]">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold">Capture d'écran</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">Capture de la page actuelle</p>
                    </div>
                    <button 
                      onClick={onCapturePage}
                      disabled={isCapturing}
                      className="px-4 py-2 bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-bold hover:bg-amber-200 transition-colors disabled:opacity-50"
                    >
                      {isCapturing ? <Loader2 size={14} className="animate-spin" /> : 'Capturer'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-2xl border border-[var(--border)]">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold">Debug Info</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">Copier les infos système</p>
                    </div>
                    <button 
                      onClick={() => {
                        const info = {
                          ua: navigator.userAgent,
                          url: window.location.href,
                          origin: window.location.origin,
                          platform: Capacitor.getPlatform()
                        };
                        navigator.clipboard.writeText(JSON.stringify(info, null, 2));
                        addNotification('Infos copiées !', 'success');
                      }}
                      className="px-4 py-2 bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold hover:bg-blue-200 transition-colors"
                    >
                      Copier
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-sm">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-bold text-lg">Fonctionnalités de l'éditeur</h3>
              <p className="text-sm text-[var(--text-secondary)]">Désactivez les outils inutiles pour simplifier l'interface.</p>
            </div>
          </div>
          
          <div className="space-y-6">
            {[
              { id: 'removeText', label: 'Effacer Texte', description: 'Supprime intelligemment le texte en conservant le fond.', icon: <Edit2 size={16} /> },
              { id: 'removeColor', label: 'Effacer Couleur', description: 'Baguette magique pour effacer une couleur spécifique.', icon: <Wand2 size={16} /> },
              { id: 'wordBox', label: 'Word Box', description: 'Ajoute des boîtes de texte stylisées avec mise en page.', icon: <Type size={16} /> },
              { id: 'eraser', label: 'Gomme', description: 'Remplace une zone par du blanc (outil classique).', icon: <Eraser size={16} /> },
              { id: 'zoom', label: 'Zoom & Pan', description: 'Permet de naviguer et de zoomer sur l\'image.', icon: <Maximize size={16} /> },
              { id: 'undoRedo', label: 'Annuler/Rétablir', description: 'Boutons pour revenir en arrière ou rétablir une action.', icon: <Undo size={16} /> },
              { id: 'ocr', label: 'Scan Texte (OCR)', description: 'Extrait le texte de l\'image pour le copier.', icon: <Scan size={16} />, wip: true },
            ].map((feature) => (
              <div key={feature.id} className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-[var(--surface)] rounded-xl text-[var(--text-secondary)] shrink-0">
                      {feature.icon}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="font-bold leading-none">{feature.label}</p>
                        {(feature as any).wip && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[8px] font-black uppercase tracking-tighter border border-amber-200 dark:border-amber-800/50">
                            WIP
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-tight">{feature.description}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={(enabledFeatures as any)[feature.id]}
                      onChange={(e) => setEnabledFeatures((prev: any) => ({ ...prev, [feature.id]: e.target.checked }))}
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-brand-accent)]"></div>
                  </label>
                </div>
                
                {feature.id === 'wordBox' && enabledFeatures.wordBox && (
                  <div className="ml-13 p-3 bg-[var(--surface)] rounded-2xl flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold">Version simplifiée</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">Masque les options de mise en page avancées.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={enabledFeatures.wordBoxSimplified}
                        onChange={(e) => setEnabledFeatures((prev: any) => ({ ...prev, wordBoxSimplified: e.target.checked }))}
                      />
                      <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-brand-accent)]"></div>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-center space-y-2 pb-8">
        <button 
          onMouseDown={() => {
            longPressTimer.current = setTimeout(() => {
              setIsDeveloperMode(true);
              alert('Mode Développeur activé ! 🛠️');
            }, 5000);
          }}
          onMouseUp={() => {
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
          }}
          onMouseLeave={() => {
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
          }}
          onTouchStart={() => {
            longPressTimer.current = setTimeout(() => {
              setIsDeveloperMode(true);
              alert('Mode Développeur activé ! 🛠️');
            }, 5000);
          }}
          onTouchEnd={() => {
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
          }}
          className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-opacity"
        >
          Smart EDT v1.5.0
        </button>
      </div>
    </motion.div>
  );
}
