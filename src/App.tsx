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
  Upload,
  ChevronRight,
  RefreshCcw,
  Info,
  History,
  Trash2,
  Clock,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { identifyMedicine, getMedicineByDisease, getAlternativesByGeneric } from './services/geminiService';

type Mode = 'identify' | 'disease' | 'generic' | 'history';

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
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [identifySubMode, setIdentifySubMode] = useState<'visual' | 'text'>('visual');
  const [textDescription, setTextDescription] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('pharmai_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save history on change
  useEffect(() => {
    localStorage.setItem('pharmai_history', JSON.stringify(history));
  }, [history]);

  const addToHistory = (type: Mode, q: string, res: string) => {
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      type,
      query: q,
      result: res,
      timestamp: Date.now(),
    };
    setHistory(prev => [newItem, ...prev].slice(0, 50)); // Keep last 50
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
      setError('Could not access camera. Please check permissions.');
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
      setError('Please upload a valid image file.');
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
        addToHistory('identify', 'Visual Scan Identification', data);
      }
      setResult(data || 'Could not identify medicine.');
    } catch (err) {
      console.error(err);
      setError('Failed to analyze image. Please try again.');
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
        addToHistory('identify', `Physical Profile: "${textDescription.substring(0, 30)}..."`, data);
      }
      setResult(data || 'Could not identify medicine.');
    } catch (err) {
      console.error(err);
      setError('Failed to analyze description. Please try again.');
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
      setResult(data || 'No information found.');
    } catch (err) {
      console.error(err);
      setError('Search failed. Please try again.');
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
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-sans selection:bg-blue-500/30">
      {/* Navbar */}
      <header className="bg-[#0a0a0a] border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group" onClick={reset} role="button">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-blue-500/50 flex items-center justify-center transition-transform group-hover:scale-105">
              <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-blue-500 rounded-sm rotate-45 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
            </div>
            <h1 className="text-lg sm:text-xl font-medium tracking-tight font-serif italic text-white flex items-center">
              MediPharma LLM
              <span className="not-italic font-light ml-2 text-zinc-600 text-[10px] sm:text-xs">v4.2</span>
            </h1>
          </div>
          
          <nav className="hidden md:flex items-center gap-2 bg-white/5 border border-white/5 p-1 rounded-full">
            {(['identify', 'disease', 'generic', 'history'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setResult(null); setPreview(null); }}
                className={`px-5 py-2 rounded-full text-xs font-bold tracking-widest uppercase transition-all ${
                  mode === m 
                    ? 'bg-blue-500 text-black shadow-[0_0_20px_rgba(59,130,246,0.3)]' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {m === 'identify' ? 'Vision Lab' : m === 'disease' ? 'Clinical Search' : m === 'generic' ? 'Alternates' : 'History'}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase text-blue-400">
              System Secure
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24 md:pb-12">
        {/* Hero Section */}
        <div className="mb-10 sm:mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-zinc-400 text-[9px] sm:text-[10px] font-bold tracking-[0.2em] uppercase mb-4 sm:mb-6"
          >
            <AlertCircle className="w-3 h-3 text-blue-500" />
            Clinical Analysis Engine
          </motion.div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
            <div>
              <h2 className="text-3xl sm:text-5xl font-medium font-serif italic text-white mb-3 sm:mb-4 tracking-tight leading-tight">
                {mode === 'identify' ? 'Identify Asset' : mode === 'disease' ? 'Condition Matrix' : 'Molecular Equivalents'}
              </h2>
              <p className="text-zinc-500 max-w-xl text-sm sm:text-lg font-light leading-relaxed">
                {mode === 'identify' 
                  ? 'Utilize multi-modal vision models to identify pharmaceutical assets with high confidence.' 
                  : mode === 'disease' 
                    ? 'Access therapeutic ranges and prescribed protocols by matching physiological conditions.'
                    : 'Analyze chemical compounds and market brand equivalents for generic distribution.'}
              </p>
            </div>
          </div>
        </div>

        {/* Interaction Zone */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
          <div className="lg:col-span-12">
            {mode === 'history' ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-sm">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20">
                      <Clock className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium font-serif italic text-white leading-none mb-1">Clinical History Logs</h3>
                      <p className="text-zinc-500 text-xs tracking-widest uppercase font-bold">Stored Local Sessions</p>
                    </div>
                  </div>
                  {history.length > 0 && (
                    <button 
                      onClick={clearHistory}
                      className="px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
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
                        className="col-span-2 py-20 text-center bg-[#0f0f0f] border border-white/5 rounded-3xl"
                      >
                         <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-white/5">
                           <History className="w-8 h-8 text-zinc-700" />
                         </div>
                         <h4 className="text-white font-medium font-serif italic text-xl mb-2">Logs Vacant</h4>
                         <p className="text-zinc-600 text-sm max-w-xs mx-auto">No pharmaceutical identification or clinical searches have been recorded in the current session profile.</p>
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
                          className="group p-6 bg-[#0f0f0f] border border-white/5 rounded-3xl hover:border-blue-500/30 transition-all cursor-pointer relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[40px] rounded-full group-hover:bg-blue-500/10 transition-colors"></div>
                          <div className="relative z-10 flex items-start justify-between">
                            <div className="flex gap-4">
                              <div className="bg-white/5 p-3 rounded-2xl border border-white/10 group-hover:border-blue-500/30 transition-colors">
                                {item.type === 'identify' ? <Camera className="w-5 h-5 text-zinc-400 group-hover:text-blue-400" /> : item.type === 'disease' ? <Stethoscope className="w-5 h-5 text-zinc-400 group-hover:text-blue-400" /> : <Pill className="w-5 h-5 text-zinc-400 group-hover:text-blue-400" />}
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-1">
                                  {new Date(item.timestamp).toLocaleDateString()} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <h4 className="text-white font-medium font-serif italic text-lg line-clamp-1 mb-2 group-hover:text-blue-300 transition-colors">{item.query}</h4>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[8px] uppercase font-bold text-blue-400 tracking-widest">
                                    {item.type === 'identify' ? 'Vision Lab' : item.type === 'disease' ? 'Clinical' : 'Alternate'}
                                  </span>
                                  <ExternalLink className="w-3 h-3 text-zinc-700 group-hover:text-blue-500 transition-colors" />
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => deleteHistoryItem(item.id, e)}
                              className="p-2 text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
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
              <div 
                className={`relative bg-[#0f0f0f] border rounded-3xl transition-all flex flex-col items-center justify-center overflow-hidden group p-6 sm:p-12 ${
                  preview || isCameraOpen ? 'h-[380px] sm:h-[450px] border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.05)]' : 'min-h-[380px] sm:min-h-[450px] border-white/5 hover:border-white/10'
                }`}
              >
                {/* Decorative glow */}
                <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-blue-500/5 blur-[80px] sm:blur-[100px] rounded-full"></div>
                
                {isCameraOpen ? (
                  <div className="relative w-full h-full z-10 bg-black rounded-2xl overflow-hidden">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 border-[12px] sm:border-[20px] border-black/40 pointer-events-none flex items-center justify-center">
                       <div className="w-48 h-48 sm:w-64 sm:h-64 border-2 border-blue-500/50 rounded-3xl relative">
                          <div className="absolute -top-1 -left-1 w-4 sm:w-6 h-4 sm:h-6 border-t-4 border-l-4 border-blue-500"></div>
                          <div className="absolute -top-1 -right-1 w-4 sm:w-6 h-4 sm:h-6 border-t-4 border-r-4 border-blue-500"></div>
                          <div className="absolute -bottom-1 -left-1 w-4 sm:w-6 h-4 sm:h-6 border-b-4 border-l-4 border-blue-500"></div>
                          <div className="absolute -bottom-1 -right-1 w-4 sm:w-6 h-4 sm:h-6 border-b-4 border-r-4 border-blue-500"></div>
                       </div>
                    </div>
                    <div className="absolute bottom-6 sm:bottom-8 left-0 right-0 flex justify-center items-center gap-4 sm:gap-6 z-20">
                      <button 
                        onClick={stopCamera}
                        className="p-3 sm:p-4 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-white hover:bg-white/20 transition-all"
                      >
                        <RefreshCcw className="w-5 h-5 rotate-180" />
                      </button>
                      <button 
                        onClick={capturePhoto}
                        className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center border-4 border-blue-500/50 shadow-lg shadow-white/10 active:scale-95 transition-all"
                      >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-black/10"></div>
                      </button>
                      <div className="hidden sm:block w-12"></div>
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                ) : preview ? (
                  <div className="relative w-full h-full flex items-center justify-center z-10 p-4 sm:p-8">
                    <div className="absolute top-4 left-4 z-20 flex gap-2">
                       <span className="px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[8px] sm:text-[10px] uppercase font-bold text-blue-400 border border-blue-500/30 tracking-widest">Vision Lab Active</span>
                    </div>
                    <img src={preview} alt="Preview" className="max-w-full max-h-full object-contain rounded-xl border border-white/10" />
                    {!loading && (
                      <button 
                        onClick={() => { setPreview(null); setResult(null); }}
                        className="absolute bottom-4 right-4 p-2 sm:p-3 bg-white/5 backdrop-blur-md rounded-full border border-white/10 text-zinc-400 hover:text-white transition-all shadow-xl"
                      >
                        <RefreshCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="relative z-10 w-full flex flex-col items-center">
                    {/* Modern mode selector tabs inside the interactive zone */}
                    <div className="flex bg-[#121212] border border-white/5 rounded-full p-1 w-full max-w-sm mb-8 relative z-20">
                      <button
                        onClick={() => setIdentifySubMode('visual')}
                        className={`flex-1 py-2 rounded-full text-[9px] sm:text-[10px] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${
                          identifySubMode === 'visual' ? 'bg-blue-500 text-black font-extrabold shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Visual
                      </button>
                      <button
                        onClick={() => setIdentifySubMode('text')}
                        className={`flex-1 py-2 rounded-full text-[9px] sm:text-[10px] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${
                          identifySubMode === 'text' ? 'bg-blue-500 text-black font-extrabold shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Traits text
                      </button>
                    </div>

                    {identifySubMode === 'visual' ? (
                      <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/20 mb-6 sm:mb-8 group-hover:scale-105 transition-transform duration-500 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                          <Camera className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                        </div>
                        <h3 className="text-white text-lg sm:text-xl font-medium font-serif italic mb-2">Awaiting Input...</h3>
                        <p className="text-zinc-500 text-[10px] sm:text-sm mb-6 sm:mb-8 tracking-tight uppercase font-bold max-w-[200px] sm:max-w-xs">Upload therapeutic image for molecular identification</p>
                        <div className="flex flex-col gap-3 min-w-[200px]">
                          <button 
                            onClick={startCamera}
                            className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-blue-500 hover:bg-blue-400 text-black text-[10px] sm:text-xs font-bold rounded-full transition-all uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(59,130,246,0.2)] flex items-center justify-center gap-2"
                          >
                            <Camera className="w-4 h-4" />
                            Open Scanner
                          </button>
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[10px] sm:text-xs font-bold rounded-full transition-all uppercase tracking-[0.2em]"
                          >
                            Upload Local File
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full max-w-2xl flex flex-col items-center">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/20 mb-6 sm:mb-8 group-hover:scale-105 transition-transform duration-500 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                          <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                        </div>
                        <h3 className="text-white text-lg sm:text-xl font-medium font-serif italic mb-2">Describe Your Asset</h3>
                        <p className="text-zinc-500 text-[10px] sm:text-sm mb-6 tracking-tight uppercase font-bold max-w-sm text-center">Describe the pill imprint, color, shape, or marks</p>
                        
                        <div className="w-full relative rounded-2xl border border-white/5 bg-white/2 backdrop-blur-sm overflow-hidden mb-6 hover:border-white/10 transition-colors">
                          <textarea
                            value={textDescription}
                            onChange={(e) => setTextDescription(e.target.value)}
                            placeholder="E.g., round peach/orange tablet with imprint IG 282 on one side OR oblong white tablet marked L484..."
                            className="w-full min-h-[110px] p-4 bg-transparent text-white text-sm focus:ring-0 outline-none placeholder:text-zinc-700 resize-none font-light leading-relaxed font-sans"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey && textDescription.trim()) {
                                e.preventDefault();
                                processTextDescription();
                              }
                            }}
                          />
                        </div>

                        <div className="flex flex-wrap gap-2 justify-center mb-8 max-w-md">
                          <span className="text-[9px] text-zinc-500 uppercase tracking-widest my-auto mr-1 font-bold">Presets:</span>
                          {[
                            "Round peach tablet IG 282", 
                            "Oblong yellow with L484", 
                            "IP 204 white capsule"
                          ].map((preset) => (
                            <button
                              key={preset}
                              onClick={() => setTextDescription(preset)}
                              className="px-3 py-1 bg-white/5 hover:bg-white/10 hover:border-blue-500/30 text-zinc-400 hover:text-white border border-white/5 rounded-full text-[10px] transition-all"
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

                        <button 
                          onClick={processTextDescription}
                          disabled={loading || !textDescription.trim()}
                          className="w-full sm:w-auto px-10 py-3.5 sm:py-4 bg-blue-500 hover:bg-blue-400 disabled:bg-zinc-800 disabled:text-zinc-650 text-black text-[10px] sm:text-xs font-bold rounded-full transition-all uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(59,130,246,0.2)] flex items-center justify-center gap-2"
                        >
                          <Search className="w-4 h-4" />
                          Examine Traits
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
            ) : (
              <div className="relative bg-[#0f0f0f] p-2 sm:p-4 rounded-3xl border border-white/5 group shadow-2xl flex flex-col md:block">
                <div className="absolute inset-y-0 left-6 sm:left-8 hidden sm:flex items-center pointer-events-none z-10">
                  {mode === 'disease' ? <Stethoscope className="w-6 h-6 text-zinc-500" /> : <Pill className="w-6 h-6 text-zinc-500" />}
                </div>
                <input 
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={mode === 'disease' ? "e.g. Hypertension..." : "e.g. Atorvastatin..."}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-6 sm:pl-16 pr-6 md:pr-44 py-5 sm:py-7 bg-white/2 backdrop-blur-sm text-white text-lg sm:text-xl border-transparent rounded-2xl focus:ring-0 outline-none placeholder:text-zinc-700 font-light"
                />
                <button 
                  onClick={handleSearch}
                  disabled={loading || !query.trim()}
                  className="mt-3 md:mt-0 md:absolute md:right-4 md:top-4 md:bottom-4 py-4 md:px-10 bg-blue-500 hover:bg-blue-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black rounded-2xl font-bold text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3"
                >
                  {loading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Search className="w-4 h-4 sm:w-5 sm:h-5" />}
                  Execute Search
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-4 p-6 bg-red-500/5 border border-red-500/20 rounded-3xl mb-12 max-w-3xl mx-auto"
          >
            <div className="bg-red-500/20 p-2 rounded-xl">
              <AlertCircle className="text-red-500 w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest">Protocol Override Failure</h4>
              <p className="text-white/70 text-sm mt-1">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Results Logic */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto space-y-4 sm:space-y-8"
            >
              {[1, 2].map(i => (
                <div key={i} className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
                  <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full" />
                  <div className="flex flex-col gap-4 sm:gap-6">
                    <div className="h-3 sm:h-4 bg-white/5 rounded w-1/4" />
                    <div className="space-y-3">
                      <div className="h-6 sm:h-8 bg-white/5 rounded w-1/2" />
                      <div className="h-20 bg-white/5 rounded w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          ) : result ? (
            <motion.div 
              key="result"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-5xl mx-auto space-y-6 sm:space-y-8"
            >
              <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
                {/* Decorative elements from design */}
                <div className="absolute top-0 right-0 w-48 sm:w-96 h-48 sm:h-96 bg-blue-500/5 blur-[80px] sm:blur-[120px] rounded-full pointer-events-none"></div>
                
                <div className="border-b border-white/5 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-[#0a0a0a]/50 backdrop-blur-md">
                   <div className="flex items-center gap-3 sm:gap-4">
                      <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 sm:p-3 rounded-2xl">
                        <Info className="text-blue-500 w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div>
                        <h3 className="text-[8px] sm:text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold mb-1">Generated Analysis Report</h3>
                        <p className="text-lg sm:text-xl font-medium font-serif italic text-white tracking-tight">Clinical Evaluation Profile</p>
                      </div>
                   </div>
                   <button 
                     onClick={reset}
                     className="px-5 sm:px-6 py-2.5 sm:py-3 bg-white/5 border border-white/10 text-white rounded-full text-[10px] sm:text-xs font-bold tracking-widest uppercase hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                   >
                     New Session
                     <ChevronRight className="w-4 h-4 text-zinc-500" />
                   </button>
                </div>
                <div className="p-6 sm:p-10">
                  <div className="markdown-body">
                    <Markdown>{result}</Markdown>
                  </div>
                </div>
              </div>

              {/* Action grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                 <div className="p-6 sm:p-8 bg-[#0f0f0f] border border-blue-500/20 rounded-3xl relative overflow-hidden group">
                    <div className="relative z-10">
                      <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-blue-500 font-bold mb-3 sm:mb-4">Market Equivalents</p>
                      <h4 className="text-xl sm:text-2xl font-medium font-serif italic text-white mb-3 sm:mb-4">Brand Comparison Matrix</h4>
                      <p className="text-zinc-500 text-xs sm:text-sm leading-relaxed mb-6">Access comparative pharmacological data for premium brand references versus standardized generic distributions.</p>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                        <span className="text-[10px] sm:text-xs text-zinc-400 font-medium italic font-serif">Verified clinical data sources</span>
                      </div>
                    </div>
                    <div className="absolute -right-12 -bottom-12 opacity-[0.02] group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                      <Pill size={180} className="sm:w-[240px] sm:h-[240px]" />
                    </div>
                 </div>
                 
                 <div className="p-6 sm:p-8 bg-blue-600 border border-transparent rounded-3xl text-black shadow-xl shadow-blue-500/20 relative overflow-hidden group">
                    <div className="relative z-10">
                      <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-black/50 font-bold mb-3 sm:mb-4">Protocol Warnings</p>
                      <h4 className="text-xl sm:text-2xl font-medium font-serif italic mb-3 sm:mb-4">Pharmacological Safety</h4>
                      <p className="text-black/70 text-xs sm:text-sm leading-relaxed mb-6 sm:mb-8 font-medium">Standard medical disclaimer: This vision-based analysis tool is for educational purposes. All clinical data requires verification.</p>
                      <button className="w-full py-3.5 sm:py-4 bg-black text-white text-[10px] sm:text-xs font-bold rounded-2xl tracking-[0.2em] uppercase hover:bg-zinc-900 transition-colors">
                        Export PDF Protocol
                      </button>
                    </div>
                    <div className="absolute -right-12 -bottom-12 opacity-[0.08] group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                      <Stethoscope size={180} className="sm:w-[240px] sm:h-[240px]" />
                    </div>
                 </div>
              </div>
            </motion.div>
          ) : (
             <motion.div 
               key="empty"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6"
             >
                <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 sm:p-10 hover:border-blue-500/30 transition-all cursor-pointer group relative overflow-hidden" onClick={() => setMode('disease')}>
                   <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[40px] rounded-full"></div>
                   <div className="bg-white/5 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-6 sm:mb-8 border border-white/5 group-hover:scale-105 transition-transform duration-500">
                     <Stethoscope className="text-blue-500 w-6 h-6 sm:w-7 sm:h-7" />
                   </div>
                   <h4 className="text-xl sm:text-2xl font-medium font-serif italic text-white mb-2">Condition Lookup</h4>
                   <p className="text-zinc-500 text-xs sm:text-sm font-light leading-relaxed">Search specific pharmaceutical protocols by disease name or clinical condition.</p>
                </div>
                <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 sm:p-10 hover:border-blue-500/30 transition-all cursor-pointer group relative overflow-hidden" onClick={() => setMode('generic')}>
                   <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[40px] rounded-full"></div>
                   <div className="bg-white/5 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-6 sm:mb-8 border border-white/5 group-hover:scale-105 transition-transform duration-500">
                     <RefreshCcw className="text-blue-500 w-6 h-6 sm:w-7 sm:h-7" />
                   </div>
                   <h4 className="text-xl sm:text-2xl font-medium font-serif italic text-white mb-2">Brand Alternates</h4>
                   <p className="text-zinc-500 text-xs sm:text-sm font-light leading-relaxed">Analyze generic market equivalents and brand-name reference compounds.</p>
                </div>
             </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/80 backdrop-blur-xl border-t border-white/5 z-40 flex items-center justify-around h-20 px-4 pb-2 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {(['identify', 'disease', 'generic', 'history'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setResult(null); setPreview(null); }}
            className={`flex flex-col items-center gap-1.5 transition-all p-2 rounded-2xl ${
              mode === m ? 'text-blue-500 scale-105' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <div className={`p-2 rounded-xl transition-all ${mode === m ? 'bg-blue-500/10 border border-blue-500/20' : ''}`}>
              {m === 'identify' ? <Camera className="w-5 h-5" /> : m === 'disease' ? <Stethoscope className="w-5 h-5" /> : m === 'generic' ? <Pill className="w-5 h-5" /> : <History className="w-5 h-5" />}
            </div>
            <span className={`text-[9px] font-bold tracking-widest uppercase ${mode === m ? 'opacity-100' : 'opacity-60'}`}>
              {m === 'identify' ? 'Vision' : m === 'disease' ? 'Clinical' : m === 'generic' ? 'Alternates' : 'History'}
            </span>
          </button>
        ))}
      </nav>

      <footer className="bg-[#0a0a0a] border-t border-white/5 py-8 sm:py-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8 text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-4">
             <div className="p-3 bg-[#0f0f0f] border border-white/5 rounded-2xl">
                <AlertCircle className="w-5 h-5 text-zinc-600" />
             </div>
             <div>
                <p className="text-[9px] sm:text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Standard Medical Disclaimer</p>
                <p className="text-[10px] sm:text-[11px] text-zinc-600 italic font-serif leading-relaxed max-w-md">The MediPharma LLM clinical intelligence system is for informational purposes and requires licensed medical verification prior to use.</p>
             </div>
          </div>
          <div className="flex gap-6 sm:gap-10">
            <button className="text-[9px] sm:text-[10px] font-bold text-zinc-600 hover:text-white tracking-widest uppercase transition-colors">Privacy Lab</button>
            <button className="text-[9px] sm:text-[10px] font-bold text-zinc-600 hover:text-white tracking-widest uppercase transition-colors">Safety Protocols</button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
           <p className="text-[8px] sm:text-[9px] text-zinc-700 uppercase tracking-[0.3em] sm:tracking-[0.4em]">© 2026 MediPharma LLM Intelligence • v4.2.1-stable</p>
           <div className="flex flex-col items-center md:items-end gap-1">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></div>
             <p className="text-[8px] sm:text-[9px] text-zinc-700 uppercase tracking-[0.2em]">Secure Node 079-A</p>
             <p className="text-[7px] sm:text-[8px] text-zinc-600 uppercase tracking-[0.2em] mt-1 font-bold italic">Made by Jamil • 01307541441</p>
           </div>
        </div>
      </footer>
    </div>
  );
}
