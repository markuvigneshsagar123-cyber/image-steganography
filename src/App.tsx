/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Lock, 
  Unlock, 
  Download, 
  Info, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2,
  Infinity,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Copy,
  Check,
  Share
} from 'lucide-react';
import { encodeMessage, decodeMessage } from './utils/steganography';

// --- Components ---

const Navbar = ({ onNavigate }: { onNavigate: (view: 'home' | 'encode' | 'decode') => void }) => (
  <nav className="fixed top-0 left-0 right-0 z-50 bg-brand-dark/80 backdrop-blur-md border-b border-white/5">
    <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('home')} title="SteganoGuard Home">
        <div className="w-10 h-10 bg-brand-accent rounded-lg flex items-center justify-center">
          <ShieldCheck className="text-brand-dark w-6 h-6" title="SteganoGuard Logo" />
        </div>
        <span className="text-xl font-bold tracking-tight">Stegano<span className="text-brand-accent">Guard</span></span>
      </div>
      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
        <button onClick={() => onNavigate('home')} className="hover:text-brand-accent transition-colors cursor-pointer">Home</button>
        <button onClick={() => onNavigate('encode')} className="hover:text-brand-accent transition-colors cursor-pointer">Encode</button>
        <button onClick={() => onNavigate('decode')} className="hover:text-brand-accent transition-colors cursor-pointer">Decode</button>
        <a href="#about" className="hover:text-brand-accent transition-colors">About</a>
      </div>
    </div>
  </nav>
);

const Footer = ({ onNavigate }: { onNavigate: (view: 'home' | 'encode' | 'decode') => void }) => (
  <footer className="bg-brand-dark border-t border-white/5 py-12">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="text-brand-accent w-6 h-6" title="Security Verified" />
            <span className="text-xl font-bold">SteganoGuard</span>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            Securely hide and reveal messages inside images using advanced LSB steganography techniques.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Quick Links</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><button onClick={() => onNavigate('home')} className="hover:text-brand-accent">Home</button></li>
            <li><button onClick={() => onNavigate('encode')} className="hover:text-brand-accent">Encode Message</button></li>
            <li><button onClick={() => onNavigate('decode')} className="hover:text-brand-accent">Decode Message</button></li>
          </ul>
        </div>
      </div>
    </div>
  </footer>
);

const Notification = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'warning' | 'info', onClose: () => void }) => {
  const styles = {
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    error: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400'
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5" title="Success" />,
    error: <AlertCircle className="w-5 h-5" title="Error" />,
    warning: <AlertCircle className="w-5 h-5" title="Warning" />,
    info: <Info className="w-5 h-5" title="Info" />
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className={`fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md ${styles[type]}`}
    >
      {icons[type]}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">×</button>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'home' | 'encode' | 'decode'>('home');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // Encoding State
  const [encodeImage, setEncodeImage] = useState<string | null>(null);
  const [isDraggingEncode, setIsDraggingEncode] = useState(false);
  const secretMessageRef = useRef<HTMLTextAreaElement>(null);
  const [passwordEncode, setPasswordEncode] = useState('');
  const [encodedResult, setEncodedResult] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string>('image.png');
  const encodeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Decoding State
  const [decodeImage, setDecodeImage] = useState<string | null>(null);
  const [isDraggingDecode, setIsDraggingDecode] = useState(false);
  const [passwordDecode, setPasswordDecode] = useState('');
  const [decodedMessage, setDecodedMessage] = useState<string | null>(null);
  const decodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const handleCopy = () => {
    if (!decodedMessage) return;
    navigator.clipboard.writeText(decodedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clear decoded message when inputs change to avoid confusion
  React.useEffect(() => {
    setDecodedMessage(null);
  }, [passwordDecode, decodeImage]);

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const processImageFile = (file: File, type: 'encode' | 'decode') => {
    if (!file.type.startsWith('image/')) {
      showNotification('Please upload a valid image file', 'error');
      return;
    }

    if (type === 'encode') {
      setOriginalFileName(file.name);
    }

    if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      if (type === 'decode') {
        showNotification('JPEG detected. If this image was compressed by a social app, the hidden message might be lost. PNG is always better for steganography.', 'warning');
      } else {
        showNotification('JPEG source detected. The encoded result will be saved as a lossless PNG to protect your message.', 'info');
      }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (type === 'encode') {
        setEncodeImage(result);
        setEncodedResult(null);
      } else {
        setDecodeImage(result);
        setDecodedMessage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'encode' | 'decode') => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file, type);
  };

  const handleDragOver = (e: React.DragEvent, type: 'encode' | 'decode') => {
    e.preventDefault();
    if (type === 'encode') setIsDraggingEncode(true);
    else setIsDraggingDecode(true);
  };

  const handleDragLeave = (e: React.DragEvent, type: 'encode' | 'decode') => {
    e.preventDefault();
    if (type === 'encode') setIsDraggingEncode(false);
    else setIsDraggingDecode(false);
  };

  const handleDrop = (e: React.DragEvent, type: 'encode' | 'decode') => {
    e.preventDefault();
    if (type === 'encode') setIsDraggingEncode(false);
    else setIsDraggingDecode(false);

    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file, type);
  };

  const handleEncode = async () => {
    const message = secretMessageRef.current?.value || '';
    if (!encodeImage || !message || !passwordEncode) {
      showNotification('Please provide an image, message, and password', 'error');
      return;
    }
    setLoading(true);
    setProgress(0);
    try {
      const img = new Image();
      img.src = encodeImage;
      await new Promise((resolve) => (img.onload = resolve));

      const canvas = encodeCanvasRef.current!;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const result = await encodeMessage(canvas, message, passwordEncode, (p) => setProgress(p));
      setEncodedResult(result);
      showNotification('Message hidden successfully!', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Encoding failed', 'error');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleDecode = async () => {
    if (!decodeImage || !passwordDecode) {
      showNotification('Please provide an image and password', 'error');
      return;
    }
    setLoading(true);
    setProgress(0);
    setDecodeError(null);
    try {
      const img = new Image();
      img.src = decodeImage;
      await new Promise((resolve) => (img.onload = resolve));

      const canvas = decodeCanvasRef.current!;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const result = await decodeMessage(canvas, passwordDecode, (p) => setProgress(p));
      setDecodedMessage(result);
      showNotification('Message decoded successfully!', 'success');
    } catch (err: any) {
      setDecodeError(err.message || 'Decoding failed');
      showNotification(err.message || 'Decoding failed', 'error');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleClearEncode = () => {
    setEncodeImage(null);
    setPasswordEncode('');
    setEncodedResult(null);
    if (secretMessageRef.current) {
      secretMessageRef.current.value = '';
    }
    setProgress(0);
  };

  const handleClearDecode = () => {
    setDecodeImage(null);
    setPasswordDecode('');
    setDecodedMessage(null);
    setDecodeError(null);
    setProgress(0);
  };

  const downloadImage = () => {
    if (!encodedResult) return;
    
    // Extract name and extension
    const lastDotIndex = originalFileName.lastIndexOf('.');
    const name = lastDotIndex !== -1 ? originalFileName.substring(0, lastDotIndex) : originalFileName;
    const ext = lastDotIndex !== -1 ? originalFileName.substring(lastDotIndex) : '.png';
    
    // Add a unique suffix to avoid overwriting if the user saves multiple times
    const timestamp = new Date().getTime().toString().slice(-4);
    // Ensure the extension is .png as steganography requires lossless format
    const finalFileName = `${name}_encoded_${timestamp}.png`;

    const link = document.createElement('a');
    link.download = finalFileName;
    link.href = encodedResult;
    link.click();
  };

  const handleShare = async () => {
    if (!encodedResult) return;
    try {
      const response = await fetch(encodedResult);
      const blob = await response.blob();
      const file = new File([blob], `${originalFileName.split('.')[0]}_encoded.png`, { type: 'image/png' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Encoded Image',
          text: 'Here is an image with a hidden message. Decode it using SteganoGuard.',
        });
      } else {
        showNotification('Web Share API not supported for files on this browser. Please download and share manually.', 'error');
      }
    } catch (err) {
      console.error('Sharing failed:', err);
      showNotification('Sharing failed. Please download and share manually.', 'error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col pt-20">
      <Navbar onNavigate={setView} />

      <main className="flex-grow">
        {/* Hero Section */}
        {view === 'home' && (
          <section id="home" className="relative py-24 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl">
              <div className="absolute top-0 left-0 w-96 h-96 bg-brand-accent/10 blur-[120px] rounded-full" />
              <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full" />
            </div>

            <div className="max-w-7xl mx-auto px-6 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  <h1 className="text-5xl lg:text-7xl font-bold leading-tight mb-6">
                    Image <span className="gradient-text">Steganography</span>
                  </h1>
                  <p className="text-xl text-slate-400 mb-8 leading-relaxed">
                    The art of hiding secret information within ordinary-looking files. 
                    Securely embed messages into images without altering their visual appearance.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <button onClick={() => setView('encode')} className="btn-primary" title="Go to Encode section">
                      <Lock className="w-5 h-5" title="Lock Icon" />
                      Start Encoding
                    </button>
                    <button onClick={() => setView('decode')} className="btn-secondary" title="Go to Decode section">
                      <Unlock className="w-5 h-5" title="Unlock Icon" />
                      Start Decoding
                    </button>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="relative"
                >
                  <div className="glass-card p-4 aspect-square flex items-center justify-center overflow-hidden">
                    <img 
                      src="https://picsum.photos/seed/cyber/800/800" 
                      alt="Cybersecurity Illustration" 
                      className="rounded-xl object-cover w-full h-full opacity-80"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/80 to-transparent" />
                    <div className="absolute bottom-8 left-8 right-8">
                      <div className="flex items-center gap-4 p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/10">
                        <div className="w-12 h-12 bg-brand-accent/20 rounded-lg flex items-center justify-center">
                          <ShieldCheck className="text-brand-accent" title="Security Shield" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">End-to-End Privacy</p>
                          <p className="text-xs text-slate-400">Client-side processing only</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Sharing Tips Section */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mt-24 p-8 bg-amber-500/5 border border-amber-500/20 rounded-3xl"
              >
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="text-amber-500 w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-3 text-amber-500">Critical: Message Integrity & Sharing</h3>
                    <p className="text-slate-400 leading-relaxed mb-4">
                      Steganography stores data in the <span className="text-white font-medium">exact bits</span> of the image. 
                      Standard photo sharing on apps like WhatsApp or Messenger uses <span className="text-amber-400 font-bold">lossy compression</span> which erases these bits.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-500 font-bold text-[10px]">1</div>
                        <p className="text-slate-400">Always share as a <span className="text-white font-medium">"Document" or "File"</span> to keep the original bits.</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-500 font-bold text-[10px]">2</div>
                        <p className="text-slate-400">Ensure the file remains a <span className="text-white font-medium">PNG</span>. Converting to JPG will destroy the message.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* Functional Section */}
        {(view === 'encode' || view === 'decode') && (
          <section id="functional" className="py-24 bg-brand-blue/30 min-h-[70vh] flex flex-col justify-center">
            <div className="max-w-7xl mx-auto px-6 w-full">
              <div className="flex justify-center mb-12">
                <div className="inline-flex p-1 bg-white/5 rounded-2xl border border-white/10">
                  <button 
                    onClick={() => setView('encode')}
                    className={`px-8 py-3 rounded-xl font-semibold transition-all ${view === 'encode' ? 'bg-brand-accent text-brand-dark' : 'text-slate-400 hover:text-white'}`}
                  >
                    Encode
                  </button>
                  <button 
                    onClick={() => setView('decode')}
                    className={`px-8 py-3 rounded-xl font-semibold transition-all ${view === 'decode' ? 'bg-brand-accent text-brand-dark' : 'text-slate-400 hover:text-white'}`}
                  >
                    Decode
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {view === 'encode' ? (
                  <motion.div 
                    key="encode"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-8"
                  >
                    <div className="glass-card p-8">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-2xl font-bold flex items-center gap-3">
                          <Lock className="text-brand-accent" title="Secure Encoding" />
                          Encode Message
                          <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-slate-500 font-normal">Supports PNG & JPG</span>
                        </h3>
                        <button 
                          onClick={handleClearEncode}
                          className="text-xs font-medium text-slate-500 hover:text-brand-accent transition-colors flex items-center gap-1 cursor-pointer"
                          title="Clear all fields"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Clear
                        </button>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="relative group">
                          <input 
                            type="file" 
                            id="encode-upload" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'encode')}
                          />
                          <label 
                            htmlFor="encode-upload"
                            onDragOver={(e) => handleDragOver(e, 'encode')}
                            onDragLeave={(e) => handleDragLeave(e, 'encode')}
                            onDrop={(e) => handleDrop(e, 'encode')}
                            className={`flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-2xl transition-all cursor-pointer group ${
                              isDraggingEncode 
                                ? 'border-brand-accent bg-brand-accent/5 scale-[1.02]' 
                                : 'border-white/10 hover:border-brand-accent/50 hover:bg-white/5'
                            }`}
                          >
                            {encodeImage ? (
                              <img src={encodeImage} className="max-h-48 rounded-lg shadow-lg" alt="Preview" title="Image Preview" />
                            ) : (
                              <>
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <Upload className="text-slate-400" title="Upload Image" />
                                </div>
                                <div className="text-center">
                                  <p className="font-semibold">Click to upload image</p>
                                  <p className="text-sm text-slate-500">PNG, JPG or WEBP (Max 5MB)</p>
                                </div>
                              </>
                            )}
                          </label>
                        </div>

                        {encodeImage && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-6"
                          >
                            <div>
                              <label className="flex items-center justify-between text-sm font-medium text-slate-400 mb-2">
                                <span>Secret Message</span>
                                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-40" title="This message box can handle any amount of text without performance issues">
                                  <Infinity className="w-3 h-3" />
                                  Unlimited Capacity
                                </span>
                              </label>
                              <textarea 
                                ref={secretMessageRef}
                                placeholder="Type your hidden message here... ∞ (Your secret is safe forever)"
                                className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 focus:ring-2 focus:ring-brand-accent outline-none transition-all resize-none"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-400 mb-2">Security Password</label>
                              <input 
                                type="password"
                                value={passwordEncode}
                                onChange={(e) => setPasswordEncode(e.target.value)}
                                placeholder="Enter password to protect your message"
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:ring-2 focus:ring-brand-accent outline-none transition-all"
                              />
                            </div>

                            <button 
                              onClick={handleEncode}
                              disabled={!encodeImage || !passwordEncode || loading}
                              className="btn-primary w-full cursor-pointer relative overflow-hidden"
                              title="Securely Encode Message"
                            >
                              {loading ? (
                                <>
                                  <div className="absolute inset-0 bg-brand-accent/20">
                                    <motion.div 
                                      className="h-full bg-brand-accent/40"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${progress}%` }}
                                    />
                                  </div>
                                  <Loader2 className="w-5 h-5 animate-spin relative z-10" title="Processing..." />
                                  <span className="relative z-10">Encoding {Math.round(progress)}%</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-5 h-5" title="Securely Encode Message" />
                                  Encode & Hide Message
                                </>
                              )}
                            </button>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    <div className="glass-card p-8 flex flex-col">
                      <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <ImageIcon className="text-brand-accent" title="Image Preview Icon" />
                        Result Preview
                      </h3>
                      <div className="flex-grow flex flex-col items-center justify-center border border-white/5 rounded-2xl bg-black/20 p-4">
                        {encodedResult ? (
                          <>
                            <img src={encodedResult} className="max-h-64 rounded-lg shadow-2xl mb-6" alt="Encoded Result" title="Encoded Image Preview" />
                            <div className="w-full space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <button onClick={downloadImage} className="btn-secondary w-full cursor-pointer" title="Download Encoded Image">
                                  <Download className="w-5 h-5" title="Download Encoded Image" />
                                  Save PNG
                                </button>
                                <button onClick={handleShare} className="btn-secondary w-full cursor-pointer border-brand-accent/30 hover:border-brand-accent" title="Share Encoded Image">
                                  <Share className="w-5 h-5" title="Share Encoded Image" />
                                  Share File
                                </button>
                              </div>
                              
                              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-pulse-subtle">
                                <h4 className="text-sm font-bold text-amber-500 mb-2 flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  CRITICAL: How to Share
                                </h4>
                                <ul className="text-xs text-slate-300 space-y-2 list-disc pl-4">
                                  <li><span className="text-white font-bold">DO NOT</span> share as a standard photo on WhatsApp/Messenger.</li>
                                  <li>Select <span className="text-white font-bold">"Send as Document"</span> or <span className="text-white font-bold">"Send as File"</span>.</li>
                                  <li>Standard photo sharing uses <span className="text-amber-400">lossy compression</span> which erases the message.</li>
                                  <li>The recipient must download the <span className="text-white font-medium">original PNG</span> to decode it.</li>
                                </ul>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-center text-slate-500">
                            <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" title="No Image" />
                            <p>Encoded image will appear here</p>
                          </div>
                        )}
                      </div>
                      <canvas ref={encodeCanvasRef} className="hidden" />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="decode"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-8"
                  >
                    <div className="glass-card p-8">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-2xl font-bold flex items-center gap-3">
                          <Unlock className="text-brand-accent" title="Secure Decoding" />
                          Decode Message
                          <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-slate-500 font-normal">Supports PNG & JPG</span>
                        </h3>
                        <button 
                          onClick={handleClearDecode}
                          className="text-xs font-medium text-slate-500 hover:text-brand-accent transition-colors flex items-center gap-1 cursor-pointer"
                          title="Clear all fields"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Clear
                        </button>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="relative group">
                          <input 
                            type="file" 
                            id="decode-upload" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'decode')}
                          />
                          <label 
                            htmlFor="decode-upload"
                            onDragOver={(e) => handleDragOver(e, 'decode')}
                            onDragLeave={(e) => handleDragLeave(e, 'decode')}
                            onDrop={(e) => handleDrop(e, 'decode')}
                            className={`flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-2xl transition-all cursor-pointer group ${
                              isDraggingDecode 
                                ? 'border-brand-accent bg-brand-accent/5 scale-[1.02]' 
                                : 'border-white/10 hover:border-brand-accent/50 hover:bg-white/5'
                            }`}
                          >
                            {decodeImage ? (
                              <img src={decodeImage} className="max-h-48 rounded-lg shadow-lg" alt="Preview" title="Image Preview" />
                            ) : (
                              <>
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                  <Upload className="text-slate-400" title="Upload Image" />
                                </div>
                                <div className="text-center">
                                  <p className="font-semibold">Upload encoded image</p>
                                  <p className="text-sm text-slate-500">Select the original image file (PNG or JPG)</p>
                                </div>
                              </>
                            )}
                          </label>
                        </div>

                        {decodeImage && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-6"
                          >
                            <div>
                              <label className="block text-sm font-medium text-slate-400 mb-2">Security Password</label>
                              <input 
                                type="password"
                                value={passwordDecode}
                                onChange={(e) => setPasswordDecode(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleDecode()}
                                placeholder="Enter the password used during encoding"
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 focus:ring-2 focus:ring-brand-accent outline-none transition-all"
                              />
                            </div>

                            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex gap-3 items-start">
                              <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                              <div className="text-xs text-slate-400 leading-relaxed">
                                <p className="font-semibold text-slate-300 mb-1">Decoding Tips:</p>
                                <ul className="list-disc ml-4 space-y-1">
                                  <li>Ensure you are using the <strong>exact same image</strong> that was generated.</li>
                                  <li>Avoid using JPEG images as they destroy hidden data.</li>
                                  <li>The password must match exactly (case-sensitive).</li>
                                </ul>
                              </div>
                            </div>

                            <button 
                              onClick={handleDecode}
                              disabled={!decodeImage || !passwordDecode || loading}
                              className="btn-primary w-full cursor-pointer relative overflow-hidden"
                              title="Decode Hidden Message"
                            >
                              {loading ? (
                                <>
                                  <div className="absolute inset-0 bg-brand-accent/20">
                                    <motion.div 
                                      className="h-full bg-brand-accent/40"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${progress}%` }}
                                    />
                                  </div>
                                  <Loader2 className="w-5 h-5 animate-spin relative z-10" title="Processing..." />
                                  <span className="relative z-10">Decoding {Math.round(progress)}%</span>
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-5 h-5" title="Decode Hidden Message" />
                                  Decode Hidden Message
                                </>
                              )}
                            </button>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    <div className="glass-card p-8 flex flex-col">
                      <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <CheckCircle2 className="text-brand-accent" title="Verification Icon" />
                        Decoded Result
                      </h3>
                      <div className="flex-grow flex flex-col items-center justify-center border border-white/5 rounded-2xl bg-black/20 p-6">
                        {decodedMessage ? (
                          <div className="w-full h-full flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm text-slate-400 font-medium">Message Found:</p>
                              <div className="flex items-center gap-4">
                                <button 
                                  onClick={handleCopy}
                                  className="flex items-center gap-1.5 text-xs text-brand-accent hover:text-brand-accent/80 transition-colors"
                                  title="Copy message to clipboard"
                                >
                                  {copied ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      Copy
                                    </>
                                  )}
                                </button>
                                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-40 text-slate-400" title="The decoded output supports unlimited text length">
                                  <Infinity className="w-3 h-3" />
                                  Unlimited Capacity
                                </span>
                              </div>
                            </div>
                            <div className="flex-grow p-4 bg-white/5 border border-white/10 rounded-xl font-mono text-brand-accent overflow-auto">
                              {decodedMessage}
                            </div>
                          </div>
                        ) : decodeError ? (
                          <div className="w-full space-y-6">
                            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
                              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                              <h4 className="text-lg font-bold text-red-500 mb-2">Decoding Failed</h4>
                              <p className="text-sm text-slate-400">{decodeError}</p>
                            </div>

                            <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                              <h5 className="font-bold mb-4 flex items-center gap-2">
                                <Info className="w-4 h-4 text-brand-accent" />
                                Troubleshooting Guide
                              </h5>
                              <ul className="text-sm text-slate-400 space-y-4">
                                <li className="flex gap-3">
                                  <div className="w-6 h-6 rounded-full bg-brand-accent/20 flex items-center justify-center flex-shrink-0 text-brand-accent font-bold text-xs">1</div>
                                  <p><strong>Platform Compression:</strong> If you received this image via WhatsApp, Messenger, or Discord, it was likely compressed. Ask the sender to send it as a <strong>"Document" or "File"</strong>.</p>
                                </li>
                                <li className="flex gap-3">
                                  <div className="w-6 h-6 rounded-full bg-brand-accent/20 flex items-center justify-center flex-shrink-0 text-brand-accent font-bold text-xs">2</div>
                                  <p><strong>File Format:</strong> Ensure the image is a <strong>PNG</strong>. If it was converted to JPG or WEBP, the hidden message is permanently lost.</p>
                                </li>
                                <li className="flex gap-3">
                                  <div className="w-6 h-6 rounded-full bg-brand-accent/20 flex items-center justify-center flex-shrink-0 text-brand-accent font-bold text-xs">3</div>
                                  <p><strong>Password:</strong> Double-check your password. It is case-sensitive and must match exactly what was used during encoding.</p>
                                </li>
                              </ul>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-slate-500">
                            <Unlock className="w-16 h-16 mx-auto mb-4 opacity-20" title="Locked Message Icon" />
                            <p>Hidden message will appear here after decoding</p>
                          </div>
                        )}
                      </div>
                      <canvas ref={decodeCanvasRef} className="hidden" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
          </div>
        </section>
      )}

        {/* About Section */}
        <section id="about" className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
                <Info className="text-brand-accent w-8 h-8" title="Information" />
                What is <span className="text-brand-accent">Steganography?</span>
              </h2>
              <div className="w-24 h-1 bg-brand-accent mx-auto rounded-full" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <p className="text-lg text-slate-400 leading-relaxed">
                  Steganography is the practice of concealing a file, message, image, or video within another file, message, image, or video. 
                  Unlike cryptography, which focuses on making a message unreadable, steganography focuses on hiding the very existence of the message.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                    <h4 className="font-bold mb-2 text-brand-accent">Invisibility</h4>
                    <p className="text-sm text-slate-400">The carrier image looks completely normal to the naked eye.</p>
                  </div>
                  <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                    <h4 className="font-bold mb-2 text-brand-accent">Security</h4>
                    <p className="text-sm text-slate-400">Adds an extra layer of security on top of traditional encryption.</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-8 bg-gradient-to-br from-brand-accent/10 to-transparent">
                <h3 className="text-2xl font-bold mb-4">Advantages over Cryptography</h3>
                <ul className="space-y-4">
                  {[
                    "Does not attract attention to the secret message.",
                    "Harder to detect using traditional forensic tools.",
                    "Can be combined with encryption for ultimate privacy.",
                    "Ideal for covert communication in restricted environments."
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-accent flex-shrink-0" />
                      <span className="text-slate-400">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer onNavigate={setView} />

      <AnimatePresence>
        {notification && (
          <Notification 
            message={notification.message} 
            type={notification.type} 
            onClose={() => setNotification(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
