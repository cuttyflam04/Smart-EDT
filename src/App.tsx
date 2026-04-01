/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Sparkles, Calendar, User, Settings, Wand2, Loader2, X, Edit2, Download, Image as ImageIcon, ChevronLeft, MessageSquarePlus, Bug, Send, Lightbulb, Eraser, Type, Maximize, Maximize2, Undo, Scan, Copy, CheckCircle2, Shield, MessageSquare, Link2, Cpu, Phone, Layers, Eye, Trash2, RotateCcw, FileText } from 'lucide-react';
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
import { FeedbackForm } from './components/FeedbackForm';
import { performOCR } from './services/ocrService';
import { generateCalendarEvents, generateICS, type CalendarEvent } from './services/calendarService';
import { auth, db, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, handleFirestoreError, OperationType, collection, doc, onSnapshot, setDoc, query, where, Timestamp, debugLogs, addLog } from './firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { serverTimestamp, orderBy, limit, getDocs } from 'firebase/firestore';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Notification system
interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

function Toast({ message, type, onDismiss }: { message: string, type: 'success' | 'error' | 'info', onDismiss: () => void, key?: string }) {
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

const Logo = ({ showText = false }: { showText?: boolean }) => (
  <div className={cn("flex items-center gap-3", showText ? "flex-row" : "flex-col")}>
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm overflow-visible">
        {/* Extra sketchy background lines */}
        <path d="M20,15 L25,10 M85,30 L90,35 M20,85 L25,90" stroke="currentColor" strokeWidth="1" className="text-[var(--border)]" />
        
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
          className="text-[var(--border)]"
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

  // Firebase state
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [studentSchedule, setStudentSchedule] = useState<any>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [adminScheduleUpload, setAdminScheduleUpload] = useState<string>('');
  const [adminClassId, setAdminClassId] = useState<string>('');
  const [isUploadingSchedule, setIsUploadingSchedule] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('33600000000');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState<{ name: string, type: 'image' | 'pdf', data?: string, uri?: string }[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [viewerFile, setViewerFile] = useState<{ name: string, type: 'image' | 'pdf', data: string | Uint8Array } | null>(null);
  const [viewerPageNumber, setViewerPageNumber] = useState(1);
  const [viewerNumPages, setViewerNumPages] = useState<number | null>(null);

  useEffect(() => {
    // Reset page number when opening a new file
    if (viewerFile) {
      setViewerPageNumber(1);
      setViewerNumPages(null);
    }
    
    // Cleanup Blob URLs when viewer closes
    return () => {
      if (typeof viewerFile?.data === 'string' && viewerFile.data.startsWith('blob:')) {
        URL.revokeObjectURL(viewerFile.data);
      }
    };
  }, [viewerFile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Listen to user profile
        const userDocRef = doc(db, 'users', u.uid);
        onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            setUserProfile(snap.data());
          } else {
            // Create initial profile
            setDoc(userDocRef, {
              displayName: u.displayName,
              email: u.email,
              photoURL: u.photoURL,
              role: 'student',
              createdAt: serverTimestamp()
            }, { merge: true });
          }
        }, (err) => handleFirestoreError(err, OperationType.GET, `users/${u.uid}`));
      } else {
        setUserProfile(null);
      }
    });
    
    getRedirectResult(auth).then((result) => {
      if (result) {
        addLog(`Redirect login success: ${result.user.email}`);
        addNotification("Connexion réussie !", "success");
      }
    }).catch((error) => {
      addLog(`Redirect auth error: ${error.code} - ${error.message}`);
      if (error.code === 'auth/unauthorized-domain') {
        addNotification(`Domaine non autorisé: ${window.location.hostname}`, "error");
      } else if (error.code === 'auth/network-request-failed') {
        addNotification("Erreur réseau. Vérifiez votre connexion ou vos bloqueurs de pub.", "error");
      }
    });

    addLog(`Origin detected: ${window.location.origin}`);
    addLog(`Hostname detected: ${window.location.hostname}`);
    
    return () => unsubscribe();
  }, []);

  // Listen to schedules based on user classId
  useEffect(() => {
    if (userProfile?.classId) {
      const q = query(
        collection(db, 'schedules'),
        where('classId', '==', userProfile.classId),
        orderBy('updatedAt', 'desc'),
        limit(1)
      );
      const unsubscribe = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          setStudentSchedule(snap.docs[0].data());
        } else {
          setStudentSchedule(null);
        }
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'schedules'));
      return () => unsubscribe();
    }
  }, [userProfile?.classId]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'configs', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setWhatsappNumber(snapshot.data().whatsappNumber || '33600000000');
      }
    }, (error) => {
      console.log("Config read permission denied or error:", error.message);
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = user !== null && user.email === "monstertrio04@gmail.com";

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    addLog("Starting login process...");
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isIframe = window.self !== window.top;

    try {
      if (isMobile || isIframe) {
        addLog(`Using redirect (isMobile: ${isMobile}, isIframe: ${isIframe})...`);
        await signInWithRedirect(auth, googleProvider);
      } else {
        addLog("Attempting signInWithPopup...");
        try {
          await signInWithPopup(auth, googleProvider);
          addLog("Login success via popup");
        } catch (popupError: any) {
          if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/operation-not-supported-in-this-environment') {
            addLog("Popup blocked or not supported, falling back to redirect...");
            await signInWithRedirect(auth, googleProvider);
          } else {
            throw popupError;
          }
        }
      }
    } catch (error: any) {
      addLog(`Login failed: ${error.code} - ${error.message}`);
      
      if (error.code === 'auth/popup-closed-by-user') {
        addLog("User closed the login popup.");
      } else if (error.code === 'auth/unauthorized-domain') {
        addNotification(`Domaine non autorisé: ${window.location.hostname}`, "error");
      } else {
        addNotification("Échec de la connexion. Veuillez réessayer.", "error");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const copyDiagnosticLogs = () => {
    const info = [
      `URL: ${window.location.href}`,
      `Hostname: ${window.location.hostname}`,
      `User Agent: ${navigator.userAgent}`,
      `Auth State: ${user ? 'Logged In (' + user.uid + ')' : 'Logged Out'}`,
      `Firestore Status: ${db ? 'Initialized' : 'Not Initialized'}`,
      '\n--- DEBUG LOGS ---',
      ...(debugLogs || [])
    ].join('\n');
    
    navigator.clipboard.writeText(info);
    addNotification("Logs copiés dans le presse-papier !", "success");
  };

  const handleUpdateClassId = async (classId: string) => {
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      await setDoc(doc(db, 'users', user.uid), { classId }, { merge: true });
      addNotification("Classe mise à jour !", "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleSaveWhatsappConfig = async () => {
    if (!isAdmin) return;
    setIsSavingConfig(true);
    try {
      await setDoc(doc(db, 'configs', 'global'), {
        whatsappNumber,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid
      }, { merge: true });
      addNotification('Numéro WhatsApp mis à jour !', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'configs/global');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleUploadSchedule = async () => {
    if (!isAdmin || !adminClassId || !adminScheduleUpload) {
      addNotification("Veuillez remplir tous les champs admin.", "error");
      return;
    }
    
    setIsUploadingSchedule(true);
    try {
      const scheduleData = JSON.parse(adminScheduleUpload);
      const scheduleDocRef = doc(collection(db, 'schedules'));
      await setDoc(scheduleDocRef, {
        classId: adminClassId.toUpperCase(),
        ...scheduleData,
        updatedAt: serverTimestamp(),
        authorUid: user?.uid
      });
      
      addNotification(`EDT pour ${adminClassId} mis en ligne !`, "success");
      setAdminScheduleUpload('');
      setAdminClassId('');
    } catch (error) {
      console.error("Upload error:", error);
      addNotification("Erreur lors de l'upload. Vérifiez le format JSON.", "error");
    } finally {
      setIsUploadingSchedule(false);
    }
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
    const id = Math.random().toString(36).substring(7);
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
          {activeTab === 'home' && (
            <motion.div 
              key="upload-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full space-y-8"
            >
              {/* Last Saved Widget */}
              {lastSavedEDT && !preview && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full p-4 bg-[var(--surface)] rounded-3xl border border-[var(--border)] shadow-sm flex items-center gap-4 cursor-pointer hover:bg-[var(--border)] transition-all group"
                  onClick={() => handleViewLibraryFile(lastSavedEDT)}
                >
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black/5 flex items-center justify-center shrink-0 border border-black/5">
                    {lastSavedEDT.type === 'image' && lastSavedEDT.data ? (
                      <img src={lastSavedEDT.data} alt="Dernier EDT" className="w-full h-full object-cover" />
                    ) : (
                      <div className={cn("flex flex-col items-center justify-center", lastSavedEDT.type === 'pdf' ? "text-red-500" : "text-blue-500")}>
                        {lastSavedEDT.type === 'pdf' ? <FileText size={24} /> : <ImageIcon size={24} />}
                        <span className="text-[8px] font-bold uppercase">{lastSavedEDT.type}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-[var(--color-brand-accent)] uppercase tracking-wider mb-0.5">Dernier enregistré</p>
                    <p className="font-bold truncate text-sm">{lastSavedEDT.name.split('/').pop()}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] font-mono uppercase">
                      {lastSavedEDT.name.includes('_') ? new Date(parseInt(lastSavedEDT.name.split('_')[1])).toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Fichier'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleViewLibraryFile(lastSavedEDT); }}
                      className="p-2 rounded-full bg-white hover:bg-[var(--color-brand-accent)] hover:text-white transition-all shadow-sm"
                    >
                      <Eye size={18} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEditLibraryFile(lastSavedEDT); }}
                      className="p-2 rounded-full bg-white hover:bg-[var(--color-brand-accent)] hover:text-white transition-all shadow-sm"
                      title="Modifier"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (window.confirm('Voulez-vous retirer ce fichier de l\'aperçu rapide ? (Le fichier restera dans votre bibliothèque)')) {
                          setLastSavedEDT(null);
                          localStorage.removeItem('smartedt_last_saved');
                          addNotification('Aperçu nettoyé.', 'info');
                        }
                      }}
                      className="p-2 rounded-full bg-white hover:bg-rose-500 hover:text-white transition-all shadow-sm text-rose-500"
                      title="Nettoyer l'aperçu"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              )}

              {preview ? (
                <div className="w-full flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Aperçu du document</h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setPreview(null);
                          setProcessedPreview(null);
                          setPdfForSelection(null);
                          setIsPageSelectorOpen(false);
                          setFileType(null);
                          setNumPages(null);
                          setPdfError(null);
                          setIsProcessing(false);
                          addNotification("Espace d'édition réinitialisé", "success");
                        }} 
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl font-bold transition-all shadow-sm"
                      >
                        <RotateCcw size={18} />
                        Réinitialiser
                      </button>
                    </div>
                  </div>
                  
                  <div 
                    ref={pdfContainerRef}
                    className="w-full border-2 border-[var(--border)] rounded-3xl overflow-hidden bg-[var(--surface)] p-4 max-h-[70vh] overflow-y-auto"
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
                                key={idx}
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
          )}

          {activeTab === 'account' && (
            <motion.div
              key="account-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-4xl space-y-8"
            >
              {!user ? (
                <div className="max-w-md mx-auto space-y-6 text-center py-12">
                  <div className="w-20 h-20 bg-[var(--color-brand-accent)]/10 rounded-full flex items-center justify-center mx-auto text-[var(--color-brand-accent)]">
                    <User size={40} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Connectez-vous</h2>
                    <p className="text-[var(--text-secondary)]">
                      Accédez à vos emplois du temps institutionnels et synchronisez vos fichiers sur tous vos appareils.
                    </p>
                  </div>
                  <button 
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className="w-full py-4 bg-[var(--color-brand-accent)] text-white rounded-2xl font-bold shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-3"
                  >
                    {isLoggingIn ? <Loader2 size={20} className="animate-spin" /> : <Cpu size={20} />}
                    Se connecter avec Google
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Profile Section */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-[var(--surface)] p-6 rounded-[2.5rem] border border-[var(--border)] shadow-sm text-center">
                      <div className="relative inline-block mb-4">
                        <img 
                          src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                          alt="Profile" 
                          className="w-24 h-24 rounded-full border-4 border-white shadow-md mx-auto"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 border-2 border-white rounded-full" />
                      </div>
                      <h3 className="text-xl font-bold">{user.displayName}</h3>
                      <p className="text-sm text-[var(--text-secondary)] mb-6">{user.email}</p>
                      
                      <div className="space-y-4 text-left">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase ml-1">Ma Classe / Groupe</label>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="Ex: L3-INFO"
                              defaultValue={userProfile?.classId || ''}
                              onBlur={(e) => handleUpdateClassId(e.target.value)}
                              className="flex-1 px-4 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none text-sm focus:ring-2 focus:ring-[var(--color-brand-accent)]"
                            />
                            {isUpdatingProfile && <Loader2 size={16} className="animate-spin text-[var(--color-brand-accent)] mt-2" />}
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => signOut(auth)}
                        className="mt-8 w-full py-3 text-red-500 font-bold text-sm hover:bg-red-50 rounded-xl transition-all"
                      >
                        Déconnexion
                      </button>
                    </div>

                    {/* Today's Schedule Mini-View */}
                    <div className="bg-[var(--surface)] p-6 rounded-[2.5rem] border border-[var(--border)] shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold flex items-center gap-2">
                          <Calendar size={18} className="text-[var(--color-brand-accent)]" />
                          Aujourd'hui
                        </h4>
                      </div>
                      
                      {!userProfile?.classId ? (
                        <p className="text-xs text-[var(--text-secondary)] text-center py-4 italic">
                          Renseignez votre classe pour voir votre EDT.
                        </p>
                      ) : !studentSchedule ? (
                        <p className="text-xs text-[var(--text-secondary)] text-center py-4 italic">
                          Aucun EDT trouvé pour {userProfile.classId}.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {studentSchedule.days?.find((d: any) => d.dayName.toLowerCase() === new Date().toLocaleDateString('fr-FR', { weekday: 'long' }).toLowerCase())?.slots?.map((slot: any, sidx: number) => (
                            <div key={sidx} className="p-3 bg-[var(--bg)] rounded-2xl border border-[var(--border)]">
                              <p className="text-[10px] font-bold text-[var(--color-brand-accent)]">{slot.time}</p>
                              <p className="font-bold text-sm">{slot.subject}</p>
                              <p className="text-[10px] text-[var(--text-secondary)]">{slot.room} • {slot.teacher}</p>
                            </div>
                          )) || (
                            <p className="text-xs text-[var(--text-secondary)] text-center py-4 italic">
                              Rien de prévu pour aujourd'hui !
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Library Section */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="text-2xl font-bold flex items-center gap-3">
                        <Layers size={24} className="text-[var(--color-brand-accent)]" />
                        Mes EDTs Importés
                      </h3>
                      <button 
                        onClick={loadLibraryFiles}
                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--text)] transition-all"
                      >
                        <RotateCcw size={20} className={isLoadingLibrary ? "animate-spin" : ""} />
                      </button>
                    </div>

                    {isLoadingLibrary ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 size={40} className="animate-spin text-[var(--color-brand-accent)]" />
                        <p className="text-[var(--text-secondary)] font-medium">Chargement de votre bibliothèque...</p>
                      </div>
                    ) : libraryFiles.length === 0 ? (
                      <div className="bg-[var(--surface)] border-2 border-dashed border-[var(--border)] rounded-[2.5rem] p-12 text-center space-y-4">
                        <div className="w-16 h-16 bg-[var(--bg)] rounded-full flex items-center justify-center mx-auto text-[var(--text-secondary)]">
                          <FileText size={32} />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-lg">Votre bibliothèque est vide</p>
                          <p className="text-sm text-[var(--text-secondary)]">Importez ou créez votre premier emploi du temps pour le voir ici.</p>
                        </div>
                        <button 
                          onClick={() => setActiveTab('home')}
                          className="px-6 py-2 bg-[var(--color-brand-accent)] text-white rounded-full text-sm font-bold shadow-md"
                        >
                          Commencer
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {libraryFiles.map((file, idx) => (
                          <motion.div
                            key={file.name + idx}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="group bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-4 flex items-center gap-4 hover:shadow-lg transition-all"
                          >
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                              file.type === 'pdf' ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"
                            )}>
                              {file.type === 'pdf' ? <FileText size={24} /> : <ImageIcon size={24} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm truncate">{file.name.split('/').pop()}</p>
                              <p className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">
                                {file.type === 'pdf' ? 'Document PDF' : 'Image PNG'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleViewLibraryFile(file)}
                                className="p-2 hover:bg-[var(--bg)] rounded-xl text-[var(--text-secondary)]"
                                title="Voir"
                              >
                                <Eye size={18} />
                              </button>
                              <button 
                                onClick={() => handleEditLibraryFile(file)}
                                className="p-2 hover:bg-[var(--bg)] rounded-xl text-[var(--text-secondary)]"
                                title="Modifier"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={() => handleDeleteLibraryFile(file)}
                                className="p-2 hover:bg-red-50 rounded-xl text-red-500"
                                title="Supprimer"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
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

              <div className="space-y-4">
                <div className="flex items-center gap-2 px-2 text-[var(--text-secondary)]">
                  <Bug size={18} />
                  <h3 className="font-bold">Support & Diagnostic</h3>
                </div>
                <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-6 space-y-4">
                  <p className="text-sm text-[var(--text-secondary)]">
                    Si vous rencontrez des problèmes de connexion, utilisez ce bouton pour copier les informations techniques et les envoyer au support.
                  </p>
                  <button 
                    onClick={copyDiagnosticLogs}
                    className="w-full py-3 bg-[var(--bg)] border border-[var(--border)] rounded-2xl flex items-center justify-center gap-2 font-bold hover:bg-[var(--border)] transition-all"
                  >
                    <Copy size={18} />
                    Copier les logs de diagnostic
                  </button>
                </div>
              </div>

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
                          {!user ? (
                            <button 
                              onClick={handleLogin}
                              disabled={isLoggingIn}
                              className="text-[10px] font-bold text-amber-600 uppercase tracking-wider hover:underline disabled:opacity-50"
                            >
                              {isLoggingIn ? "Connexion..." : "Connexion Admin"}
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-amber-600/60 truncate max-w-[100px]">{user.email}</span>
                              <button 
                                onClick={() => auth.signOut()}
                                className="text-[10px] font-bold text-red-500 uppercase tracking-wider hover:underline"
                              >
                                Déconnexion
                              </button>
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-amber-600/60 uppercase ml-1">Numéro (Format international sans +)</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={whatsappNumber}
                              onChange={(e) => setWhatsappNumber(e.target.value)}
                              disabled={!isAdmin}
                              placeholder="Ex: 33612345678"
                              className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none text-sm focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                            />
                            {isAdmin && (
                              <button 
                                onClick={handleSaveWhatsappConfig}
                                disabled={isSavingConfig}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-amber-600 text-white rounded-lg hover:brightness-95 transition-all disabled:opacity-50"
                              >
                                {isSavingConfig ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                              </button>
                            )}
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
                              onChange={(e) => isAdmin && setLogoLinkEnabled(e.target.checked)}
                              disabled={!isAdmin}
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
                              onChange={(e) => isAdmin && setLogoLinkUrl(e.target.value)}
                              disabled={!isAdmin}
                              className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-50"
                              placeholder="https://example.com"
                            />
                          </div>
                        )}
                      </div>

                      <div className="h-px bg-amber-200 dark:bg-amber-800/40" />

                      {/* Schedule Upload */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar size={18} className="text-amber-600" />
                            <p className="font-bold">Upload Emploi du Temps</p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-amber-600/60 uppercase ml-1">Classe ID (Ex: L3-INFO)</label>
                            <input 
                              type="text" 
                              value={adminClassId}
                              onChange={(e) => setAdminClassId(e.target.value)}
                              disabled={!isAdmin}
                              className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-50"
                              placeholder="ID de la classe"
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-amber-600/60 uppercase ml-1">Données JSON</label>
                            <textarea 
                              value={adminScheduleUpload}
                              onChange={(e) => setAdminScheduleUpload(e.target.value)}
                              disabled={!isAdmin}
                              rows={4}
                              className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-50 resize-none"
                              placeholder='{"days": [{"dayName": "Lundi", "slots": [...]}]}'
                            />
                          </div>

                          <button 
                            onClick={handleUploadSchedule}
                            disabled={!isAdmin || isUploadingSchedule}
                            className="w-full py-3 bg-amber-600 text-white rounded-xl font-bold text-sm shadow-md hover:brightness-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isUploadingSchedule ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                            Mettre en ligne l'EDT
                          </button>
                        </div>
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
                              onClick={handleCapturePage}
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
                                  platform: Capacitor.getPlatform(),
                                  user: user ? { email: user.email, verified: user.emailVerified } : 'null'
                                };
                                navigator.clipboard.writeText(JSON.stringify(info, null, 2));
                                alert('Infos copiées !');
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
                      { id: 'ocr', label: 'Scan Texte (OCR)', description: 'Extrait le texte de l\'image pour le copier.', icon: <Scan size={16} /> },
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
                              </div>
                              <p className="text-xs text-[var(--text-secondary)] leading-tight">{feature.description}</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={(enabledFeatures as any)[feature.id]}
                              onChange={(e) => setEnabledFeatures(prev => ({ ...prev, [feature.id]: e.target.checked }))}
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
                                onChange={(e) => setEnabledFeatures(prev => ({ ...prev, wordBoxSimplified: e.target.checked }))}
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
                  onTouchCancel={() => {
                    if (longPressTimer.current) clearTimeout(longPressTimer.current);
                  }}
                  className="text-xs text-[var(--text-secondary)] font-mono hover:text-[var(--text)] transition-colors select-none"
                >
                  VERSION 1.0.0
                </button>
                <p className="text-xs text-[var(--text-secondary)] font-mono uppercase tracking-widest">SMART EDT © 2026</p>
              </div>
            </motion.div>
          )}

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
            <User size={22} strokeWidth={activeTab === 'account' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Mon Espace</span>
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
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
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
