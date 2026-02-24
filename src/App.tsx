/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Sparkles, Calendar, User, Settings, Wand2, Loader2, X, Edit2, Download, Image as ImageIcon } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ImageEditor from './components/ImageEditor';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorImageUrl, setEditorImageUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'account' | 'settings'>('home');
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (pdfContainerRef.current) {
        setContainerWidth(pdfContainerRef.current.clientWidth - 32); // 32px for padding
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [preview]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFileType(selectedFile.type);
      setProcessedPreview(null); // Reset processed image on new upload
      setNumPages(null);
      setPdfError(null);

      if (selectedFile.type === 'application/pdf') {
        setPreview(URL.createObjectURL(selectedFile));
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    },
    multiple: false
  } as any);

  const convertPdfToImage = async (fileUrl: string): Promise<string | null> => {
    try {
      const loadingTask = pdfjs.getDocument(fileUrl);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1); // Use first page
      const viewport = page.getViewport({ scale: 2.0 }); // High res for editing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({ canvasContext: ctx, viewport, canvasFactory: { create: (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }, reset: (c, w, h) => { c.width = w; c.height = h; }, destroy: () => {} } } as any).promise;
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.error("Error converting PDF to image:", e);
      return null;
    }
  };

  const handleOpenEditor = async () => {
    if (!preview) return;
    
    setIsProcessing(true);
    let imageUrlToEdit = processedPreview || preview;
    
    if (fileType === 'application/pdf' && !processedPreview) {
      const converted = await convertPdfToImage(preview);
      if (converted) {
        imageUrlToEdit = converted;
      }
    }
    
    setIsProcessing(false);
    setEditorImageUrl(imageUrlToEdit);
    setIsEditorOpen(true);
  };

  const handleSaveEdit = (editedImageUrl: string) => {
    setProcessedPreview(editedImageUrl);
    setFileType('image/png'); // Once edited, it's an image
    setIsEditorOpen(false);
  };

  const handleDownloadPdf = () => {
    if (!processedPreview) return;

    const img = new Image();
    img.onload = () => {
      const pdf = new jsPDF({
        orientation: img.width > img.height ? 'l' : 'p',
        unit: 'px',
        format: [img.width, img.height]
      });
      pdf.addImage(processedPreview, 'PNG', 0, 0, img.width, img.height);
      pdf.save('EDT_modifie.pdf');
    };
    img.src = processedPreview;
  };

  const handleDownloadImage = () => {
    if (!processedPreview) return;
    const link = document.createElement('a');
    link.href = processedPreview;
    link.download = 'EDT_modifie.png';
    link.click();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-brand-bg)] text-[var(--color-brand-primary)] font-sans">
      {/* Header */}
      <header className="p-4 grid grid-cols-3 items-center border-b border-black/10">
        <div className="w-10 h-10"> {/* Placeholder for left icon/button */}</div>
        <div className="flex justify-center items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white">
            <Sparkles size={16} />
          </div>
          <h1 className="text-xl font-display font-bold tracking-tight">Smart EDT</h1>
        </div>
        <div className="flex justify-end">
          <button 
            onClick={() => setActiveTab('settings')}
            className="p-2 hover:bg-black/5 rounded-full transition-colors"
          >
            <Settings size={20} className="text-[var(--color-brand-accent)]" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-6 md:p-12 flex flex-col items-center justify-center pb-24 md:pb-12">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="upload-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full space-y-8"
            >
              {preview ? (
                <div className="w-full flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Aperçu du document</h2>
                    <button 
                      onClick={() => {
                        setPreview(null);
                        setProcessedPreview(null);
                      }} 
                      className="flex items-center gap-2 px-4 py-2 bg-black/5 hover:bg-black/10 rounded-xl font-medium transition-colors"
                    >
                      <X size={18} />
                      Changer de fichier
                    </button>
                  </div>
                  
                  <div 
                    ref={pdfContainerRef}
                    className="w-full border-2 border-black/10 rounded-3xl overflow-hidden bg-white p-4 max-h-[70vh] overflow-y-auto"
                  >
                    {fileType === 'application/pdf' && !processedPreview ? (
                      <Document 
                        file={preview} 
                        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                        onLoadError={(error) => setPdfError(error.message)}
                        className="flex flex-col items-center gap-6"
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

                  <div className="w-full p-4 bg-white/50 rounded-2xl border border-black/10 flex flex-wrap items-center justify-center gap-4">
                    <button
                      onClick={handleOpenEditor}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-black text-white hover:brightness-95 transition-all disabled:bg-black/20 disabled:cursor-not-allowed"
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

                    {processedPreview && (
                      <>
                        <button
                          onClick={handleDownloadPdf}
                          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-[var(--color-brand-accent)] text-white hover:brightness-95 transition-all shadow-lg shadow-[var(--color-brand-accent)]/20"
                        >
                          <Download size={20} />
                          Sauvegarder PDF
                        </button>
                        
                        <button
                          onClick={handleDownloadImage}
                          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-white text-black border border-black/10 hover:bg-black/5 transition-all"
                        >
                          <ImageIcon size={20} />
                          Sauvegarder Image
                        </button>
                      </>
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
                      <Upload className="text-black/40" />
                    </div>
                    <div>
                      <p className="font-medium">Glissez votre PDF ou Image ici</p>
                      <p className="text-sm text-black/40">PNG, JPG ou PDF jusqu'à 10MB</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'account' && (
            <motion.div
              key="account-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md space-y-6 text-center"
            >
              <div className="w-24 h-24 bg-black/5 rounded-full flex items-center justify-center mx-auto">
                <User size={48} className="text-black/20" />
              </div>
              <h2 className="text-2xl font-bold">Mon Compte</h2>
              <p className="text-black/60">Connectez-vous pour sauvegarder vos emplois du temps et y accéder partout.</p>
              <button className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:brightness-95 transition-all">
                Se connecter
              </button>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md space-y-8"
            >
              <h2 className="text-2xl font-bold text-center">Réglages</h2>
              
              <div className="bg-white rounded-3xl border border-black/10 overflow-hidden">
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-bold">Rotation automatique</p>
                      <p className="text-sm text-black/40">Pivote l'interface d'édition sur mobile</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={autoRotateEnabled}
                        onChange={(e) => setAutoRotateEnabled(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-brand-accent)]"></div>
                    </label>
                  </div>

                  <div className="h-px bg-black/5" />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-bold">Mode sombre</p>
                      <p className="text-sm text-black/40">Interface plus sombre pour la nuit</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={isDarkMode}
                        onChange={(e) => setIsDarkMode(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-brand-accent)]"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="text-xs text-black/40 font-mono">VERSION 1.0.0</p>
                <p className="text-xs text-black/40 font-mono">SMART EDT © 2026</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {isEditorOpen && editorImageUrl && (
        <ImageEditor 
          imageUrl={editorImageUrl} 
          onClose={() => setIsEditorOpen(false)} 
          onSave={handleSaveEdit}
          autoRotateEnabled={autoRotateEnabled}
        />
      )}

      {/* Footer for Desktop */}
      <footer className="p-8 border-t border-black/10 text-center hidden md:block">
        <p className="text-sm text-black/40 font-mono">
          SMART EDT © 2026
        </p>
      </footer>

      {/* Bottom Nav for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-lg border-t border-black/10 p-2 z-40">
        <div className="flex justify-around">
          <button 
            onClick={() => setActiveTab('home')}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg w-24 transition-all",
              activeTab === 'home' ? "bg-[var(--color-brand-accent)] text-white" : "text-black/40 hover:text-black"
            )}
          >
            <Calendar size={24} />
            <span className="text-xs font-bold">Accueil</span>
          </button>
          <button 
            onClick={() => setActiveTab('account')}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg w-24 transition-all",
              activeTab === 'account' ? "bg-[var(--color-brand-accent)] text-white" : "text-black/40 hover:text-black"
            )}
          >
            <User size={24} />
            <span className="text-xs font-bold">Mon Compte</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg w-24 transition-all",
              activeTab === 'settings' ? "bg-[var(--color-brand-accent)] text-white" : "text-black/40 hover:text-black"
            )}
          >
            <Settings size={24} />
            <span className="text-xs font-bold">Réglages</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
