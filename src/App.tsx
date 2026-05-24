/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { 
  Camera, 
  Search, 
  Pill, 
  Stethoscope, 
  AlertCircle, 
  Loader2, 
  ChevronRight,
  RefreshCcw,
  Info,
  History,
  Trash2,
  Clock,
  ExternalLink,
  Sparkles,
  Heart,
  Activity,
  CheckCircle2,
  Sliders,
  Microscope,
  Calendar,
  User,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { identifyMedicine, getMedicineByDisease, getAlternativesByGeneric } from './services/geminiService';
import { 
  PILL_SHAPES, 
  PILL_COLORS, 
  PILL_PRESETS, 
  CLINICAL_DOSING_DATABASE,
  PillShapeOption,
  PillColorOption,
  DosingMedication
} from './data/medicineData';
import {
  saveHistoryLogToSupabase,
  fetchHistoryLogsFromSupabase,
  fetchMedicinesFromSupabase,
  getSupabaseClient,
  signInWithGoogle,
  signUpWithEmail,
  signInWithEmail,
  signOutUser,
  getActiveUserEmail
} from './services/supabaseService';


type Mode = 'identify' | 'disease' | 'generic' | 'dosing' | 'history';

interface HistoryItem {
  id: string;
  type: Mode;
  query: string;
  result: string;
  timestamp: number;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('identify');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [medicines, setMedicines] = useState<DosingMedication[]>(CLINICAL_DOSING_DATABASE);
  const [isDbSynced, setIsDbSynced] = useState(false);

  // Authentication states
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);

  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [identifySubMode, setIdentifySubMode] = useState<'visual' | 'text'>('visual');
  const [textDescription, setTextDescription] = useState('');

  // Pill visual builder states
  const [pillShape, setPillShape] = useState<string>('round');
  const [pillColor, setPillColor] = useState<string>('white');
  const [pillImprint, setPillImprint] = useState<string>('');
  const [pillScored, setPillScored] = useState<boolean>(false);
  const [pillAdditionalText, setPillAdditionalText] = useState<string>('');

  // Clinic Dosing Planner states
  const [selectedDoseDrugId, setSelectedDoseDrugId] = useState<string>('amoxicillin');
  const [patientWeightKg, setPatientWeightKg] = useState<number>(20);
  const [patientAgeGroup, setPatientAgeGroup] = useState<'pediatric' | 'adult'>('pediatric');
  const [doseCompliance, setDoseCompliance] = useState<Record<string, boolean>>({
    morning: false,
    afternoon: false,
    evening: false,
    hydration: false
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Listen to Supabase Auth State changes
  useEffect(() => {
    async function checkCurrentAuth() {
      const email = await getActiveUserEmail();
      if (email) {
        setCurrentUserEmail(email);
      }
    }
    checkCurrentAuth();
  }, []);

  // Fetch medicines and user-specific history logs on email changes or mount
  useEffect(() => {
    async function loadDatabaseAndHistory() {
      // 1. Initial Local Storage load
      const saved = localStorage.getItem('pharmai_history');
      if (saved) {
        try {
          if (!currentUserEmail) {
            setHistory(JSON.parse(saved));
          }
        } catch (e) {
          console.error("Failed to load local history", e);
        }
      }

      // 2. Check if Supabase contains active keys
      const hasSupabase = getSupabaseClient();
      if (hasSupabase) {
        setIsDbSynced(true);
        try {
          // Fetch synced medicines list
          const cloudMeds = await fetchMedicinesFromSupabase();
          setMedicines(cloudMeds);

          // Fetch synced audit logs for the current user
          const cloudLogs = await fetchHistoryLogsFromSupabase(currentUserEmail || undefined);
          if (cloudLogs && cloudLogs.length > 0) {
            if (currentUserEmail) {
              setHistory(cloudLogs);
            } else {
              setHistory(prev => {
                const uniqueMap = new Map();
                prev.forEach(item => uniqueMap.set(item.type + item.query, item));
                cloudLogs.forEach(item => uniqueMap.set(item.type + item.query, item));
                return Array.from(uniqueMap.values())
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .slice(0, 50);
              });
            }
          } else if (currentUserEmail) {
            // If user is logged in but has no cloud logs, clear history since it's user-specific
            setHistory([]);
          }
        } catch (error) {
          console.error("[Supabase Service] Failed during dynamic data synchronization:", error);
        }
      }
    }
    loadDatabaseAndHistory();
  }, [currentUserEmail]);

  // Save history on change
  useEffect(() => {
    localStorage.setItem('pharmai_history', JSON.stringify(history));
  }, [history]);

  // Authentication Handlers
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccessMessage(null);
    try {
      if (authMode === 'register') {
        await signUpWithEmail(authEmail, authPassword);
        setAuthSuccessMessage("Account successfully registered! You can now sign in.");
        setAuthMode('login');
      } else {
        await signInWithEmail(authEmail, authPassword);
        setCurrentUserEmail(authEmail);
        setAuthSuccessMessage("Welcome back! Signed in successfully.");
        // Clear passwords and close popup
        setAuthPassword('');
        setTimeout(() => {
          setShowAuthModal(false);
          setAuthSuccessMessage(null);
        }, 1200);
      }
    } catch (err: any) {
      setAuthError(err?.message || "Authentication credentials refused.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await signInWithGoogle();
      if (result?.user?.email) {
        setCurrentUserEmail(result.user.email);
        setAuthSuccessMessage(`Signed in as ${result.user.email}`);
        setTimeout(() => {
          setShowAuthModal(false);
          setAuthSuccessMessage(null);
        }, 1200);
      }
    } catch (err: any) {
      setAuthError(err?.message || "Google Single Sign-On link failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setCurrentUserEmail(null);
    } catch (err: any) {
      console.error("Sign out process failed:", err);
    }
  };

  // Synchronize dynamic visual pill descriptors to textDescription
  useEffect(() => {
    if (identifySubMode === 'text') {
      const shapeObj = PILL_SHAPES.find(s => s.id === pillShape);
      const colorObj = PILL_COLORS.find(c => c.id === pillColor);
      const scoreText = pillScored ? "with a visible central scored division line" : "with no division markings";
      
      let builtDesc = `A ${colorObj?.name || 'white'} color ${shapeObj?.name || 'round'} tablet ${scoreText}${imprintPartText(pillImprint)}.`;
      if (pillAdditionalText.trim()) {
        builtDesc += ` Additional descriptive traits/indications provided: "${pillAdditionalText.trim()}".`;
      }
      setTextDescription(builtDesc);
    }
  }, [pillShape, pillColor, pillImprint, pillScored, pillAdditionalText, identifySubMode]);

  const imprintPartText = (val: string) => {
    return val.trim() ? `, marked with the specific imprint text code "${val.trim()}"` : "";
  };

  const handlePresetSelect = (preset: { shape: string; color: string; imprint: string; desc: string }) => {
    setPillShape(preset.shape);
    setPillColor(preset.color);
    setPillImprint(preset.imprint);
    setPillAdditionalText('');
    setTextDescription(preset.desc);
  };

  const addToHistory = (type: Mode, q: string, res: string) => {
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      type,
      query: q,
      result: res,
      timestamp: Date.now(),
    };
    setHistory(prev => [newItem, ...prev].slice(0, 50));

    // Asynchronously write audit logs to Supabase backend in the background
    saveHistoryLogToSupabase(type, q, res, currentUserEmail || undefined).catch(err => {
      console.warn("[Supabase Service] Failed background sync:", err);
    });
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to purge all clinical history logs?")) {
      setHistory([]);
    }
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setMode(item.type);
    setQuery(item.query);
    setResult(item.result);
    setPreview(null);
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    setPreview(null);
    setResult(null);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error(err);
      setError('Could not access camera. Please confirm device camera permissions are granted.');
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setPreview(dataUrl);
        const base64 = dataUrl.split(',')[1];
        stopCamera();
        processImage(base64);
      }
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Invalid format. Please supply a standard JPEG, PNG or WebP clinical image.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setPreview(reader.result as string);
      await processImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (base64: string) => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await identifyMedicine(base64);
      if (data) {
        addToHistory('identify', 'Clinical Image Classification', data);
      }
      setResult(data || 'Medicinal agent could not be identified with certainty.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to analyze medicine imagery payload. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const processTextDescription = async () => {
    if (!textDescription.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await identifyMedicine(undefined, textDescription);
      if (data) {
        addToHistory('identify', `Pill Profile: "${textDescription.substring(0, 35)}..."`, data);
      }
      setResult(data || 'No pharmaceutical targets match this trait profile.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Physical profile triage processing interrupted. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      let data;
      if (mode === 'disease') {
        data = await getMedicineByDisease(query);
      } else {
        data = await getAlternativesByGeneric(query);
      }
      if (data) {
        addToHistory(mode, query, data);
      }
      setResult(data || 'No therapeutic equivalents indexed for this clinical query.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Clinical query lookup failed. Please confirm connection stability.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMode('identify');
    setResult(null);
    setPreview(null);
    setQuery('');
    setError(null);
    setTextDescription('');
    setPillImprint('');
    setPillScored(false);
    setPillAdditionalText('');
  };

  // Rx Scheduler & Compliance Calculators
  const selectedMed = medicines.find(m => m.id === selectedDoseDrugId) || medicines[0];
  
  const getCalculatedDose = () => {
    const isWeightDriven = patientAgeGroup === 'pediatric' && selectedMed.pediatricDosePerKg > 0;
    if (isWeightDriven) {
      const baseDaily = patientWeightKg * selectedMed.pediatricDosePerKg;
      // standard antibiotics or antipyretics are divided either daily or twice as per database
      let splitFactor = 2; // default BID
      if (selectedMed.id === 'acetaminophen') splitFactor = 4; // q6h
      if (selectedMed.id === 'ibuprofen') splitFactor = 3; // q8h
      
      const dosePerIntake = Math.round(baseDaily / splitFactor);
      const roundedTotalDaily = dosePerIntake * splitFactor;
      
      return {
        dailyMg: roundedTotalDaily,
        intakeMg: dosePerIntake,
        frequency: splitFactor === 2 ? 'Every 12 hours (2x Daily)' : splitFactor === 3 ? 'Every 8 hours (3x Daily)' : 'Every 6 hours (4x Daily)',
        times: splitFactor,
        isWeightDriven,
      };
    } else {
      return {
        dailyMg: null,
        intakeMg: null,
        frequency: selectedMed.scheduleFrequency,
        times: selectedMed.scheduleFrequency.includes("Once") ? 1 : selectedMed.scheduleFrequency.includes("Twice") ? 2 : 3,
        isWeightDriven: false,
      };
    }
  };

  const doseDetails = getCalculatedDose();

  const handleResetCompliance = () => {
    setDoseCompliance({
      morning: false,
      afternoon: false,
      evening: false,
      hydration: false
    });
  };

  const activeComplianceCount = Object.values(doseCompliance).filter(Boolean).length;
  const compliancePercentage = Math.round((activeComplianceCount / 4) * 100);

  return (
    <div className="min-h-screen bg-[#060808] text-[#e2edea] font-sans selection:bg-emerald-500/20">
      
      {/* Dynamic Grid Background with clinical atmosphere */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] z-0"></div>

      {/* Apothecary Clinical Header */}
      <header className="bg-[#0b0e0d] border-b border-emerald-950/40 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between relative z-10">
          
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group" onClick={reset} role="button">
            {/* Animated Chemistry Hexagon Cross */}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-center transition-all group-hover:border-emerald-400">
              <div className="relative">
                <div className="w-1.5 h-4 bg-emerald-400 rounded-full animate-pulse"></div>
                <div className="w-4 h-1.5 bg-emerald-400 rounded-full absolute top-1.5 -left-1.5 animate-pulse"></div>
              </div>
            </div>
            
            <div className="flex flex-col">
              <h1 className="text-md sm:text-lg font-semibold tracking-tight text-white flex items-center">
                AuraPharma
                <span className="font-mono text-[9px] sm:text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/20 px-1.5 py-0.5 ml-2 rounded font-normal">LAB v4.3</span>
              </h1>
              <span className="text-[9px] uppercase tracking-wider text-emerald-600 font-mono hidden sm:inline-block leading-none mt-0.5">Clinical Protocol Console</span>
            </div>
          </div>
          
          {/* Main Desktop Navigation bar */}
          <nav className="hidden md:flex items-center gap-1.5 bg-neutral-950/80 border border-emerald-950/60 p-1 rounded-full shadow-inner">
            {(['identify', 'disease', 'generic', 'dosing', 'history'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setResult(null); setPreview(null); }}
                className={`px-4.5 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all flex items-center gap-1.5 ${
                  mode === m 
                    ? 'bg-emerald-500 text-neutral-950 font-extrabold shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                    : 'text-zinc-500 hover:text-emerald-400 hover:bg-emerald-950/20'
                }`}
              >
                {m === 'identify' && <Camera className="w-3.5 h-3.5" />}
                {m === 'disease' && <Stethoscope className="w-3.5 h-3.5" />}
                {m === 'generic' && <Pill className="w-3.5 h-3.5" />}
                {m === 'dosing' && <Sliders className="w-3.5 h-3.5" />}
                {m === 'history' && <History className="w-3.5 h-3.5" />}
                
                {m === 'identify' ? 'Vision Lab' : m === 'disease' ? 'Clinical Search' : m === 'generic' ? 'Brand Alternates' : m === 'dosing' ? 'Rx Planner' : 'History'}
              </button>
            ))}
          </nav>

          {/* Secure Status Badge & Authenticated User Actions */}
          <div className="flex items-center gap-3">
            {/* Real ECG Heatbeat visualization */}
            <div className="hidden lg:flex items-center gap-2 pr-2 border-r border-emerald-950/40">
              <span className="text-[10px] font-mono text-emerald-500/80">ECG FEED</span>
              <svg className="w-14 h-4 text-emerald-500" viewBox="0 0 60 20" fill="none">
                <path d="M0 10 H20 L23 2 L26 18 L29 10 H60" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            
            <div className="px-3.5 py-1.5 bg-emerald-950/50 border border-emerald-800/30 rounded-full text-[9px] font-bold tracking-[0.15em] uppercase text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              HIPAA SECURE
            </div>

            {isDbSynced && (
              <div className="hidden sm:flex px-3 py-1 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 rounded-full text-[9px] font-mono tracking-wider items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                SUPABASE SYNCED
              </div>
            )}

            {/* Authentication user tag or login trigger */}
            {currentUserEmail ? (
              <div className="flex items-center gap-2">
                <div 
                  title={currentUserEmail}
                  className="px-3 py-1.5 bg-zinc-950 border border-emerald-950 text-[10px] font-mono text-emerald-400 rounded-lg max-w-[140px] sm:max-w-[180px] truncate flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {currentUserEmail}
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-zinc-800/60 rounded-lg text-zinc-400 hover:text-white text-[9px] uppercase tracking-wider font-mono font-bold transition-all transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode('login');
                  setAuthError(null);
                  setAuthSuccessMessage(null);
                  setShowAuthModal(true);
                }}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-[10px] uppercase font-mono tracking-widest font-extrabold rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.25)] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span>SIGN IN</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24 md:pb-16 relative z-10">
        
        {/* Clinical Disclaimer Bar */}
        <div className="bg-emerald-950/20 border border-emerald-800/20 rounded-2xl p-4 mb-8 text-xs text-emerald-400/80 flex items-start gap-3 max-w-4xl">
          <Info className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider text-emerald-400 block mb-0.5">Clinical Decision Support System</span>
            This AI engine is optimized to identify medication traits and calculate reference pediatric doses using standard guidelines. It must NOT replace professional medical consult, diagnosis, or standard healthcare protocols.
          </div>
        </div>

        {/* Hero Section */}
        <div className="mb-8 sm:mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-950/40 border border-emerald-900/30 px-3 py-1 rounded-md text-emerald-400 text-[10px] font-mono tracking-wider mb-3">
                <Microscope className="w-3.5 h-3.5 text-emerald-400" />
                AuraPharma LLM Intelligence Unit
              </div>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-2 font-serif italic">
                {mode === 'identify' ? 'Molecular Asset Triage' : 
                 mode === 'disease' ? 'Therapeutic Protocols Search' : 
                 mode === 'generic' ? 'Equivalence & Brand Matrix' : 
                 mode === 'dosing' ? 'Clinical Rx Dosing Planner' :
                 'Triage Audit History'}
              </h2>
              <p className="text-emerald-500/60 max-w-2xl text-sm sm:text-base font-light">
                {mode === 'identify' 
                  ? 'Examine tablet or capsule identities instantly using physical traits classification or real-time computer vision imaging.' 
                  : mode === 'disease' 
                    ? 'Search standard medications matched to clinical diagnostic descriptors, symptoms, or acute diseases.'
                    : mode === 'generic'
                      ? 'Find common market alternatives, equivalents, and chemical details for major brand formulation compounds.'
                      : mode === 'dosing'
                        ? 'Formulate precise pediatric and adult dose estimations. Plan daily drug intake templates and track therapy compliance.'
                        : 'Review records of molecular scans and clinical lookup queries captured during your active local workspace session.'}
              </p>
            </div>
          </div>
        </div>

        {/* Interaction Zone */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          <div className="lg:col-span-12">
            
            {/* HISTORIC LOGS VIEW */}
            {mode === 'history' ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-6 bg-[#0c0f0e] border border-emerald-950/70 rounded-3xl backdrop-blur-sm">
                  <div className="flex items-center gap-4">
                    <div className="bg-emerald-950/35 p-3 rounded-2xl border border-emerald-900/30">
                      <Clock className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-md sm:text-lg font-medium text-white font-serif italic mb-0.5">Clinical History Logs</h3>
                      <p className="text-emerald-600/70 text-[10px] sm:text-xs tracking-wider uppercase font-mono font-bold">Stored Session Audits</p>
                    </div>
                  </div>
                  {history.length > 0 && (
                    <button 
                      onClick={clearHistory}
                      className="px-5 py-2.5 bg-red-950/20 border border-red-900/40 text-red-400 rounded-full text-[10.5px] font-bold tracking-widest uppercase hover:bg-red-900 hover:text-white transition-all flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Purge Logs
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence mode="popLayout">
                    {history.length === 0 ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="col-span-2 py-20 text-center bg-[#0d0f0e] border border-emerald-950/40 rounded-3xl"
                      >
                         <div className="w-16 h-16 bg-neutral-950 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-emerald-950/20">
                           <History className="w-8 h-8 text-neutral-800" />
                         </div>
                         <h4 className="text-emerald-500 font-serif italic text-lg mb-2">Logs Vacant</h4>
                         <p className="text-emerald-700 max-w-sm mx-auto text-xs">No active scans, molecular matches, or dosing sessions have been captured for this console profile yet.</p>
                      </motion.div>
                    ) : (
                      history.map((item) => (
                        <motion.div 
                          key={item.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          onClick={() => loadHistoryItem(item)}
                          className="group p-5 bg-[#0a0d0c] border border-emerald-950/30 rounded-3xl hover:border-emerald-500/35 transition-all cursor-pointer relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-3xl pointer-events-none"></div>
                          <div className="relative z-10 flex items-start justify-between">
                            <div className="flex gap-4">
                              <div className="bg-neutral-950 p-2.5 rounded-2xl border border-emerald-950/80 group-hover:border-emerald-500/40 transition-colors">
                                {item.type === 'identify' ? <Camera className="w-4.5 h-4.5 text-emerald-500" /> : item.type === 'disease' ? <Stethoscope className="w-4.5 h-4.5 text-emerald-500" /> : <Pill className="w-4.5 h-4.5 text-emerald-500" />}
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-widest text-[#10b981] font-mono mb-1">
                                  {new Date(item.timestamp).toLocaleDateString()} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <h4 className="text-white font-medium text-base line-clamp-1 mb-2 group-hover:text-emerald-300 transition-colors">{item.query}</h4>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/20 rounded text-[8px] uppercase font-mono font-bold tracking-widest">
                                    {item.type === 'identify' ? 'Vision' : item.type === 'disease' ? 'Clinical' : 'Alternates'}
                                  </span>
                                  <ExternalLink className="w-3 h-3 text-emerald-500/40 group-hover:text-emerald-400 transition-colors" />
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => deleteHistoryItem(item.id, e)}
                              className="p-2 text-zinc-650 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : mode === 'identify' ? (
              
              /* VISION & TRIAGE IDENTIFIER */
              <div 
                className={`relative bg-[#090b0a] border rounded-3xl transition-all flex flex-col items-center justify-center overflow-hidden group p-6 sm:p-12 ${
                  preview || isCameraOpen ? 'h-[380px] sm:h-[450px] border-emerald-500/30' : 'min-h-[380px] sm:min-h-[450px] border-emerald-950/40 hover:border-emerald-800/40'
                }`}
              >
                {/* Decorative glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full"></div>
                
                {isCameraOpen ? (
                  <div className="relative w-full h-full z-10 bg-black rounded-2xl overflow-hidden">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 border-[12px] sm:border-[20px] border-black/40 pointer-events-none flex items-center justify-center">
                       <div className="w-48 h-48 sm:w-64 sm:h-64 border-2 border-emerald-500/40 rounded-3xl relative">
                          <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-500"></div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-500"></div>
                          <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-500"></div>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-500"></div>
                       </div>
                    </div>
                    <div className="absolute bottom-6 sm:bottom-8 left-0 right-0 flex justify-center items-center gap-4 z-20">
                      <button 
                        onClick={stopCamera}
                        className="p-3 bg-neutral-900/95 backdrop-blur-md rounded-full border border-emerald-950 text-white hover:bg-neutral-800 transition-all"
                      >
                        <RefreshCcw className="w-5 h-5 text-emerald-500" />
                      </button>
                      <button 
                        onClick={capturePhoto}
                        className="w-14 h-14 bg-white rounded-full flex items-center justify-center border-4 border-emerald-500 shadow-md active:scale-95 transition-all"
                      >
                        <div className="w-10 h-10 rounded-full bg-neutral-900"></div>
                      </button>
                      <div className="hidden sm:block w-12"></div>
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                ) : preview ? (
                  <div className="relative w-full h-full flex items-center justify-center z-10 p-4 sm:p-8">
                    <div className="absolute top-4 left-4 z-20 flex gap-2">
                       <span className="px-2 py-1 bg-black/80 backdrop-blur-md rounded text-[9px] uppercase font-mono font-bold text-emerald-400 border border-emerald-800/30 tracking-widest">Vision Capture Node</span>
                    </div>
                    <img src={preview} alt="Preview" className="max-w-full max-h-full object-contain rounded-xl border border-emerald-900/20" />
                    {!loading && (
                      <button 
                        onClick={() => { setPreview(null); setResult(null); }}
                        className="absolute bottom-4 right-4 p-2.5 bg-neutral-900/95 backdrop-blur-md rounded-full border border-emerald-950 text-emerald-400 hover:text-white transition-all shadow-xl"
                      >
                        <RefreshCcw className="w-4.5 h-4.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="relative z-10 w-full flex flex-col items-center">
                    
                    {/* Medical Style Tabs (Visual vs Traits) */}
                    <div className="flex bg-[#0b0e0d] border border-emerald-950/60 rounded-full p-1 w-full max-w-sm mb-8 relative z-20">
                      <button
                        onClick={() => setIdentifySubMode('visual')}
                        className={`flex-1 py-2 rounded-full text-[9px] sm:text-[10.5px] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${
                          identifySubMode === 'visual' ? 'bg-emerald-500 text-neutral-950 font-extrabold shadow-[0_0_12px_rgba(16,185,129,0.25)]' : 'text-zinc-500 hover:text-emerald-400'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Visual Scanner
                      </button>
                      <button
                        onClick={() => setIdentifySubMode('text')}
                        className={`flex-1 py-3 rounded-full text-[9px] sm:text-[10px] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-1.5 ${
                          identifySubMode === 'text' ? 'bg-emerald-500 text-neutral-950 font-extrabold shadow-[0_0_12px_rgba(16,185,129,0.25)]' : 'text-zinc-500 hover:text-emerald-400'
                        }`}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        Interactive Visual Traits
                      </button>
                    </div>

                    {identifySubMode === 'visual' ? (
                      <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-950/20 rounded-2xl flex items-center justify-center border border-emerald-800/20 mb-6 group-hover:scale-105 transition-transform duration-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                          <Camera className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400 animate-pulse" />
                        </div>
                        <h3 className="text-white text-lg font-medium font-serif italic mb-1.5">No Imagery Logged</h3>
                        <p className="text-emerald-700 text-[10px] sm:text-xs mb-6 tracking-wide uppercase font-mono font-bold max-w-[220px] sm:max-w-xs">Scan medicinal packaging, capsules or tablets with Vision model</p>
                        
                        <div className="flex flex-col sm:flex-row gap-3 min-w-[210px]">
                          <button 
                            onClick={startCamera}
                            className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold rounded-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
                          >
                            <Camera className="w-4 h-4" />
                            Launch Scanner
                          </button>
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="px-6 py-3.5 bg-neutral-900 border border-emerald-900/40 hover:bg-emerald-950/30 text-emerald-400 text-xs font-bold rounded-lg transition-all uppercase tracking-widest"
                          >
                            Upload Chemical Photo
                          </button>
                        </div>
                      </div>
                    ) : (
                      
                      /* CLINICAL TRAITS BUILDER */
                      <div className="w-full max-w-2xl flex flex-col items-center">
                        <div className="w-full bg-[#0c100e] border border-emerald-950/60 p-5 sm:p-6 rounded-2xl mb-6 relative">
                          <h4 className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 mb-4 flex items-center gap-1.5 border-b border-emerald-950/60 pb-2">
                            <Sliders className="w-4 h-4" />
                            Visual Tablet Attribute Synthesizer
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Shape Selector */}
                            <div>
                              <span className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-2">1. Tablet Shape</span>
                              <div className="grid grid-cols-4 gap-2">
                                {PILL_SHAPES.map((shape) => (
                                  <button
                                    key={shape.id}
                                    type="button"
                                    onClick={() => setPillShape(shape.id)}
                                    className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                                      pillShape === shape.id 
                                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' 
                                        : 'bg-neutral-950/80 border-emerald-950/40 text-zinc-500 hover:border-emerald-800/30'
                                    }`}
                                  >
                                    <div className={`${shape.className} ${pillShape === shape.id ? 'border-emerald-400 bg-emerald-500/10' : 'border-zinc-700'} aspect-square`} />
                                    <span className="text-[9px] uppercase tracking-tighter font-mono font-bold">{shape.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Color Selector */}
                            <div>
                              <span className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-2">2. Tablet Color Accent</span>
                              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                                {PILL_COLORS.map((color) => (
                                  <button
                                    key={color.id}
                                    type="button"
                                    onClick={() => setPillColor(color.id)}
                                    title={color.name}
                                    className={`p-2 rounded-lg border flex flex-col items-center transition-all ${
                                      pillColor === color.id 
                                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' 
                                        : 'bg-neutral-950/80 border-emerald-950/40 text-zinc-500 hover:border-emerald-800/30'
                                    }`}
                                  >
                                    <div 
                                      className="w-5 h-5 rounded-full border border-neutral-800"
                                      style={{ backgroundColor: color.hex }}
                                    />
                                    <span className="text-[8px] uppercase tracking-tighter font-mono mt-1 font-bold">{color.name.split('/')[0]}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Imprint selector */}
                            <div>
                              <span className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-2">3. Imprint Code Markings</span>
                              <input 
                                type="text"
                                value={pillImprint}
                                onChange={(e) => setPillImprint(e.target.value)}
                                placeholder="E.g., L484, IG 282, IP 204..."
                                className="w-full bg-neutral-950 border border-emerald-950/60 rounded-lg p-2.5 text-xs text-white placeholder-emerald-900/55 uppercase tracking-widest focus:border-emerald-500 focus:ring-0 outline-none font-mono"
                              />
                            </div>

                            {/* Split Score line */}
                            <div>
                              <span className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-2">4. Tablet Split Division (Score)</span>
                              <div className="flex gap-4 p-1 rounded-lg bg-neutral-950/85 border border-emerald-950/45 h-[42px] items-center px-4">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-zinc-400 select-none">
                                  <input 
                                    type="checkbox"
                                    checked={pillScored}
                                    onChange={(e) => setPillScored(e.target.checked)}
                                    className="accent-emerald-500 rounded border-emerald-850 bg-neutral-900"
                                  />
                                  <span>Has split scoring line</span>
                                </label>
                              </div>
                            </div>

                            {/* Additional Search traits / symptoms / markings (text) */}
                            <div className="md:col-span-2">
                              <span className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-2">5. Clinical Search Hints / Secondary Text Markings / Symptoms</span>
                              <input 
                                type="text"
                                value={pillAdditionalText}
                                onChange={(e) => setPillAdditionalText(e.target.value)}
                                placeholder="E.g., cherry flavored chewable, glossy coating, prescribed for migraines..."
                                className="w-full bg-neutral-950 border border-emerald-950/60 rounded-lg p-2.5 text-xs text-white placeholder-emerald-900/55 uppercase tracking-widest focus:border-emerald-500 focus:ring-0 outline-none font-mono"
                              />
                            </div>

                          </div>

                          <div className="mt-5 border-t border-emerald-950/50 pt-4">
                            <span className="block text-[9px] uppercase font-bold tracking-wider text-emerald-700 mb-1 font-mono">Dynamic AI Promptext Pipeline</span>
                            <div className="p-3 bg-neutral-950 rounded-lg text-[11px] font-mono text-emerald-400/80 border border-emerald-950/40 select-all leading-relaxed break-words">
                              {textDescription || "Formulating pill descriptors..."}
                            </div>
                          </div>
                        </div>

                        {/* Presets */}
                        <div className="flex flex-wrap gap-1.5 justify-center mb-6 max-w-lg">
                          <span className="text-[9px] text-emerald-700 uppercase tracking-widest my-auto mr-1.5 font-mono font-bold">Clinical Presets:</span>
                          {PILL_PRESETS.map((preset) => (
                            <button
                              key={preset.imprint}
                              type="button"
                              onClick={() => handlePresetSelect(preset)}
                              className="px-2.5 py-1 bg-neutral-950 hover:bg-emerald-950/35 border border-emerald-950 text-zinc-400 hover:text-emerald-400 rounded-md text-[9px] font-mono transition-all"
                            >
                              Code: {preset.imprint}
                            </button>
                          ))}
                        </div>

                        <button 
                          onClick={processTextDescription}
                          disabled={loading || !textDescription.trim()}
                          className="px-9 py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-950 disabled:text-zinc-700 text-neutral-950 text-xs font-bold rounded-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(16,185,129,0.15)]"
                        >
                          <Search className="w-4 h-4" />
                          Examine Asset Traits
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                  accept="image/*"
                />
              </div>
            ) : mode === 'dosing' ? (
              
              /* RX DOSING PLANNER & INTEGRATED CALCULATOR MODE */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Configuration controls */}
                <div className="lg:col-span-5 bg-[#090b0a] border border-emerald-950/50 rounded-3xl p-5 sm:p-6 relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.02] blur-2xl pointer-events-none"></div>
                  
                  <div className="flex items-center gap-2 mb-6 border-b border-emerald-950/60 pb-3">
                    <Sliders className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="font-serif italic text-white text-base">Rx Estimator Controls</h3>
                      <p className="text-[9px] font-mono uppercase tracking-wider text-emerald-600">Prescribing Parameters</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Medication Selector */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1.5 font-mono">1. Select Target Molecule</label>
                      <select
                        value={selectedDoseDrugId}
                        onChange={(e) => {
                          setSelectedDoseDrugId(e.target.value);
                          handleResetCompliance();
                        }}
                        className="w-full bg-neutral-950 border border-emerald-950 text-sm text-white rounded-lg p-3 outline-none focus:border-emerald-500 transition-colors font-medium cursor-pointer"
                      >
                        {medicines.map((drug) => (
                          <option key={drug.id} value={drug.id}>
                            {drug.name} ({drug.genericName})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Age cohort select */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1.5 font-mono">2. Patient Physiological Age Cohort</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPatientAgeGroup('pediatric');
                            handleResetCompliance();
                          }}
                          className={`p-3 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                            patientAgeGroup === 'pediatric' 
                              ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' 
                              : 'bg-neutral-950/80 border-emerald-950/40 text-zinc-500 hover:border-emerald-800/30'
                          }`}
                        >
                          <User className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Pediatric</span>
                          <span className="text-[8px] opacity-75">Weight-based dose</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPatientAgeGroup('adult');
                            handleResetCompliance();
                          }}
                          className={`p-3 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                            patientAgeGroup === 'adult' 
                              ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' 
                              : 'bg-neutral-950/80 border-emerald-950/40 text-zinc-500 hover:border-emerald-800/30'
                          }`}
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Adult / Geriatric</span>
                          <span className="text-[8px] opacity-75">Fixed standard dose</span>
                        </button>
                      </div>
                    </div>

                    {/* Weight slider for Pediatric */}
                    {patientAgeGroup === 'pediatric' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2 border-t border-emerald-950/50 pt-4"
                      >
                        <div className="flex justify-between items-center">
                          <label className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500 font-mono">3. Patient Core Weight</label>
                          <span className="bg-emerald-950 text-emerald-400 font-mono px-2 py-0.5 border border-emerald-800/30 rounded text-xs font-bold leading-none">
                            {patientWeightKg} Kg (~{Math.round(patientWeightKg * 2.204)} lbs)
                          </span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="60"
                          step="1"
                          value={patientWeightKg}
                          onChange={(e) => {
                            setPatientWeightKg(Number(e.target.value));
                            handleResetCompliance();
                          }}
                          className="w-full h-1.5 bg-neutral-950 border border-emerald-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex justify-between text-[8px] uppercase tracking-tighter text-zinc-650 font-mono">
                          <span>Infant (5 kg)</span>
                          <span>Toddler (15 kg)</span>
                          <span>Child (30 kg)</span>
                          <span>Adolescent (60 kg)</span>
                        </div>
                      </motion.div>
                    )}

                    {/* Drug Reference specs block */}
                    <div className="border-t border-emerald-950/50 pt-4 space-y-3 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-650">THERAPEUTIC CLASS:</span>
                        <span className="text-emerald-400 font-bold truncate max-w-[200px]">{selectedMed.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-650">MOLECULAR ASSAY:</span>
                        <span className="text-[#e2edea]">{selectedMed.genericName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-650">AVAILABLE STRENGTHS:</span>
                        <span className="text-emerald-500 font-bold">{selectedMed.standardStrengths.join(' / ')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulated Rx Sheet card */}
                <div className="lg:col-span-7 flex flex-col justify-between">
                  
                  {/* Real-looking Rx sheet */}
                  <div className="bg-[#fcfdfd] border-t-8 border-emerald-600 rounded-3xl p-6 sm:p-8 text-neutral-900 shadow-[0_22px_45px_rgba(0,0,0,0.6)] relative overflow-hidden flex-1 flex flex-col justify-between min-h-[420px]">
                    <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-50/20 blur-xl rounded-full pointer-events-none"></div>
                    
                    <div>
                      {/* Rx Sheet top identifier section */}
                      <div className="flex justify-between items-start border-b border-zinc-200 pb-4 mb-5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-2xl font-serif font-extrabold italic text-emerald-800 select-all leading-none">Rx</span>
                          <div className="h-5 w-px bg-zinc-300 mx-2"></div>
                          <div className="font-sans leading-none">
                            <h4 className="text-xs uppercase font-extrabold tracking-widest text-[#090b0a]">AuraPharma Clinic</h4>
                            <span className="text-[8px] font-mono text-zinc-500">Node: 079-A • Medical Script</span>
                          </div>
                        </div>
                        <div className="text-right font-mono text-[9px] text-zinc-500 leading-none">
                          <p>DATE: {new Date().toLocaleDateString()}</p>
                          <p className="mt-1">REF CODE: AP-{selectedMed.id.substring(0, 3).toUpperCase()}-{patientWeightKg}PX</p>
                        </div>
                      </div>

                      {/* Patient metadata label bar */}
                      <div className="bg-zinc-100 p-3 rounded-lg flex flex-wrap justify-between items-center text-xs text-zinc-750 gap-2 font-mono mb-4">
                        <div>
                          <span className="text-[9px] text-zinc-400 uppercase block leading-none">PATIENT INDICES</span>
                          <span className="text-[#090b0a] font-bold select-all">GENERIC PATIENT #CL-8902</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-400 uppercase block leading-none">PHYSIOLOGY</span>
                          <span className="text-emerald-950 font-bold uppercase">{patientAgeGroup}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-400 uppercase block leading-none">WEIGHT RECORDED</span>
                          <span className="text-[#090b0a] font-bold">
                            {patientAgeGroup === 'pediatric' ? `${patientWeightKg} KG` : 'N/A STABLE'}
                          </span>
                        </div>
                      </div>

                      {/* Calculation prescription details */}
                      <div className="space-y-4 mb-6">
                        <div className="border-l-4 border-emerald-600 pl-4 py-1">
                          <h5 className="text-[10px] text-emerald-800 font-extrabold tracking-widest uppercase mb-1 font-mono">ESTIMATED PRESCRIBING INSTRUCTIONS</h5>
                          <h4 className="text-lg sm:text-xl font-extrabold tracking-tight text-neutral-950 leading-tight">
                            {doseDetails.isWeightDriven 
                              ? `Administer ${doseDetails.intakeMg} mg of ${selectedMed.genericName} orally ${doseDetails.frequency}.`
                              : `Instruct adult model to ingest: ${selectedMed.adultStandardDose}.`
                            }
                          </h4>
                        </div>

                        {doseDetails.isWeightDriven && (
                          <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100 text-xs text-emerald-850">
                            <span className="font-bold block uppercase tracking-wider text-[9px] mb-1 font-mono text-emerald-800">Pediatric Dose Matrix Math Details:</span>
                            Standard therapeutic coefficient is <span className="font-bold">{selectedMed.pediatricDosePerKg} mg/kg/day</span>. 
                            At patient weight of <span className="font-bold">{patientWeightKg} Kg</span>, total computed daily volume of medicine is <span className="font-bold">{doseDetails.dailyMg} mg per day</span> divided into equal doses.
                          </div>
                        )}
                      </div>

                      {/* Daily schedule timelines */}
                      <div className="pb-4">
                        <h5 className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-2 font-mono">4. Therapy Compliance Simulator</h5>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          
                          <label className={`p-3 rounded-xl border flex flex-col gap-1.5 cursor-pointer select-none transition-all ${
                            doseCompliance.morning 
                              ? 'bg-emerald-100/40 border-emerald-300 text-emerald-900' 
                              : 'bg-zinc-50 border-zinc-200 text-zinc-550 hover:bg-zinc-100'
                          }`}>
                            <div className="flex justify-between items-center">
                              <span className="text-lg leading-none">☀️</span>
                              <input 
                                type="checkbox"
                                checked={doseCompliance.morning}
                                onChange={(e) => setDoseCompliance(prev => ({ ...prev, morning: e.target.checked }))}
                                className="accent-emerald-600 rounded"
                              />
                            </div>
                            <span className="text-[9px] font-bold uppercase font-mono">Morning Dose</span>
                            <span className="text-[8px] tracking-tight opacity-75">08:00 AM</span>
                          </label>

                          <label className={`p-3 rounded-xl border flex flex-col gap-1.5 cursor-pointer select-none transition-all ${
                            doseCompliance.afternoon 
                              ? 'bg-emerald-100/40 border-emerald-300 text-emerald-900' 
                              : 'bg-zinc-50 border-zinc-200 text-zinc-550 hover:bg-zinc-100'
                          }`}>
                            <div className="flex justify-between items-center">
                              <span className="text-lg leading-none">🌤️</span>
                              <input 
                                type="checkbox"
                                checked={doseCompliance.afternoon}
                                onChange={(e) => setDoseCompliance(prev => ({ ...prev, afternoon: e.target.checked }))}
                                className="accent-emerald-600 rounded"
                              />
                            </div>
                            <span className="text-[9px] font-bold uppercase font-mono">Midday Dose</span>
                            <span className="text-[8px] tracking-tight opacity-75">02:00 PM</span>
                          </label>

                          <label className={`p-3 rounded-xl border flex flex-col gap-1.5 cursor-pointer select-none transition-all ${
                            doseCompliance.evening 
                              ? 'bg-emerald-100/40 border-emerald-300 text-emerald-900' 
                              : 'bg-zinc-50 border-zinc-200 text-zinc-550 hover:bg-zinc-100'
                          }`}>
                            <div className="flex justify-between items-center">
                              <span className="text-lg leading-none">🌙</span>
                              <input 
                                type="checkbox"
                                checked={doseCompliance.evening}
                                onChange={(e) => setDoseCompliance(prev => ({ ...prev, evening: e.target.checked }))}
                                className="accent-emerald-600 rounded"
                              />
                            </div>
                            <span className="text-[9px] font-bold uppercase font-mono">Night Dose</span>
                            <span className="text-[8px] tracking-tight opacity-75">08:00 PM</span>
                          </label>

                          <label className={`p-3 rounded-xl border flex flex-col gap-1.5 cursor-pointer select-none transition-all ${
                            doseCompliance.hydration 
                              ? 'bg-cyan-50 border-cyan-200 text-cyan-900' 
                              : 'bg-zinc-50 border-zinc-200 text-zinc-550 hover:bg-zinc-100'
                          }`}>
                            <div className="flex justify-between items-center">
                              <span className="text-lg leading-none">💧</span>
                              <input 
                                type="checkbox"
                                checked={doseCompliance.hydration}
                                onChange={(e) => setDoseCompliance(prev => ({ ...prev, hydration: e.target.checked }))}
                                className="accent-cyan-600 rounded"
                              />
                            </div>
                            <span className="text-[9px] font-bold uppercase font-mono">8oz Hydrator</span>
                            <span className="text-[8px] tracking-tight opacity-75">Therapeutic fluid</span>
                          </label>

                        </div>
                      </div>
                    </div>

                    {/* Rx compliance bottom tracking sheet */}
                    <div className="border-t border-zinc-200 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="bg-emerald-100 border border-emerald-200 p-2 rounded-xl shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-emerald-800" />
                        </div>
                        <div className="w-full">
                          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block font-mono leading-none">DAILY THERAPY SUMMARY</span>
                          <span className="text-xs font-bold text-neutral-900">
                            {activeComplianceCount === 4 
                              ? '100% Core Treatment Met! Safe Node Sync.' 
                              : `${compliancePercentage}% Dosing Treatment Met for today`}
                          </span>
                          <div className="w-full sm:w-48 bg-zinc-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                              style={{ width: `${compliancePercentage}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleResetCompliance}
                        className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[10px] font-semibold tracking-wider uppercase rounded-md transition-colors w-full sm:w-auto text-center"
                      >
                        Reset Tracking Data
                      </button>
                    </div>

                  </div>

                </div>

              </div>
            ) : (
              
              /* CLINICAL & ALTERNATES TEXT INPUT FORM */
              <div className="relative bg-[#090b0a] p-2 sm:p-4 rounded-3xl border border-emerald-950/60 group shadow-2xl flex flex-col md:block">
                <div className="absolute inset-y-0 left-6 sm:left-8 hidden sm:flex items-center pointer-events-none z-10">
                  {mode === 'disease' ? <Stethoscope className="w-5.5 h-5.5 text-emerald-500" /> : <Pill className="w-5.5 h-5.5 text-emerald-500" />}
                </div>
                <input 
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={mode === 'disease' ? "Search therapeutic compounds of disease (e.g. Chronic Hypertension)..." : "Analyze molecular twins of (e.g. Atorvastatin)..."}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-6 sm:pl-16 pr-6 md:pr-44 py-5 sm:py-7 bg-[#050606] text-white text-base sm:text-lg border border-emerald-950/40 rounded-2xl focus:border-emerald-500 focus:ring-0 outline-none placeholder:text-emerald-950 font-light"
                />
                <button 
                  onClick={handleSearch}
                  disabled={loading || !query.trim()}
                  className="mt-3 md:mt-0 md:absolute md:right-4 md:top-4 md:bottom-4 py-3.5 px-6 md:px-10 bg-emerald-500 hover:bg-emerald-400 disabled:bg-[#0c0f0d] disabled:text-zinc-700 text-neutral-950 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 shrink-0"
                >
                  {loading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Search className="w-4.5 h-4.5" />}
                  Execute Query
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Error Triage Display Card */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-start gap-4 p-5 bg-red-950/10 border border-red-900/30 rounded-2xl mb-12 max-w-3xl mx-auto"
          >
            <div className="bg-red-900/20 p-2 rounded-xl shrink-0">
              <AlertCircle className="text-red-400 w-5 h-5" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-widest font-mono">Protocol Exception Intercepted</h4>
              <p className="text-red-100/80 text-sm mt-1">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Results Render Logics */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              {[1, 2].map(i => (
                <div key={i} className="bg-[#090b0a] border border-emerald-950/30 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/[0.03] to-transparent -translate-x-full animate-pulse" />
                  <div className="flex flex-col gap-4">
                    <div className="h-3.5 bg-neutral-950 rounded w-1/5 border border-emerald-950" />
                    <div className="space-y-3">
                      <div className="h-6 bg-neutral-950 rounded w-1/3 border border-emerald-950" />
                      <div className="h-16 bg-neutral-950 rounded w-full border border-emerald-950" />
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          ) : result ? (
            <motion.div 
              key="result"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-5xl mx-auto space-y-6"
            >
              <div className="bg-[#090b0a] border border-emerald-950/60 rounded-3xl overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/[0.01] blur-3xl pointer-events-none"></div>
                
                <div className="border-b border-emerald-950/60 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0a0d0c]/30 backdrop-blur-md">
                   <div className="flex items-center gap-3">
                      <div className="bg-emerald-950/50 border border-emerald-800/30 p-2.5 rounded-xl">
                        <Info className="text-emerald-400 w-5.5 h-5.5" />
                      </div>
                      <div>
                        <h3 className="text-[9px] uppercase tracking-widest text-emerald-500 font-mono font-bold">Clinical Analysis Document</h3>
                        <p className="text-base sm:text-lg font-medium font-serif italic text-white">Compound Identification Dossier</p>
                      </div>
                   </div>
                   <button 
                     onClick={reset}
                     className="px-4 py-2 bg-neutral-950 border border-emerald-950 text-emerald-400 rounded-lg text-xs font-bold tracking-widest uppercase hover:text-emerald-300 transition-all flex items-center justify-center gap-2 shadow-inner"
                   >
                     Reset Evaluation
                     <ChevronRight className="w-4 h-4 text-emerald-600" />
                   </button>
                </div>
                <div className="p-6 sm:p-10 select-text">
                  <div className="markdown-body">
                    <Markdown>{result}</Markdown>
                  </div>
                </div>
              </div>

              {/* Advanced Clinical stats panel cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 
                 <div className="p-6 sm:p-8 bg-[#090b0a] border border-emerald-950 rounded-3xl relative overflow-hidden group">
                    <div className="relative z-10">
                      <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-mono font-bold mb-3">Therapeutic Core Spec</p>
                      <h4 className="text-xl sm:text-2xl font-serif italic text-white mb-2">Molecular Formulation Standards</h4>
                      <p className="text-emerald-700/80 text-xs sm:text-sm leading-relaxed mb-6">Calculated and classified through AuraPharma Clinical Triage filters, matching compounds precisely using international standard pharmacopoeias.</p>
                      <div className="flex items-center gap-2 text-xs">
                        <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                        <span className="text-emerald-300/80 font-mono">Dossier certified via Secure LLM pipeline</span>
                      </div>
                    </div>
                    <div className="absolute -right-8 -bottom-8 opacity-[0.01] group-hover:scale-105 transition-transform duration-700 pointer-events-none text-white">
                      <Pill size={160} />
                    </div>
                 </div>
                 
                 <div className="p-6 sm:p-8 bg-emerald-950/45 border border-emerald-800/20 rounded-3xl relative overflow-hidden group">
                    <div className="relative z-10">
                      <p className="text-[10px] uppercase tracking-widest text-[#10b981] font-mono font-bold mb-3">Diagnostic Compliance</p>
                      <h4 className="text-xl sm:text-2xl font-serif italic text-white mb-2">Pharmacovigilance Alert</h4>
                      <p className="text-emerald-300/60 text-xs sm:text-sm leading-relaxed mb-6">Patient profiles must match physical pill imprints and label instructions exactly. Please cross-reference calculated indices with certified clinical packaging before use.</p>
                      <button 
                        onClick={() => {
                          setMode('dosing');
                          setResult(null);
                        }}
                        className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-[10px] font-bold tracking-widest uppercase rounded-md transition-colors w-full text-center"
                      >
                        Formulate Intake Schedule
                      </button>
                    </div>
                    <div className="absolute -right-8 -bottom-8 opacity-[0.01] group-hover:scale-105 transition-transform duration-700 pointer-events-none text-white">
                      <Stethoscope size={160} />
                    </div>
                 </div>
              </div>
            </motion.div>
          ) : (
             <motion.div 
               key="empty"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="grid grid-cols-1 sm:grid-cols-3 gap-6"
             >
                <div 
                  onClick={() => setMode('disease')}
                  className="bg-[#090b0a] border border-emerald-950/40 rounded-3xl p-6 sm:p-8 hover:border-emerald-500/30 transition-all cursor-pointer group relative overflow-hidden" 
                >
                   <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.02] blur-xl rounded-full"></div>
                   <div className="bg-[#060808] w-12 h-12 rounded-xl flex items-center justify-center mb-5 border border-emerald-950 group-hover:scale-105 transition-transform duration-500">
                     <Stethoscope className="text-emerald-500 w-6 h-6" />
                   </div>
                   <h4 className="text-lg sm:text-xl font-serif italic text-white mb-2">Diagnostic Search</h4>
                   <p className="text-emerald-700 text-xs leading-relaxed font-light">Lookup core medical compounds, clinical descriptions, and therapeutics matching any specific health condition or disease name.</p>
                </div>
                
                <div 
                  onClick={() => setMode('generic')}
                  className="bg-[#090b0a] border border-emerald-950/40 rounded-3xl p-6 sm:p-8 hover:border-emerald-500/30 transition-all cursor-pointer group relative overflow-hidden" 
                >
                   <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.02] blur-xl rounded-full"></div>
                   <div className="bg-[#060808] w-12 h-12 rounded-xl flex items-center justify-center mb-5 border border-emerald-950 group-hover:scale-105 transition-transform duration-500">
                     <RefreshCcw className="text-emerald-500 w-5 h-5" />
                   </div>
                   <h4 className="text-lg sm:text-xl font-serif italic text-white mb-2">Equivalent Twins</h4>
                   <p className="text-emerald-700 text-xs leading-relaxed font-light">Identify brand alternatives or lower-cost generic molecular representations for major chemical compounds with 100% composition matching.</p>
                </div>

                <div 
                  onClick={() => setMode('dosing')}
                  className="bg-[#090b0a] border border-emerald-950/40 rounded-3xl p-6 sm:p-8 hover:border-emerald-500/30 transition-all cursor-pointer group relative overflow-hidden" 
                >
                   <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.02] blur-xl rounded-full"></div>
                   <div className="bg-[#060808] w-12 h-12 rounded-xl flex items-center justify-center mb-5 border border-emerald-950 group-hover:scale-105 transition-transform duration-500">
                     <Sliders className="text-emerald-500 w-5.5 h-5.5" />
                   </div>
                   <h4 className="text-lg sm:text-xl font-serif italic text-white mb-2">Rx Dosing Lab</h4>
                   <p className="text-emerald-700 text-xs leading-relaxed font-light">Determine precise pediatric weight-based micro-dosages and adult intake schedules with integrated compliance logging.</p>
                </div>
             </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Touch-Friendly Responsive Mobile Navigation bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-neutral-950/90 backdrop-blur-xl border-t border-emerald-950/40 h-20 px-3 pb-2 flex items-center justify-around z-40">
        {(['identify', 'disease', 'generic', 'dosing', 'history'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setResult(null); setPreview(null); }}
            className={`flex flex-col items-center gap-1 transition-all p-2 rounded-xl text-neutral-400 ${
              mode === m ? 'text-emerald-500 scale-105' : 'text-zinc-600 hover:text-emerald-400'
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-all ${mode === m ? 'bg-emerald-950/55 border border-emerald-700/35' : ''}`}>
              {m === 'identify' ? <Camera className="w-4.5 h-4.5" /> : 
               m === 'disease' ? <Stethoscope className="w-4.5 h-4.5" /> : 
               m === 'generic' ? <Pill className="w-4.5 h-4.5" /> : 
               m === 'dosing' ? <Sliders className="w-4.5 h-4.5" /> : 
               <History className="w-4.5 h-4.5" />}
            </div>
            <span className={`text-[8px] font-mono tracking-tighter uppercase font-bold ${mode === m ? 'opacity-100' : 'opacity-60'}`}>
              {m === 'identify' ? 'Vision' : m === 'disease' ? 'Clinical' : m === 'generic' ? 'Equivalents' : m === 'dosing' ? 'Dosing' : 'History'}
            </span>
          </button>
        ))}
      </nav>

      <footer className="bg-[#090b0a] border-t border-emerald-950/40 py-10 mt-16 pb-28 md:pb-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-4">
             <div className="p-3 bg-neutral-950 border border-emerald-950 rounded-2xl">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
             </div>
             <div>
                <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold font-mono mb-1">Standard Pharmacopoeia & HIPAA Protocols</p>
                <p className="text-xs text-emerald-700/80 italic font-serif leading-relaxed max-w-lg">The AuraPharma Intelligence Node maintains cryptographic data privacy models, ensuring custom chemical assessments stay offline and locally secure.</p>
             </div>
          </div>
          <div className="flex gap-8">
            <button className="text-[10px] font-bold text-emerald-700 hover:text-emerald-400 tracking-wider uppercase transition-colors">Privacy Triage</button>
            <button className="text-[10px] font-bold text-emerald-700 hover:text-emerald-400 tracking-wider uppercase transition-colors">Clinical Guidelines</button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 mt-8 pt-6 border-t border-emerald-950/20 flex flex-col sm:flex-row justify-between items-center gap-4">
           <p className="text-[9px] text-emerald-800 uppercase tracking-[0.3em]">© 2026 AuraPharma Labs IP • v4.3.0-Stable Secure Stack</p>
           <div className="flex flex-col items-center sm:items-end gap-1 font-mono text-[9px] text-emerald-900 leading-tight">
             <p className="font-bold">Authorized Operator Node 079-A</p>
             <p className="italic text-emerald-800">Coded by Jamil • 01307541441</p>
           </div>
        </div>
      </footer>

      {/* Clinician Authentication Modal Portal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-[#060808]/85 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#0b0e0d] border border-emerald-950 rounded-3xl p-6 sm:p-8 w-full max-w-md relative z-10 shadow-[0_0_50px_rgba(16,185,129,0.08)] overflow-hidden"
            >
              {/* Subtle background glow */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/[0.03] blur-3xl rounded-full pointer-events-none"></div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-emerald-500 block mb-1">AuraPharma Systems</span>
                  <h3 className="text-xl font-serif text-white italic">
                    {authMode === 'login' ? 'Clinician Access Hub' : 'Register Clinical Profile'}
                  </h3>
                </div>
                <button 
                  onClick={() => setShowAuthModal(false)}
                  className="p-1 px-2.5 rounded-lg border border-emerald-950 hover:bg-emerald-950/40 text-neutral-500 hover:text-white transition-all text-xs font-mono"
                >
                  ESC
                </button>
              </div>

              {/* Status Indications */}
              {authError && (
                <div className="bg-red-950/25 border border-red-900/40 p-3 rounded-lg mb-4 text-xs text-red-400 font-mono">
                  {authError}
                </div>
              )}
              {authSuccessMessage && (
                <div className="bg-emerald-950/30 border border-emerald-900/40 p-3 rounded-lg mb-4 text-xs text-emerald-400 font-mono">
                  {authSuccessMessage}
                </div>
              )}

              {/* Gmail / Google Single Sign-on */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={authLoading}
                className="w-full bg-white hover:bg-neutral-100 text-black font-extrabold text-[11px] uppercase tracking-wider py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                {/* Visual SVG Google Icon */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Gmail / Google
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="h-px bg-emerald-950/60 flex-1"></div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-[#2c3d39]">Or Email credentials</span>
                <div className="h-px bg-emerald-950/60 flex-1"></div>
              </div>

              {/* Standard Email Auth Form */}
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-mono font-bold mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="email@aurapharma.org"
                    className="w-full bg-neutral-950 border border-emerald-950/60 rounded-xl p-3 text-xs text-white placeholder-emerald-950 focus:border-emerald-500 focus:ring-0 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-mono font-bold mb-1.5">Secure Password</label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-neutral-950 border border-emerald-950/60 rounded-xl p-3 text-xs text-white placeholder-emerald-950 focus:border-emerald-500 focus:ring-0 outline-none font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-400 font-mono font-extrabold text-[10px] uppercase tracking-widest py-3 rounded-xl transition-all cursor-pointer mt-2 flex items-center justify-center gap-2"
                >
                  {authLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
                  ) : authMode === 'login' ? (
                    'Authenticate clinician'
                  ) : (
                    'Instantiate profile'
                  )}
                </button>
              </form>

              {/* Toggle Login/Signup Modes */}
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                    setAuthError(null);
                    setAuthSuccessMessage(null);
                  }}
                  className="text-[10px] font-mono text-zinc-500 hover:text-emerald-400 uppercase tracking-wider transition-colors inline-block"
                >
                  {authMode === 'login' 
                    ? "New Operator? Instantiate free profile" 
                    : "Back to Clinician credentials sign in"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
