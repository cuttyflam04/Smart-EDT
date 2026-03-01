/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Sparkles, Calendar, User, Settings, Wand2, Loader2, X, Edit2, Download, Image as ImageIcon, ChevronLeft, MessageSquarePlus, Bug, Send, Lightbulb, Eraser, Type, Maximize, Undo, Scan, Copy, CheckCircle2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ImageEditor from './components/ImageEditor';
import { performOCR } from './services/ocrService';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const WIPBadge = ({ className }: { className?: string }) => (
  <span className={cn("px-1.5 py-0.5 bg-amber-100 text-amber-600 text-[8px] font-bold rounded uppercase tracking-wider", className)}>
    WIP
  </span>
);

const Logo = ({ showText = false }: { showText?: boolean }) => (
  <div className={cn("flex items-center gap-3", showText ? "flex-row" : "flex-col")}>
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm overflow-visible">
        {/* Extra sketchy background lines */}
        <path d="M20,15 L25,10 M85,30 L90,35 M20,85 L25,90" stroke="currentColor" strokeWidth="1" className="text-black/20 dark:text-white/20" />
        
        {/* Hand-drawn paper effect with more "sketchy" feel */}
        <path 
          d="M22,12 C25,10 62,11 65,12 L88,35 C89,38 88,82 87,85 C85,88 25,89 22,87 C20,85 21,15 22,12 Z" 
          fill="white" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="fill-white text-black dark:text-white"
        />
        
        {/* Sketchy double border effect */}
        <path 
          d="M24,14 C27,12 60,13 63,14 L86,37 C87,40 86,80 85,83 C83,86 27,87 24,85" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1" 
          strokeLinecap="round" 
          className="text-black/10 dark:text-white/10"
        />

        {/* Folded corner */}
        <path d="M65,12 L65,35 L88,35" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-black dark:text-white" />
        
        {/* Red Scribbles - more vibrant and sketchy */}
        <path d="M30,42 Q45,38 60,42 T75,40" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" className="opacity-80" />
        <path d="M32,52 Q42,48 55,52 T70,50" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" className="opacity-80" />
        <path d="M30,62 Q48,58 65,62 T72,60" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" className="opacity-80" />

        {/* Crumbs/Shavings */}
        <circle cx="82" cy="78" r="1.5" fill="currentColor" className="text-black dark:text-white" />
        <circle cx="88" cy="82" r="1" fill="currentColor" className="text-black dark:text-white" />
        <circle cx="78" cy="85" r="1.2" fill="currentColor" className="text-black dark:text-white" />

        {/* Eraser - tilted and detailed */}
        <g transform="translate(45, 55) rotate(-25)">
          {/* Blue part */}
          <path 
            d="M0,5 Q0,0 5,0 L20,0 L20,30 L5,30 Q0,30 0,25 Z" 
            fill="#3b82f6" 
            stroke="currentColor" 
            strokeWidth="2" 
            className="text-black dark:text-white"
          />
          {/* White part */}
          <path 
            d="M20,0 L35,0 Q40,0 40,5 L40,25 Q40,30 35,30 L20,30 Z" 
            fill="white" 
            stroke="currentColor" 
            strokeWidth="2" 
            className="text-black dark:text-white"
          />
          {/* Eraser texture lines */}
          <path d="M25,5 L25,25" stroke="currentColor" strokeWidth="1" opacity="0.2" className="text-black dark:text-white" />
          <path d="M30,5 L30,25" stroke="currentColor" strokeWidth="1" opacity="0.2" className="text-black dark:text-white" />
        </g>
      </svg>
    </div>
    {showText && (
      <span className="text-2xl font-hand tracking-wide text-black dark:text-white">Smart EDT</span>
    )}
  </div>
);

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
  const [activeTab, setActiveTab] = useState<'home' | 'account' | 'settings' | 'feedback'>('home');
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(() => {
    const saved = localStorage.getItem('smartedt_autorotate');
    return saved ? JSON.parse(saved) : true;
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('smartedt_darkmode');
    return saved ? JSON.parse(saved) : false;
  });
  const [isDeveloperMode, setIsDeveloperMode] = useState(() => {
    const saved = localStorage.getItem('smartedt_devmode');
    return saved ? JSON.parse(saved) : false;
  });
  const [devClicks, setDevClicks] = useState(0);
  const [logoLinkEnabled, setLogoLinkEnabled] = useState(() => {
    const saved = localStorage.getItem('smartedt_logolink_enabled');
    return saved ? JSON.parse(saved) : false;
  });
  const [logoLinkUrl, setLogoLinkUrl] = useState(() => {
    const saved = localStorage.getItem('smartedt_logolink_url');
    return saved || 'https://github.com';
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'idea' | 'bug'>('idea');
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackDescription, setFeedbackDescription] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [enabledFeatures, setEnabledFeatures] = useState(() => {
    const saved = localStorage.getItem('smartedt_features');
    return saved ? JSON.parse(saved) : {
      removeText: true,
      removeColor: true,
      wordBox: true,
      wordBoxSimplified: false,
      eraser: true,
      zoom: true,
      undoRedo: true,
      ocr: true
    };
  });

  // Load saved preview on startup
  useEffect(() => {
    const savedPreview = localStorage.getItem('smartedt_current_preview');
    if (savedPreview) {
      // Blob URLs are session-specific and invalid on reload
      if (savedPreview.startsWith('blob:')) {
        localStorage.removeItem('smartedt_current_preview');
        localStorage.removeItem('smartedt_current_filetype');
        return;
      }
      setPreview(savedPreview);
      const savedFileType = localStorage.getItem('smartedt_current_filetype');
      if (savedFileType) setFileType(savedFileType);
    }
  }, []);

  // Save preview when it changes
  useEffect(() => {
    if (preview) {
      try {
        // Only save if it's not a blob URL (which would be invalid on reload)
        if (!preview.startsWith('blob:')) {
          localStorage.setItem('smartedt_current_preview', preview);
          if (fileType) localStorage.setItem('smartedt_current_filetype', fileType);
        }
      } catch (e) {
        console.warn('Failed to save preview to localStorage (likely too large):', e);
      }
    } else {
      localStorage.removeItem('smartedt_current_preview');
      localStorage.removeItem('smartedt_current_filetype');
    }
  }, [preview, fileType]);

  // Save settings when they change
  useEffect(() => {
    localStorage.setItem('smartedt_darkmode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('smartedt_features', JSON.stringify(enabledFeatures));
  }, [enabledFeatures]);

  useEffect(() => {
    localStorage.setItem('smartedt_autorotate', JSON.stringify(autoRotateEnabled));
  }, [autoRotateEnabled]);

  useEffect(() => {
    localStorage.setItem('smartedt_devmode', JSON.stringify(isDeveloperMode));
  }, [isDeveloperMode]);

  useEffect(() => {
    localStorage.setItem('smartedt_logolink_enabled', JSON.stringify(logoLinkEnabled));
  }, [logoLinkEnabled]);

  useEffect(() => {
    localStorage.setItem('smartedt_logolink_url', logoLinkUrl);
  }, [logoLinkUrl]);
  
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
    const initNative = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setStyle({ style: isDarkMode ? Style.Dark : Style.Light });
          await StatusBar.setBackgroundColor({ color: isDarkMode ? '#0F0F0F' : '#E4E3E0' });
          await SplashScreen.hide();
        } catch (e) {
          console.warn('Capacitor plugins not available:', e);
        }
      }
    };
    initNative();
  }, [isDarkMode]);

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

      // Use FileReader for both images and PDFs to get a persistent Base64 string
      // Blob URLs (URL.createObjectURL) are not persistent across reloads
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.onerror = () => {
        setPdfError("Erreur lors de la lecture du fichier.");
      };
      reader.readAsDataURL(selectedFile);
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
    img.onload = async () => {
      const pdf = new jsPDF({
        orientation: img.width > img.height ? 'l' : 'p',
        unit: 'px',
        format: [img.width, img.height]
      });
      pdf.addImage(processedPreview, 'PNG', 0, 0, img.width, img.height);
      
      if (Capacitor.isNativePlatform()) {
        try {
          const pdfBase64 = pdf.output('datauristring').split(',')[1];
          const fileName = `SmartEDT_${Date.now()}.pdf`;
          
          const result = await Filesystem.writeFile({
            path: fileName,
            data: pdfBase64,
            directory: Directory.Cache,
          });

          // Use 'files' instead of 'url' for local file sharing on Android
          await Share.share({
            title: 'Mon Emploi du Temps PDF',
            files: [result.uri],
            dialogTitle: 'Enregistrer ou Partager le PDF',
          });
        } catch (e: any) {
          console.error('PDF Native Save Error:', e);
          alert("Erreur lors du partage du PDF : " + (e.message || e));
          pdf.save('EDT_modifie.pdf');
        }
      } else {
        pdf.save('EDT_modifie.pdf');
      }
    };
    img.src = processedPreview;
  };

  const handleDownloadImage = async () => {
    if (!processedPreview) return;
    
    if (Capacitor.isNativePlatform()) {
      try {
        const fileName = `SmartEDT_${Date.now()}.png`;
        const base64Data = processedPreview.split(',')[1];
        
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        // Use 'files' instead of 'url' for local file sharing on Android
        await Share.share({
          title: 'Mon Emploi du Temps',
          text: 'Voici mon emploi du temps modifié avec Smart EDT',
          files: [result.uri],
          dialogTitle: 'Enregistrer ou Partager mon EDT',
        });
      } catch (e: any) {
        console.error('Share error:', e);
        alert("Erreur lors du partage de l'image : " + (e.message || e));
        const link = document.createElement('a');
        link.href = processedPreview;
        link.download = 'EDT_modifie.png';
        link.click();
      }
    } else {
      const link = document.createElement('a');
      link.href = processedPreview;
      link.download = 'EDT_modifie.png';
      link.click();
    }
  };

  const handleScanText = async () => {
    if (!preview) return;
    
    setIsScanning(true);
    setScanProgress(0);
    setOcrText(null);
    
    try {
      let imageToScan = processedPreview || preview;
      
      if (fileType === 'application/pdf' && !processedPreview) {
        const converted = await convertPdfToImage(preview);
        if (converted) imageToScan = converted;
      }
      
      const text = await performOCR(imageToScan, (progress) => {
        setScanProgress(progress);
      });
      
      setOcrText(text);
    } catch (error) {
      console.error("OCR Error:", error);
      alert("Erreur lors de l'analyse du texte.");
    } finally {
      setIsScanning(false);
    }
  };

  const copyToClipboard = () => {
    if (!ocrText) return;
    navigator.clipboard.writeText(ocrText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCapturePage = async () => {
    setIsCapturing(true);
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        scale: 2,
        backgroundColor: isDarkMode ? '#0F0F0F' : '#E4E3E0',
        onclone: (clonedDoc) => {
          // html2canvas doesn't support oklab/oklch colors used by Tailwind 4
          // We force standard colors in the cloned document for the capture
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            :root {
              --color-brand-bg: #E4E3E0 !important;
              --color-brand-primary: #141414 !important;
              --color-brand-accent: #F27D26 !important;
            }
            .dark {
              --color-dark-bg: #0F0F0F !important;
              --color-dark-primary: #F5F5F5 !important;
            }
          `;
          clonedDoc.head.appendChild(style);
        }
      });
      const link = document.createElement('a');
      link.download = `SmartEDT_Capture_${new URL(window.location.href).hostname}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Capture error:', error);
      alert('Erreur lors de la capture de la page.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleDevClick = () => {
    const newClicks = devClicks + 1;
    setDevClicks(newClicks);
    if (newClicks >= 5 && !isDeveloperMode) {
      setIsDeveloperMode(true);
      alert('Mode Développeur activé ! 🛠️');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-brand-bg)] text-[var(--color-brand-primary)] font-sans">
      {/* Header */}
      <header className="p-4 grid grid-cols-3 items-center border-b border-black/10">
        <div className="flex items-center">
          {activeTab !== 'home' && (
            <button 
              onClick={() => setActiveTab('home')}
              className="p-2 hover:bg-black/5 rounded-full transition-colors flex items-center gap-1 group"
            >
              <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-sm font-medium hidden sm:inline">Retour</span>
            </button>
          )}
        </div>
        <div className="flex justify-center items-center">
          <div className="px-6 py-2 bg-white/50 dark:bg-black/20 backdrop-blur-sm border border-black/5 dark:border-white/5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
            {logoLinkEnabled ? (
              <a href={logoLinkUrl} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
                <Logo showText={true} />
              </a>
            ) : (
              <Logo showText={true} />
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {activeTab === 'home' ? (
            <>
              <button 
                onClick={() => setActiveTab('feedback')}
                className="p-2 hover:bg-black/5 rounded-full transition-colors hidden md:block"
                title="Dépôt d'idées & Bugs"
              >
                <MessageSquarePlus size={20} className="text-black/40" />
              </button>
              <button 
                onClick={() => setActiveTab('settings')}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
                title="Réglages"
              >
                <Settings size={20} className="text-[var(--color-brand-accent)]" />
              </button>
            </>
          ) : (
            <button 
              onClick={() => setActiveTab('home')}
              className="p-2 hover:bg-black/5 rounded-full transition-colors"
              title="Fermer"
            >
              <X size={20} />
            </button>
          )}
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

                    {enabledFeatures.ocr && (
                      <button
                        onClick={handleScanText}
                        disabled={true}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-white text-black border border-black/10 hover:bg-black/5 transition-all disabled:opacity-50 relative overflow-hidden group"
                      >
                        <Scan size={20} className="text-black/40" />
                        <span className="text-black/40">Scanner le texte</span>
                        <div className="absolute top-1 right-1">
                          <WIPBadge />
                        </div>
                        <div className="absolute inset-0 bg-white/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] text-amber-600 font-bold">Bientôt disponible !</span>
                        </div>
                      </button>
                    )}

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
              <div className="relative inline-block">
                <div className="w-24 h-24 bg-black/5 rounded-full flex items-center justify-center mx-auto p-4">
                  <Logo />
                </div>
                <div className="absolute -top-1 -right-1">
                  <WIPBadge className="text-[10px] px-2 py-1" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Espace Compte</h2>
                <p className="text-black/60">
                  Nous travaillons sur une synchronisation cloud pour vos emplois du temps !
                </p>
              </div>
              
              <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 space-y-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600">
                  <Sparkles size={24} />
                </div>
                <p className="text-sm text-amber-800 font-medium">
                  Cette fonctionnalité est en cours de développement. Revenez bientôt pour créer votre compte et sauvegarder vos EDT !
                </p>
              </div>

              <button 
                onClick={() => setActiveTab('home')}
                className="w-full py-4 bg-black/5 text-black/60 rounded-2xl font-bold hover:bg-black/10 transition-all"
              >
                Retour à l'accueil
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

              <div className="bg-white rounded-3xl border border-black/10 overflow-hidden">
                <div className="p-6 space-y-6">
                  <h3 className="font-bold text-lg">Fonctionnalités de l'éditeur</h3>
                  <p className="text-sm text-black/40 -mt-4">Désactivez les outils inutiles pour simplifier l'interface.</p>
                  
                  <div className="space-y-6">
                    {[
                      { id: 'removeText', label: 'Effacer Texte', description: 'Supprime intelligemment le texte en conservant le fond.', icon: <Edit2 size={16} /> },
                      { id: 'removeColor', label: 'Effacer Couleur', description: 'Baguette magique pour effacer une couleur spécifique.', icon: <Wand2 size={16} /> },
                      { id: 'wordBox', label: 'Word Box', description: 'Ajoute des boîtes de texte stylisées avec mise en page.', icon: <Type size={16} /> },
                      { id: 'eraser', label: 'Gomme', description: 'Remplace une zone par du blanc (outil classique).', icon: <Eraser size={16} /> },
                      { id: 'zoom', label: 'Zoom & Pan', description: 'Permet de naviguer et de zoomer sur l\'image.', icon: <Maximize size={16} /> },
                      { id: 'undoRedo', label: 'Annuler/Rétablir', description: 'Boutons pour revenir en arrière ou rétablir une action.', icon: <Undo size={16} /> },
                      { id: 'ocr', label: 'Scan Texte (OCR)', description: 'Extrait le texte de l\'image pour le copier.', icon: <Scan size={16} /> },
                    ].map((feature) => (
                      <div key={feature.id} className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-3">
                            <div className="w-10 h-10 flex items-center justify-center bg-black/5 rounded-xl text-black/40 shrink-0">
                              {feature.icon}
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <p className="font-bold leading-none">{feature.label}</p>
                                {feature.id === 'ocr' && <WIPBadge />}
                              </div>
                              <p className="text-xs text-black/40 leading-tight">{feature.description}</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={(enabledFeatures as any)[feature.id]}
                              onChange={(e) => setEnabledFeatures(prev => ({ ...prev, [feature.id]: e.target.checked }))}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-brand-accent)]"></div>
                          </label>
                        </div>
                        
                        {feature.id === 'wordBox' && enabledFeatures.wordBox && (
                          <div className="ml-13 p-3 bg-black/5 rounded-2xl flex items-center justify-between">
                            <div className="space-y-0.5">
                              <p className="text-sm font-bold">Version simplifiée</p>
                              <p className="text-[10px] text-black/40">Masque les options de mise en page avancées.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                              <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={enabledFeatures.wordBoxSimplified}
                                onChange={(e) => setEnabledFeatures(prev => ({ ...prev, wordBoxSimplified: e.target.checked }))}
                              />
                              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-brand-accent)]"></div>
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-center space-y-4">
                {isDeveloperMode && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl p-6 space-y-4 text-left">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <Settings size={20} />
                      <h3 className="font-bold text-lg">Options Développeur</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold">Capture d'écran complète</p>
                          <p className="text-xs text-black/40 dark:text-white/40">Génère une image de toute la page actuelle.</p>
                        </div>
                        <button 
                          onClick={handleCapturePage}
                          disabled={isCapturing}
                          className="px-4 py-2 bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-bold hover:bg-amber-200 transition-colors disabled:opacity-50"
                        >
                          {isCapturing ? <Loader2 size={14} className="animate-spin" /> : 'Capturer'}
                        </button>
                      </div>

                      <div className="h-px bg-amber-200 dark:bg-amber-800/40" />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold">Logo Hypertexte</p>
                            <p className="text-xs text-black/40 dark:text-white/40">Rend le logo cliquable vers un lien externe.</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={logoLinkEnabled}
                              onChange={(e) => setLogoLinkEnabled(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                          </label>
                        </div>
                        
                        {logoLinkEnabled && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-amber-600/60 uppercase">URL du lien</p>
                            <input 
                              type="text" 
                              value={logoLinkUrl}
                              onChange={(e) => setLogoLinkUrl(e.target.value)}
                              className="w-full px-3 py-2 bg-white dark:bg-black/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                              placeholder="https://example.com"
                            />
                          </div>
                        )}
                      </div>

                      <div className="h-px bg-amber-200 dark:bg-amber-800/40" />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold">Capacitor Native</p>
                            <p className="text-xs text-black/40 dark:text-white/40">État de la plateforme native.</p>
                          </div>
                          <div className="px-2 py-1 bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 rounded-lg text-[10px] font-bold">
                            {Capacitor.getPlatform().toUpperCase()}
                          </div>
                        </div>
                        <p className="text-[10px] text-black/40 dark:text-white/40 italic">
                          L'application est configurée pour Capacitor. Utilisez `npm run build:cap` pour synchroniser avec Android Studio.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <button 
                    onClick={handleDevClick}
                    className="text-xs text-black/40 font-mono hover:text-black transition-colors"
                  >
                    VERSION 1.0.0
                  </button>
                  <p className="text-xs text-black/40 font-mono">SMART EDT © 2026</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'feedback' && (
            <motion.div
              key="feedback-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Dépôt d'idées & Bugs</h2>
                <p className="text-black/60">Aidez-nous à améliorer Smart EDT en partageant vos retours.</p>
              </div>

              <form className="space-y-4" onSubmit={async (e) => {
                e.preventDefault();
                setIsSendingFeedback(true);
                try {
                  const response = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      type: feedbackType,
                      title: feedbackTitle,
                      description: feedbackDescription
                    })
                  });
                  
                  if (response.ok) {
                    alert('Merci pour votre retour ! Votre message a été envoyé sur Discord.');
                    setFeedbackTitle('');
                    setFeedbackDescription('');
                    setActiveTab('home');
                  } else {
                    alert('Erreur lors de l\'envoi du feedback. Veuillez réessayer.');
                  }
                } catch (error) {
                  console.error('Feedback error:', error);
                  alert('Une erreur est survenue.');
                } finally {
                  setIsSendingFeedback(false);
                }
              }}>
                <div className="bg-white rounded-3xl border border-black/10 p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-2 p-1 bg-black/5 rounded-xl">
                    <button 
                      type="button"
                      onClick={() => setFeedbackType('idea')}
                      className={cn(
                        "flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition-all",
                        feedbackType === 'idea' ? "bg-white shadow-sm" : "text-black/40 hover:text-black"
                      )}
                    >
                      <Lightbulb size={18} className={feedbackType === 'idea' ? "text-amber-500" : "text-black/20"} />
                      Idée
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFeedbackType('bug')}
                      className={cn(
                        "flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition-all",
                        feedbackType === 'bug' ? "bg-white shadow-sm" : "text-black/40 hover:text-black"
                      )}
                    >
                      <Bug size={18} className={feedbackType === 'bug' ? "text-red-500" : "text-black/20"} />
                      Bug
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold ml-1">Titre</label>
                    <input 
                      type="text" 
                      value={feedbackTitle}
                      onChange={(e) => setFeedbackTitle(e.target.value)}
                      placeholder="En quelques mots..."
                      className="w-full px-4 py-3 bg-black/5 rounded-xl border-none focus:ring-2 focus:ring-[var(--color-brand-accent)] outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold ml-1">Description</label>
                    <textarea 
                      value={feedbackDescription}
                      onChange={(e) => setFeedbackDescription(e.target.value)}
                      placeholder="Détaillez votre idée ou le bug rencontré..."
                      className="w-full px-4 py-3 bg-black/5 rounded-xl border-none focus:ring-2 focus:ring-[var(--color-brand-accent)] outline-none min-h-[120px] resize-none"
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isSendingFeedback}
                  className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:brightness-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingFeedback ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                  {isSendingFeedback ? 'Envoi en cours...' : 'Envoyer le message'}
                </button>
              </form>
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
          enabledFeatures={enabledFeatures}
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
              "flex flex-col items-center gap-1 p-2 rounded-lg w-16 transition-all",
              activeTab === 'home' ? "bg-[var(--color-brand-accent)] text-white" : "text-black/40 hover:text-black"
            )}
          >
            <Calendar size={20} />
            <span className="text-[10px] font-bold">Accueil</span>
          </button>
          <button 
            onClick={() => setActiveTab('account')}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg w-16 transition-all relative",
              activeTab === 'account' ? "bg-[var(--color-brand-accent)] text-white" : "text-black/40 hover:text-black"
            )}
          >
            <User size={20} />
            <span className="text-[10px] font-bold">Compte</span>
            <div className="absolute top-1 right-1">
              <WIPBadge />
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('feedback')}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg w-16 transition-all",
              activeTab === 'feedback' ? "bg-[var(--color-brand-accent)] text-white" : "text-black/40 hover:text-black"
            )}
          >
            <MessageSquarePlus size={20} />
            <span className="text-[10px] font-bold">Feedback</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg w-16 transition-all",
              activeTab === 'settings' ? "bg-[var(--color-brand-accent)] text-white" : "text-black/40 hover:text-black"
            )}
          >
            <Settings size={20} />
            <span className="text-[10px] font-bold">Réglages</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
