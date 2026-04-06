import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Edit2, Scan, Loader2, X, Copy, CheckCircle2, Calendar, Download, Image as ImageIcon, Send, Sparkles, Maximize, User } from 'lucide-react';
import { Document, Page } from 'react-pdf';
import { Capacitor } from '@capacitor/core';
import { cn } from '../lib/utils';

interface HomeTabProps {
  key?: string | number;
  activeTab: string;
  preview: string | null;
  processedPreview: string | null;
  ocrText: string | null;
  calendarEvents: any[] | null;
  isCopied: boolean;
  isCapturing: boolean;
  getRootProps: (props?: any) => any;
  getInputProps: (props?: any) => any;
  isDragActive: boolean;
  copyToClipboard: () => void;
  setOcrText: (text: string | null) => void;
  handleDownloadICS: () => void;
  setCalendarEvents: (events: any[] | null) => void;
  handleDownloadPdf: () => void;
  handleDownloadImage: () => void;
  handleShare: () => void;
  handleCapturePage: () => void;
  handleScanText: () => void;
  // Added missing props that were in App.tsx but not in HomeTab
  lastSavedEDT?: any;
  handleViewLibraryFile?: (file: any) => void;
  handleEditLibraryFile?: (file: any) => void;
  setLastSavedEDT?: (file: any) => void;
  addNotification?: (msg: string, type: string) => void;
  fileType?: string | null;
  setNumPages?: (num: number | null) => void;
  setPdfError?: (err: string | null) => void;
  numPages?: number | null;
  pdfError?: string | null;
  pdfContainerRef?: React.RefObject<HTMLDivElement>;
  containerWidth?: number;
  handleStartEditor?: () => void;
  isProcessing?: boolean;
  enabledFeatures?: any;
  isScanning?: boolean;
  scanProgress?: number;
  isGeneratingCalendar?: boolean;
}

export function HomeTab({ 
  activeTab,
  preview, 
  processedPreview, 
  ocrText, 
  calendarEvents, 
  isCopied, 
  isCapturing, 
  getRootProps, 
  getInputProps, 
  isDragActive, 
  copyToClipboard, 
  setOcrText, 
  handleDownloadICS, 
  setCalendarEvents, 
  handleDownloadPdf, 
  handleDownloadImage, 
  handleShare, 
  handleCapturePage,
  handleScanText,
  lastSavedEDT,
  handleViewLibraryFile,
  handleEditLibraryFile,
  setLastSavedEDT,
  addNotification,
  fileType,
  setNumPages,
  setPdfError,
  numPages,
  pdfError,
  pdfContainerRef,
  containerWidth,
  handleStartEditor,
  isProcessing,
  enabledFeatures,
  isScanning,
  scanProgress,
  isGeneratingCalendar
}: HomeTabProps) {
  if (activeTab !== 'home') return null;
  return (
    <motion.div
      key="home-view"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-2xl space-y-8"
    >
      {preview ? (
        <div className="space-y-6">
          <div className="bg-[var(--surface)] p-4 rounded-3xl border border-[var(--border)] shadow-sm overflow-hidden">
            {fileType === 'application/pdf' ? (
              <Document
                file={preview}
                onLoadError={(error) => console.error('PDF error:', error)}
                className="flex flex-col gap-4"
              >
                {pdfError ? (
                  <div className='text-red-500 p-4 bg-red-100 rounded-lg'>
                    <p><strong>Erreur de chargement du PDF:</strong></p>
                    <p>{pdfError}</p>
                  </div>
                ) : (
                  Array.from(new Array(numPages || 0), (el, index) => (
                    <div key={`page_${index + 1}`} className="max-w-full overflow-x-auto bg-white rounded-lg shadow-sm border border-black/5">
                      <Page 
                        pageNumber={index + 1} 
                        renderTextLayer={true} 
                        renderAnnotationLayer={true}
                        width={containerWidth}
                        className="max-w-full"
                      />
                    </div>
                  ))
                )}
              </Document>
            ) : (
              <img src={processedPreview || preview} alt="Aperçu de l'emploi du temps" className="w-full h-auto object-contain rounded-xl" />
            )}
          </div>

          <div className="w-full p-4 bg-[var(--surface)]/50 rounded-2xl border border-[var(--border)] flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={handleStartEditor}
              disabled={isProcessing}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-[var(--text)] text-[var(--bg)] hover:opacity-90 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Préparation...
                </>
              ) : (
                <>
                  <Edit2 size={20} />
                  {processedPreview ? "Continuer l'édition" : "Nettoyer l'EDT"}
                </>
              )}
            </button>

            {enabledFeatures.ocr && (
              <button
                onClick={handleScanText}
                disabled={isScanning}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface)] transition-all disabled:opacity-50 relative overflow-hidden group"
              >
                {isScanning ? (
                  <Loader2 size={20} className="animate-spin text-[var(--color-brand-accent)]" />
                ) : (
                  <Scan size={20} className="text-[var(--text-secondary)]" />
                )}
                <span className={cn(isScanning || isGeneratingCalendar ? "text-[var(--color-brand-accent)]" : "text-[var(--text-secondary)]")}>
                  {isScanning 
                    ? `Analyse (${Math.round(scanProgress * 100)}%)` 
                    : isGeneratingCalendar 
                      ? "Génération du calendrier..." 
                      : "Scanner le texte"}
                </span>
                <span className="absolute top-0 right-0 px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-black uppercase tracking-tighter rounded-bl-lg">
                  WIP
                </span>
              </button>
            )}

            {/* OCR Results Section */}
            <AnimatePresence>
              {ocrText && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="w-full mt-8 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-[var(--color-brand-accent)]/10 text-[var(--color-brand-accent)] rounded-lg">
                        <Scan size={20} />
                      </div>
                      <h3 className="font-bold text-lg">Texte Extrait</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyToClipboard}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all",
                          isCopied 
                            ? "bg-emerald-500 text-white" 
                            : "bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface)]"
                        )}
                      >
                        {isCopied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                        {isCopied ? "Copié !" : "Copier"}
                      </button>
                      <button
                        onClick={() => setOcrText(null)}
                        className="p-2 hover:bg-[var(--border)] rounded-lg transition-colors text-[var(--text-secondary)]"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-[var(--text)] leading-relaxed">
                      {ocrText}
                    </pre>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <Sparkles size={14} className="text-[var(--color-brand-accent)]" />
                    <span>Analysé intelligemment par l'IA</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Calendar Events Section */}
            <AnimatePresence>
              {calendarEvents && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full mt-8 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                        <Calendar size={20} />
                      </div>
                      <h3 className="font-bold text-lg">Événements Détectés</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDownloadICS}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20"
                      >
                        <Download size={16} />
                        Exporter (.ics)
                      </button>
                      <button
                        onClick={() => setCalendarEvents(null)}
                        className="p-2 hover:bg-[var(--border)] rounded-lg transition-colors text-[var(--text-secondary)]"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {calendarEvents.map((event, idx) => (
                      <motion.div
                        key={`${event.title}-${idx}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-2 hover:border-[var(--color-brand-accent)]/30 transition-colors group"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="font-bold text-[var(--text)] group-hover:text-[var(--color-brand-accent)] transition-colors line-clamp-2">
                            {event.title}
                          </h4>
                          {event.type && (
                            <span className="px-2 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                              {event.type}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-[var(--text-secondary)]">
                          <div className="flex items-center gap-1">
                            <Calendar size={12} className="text-amber-500" />
                            <span>{event.day}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Loader2 size={12} className="text-sky-500" />
                            <span>{event.startTime} - {event.endTime}</span>
                          </div>
                          {event.room && (
                            <div className="flex items-center gap-1">
                              <Maximize size={12} className="text-emerald-500" />
                              <span>{event.room}</span>
                            </div>
                          )}
                        </div>
                        {event.teacher && (
                          <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)] pt-1 border-t border-[var(--border)]/50">
                            <User size={12} />
                            <span className="italic">{event.teacher}</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {processedPreview && (
              <div className="w-full flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <button
                    onClick={handleDownloadPdf}
                    className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold bg-[var(--color-brand-accent)] text-white hover:brightness-95 transition-all shadow-lg shadow-[var(--color-brand-accent)]/20"
                  >
                    <Download size={20} />
                    Enregistrer PDF
                  </button>
                  
                  <button
                    onClick={handleDownloadImage}
                    className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--border)] transition-all"
                  >
                    <ImageIcon size={20} />
                    Enregistrer Image
                  </button>
                </div>

                {Capacitor.isNativePlatform() && (
                  <button
                    onClick={handleShare}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold bg-black text-white hover:brightness-95 transition-all"
                  >
                    <Send size={20} />
                    Partager l'EDT
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div 
          {...getRootProps()} 
          className={cn(
            "w-full aspect-video border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-12 transition-all cursor-pointer",
            isDragActive ? "border-[var(--color-brand-accent)] bg-[var(--color-brand-accent)]/5" : "border-black/20 hover:border-black/40"
          )}
        >
          <input {...getInputProps()} />
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto">
              <Upload className="text-[var(--text-secondary)]" />
            </div>
            <div>
              <p className="font-medium">Glissez votre PDF ou Image ici</p>
              <p className="text-sm text-[var(--text-secondary)]">PNG, JPG ou PDF jusqu'à 10MB</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
