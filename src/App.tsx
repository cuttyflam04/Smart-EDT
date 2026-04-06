/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Sparkles, Calendar, User, Settings, Wand2, Loader2, X, Edit2, Download, Image as ImageIcon, ChevronLeft, MessageSquarePlus, Bug, Send, Lightbulb, Eraser, Type, Maximize, Maximize2, Undo, Scan, Copy, CheckCircle2, Shield, MessageSquare, Link2, Cpu, Phone, Layers, Eye, Trash2, RotateCcw, FileText, Construction, Hammer } from 'lucide-react';
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
import ImageEditor from './components/ImageEditor';
import { FeedbackForm } from './components/FeedbackForm';
import { performOCR } from './services/ocrService';
import { generateCalendarEvents, generateICS, type CalendarEvent } from './services/calendarService';

// Custom components
import { Logo } from './components/Logo';
import { Toast, type Notification } from './components/Toast';
import { HomeTab } from './components/HomeTab';
import { AccountTab } from './components/AccountTab';
import { SettingsTab } from './components/SettingsTab';
import { cn } from './lib/utils';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Save File Utility

// Save File Utility
async function saveFile(blob: Blob, suggestedName: string, mimeType: string) {
  // Try File System Access API first (forces "Save As" dialog)
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [{
          description: mimeType === 'application/pdf' ? 'PDF Document' : 'Image',
          accept: { [mimeType]: [mimeType === 'application/pdf' ? '.pdf' : '.png'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err: any) {
      if (err.name === 'AbortError') return false;
      console.warn('File System Access API failed, falling back:', err);
    }
  }
  
  // Fallback to traditional download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
  return true;
}

const BASE_URL = window.location.origin.includes('localhost') 
  ? 'https://ais-dev-4xlkqj6wtjalfvtml4xabo-214876071276.europe-west2.run.app' 
  : '';


export default function App() {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    // Cleanup preview Blob URL when preview changes
    return () => {
      if (preview?.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);
  const [fileType, setFileType] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorImageUrl, setEditorImageUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'account' | 'settings' | 'feedback'>('home');
  const [lastSavedEDT, setLastSavedEDT] = useState<{ name: string, type: 'image' | 'pdf', data?: string } | null>(() => {
    const saved = localStorage.getItem('smartedt_last_saved');
    return saved ? JSON.parse(saved) : null;
  });
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(() => {
    const saved = localStorage.getItem('smartedt_autorotate');
    return saved ? JSON.parse(saved) : true;
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('smartedt_darkmode');
    return saved ? JSON.parse(saved) : false;
  });
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Local state (No Firebase)
  const [studentSchedule, setStudentSchedule] = useState<any>(null);
  const [whatsappNumber, setWhatsappNumber] = useState(() => {
    return localStorage.getItem('smartedt_whatsapp') || '33600000000';
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState<{ name: string, type: 'image' | 'pdf', data?: string, uri?: string }[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [viewerFile, setViewerFile] = useState<{ name: string, type: 'image' | 'pdf', data: string | Uint8Array } | null>(null);
  const [viewerPageNumber, setViewerPageNumber] = useState(1);
  const [viewerNumPages, setViewerNumPages] = useState<number | null>(null);

  useEffect(() => {
    // Save WhatsApp number to local storage
    localStorage.setItem('smartedt_whatsapp', whatsappNumber);
  }, [whatsappNumber]);

  const addLog = (msg: string) => {
    const log = `[${new Date().toISOString()}] ${msg}`;
    console.log(log);
  };

  const loadLibraryFiles = async () => {
    if (!Capacitor.isNativePlatform()) {
      // On web, we only have the last saved one from localStorage
      if (lastSavedEDT) {
        setLibraryFiles([lastSavedEDT]);
      }
      return;
    }

    setIsLoadingLibrary(true);
    try {
      const result = await Filesystem.readdir({
        path: 'EDT',
        directory: Directory.Documents,
      });

      const files = await Promise.all(result.files.map(async (file) => {
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        return {
          name: file.name,
          type: (isPdf ? 'pdf' : 'image') as 'pdf' | 'image',
          uri: file.uri
        };
      }));

      setLibraryFiles(files.sort((a, b) => b.name.localeCompare(a.name)));
    } catch (e) {
      console.error('Error loading library:', e);
      // If directory doesn't exist yet, it's fine
      setLibraryFiles([]);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'account') {
      loadLibraryFiles();
    }
  }, [activeTab]);

  const handleEditLibraryFile = async (file: { name: string, type: 'image' | 'pdf', data?: string | Uint8Array, uri?: string }) => {
    if (file.data) {
      if (typeof file.data === 'string') {
        setPreview(file.data);
      } else {
        const mimeType = file.type === 'pdf' ? 'application/pdf' : 'image/png';
        const blob = new Blob([file.data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        setPreview(url);
      }
      setFileType(file.type === 'pdf' ? 'application/pdf' : 'image/png');
      setActiveTab('home');
      return;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const contents = await Filesystem.readFile({
          path: `EDT/${file.name}`,
          directory: Directory.Documents,
        });
        
        const base64 = typeof contents.data === 'string' ? contents.data : '';
        if (!base64) throw new Error('No data found');
        
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        
        const mimeType = file.type === 'pdf' ? 'application/pdf' : 'image/png';
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        setPreview(url);
        setFileType(file.type === 'pdf' ? 'application/pdf' : 'image/png');
        setActiveTab('home');
      } catch (e) {
        console.error('Error reading file:', e);
        addNotification('Erreur lors de la lecture du fichier.', 'error');
      }
    }
  };

  const handleViewLibraryFile = async (file: { name: string, type: 'image' | 'pdf', data?: string, uri?: string }) => {
    if (file.data) {
      if (file.type === 'pdf') {
        try {
          const base64 = file.data.includes(',') ? file.data.split(',')[1] : file.data;
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          setViewerFile({ name: file.name, type: file.type, data: bytes });
        } catch (e) {
          setViewerFile({ name: file.name, type: file.type, data: file.data });
        }
      } else {
        setViewerFile({ name: file.name, type: file.type, data: file.data });
      }
      return;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const contents = await Filesystem.readFile({
          path: `EDT/${file.name}`,
          directory: Directory.Documents,
        });
        
        const base64 = typeof contents.data === 'string' ? contents.data : '';
        if (!base64) throw new Error('No data found');
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        
        if (file.type === 'pdf') {
          setViewerFile({ name: file.name, type: file.type, data: bytes });
        } else {
          const dataUrl = `data:image/png;base64,${base64}`;
          setViewerFile({ name: file.name, type: file.type, data: dataUrl });
        }
      } catch (e) {
        console.error('Error reading file:', e);
        addNotification('Erreur lors de la lecture du fichier.', 'error');
      }
    }
  };

  const handleDeleteLibraryFile = async (file: { name: string, type: 'image' | 'pdf', uri?: string }) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet emploi du temps ?')) return;

    if (!Capacitor.isNativePlatform()) {
      if (lastSavedEDT?.name === file.name) {
        setLastSavedEDT(null);
        localStorage.removeItem('smartedt_last_saved');
        setLibraryFiles([]);
      }
      return;
    }

    try {
      await Filesystem.deleteFile({
        path: `EDT/${file.name}`,
        directory: Directory.Documents,
      });
      addNotification('Fichier supprimé.', 'success');
      loadLibraryFiles();
      if (lastSavedEDT?.name === file.name) {
        setLastSavedEDT(null);
        localStorage.removeItem('smartedt_last_saved');
      }
    } catch (e) {
      console.error('Error deleting file:', e);
      addNotification('Erreur lors de la suppression.', 'error');
    }
  };

  const [logoLinkEnabled, setLogoLinkEnabled] = useState(() => {
    const saved = localStorage.getItem('smartedt_logolink_enabled');
    return saved ? JSON.parse(saved) : false;
  });
  const [logoLinkUrl, setLogoLinkUrl] = useState(() => {
    const saved = localStorage.getItem('smartedt_logolink_url');
    return saved || 'https://github.com';
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isPageSelectorOpen, setIsPageSelectorOpen] = useState(false);
  const [pdfForSelection, setPdfForSelection] = useState<any>(null);
  const [selectedPageForEdit, setSelectedPageForEdit] = useState(1);

  const addNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    setNotifications(prev => [...prev, { id, message, type }]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const [ocrText, setOcrText] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[] | null>(null);
  const [isGeneratingCalendar, setIsGeneratingCalendar] = useState(false);
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
          await StatusBar.setBackgroundColor({ color: isDarkMode ? '#0F0F0F' : '#FFFFFF' });
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

  const convertPdfToImage = async (fileUrl: string, pageNumber: number = 1): Promise<string | null> => {
    try {
      const loadingTask = pdfjs.getDocument(fileUrl);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(pageNumber); // Use specified page
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

  const handleOpenEditor = async (pageNumber: number = 1) => {
    if (!preview) return;
    
    setIsProcessing(true);
    let imageUrlToEdit = processedPreview || preview;
    
    if (fileType === 'application/pdf' && !processedPreview) {
      const converted = await convertPdfToImage(preview, pageNumber);
      if (converted) {
        imageUrlToEdit = converted;
      }
    }
    
    setIsProcessing(false);
    setEditorImageUrl(imageUrlToEdit);
    setIsEditorOpen(true);
    setIsPageSelectorOpen(false);
  };

  const handleStartEditor = async () => {
    if (!preview) return;

    if (fileType === 'application/pdf' && !processedPreview) {
      const loadingTask = pdfjs.getDocument(preview);
      const pdf = await loadingTask.promise;
      if (pdf.numPages > 1) {
        setPdfForSelection(pdf);
        setIsPageSelectorOpen(true);
        return;
      }
    }
    
    handleOpenEditor(1);
  };

  const handleSaveEdit = (editedImageUrl: string) => {
    setProcessedPreview(editedImageUrl);
    setFileType('image/png'); // Once edited, it's an image
    setIsEditorOpen(false);
  };

  const handleDownloadPdf = async () => {
    if (!processedPreview) return;
    setIsProcessing(true);

    const img = new Image();
    img.onerror = () => {
      setIsProcessing(false);
      addNotification("Erreur de chargement de l'image traitée.", 'error');
    };
    
    img.onload = async () => {
      try {
        const pdf = new jsPDF({
          orientation: img.width > img.height ? 'l' : 'p',
          unit: 'px',
          format: [img.width, img.height]
        });
        pdf.addImage(processedPreview, 'PNG', 0, 0, img.width, img.height);
        
        if (Capacitor.isNativePlatform()) {
          try {
            // Request permissions first
            const perm = await Filesystem.checkPermissions();
            if (perm.publicStorage !== 'granted') {
              await Filesystem.requestPermissions();
            }

            const pdfBase64 = pdf.output('datauristring').split(',')[1];
            const fileName = `SmartEDT_${Date.now()}.pdf`;
            
            await Filesystem.writeFile({
              path: `EDT/${fileName}`,
              data: pdfBase64,
              directory: Directory.Documents,
              recursive: true
            });

            const lastSaved = { 
              name: fileName, 
              type: 'pdf' as const, 
              data: undefined 
            };
            setLastSavedEDT(lastSaved);
            try {
              localStorage.setItem('smartedt_last_saved', JSON.stringify(lastSaved));
            } catch (e) {
              console.warn('LocalStorage quota exceeded');
            }

            addNotification(`PDF enregistré !`, 'success');
            loadLibraryFiles();
          } catch (e: any) {
            console.error('PDF Native Save Error:', e);
            addNotification("Erreur de sauvegarde PDF.", 'error');
          }
        } else {
          const pdfBlob = pdf.output('blob');
          const fileName = `SmartEDT_${Date.now()}.pdf`;
          const success = await saveFile(pdfBlob, fileName, 'application/pdf');
          
          if (success) {
            const lastSaved = { name: fileName, type: 'pdf' as const };
            setLastSavedEDT(lastSaved);
            localStorage.setItem('smartedt_last_saved', JSON.stringify(lastSaved));
            addNotification('PDF enregistré !', 'success');
          }
        }
      } catch (error) {
        console.error('PDF Creation Error:', error);
        addNotification('Erreur lors de la création du PDF.', 'error');
      } finally {
        setIsProcessing(false);
      }
    };
    img.src = processedPreview;
  };

  const handleDownloadImage = async () => {
    if (!processedPreview) return;
    
    if (Capacitor.isNativePlatform()) {
      try {
        // Request permissions first
        const perm = await Filesystem.checkPermissions();
        if (perm.publicStorage !== 'granted') {
          await Filesystem.requestPermissions();
        }

        const fileName = `SmartEDT_${Date.now()}.png`;
        const base64Data = processedPreview.split(',')[1];
        
        await Filesystem.writeFile({
          path: `EDT/${fileName}`,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });

        const lastSaved = { 
          name: fileName, 
          type: 'image' as const, 
          data: Capacitor.isNativePlatform() ? undefined : processedPreview 
        };
        setLastSavedEDT(lastSaved);
        try {
          localStorage.setItem('smartedt_last_saved', JSON.stringify(lastSaved));
        } catch (e) {
          console.warn('LocalStorage quota exceeded');
        }

        addNotification(`Image enregistrée !`, 'success');
      } catch (e: any) {
        console.error('Save error:', e);
        addNotification("Erreur de sauvegarde Image.", 'error');
        const response = await fetch(processedPreview);
        const blob = await response.blob();
        await saveFile(blob, `EDT_${Date.now()}.png`, 'image/png');
      }
    } else {
      const response = await fetch(processedPreview);
      const blob = await response.blob();
      const success = await saveFile(blob, `EDT_${Date.now()}.png`, 'image/png');
      if (success) addNotification('Image enregistrée !', 'success');
    }
  };

  const handleShare = async () => {
    if (!processedPreview) return;

    if (Capacitor.isNativePlatform()) {
      try {
        const fileName = `SmartEDT_Share_${Date.now()}.png`;
        const base64Data = processedPreview.split(',')[1];
        
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'Mon Emploi du Temps',
          text: 'Voici mon emploi du temps modifié avec Smart EDT',
          files: [result.uri],
          dialogTitle: 'Partager mon EDT',
        });
      } catch (e: any) {
        console.error('Share error:', e);
        alert("Erreur lors du partage : " + (e.message || e));
      }
    } else {
      alert("Le partage natif n'est disponible que sur mobile.");
    }
  };

  const handleScanText = async () => {
    addNotification("Cette fonctionnalité est en cours de développement. Revenez bientôt !", "info");
    return;
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

      // Automatically generate calendar events
      setIsGeneratingCalendar(true);
      try {
        const events = await generateCalendarEvents(text);
        setCalendarEvents(events);
        addNotification("Calendrier généré avec succès !", "success");
      } catch (calError) {
        console.error("Auto Calendar Generation Error:", calError);
        addNotification("OCR réussi, mais erreur lors de la génération du calendrier.", "error");
      } finally {
        setIsGeneratingCalendar(false);
      }
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

  const handleDownloadICS = () => {
    if (!calendarEvents) return;
    const icsContent = generateICS(calendarEvents);
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mon_emploi_du_temps.ics';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
    addNotification("Fichier .ics téléchargé !", "success");
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
              --color-brand-accent: #075E54 !important;
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

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)] font-sans transition-colors duration-300">
      {/* Header */}
      <header className="p-4 grid grid-cols-3 items-center border-b border-[var(--border)]">
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
          <div 
            className="px-6 py-2 bg-white/50 dark:bg-black/20 backdrop-blur-sm border border-black/5 dark:border-white/5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 active:scale-95"
          >
            {logoLinkEnabled ? (
              <a href={logoLinkUrl} target="_blank" rel="noopener noreferrer" className="block">
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
                <MessageSquarePlus size={20} className="text-[var(--text-secondary)]" />
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

      <main className="flex-1 max-w-4xl mx-auto w-full p-6 md:p-12 flex flex-col items-center justify-center pb-48 md:pb-12">
        <AnimatePresence mode="wait">
          <HomeTab 
            key="home-tab"
            activeTab={activeTab}
            preview={preview}
            processedPreview={processedPreview}
            ocrText={ocrText}
            calendarEvents={calendarEvents}
            isCopied={isCopied}
            isCapturing={isCapturing}
            getRootProps={getRootProps}
            getInputProps={getInputProps}
            isDragActive={isDragActive}
            copyToClipboard={copyToClipboard}
            setOcrText={setOcrText}
            handleDownloadICS={handleDownloadICS}
            setCalendarEvents={setCalendarEvents}
            handleDownloadPdf={handleDownloadPdf}
            handleDownloadImage={handleDownloadImage}
            handleShare={handleShare}
            handleCapturePage={handleCapturePage}
            handleScanText={handleScanText}
            fileType={fileType}
            numPages={numPages}
            pdfError={pdfError}
            containerWidth={containerWidth}
            handleStartEditor={() => setIsEditorOpen(true)}
            isProcessing={isProcessing}
            enabledFeatures={enabledFeatures}
            isScanning={isScanning}
            scanProgress={scanProgress}
            isGeneratingCalendar={isGeneratingCalendar}
          />

          <AccountTab 
            key="account-tab"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          <SettingsTab 
            key="settings-tab"
            activeTab={activeTab}
            autoRotateEnabled={autoRotateEnabled}
            setAutoRotateEnabled={setAutoRotateEnabled}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            isDeveloperMode={isDeveloperMode}
            setIsDeveloperMode={setIsDeveloperMode}
            whatsappNumber={whatsappNumber}
            setWhatsappNumber={setWhatsappNumber}
            logoLinkEnabled={logoLinkEnabled}
            setLogoLinkEnabled={setLogoLinkEnabled}
            logoLinkUrl={logoLinkUrl}
            setLogoLinkUrl={setLogoLinkUrl}
            onCapturePage={handleCapturePage}
            isCapturing={isCapturing}
            addNotification={addNotification}
            enabledFeatures={enabledFeatures}
            setEnabledFeatures={setEnabledFeatures}
          />

          {activeTab === 'feedback' && (
            <motion.div
              key="feedback-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md px-4"
            >
              <div className="bg-[var(--surface)] p-6 rounded-[2.5rem] border border-[var(--border)] shadow-xl shadow-black/5">
                <FeedbackForm whatsappNumber={whatsappNumber} onClose={() => setActiveTab('home')} />
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
          enabledFeatures={enabledFeatures}
        />
      )}

      {/* Footer for Desktop */}
      <footer className="p-8 border-t border-black/10 text-center hidden md:block">
        <p className="text-sm text-[var(--text-secondary)] font-mono">
          SMART EDT © 2026
        </p>
      </footer>

      {/* Bottom Nav for Mobile - Floating Style */}
      <nav className="md:hidden fixed bottom-6 left-4 right-4 bg-[var(--nav-bg)] backdrop-blur-xl border border-[var(--border)] shadow-2xl rounded-[2rem] p-2 z-40">
        <div className="flex justify-around items-center h-14">
          <button 
            onClick={() => setActiveTab('home')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 h-full rounded-2xl w-16 transition-all duration-300",
              activeTab === 'home' ? "bg-[var(--color-brand-accent)] text-white shadow-lg scale-105" : "text-[var(--text-secondary)] hover:text-[var(--text)]"
            )}
          >
            <Calendar size={22} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Accueil</span>
          </button>
          <button 
            onClick={() => setActiveTab('account')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 h-full rounded-2xl w-24 transition-all duration-300 relative",
              activeTab === 'account' ? "bg-[var(--color-brand-accent)] text-white shadow-lg scale-105" : "text-[var(--text-secondary)] hover:text-[var(--text)]"
            )}
          >
            <div className="relative">
              <User size={22} strokeWidth={activeTab === 'account' ? 2.5 : 2} />
              <span className="absolute -top-1 -right-2 px-1 py-0.5 bg-amber-500 text-white text-[6px] font-black uppercase tracking-tighter rounded-full border border-white dark:border-gray-900 shadow-sm">
                WIP
              </span>
            </div>
            <span className="text-[10px] font-bold">Espace</span>
          </button>
          <button 
            onClick={() => setActiveTab('feedback')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 h-full rounded-2xl w-16 transition-all duration-300",
              activeTab === 'feedback' ? "bg-[var(--color-brand-accent)] text-white shadow-lg scale-105" : "text-[var(--text-secondary)] hover:text-[var(--text)]"
            )}
          >
            <MessageSquare size={22} strokeWidth={activeTab === 'feedback' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Feedback</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 h-full rounded-2xl w-16 transition-all duration-300",
              activeTab === 'settings' ? "bg-[var(--color-brand-accent)] text-white shadow-lg scale-105" : "text-[var(--text-secondary)] hover:text-[var(--text)]"
            )}
          >
            <Settings size={22} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Réglages</span>
          </button>
        </div>
      </nav>

      {/* Notifications */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none flex flex-col items-center gap-2">
        <AnimatePresence>
          {notifications.map(n => (
            <Toast key={n.id} message={n.message} type={n.type} onDismiss={() => removeNotification(n.id)} />
          ))}
        </AnimatePresence>
      </div>

      {/* Fullscreen Viewer Modal */}
      <AnimatePresence>
        {viewerFile && (
          <motion.div 
            key="file-viewer-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black flex flex-col"
          >
            <div className="p-4 flex justify-between items-center bg-black/80 backdrop-blur-md text-white border-b border-white/10">
              <div className="min-w-0">
                <p className="font-bold truncate text-sm">{viewerFile.name.split('/').pop()}</p>
                <p className="text-[10px] opacity-70 uppercase tracking-widest">Mode Lecture</p>
              </div>
              <div className="flex items-center gap-2">
                {viewerFile.type === 'pdf' && (
                  <button 
                    onClick={() => {
                      if (typeof viewerFile.data === 'string') {
                        window.open(viewerFile.data, '_blank');
                      } else {
                        const blob = new Blob([viewerFile.data], { type: 'application/pdf' });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      }
                    }}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all"
                    title="Ouvrir dans un nouvel onglet"
                  >
                    <Maximize2 size={20} />
                  </button>
                )}
                <button 
                  onClick={() => setViewerFile(null)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto flex flex-col items-center bg-zinc-900/50">
              {viewerFile.type === 'pdf' ? (
                <div className="w-full max-w-3xl flex flex-col items-center py-8 px-4">
                  <div className="w-full bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center min-h-[500px]">
                    <div className="w-full overflow-auto flex justify-center bg-gray-200/50 p-4">
                      <Document
                        file={viewerFile.data}
                        onLoadSuccess={({ numPages }) => setViewerNumPages(numPages)}
                        loading={
                          <div className="flex flex-col items-center gap-4 py-32">
                            <Loader2 className="animate-spin text-amber-600" size={40} />
                            <p className="text-sm text-gray-500 font-bold animate-pulse">Chargement de votre emploi du temps...</p>
                          </div>
                        }
                        error={
                          <div className="flex flex-col items-center gap-4 py-32 text-rose-500 px-6 text-center">
                            <div className="p-4 bg-rose-50 rounded-full">
                              <X size={40} />
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-bold">Impossible de lire le PDF</p>
                              <p className="text-sm opacity-80">Le fichier est peut-être corrompu ou trop volumineux.</p>
                            </div>
                            <button 
                              onClick={() => window.open(viewerFile.data, '_blank')}
                              className="mt-4 px-6 py-3 bg-rose-500 text-white rounded-xl font-bold shadow-lg"
                            >
                              Ouvrir en plein écran
                            </button>
                          </div>
                        }
                      >
                        <Page 
                          pageNumber={viewerPageNumber} 
                          width={Math.min(window.innerWidth - 64, 800)}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          className="shadow-lg"
                        />
                      </Document>
                    </div>
                  
                  {viewerNumPages && viewerNumPages > 1 && (
                    <div className="w-full p-4 bg-white border-t flex items-center justify-between">
                      <button
                        disabled={viewerPageNumber <= 1}
                        onClick={() => setViewerPageNumber(prev => Math.max(1, prev - 1))}
                        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <span className="text-sm font-bold text-gray-600">
                        Page {viewerPageNumber} sur {viewerNumPages}
                      </span>
                      <button
                        disabled={viewerPageNumber >= viewerNumPages}
                        onClick={() => setViewerPageNumber(prev => Math.min(viewerNumPages, prev + 1))}
                        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                      >
                        <ChevronLeft size={24} className="rotate-180" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <img 
                    src={typeof viewerFile.data === 'string' ? viewerFile.data : ''} 
                    alt="Viewer" 
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  />
                </div>
              )}
            </div>

            <div className="p-6 bg-black/50 backdrop-blur-md flex justify-center gap-4">
              <button 
                onClick={() => {
                  handleEditLibraryFile(viewerFile);
                  setViewerFile(null);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-[var(--color-brand-accent)] text-white rounded-xl font-bold"
              >
                <Edit2 size={18} />
                Modifier
              </button>
              <button 
                onClick={() => setViewerFile(null)}
                className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Selector Modal for Multi-page PDF */}
      <AnimatePresence>
        {isPageSelectorOpen && (
          <div key="page-selector-modal" className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPageSelectorOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[var(--bg)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-[var(--border)] flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Choisir une page</h3>
                  <p className="text-sm text-[var(--text-secondary)]">Ce PDF contient {pdfForSelection?.numPages} pages. Quelle page souhaitez-vous éditer ?</p>
                </div>
                <button onClick={() => setIsPageSelectorOpen(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Array.from(new Array(pdfForSelection?.numPages || 0), (el, index) => (
                  <button
                    key={`select_page_${index + 1}`}
                    onClick={() => handleOpenEditor(index + 1)}
                    className="group relative aspect-[3/4] border-2 border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--color-brand-accent)] transition-all bg-[var(--surface)]"
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Document file={preview} className="scale-[0.2] origin-center">
                        <Page pageNumber={index + 1} width={containerWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                      </Document>
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-end justify-center p-2">
                      <span className="bg-white/90 dark:bg-black/90 px-3 py-1 rounded-full text-xs font-bold shadow-sm">Page {index + 1}</span>
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="p-6 border-t border-[var(--border)] bg-[var(--surface)]/50 flex justify-end">
                <button 
                  onClick={() => setIsPageSelectorOpen(false)}
                  className="px-6 py-2 rounded-xl font-bold hover:bg-black/5 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
