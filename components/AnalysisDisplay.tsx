
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ParsedSection, AnalysisResult, ChatMessage } from '../types';

interface AnalysisDisplayProps {
  result: AnalysisResult;
  chatHistory?: ChatMessage[];
  onSendMessage?: (msg: string) => void;
}

const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ result, chatHistory = [], onSendMessage }) => {
  const { text: rawMarkdown, groundingMetadata } = result;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('preview'); 
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleChatSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || !onSendMessage) return;
      onSendMessage(chatInput);
      setChatInput('');
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Voice input not supported in this browser.");
        return;
    }
    
    // @ts-ignore
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(transcript);
    };

    recognition.start();
  };

  // Speech Synthesis Function
  const speakSummary = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const summaryMatch = rawMarkdown.match(/## 📊 Summary Snapshot([\s\S]*?)$/) || rawMarkdown.match(/## 🔍 Problem Detected([\s\S]*?)##/);
    const textToSpeak = summaryMatch ? summaryMatch[1].replace(/[*#\-]/g, '') : "Analysis complete. Reviewing data.";

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const systemVoice = voices.find(v => v.name.includes('Google US English')) || voices.find(v => v.lang === 'en-US');
    if (systemVoice) utterance.voice = systemVoice;

    utterance.onend = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const handlePrint = () => {
      window.print();
  };

  // Robust markdown parser
  const sections = useMemo(() => {
    if (!rawMarkdown) return [];

    const lines = rawMarkdown.split('\n');
    const parsed: ParsedSection[] = [];
    let currentTitle = '';
    let currentContent: string[] = [];
    
    const sectionConfig: Record<string, { icon: string, type: string, theme: string }> = {
      'GlobalSight Analysis': { icon: 'fa-globe', type: 'header', theme: 'neutral' },
      'Problem Detected': { icon: 'fa-triangle-exclamation', type: 'list', theme: 'danger' },
      'Root Cause': { icon: 'fa-dna', type: 'text', theme: 'info' },
      'Predicted Impact': { icon: 'fa-chart-line', type: 'impact', theme: 'warning' },
      'Actionable Solutions': { icon: 'fa-leaf', type: 'list', theme: 'success' },
      'Simulation Model': { icon: 'fa-flask', type: 'text', theme: 'life' },
      'Auto-Generated Code': { icon: 'fa-code', type: 'code', theme: 'neutral' },
      'Summary Snapshot': { icon: 'fa-clipboard-check', type: 'table', theme: 'success' },
    };

    const flushSection = () => {
      if (currentTitle) {
        let cleanTitle = currentTitle.replace(/^[#\s]+/, '').trim();
        cleanTitle = cleanTitle.replace(/^[^\w\s]+\s*/, '');
        
        const configKey = Object.keys(sectionConfig).find(k => cleanTitle.includes(k));
        const config = configKey ? sectionConfig[configKey] : { icon: 'fa-circle-info', type: 'text', theme: 'neutral' };

        parsed.push({
          title: cleanTitle,
          icon: config.icon,
          content: currentContent.join('\n').trim(),
          type: config.type as any,
          theme: config.theme as any
        } as any);
      }
      currentContent = [];
    };

    for (const line of lines) {
      if (line.startsWith('## ') || line.startsWith('# ')) {
        flushSection();
        currentTitle = line;
      } else {
        currentContent.push(line);
      }
    }
    flushSection(); 

    return parsed;
  }, [rawMarkdown]);

  const getThemeClasses = (theme: string) => {
    switch (theme) {
      case 'danger': return 'from-gs-alert to-red-600';
      case 'success': return 'from-gs-land to-emerald-600';
      case 'info': return 'from-gs-ocean to-blue-600';
      case 'life': return 'from-gs-life to-yellow-600';
      case 'warning': return 'from-orange-500 to-red-500';
      default: return 'from-slate-600 to-slate-800';
    }
  };

  const getThemeText = (theme: string) => {
    switch (theme) {
      case 'danger': return 'text-gs-alert';
      case 'success': return 'text-gs-land';
      case 'info': return 'text-gs-ocean';
      case 'life': return 'text-gs-life';
      case 'warning': return 'text-orange-400';
      default: return 'text-slate-400';
    }
  }

  const renderContent = (section: any) => {
    if (section.type === 'code') {
      const codeMatch = section.content.match(/```(\w+)?\n([\s\S]*?)```/);
      const code = codeMatch ? codeMatch[2] : section.content;
      const lang = codeMatch ? codeMatch[1]?.toLowerCase() : 'text';
      
      const isRenderable = lang === 'html' || lang === 'javascript' || lang === 'js';

      // AUTO-HEALING: Inject necessary libraries if missing
      let safeCode = code;
      if (isRenderable) {
          // If the AI gives just a body or script, wrap it
          if (!safeCode.includes('<!DOCTYPE html>')) {
              safeCode = `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <script src="https://cdn.tailwindcss.com"></script>
                  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
                  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
                  <style>
                    body { background-color: #000; color: white; padding: 20px; font-family: sans-serif; }
                    #map { height: 300px; width: 100%; border-radius: 10px; margin-top: 10px; }
                  </style>
                </head>
                <body>
                  ${safeCode}
                </body>
                </html>
              `;
          } else {
              // Even if it has HTML, ensure libs are present
              if (!safeCode.includes('chart.js')) {
                  safeCode = safeCode.replace('<head>', '<head><script src="https://cdn.jsdelivr.net/npm/chart.js"></script>');
              }
              if (!safeCode.includes('tailwindcss')) {
                  safeCode = safeCode.replace('<head>', '<head><script src="https://cdn.tailwindcss.com"></script>');
              }
              if (!safeCode.includes('leaflet')) {
                   safeCode = safeCode.replace('<head>', '<head><link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" /><script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>');
              }
          }
      }

      return (
        <div className="mt-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] bg-[#0a0f18] rounded-xl overflow-hidden border border-slate-700/50 no-print">
           {isRenderable && (
               <div className="flex border-b border-white/5">
                   <button 
                    onClick={() => setActiveTab('preview')}
                    className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'preview' ? 'bg-white/10 text-gs-land border-b-2 border-gs-land' : 'text-slate-500 hover:text-white'}`}
                   >
                       <i className="fa-solid fa-play mr-2"></i> Live Simulation
                   </button>
                   <button 
                    onClick={() => setActiveTab('code')}
                    className={`px-6 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'code' ? 'bg-white/10 text-gs-ocean border-b-2 border-gs-ocean' : 'text-slate-500 hover:text-white'}`}
                   >
                       <i className="fa-solid fa-code mr-2"></i> Source Code
                   </button>
               </div>
           )}

           <div className="relative">
                {isRenderable && activeTab === 'preview' ? (
                    <div className="w-full h-[450px] bg-black">
                        <iframe 
                            srcDoc={safeCode} 
                            className="w-full h-full border-0" 
                            title="Live Preview"
                            sandbox="allow-scripts allow-same-origin"
                        />
                    </div>
                ) : (
                    <>
                        <div className="absolute top-0 right-0 p-2 opacity-50 text-[100px] leading-none pointer-events-none text-white/5 font-black">
                            {lang}
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5 backdrop-blur-sm">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-xs uppercase text-slate-500 font-bold tracking-wider">{lang} Source</span>
                                <button 
                                onClick={() => navigator.clipboard.writeText(code)}
                                className="text-slate-500 hover:text-white transition-colors"
                                title="Copy Code"
                                >
                                    <i className="fa-regular fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <pre className="p-6 overflow-x-auto text-gs-land text-sm leading-relaxed">
                            <code>{code}</code>
                        </pre>
                    </>
                )}
           </div>
        </div>
      );
    }

    if (section.type === 'impact') {
      const isCritical = section.content.match(/Critical/i);
      const isHigh = section.content.match(/High/i);
      const isMedium = section.content.match(/Medium/i);
      const isLow = section.content.match(/Low/i);

      let riskGradient = 'from-gs-ocean to-cyan-500';
      let riskLabel = 'Low';
      if (isCritical) { riskGradient = 'from-gs-alert to-red-600'; riskLabel = 'Critical'; }
      else if (isHigh) { riskGradient = 'from-orange-500 to-red-500'; riskLabel = 'High'; }
      else if (isMedium) { riskGradient = 'from-gs-life to-orange-400'; riskLabel = 'Medium'; }

      return (
        <div className="space-y-6">
             <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/5 p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden group/risk">
                {/* Background pulse for risk */}
                <div className={`absolute inset-0 bg-gradient-to-r ${riskGradient} opacity-0 group-hover/risk:opacity-10 transition-opacity duration-500`}></div>

                <div className="text-slate-300 font-bold uppercase text-xs tracking-wider z-10">Threat Level</div>
                <div className="flex-1 w-full h-8 bg-black/60 rounded-full overflow-hidden border border-white/10 p-1.5 shadow-inner z-10">
                    <div 
                        className={`h-full bg-gradient-to-r ${riskGradient} rounded-full relative overflow-hidden transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(0,0,0,0.5)]`} 
                        style={{ width: isCritical ? '100%' : isHigh ? '75%' : isMedium ? '50%' : '25%' }}
                    >
                         <div className="absolute inset-0 bg-white/30 animate-[pulse_1s_infinite]"></div>
                         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-20"></div>
                    </div>
                </div>
                <span className={`px-5 py-2 rounded-lg text-xs font-black uppercase bg-gradient-to-r ${riskGradient} text-white shadow-lg z-10 tracking-widest`}>
                    {riskLabel}
                </span>
             </div>
             <div className="whitespace-pre-wrap text-slate-300 leading-relaxed pl-6 border-l-4 border-slate-700/50 relative">
                 <i className="fa-solid fa-quote-left absolute -top-2 -left-3 text-slate-800 text-2xl bg-gs-void"></i>
                 {section.content}
             </div>
        </div>
      );
    }

    return (
      <div className="whitespace-pre-wrap text-slate-300 leading-relaxed space-y-4">
         {section.content.split('\n').map((line: string, idx: number) => {
             if (line.trim().startsWith('###')) return <h4 key={idx} className={`text-xl font-bold mt-6 mb-3 flex items-center gap-3 ${getThemeText(section.theme)}`}><i className="fa-solid fa-caret-right opacity-70"></i> {line.replace(/###/g, '')}</h4>;
             if (line.trim().startsWith('**')) return <p key={idx} className="font-bold text-white mt-3 text-lg border-b border-white/5 pb-1 inline-block">{line.replace(/\*\*/g, '')}</p>;
             if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) return (
                <div key={idx} className="flex gap-4 items-start ml-2 group/item p-2 rounded hover:bg-white/5 transition-colors">
                    <span className={`mt-2 h-2 w-2 rounded-sm rotate-45 bg-gradient-to-br ${getThemeClasses(section.theme)} flex-shrink-0 group-hover/item:rotate-90 transition-transform duration-300 shadow-[0_0_8px_currentColor]`}></span>
                    <span className="group-hover/item:text-white transition-colors">{line.replace(/^[-•]\s+/, '')}</span>
                </div>
             );
             return <p key={idx} className={line.startsWith('Risk Score') ? "font-mono text-gs-life font-bold bg-gs-life/10 p-3 rounded border border-gs-life/20 inline-block shadow-[0_0_15px_rgba(255,170,0,0.1)]" : ""}>{line}</p>;
         })}
      </div>
    );
  };

  const renderGrounding = () => {
    if (!groundingMetadata?.groundingChunks || groundingMetadata.groundingChunks.length === 0) return null;
    type WebSource = { uri: string; title: string };
    const sources: WebSource[] = groundingMetadata.groundingChunks
      .map(chunk => chunk.web)
      .filter((web): web is WebSource => !!web);
    const uniqueSources = Array.from(new Map(sources.map(item => [item.uri, item])).values());
    if (uniqueSources.length === 0) return null;
    return (
      <div className="md:col-span-2 glass-panel rounded-3xl overflow-hidden shadow-2xl border border-white/10 mb-8 hover-lift">
        <div className="relative px-8 py-5 border-b border-white/5 bg-black/40 flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-gs-ocean/20 text-gs-ocean flex items-center justify-center border border-gs-ocean/30 shadow-[0_0_15px_rgba(0,153,255,0.2)]">
                 <i className="fa-solid fa-link"></i>
             </div>
             <div>
                <h3 className="text-lg font-bold text-white tracking-wide">Verified Earth Data Sources</h3>
                <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Citing {uniqueSources.length} global references</p>
             </div>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {uniqueSources.map((source, idx) => (
                <a 
                  key={idx} 
                  href={source.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex flex-col p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-gs-ocean/50 transition-all group hover:-translate-y-1 hover:shadow-xl"
                >
                    <div className="flex items-start justify-between mb-3">
                        <span className="text-[10px] font-mono text-gs-ocean/70 uppercase tracking-widest border border-gs-ocean/20 px-2 py-0.5 rounded">Ref {idx + 1}</span>
                        <i className="fa-solid fa-arrow-up-right-from-square text-xs text-slate-600 group-hover:text-gs-ocean transition-colors"></i>
                    </div>
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white line-clamp-2 leading-snug group-hover:underline decoration-gs-ocean/50 underline-offset-4">
                        {source.title || "External Source"}
                    </span>
                </a>
            ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-10 pb-24 px-4">
        {/* Printable Header */}
        <div className="print-header">
            <h1 className="text-3xl font-bold">GlobalSight Intelligence Report</h1>
            <p className="text-sm text-gray-500">Generated by Gemini 3 Pro Multimodal Engine</p>
            <p className="text-sm text-gray-500">Date: {new Date().toLocaleDateString()}</p>
        </div>

        {/* Intro Header */}
        <div className="text-center py-8 no-print">
             <div className="inline-flex items-center justify-center p-1.5 rounded-full bg-gradient-to-r from-gs-ocean/30 to-gs-land/30 border border-white/10 mb-4 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                <span className="px-6 py-1.5 rounded-full bg-gs-void text-xs font-black text-transparent bg-clip-text bg-gradient-to-r from-gs-ocean via-gs-land to-gs-life uppercase tracking-[0.2em] shadow-inner">
                  <i className="fa-solid fa-check-circle mr-2 text-gs-land"></i>
                  {rawMarkdown ? "Planetary Analysis Complete" : "Establishing Secure Connection..."}
                </span>
             </div>
             
             {/* Action Buttons */}
             {rawMarkdown && (
                 <div className="flex justify-center mt-2 gap-4">
                     <button 
                        onClick={speakSummary}
                        className={`flex items-center gap-3 px-6 py-2 rounded-full border transition-all duration-300 ${isSpeaking ? 'bg-gs-life text-white border-gs-life shadow-[0_0_20px_rgba(255,170,0,0.5)]' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'}`}
                     >
                        <i className={`fa-solid ${isSpeaking ? 'fa-waveform animate-pulse' : 'fa-play'}`}></i>
                        <span className="font-bold text-sm tracking-wide">{isSpeaking ? 'AUDIO ACTIVE' : 'AUDIO BRIEF'}</span>
                     </button>
                     
                     <button 
                        onClick={handlePrint}
                        className="flex items-center gap-3 px-6 py-2 rounded-full border bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white hover:border-gs-ocean transition-all duration-300"
                     >
                        <i className="fa-solid fa-file-pdf"></i>
                        <span className="font-bold text-sm tracking-wide">EXPORT REPORT</span>
                     </button>
                 </div>
             )}
        </div>
        
        {renderGrounding()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 perspective-1000">
            {sections.map((section: any, index: number) => {
                if (section.title.includes('GlobalSight Analysis')) return null;

                const isFullWidth = ['Auto-Generated Code', 'Summary Snapshot', 'Root Cause'].some(k => section.title.includes(k));
                
                return (
                    <div 
                        key={index} 
                        className={`glass-panel rounded-3xl overflow-hidden hover:border-white/30 transition-all duration-500 shadow-2xl group ${isFullWidth ? 'md:col-span-2' : ''} hover-lift`}
                        style={{ 
                            animation: `fadeIn 0.5s ease-out ${index * 0.1}s backwards`,
                            transformStyle: 'preserve-3d' 
                        }}
                    >
                        <div className="relative px-8 py-6 border-b border-white/5 overflow-hidden">
                            <div className={`absolute inset-0 bg-gradient-to-r ${getThemeClasses(section.theme)} opacity-10 group-hover:opacity-20 transition-opacity duration-500`}></div>
                            <div className="absolute -right-10 -top-10 text-9xl text-white/5 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rotate-12 pointer-events-none">
                                <i className={`fa-solid ${section.icon}`}></i>
                            </div>
                            
                            <div className="relative flex items-center gap-5 z-10">
                                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getThemeClasses(section.theme)} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 ring-4 ring-black/20`}>
                                    <i className={`fa-solid ${section.icon} text-white text-xl drop-shadow-md`}></i>
                                </div>
                                <h3 className="text-2xl font-black text-white tracking-wide">{section.title}</h3>
                            </div>
                        </div>
                        <div className="p-10 bg-black/20">
                            {renderContent(section)}
                        </div>
                    </div>
                );
            })}
        </div>
        
        {/* MISSION CONTROL CHAT INTERFACE */}
        <div className="mt-16 no-print">
            <div className="max-w-4xl mx-auto glass-panel rounded-3xl overflow-hidden border border-gs-ocean/30 shadow-[0_0_50px_rgba(0,153,255,0.1)]">
                <div className="bg-black/60 border-b border-white/10 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-gs-ocean animate-pulse"></div>
                        <span className="font-mono text-gs-ocean font-bold tracking-widest text-sm">SECURE UPLINK // MISSION CONTROL</span>
                    </div>
                    <i className="fa-solid fa-tower-broadcast text-slate-600"></i>
                </div>
                
                <div className="p-6 h-[400px] overflow-y-auto bg-black/40 space-y-6 scrollbar-thin scrollbar-thumb-slate-700">
                    {/* Welcome Message */}
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded bg-gs-ocean/20 flex items-center justify-center text-gs-ocean border border-gs-ocean/30 flex-shrink-0 mt-1">
                            <i className="fa-solid fa-robot"></i>
                        </div>
                        <div className="space-y-1">
                            <div className="font-mono text-xs text-gs-ocean/70 mb-1">AI SYSTEM</div>
                            <div className="text-slate-300 text-sm leading-relaxed bg-white/5 p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl border border-white/5 inline-block">
                                Analysis complete. I am standing by for tactical inquiries or code generation requests.
                            </div>
                        </div>
                    </div>

                    {/* Chat History */}
                    {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mt-1 ${msg.role === 'user' ? 'bg-gs-land/20 text-gs-land border border-gs-land/30' : 'bg-gs-ocean/20 text-gs-ocean border border-gs-ocean/30'}`}>
                                <i className={`fa-solid ${msg.role === 'user' ? 'fa-user' : 'fa-robot'}`}></i>
                            </div>
                            <div className={`space-y-1 max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                                <div className={`font-mono text-xs mb-1 ${msg.role === 'user' ? 'text-gs-land/70' : 'text-gs-ocean/70'}`}>
                                    {msg.role === 'user' ? 'FIELD AGENT' : 'AI SYSTEM'}
                                </div>
                                <div className={`text-sm leading-relaxed p-3 rounded-xl border ${msg.role === 'user' ? 'bg-gs-land/10 border-gs-land/20 text-white rounded-tr-none' : 'bg-white/5 border-white/5 text-slate-300 rounded-tl-none inline-block text-left'}`}>
                                    {msg.role === 'model' ? (
                                        // Render markdown-ish simple text for chat
                                        <div className="whitespace-pre-wrap">{msg.text}</div>
                                    ) : (
                                        msg.text
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={chatBottomRef}></div>
                </div>

                <form onSubmit={handleChatSubmit} className="p-4 bg-black/60 border-t border-white/10 flex gap-4">
                    <button
                        type="button"
                        onClick={handleVoiceInput}
                        className={`px-4 rounded-xl border transition-all ${isListening ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                        title="Voice Input"
                    >
                         <i className={`fa-solid ${isListening ? 'fa-microphone-lines' : 'fa-microphone'}`}></i>
                    </button>
                    <input 
                        type="text" 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Request simulation, detailed breakdown, or policy advice..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gs-ocean focus:bg-white/10 transition-all font-mono text-sm placeholder-slate-500"
                    />
                    <button 
                        type="submit"
                        disabled={!chatInput.trim()}
                        className="bg-gs-ocean/20 text-gs-ocean border border-gs-ocean/50 px-6 rounded-xl hover:bg-gs-ocean hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold tracking-wide"
                    >
                        <i className="fa-solid fa-paper-plane"></i>
                    </button>
                </form>
            </div>
        </div>
    </div>
  );
};

export default AnalysisDisplay;
