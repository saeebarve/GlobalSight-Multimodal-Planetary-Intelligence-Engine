
import React, { useState, useRef } from 'react';
import InputSection from './components/InputSection';
import AnalysisDisplay from './components/AnalysisDisplay';
import { analyzeContentStream, continueConversationStream } from './services/geminiService';
import { FileData, AudioData, AnalysisResult, ChatMessage } from './types';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isVisualAnalysis, setIsVisualAnalysis] = useState(false);
  
  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [initialContextParts, setInitialContextParts] = useState<any[]>([]);

  const handleAnalyze = async (text: string, fileData: FileData | null, audioData: AudioData | null) => {
    setIsLoading(true);
    setIsStreaming(true);
    setIsVisualAnalysis(!!fileData); 
    setError(null);
    setResult({ text: '', groundingMetadata: undefined });
    setChatHistory([]); // Reset chat

    // Prepare context parts for later use in chat
    const contextParts: any[] = [];
    if (fileData) contextParts.push({ inlineData: { data: fileData.base64.split('base64,')[1], mimeType: fileData.mimeType } });
    if (audioData) contextParts.push({ inlineData: { data: audioData.base64.split('base64,')[1], mimeType: audioData.mimeType } });
    if (text) contextParts.push({ text: text });
    if (contextParts.length === 0) contextParts.push({ text: "Analyze world data." });
    
    setInitialContextParts(contextParts);

    try {
      await analyzeContentStream(
        text, 
        fileData?.base64, 
        fileData?.mimeType,
        audioData?.base64,
        audioData?.mimeType,
        (streamedText, streamedMetadata) => {
            setResult(prev => ({
                text: streamedText,
                groundingMetadata: streamedMetadata || prev?.groundingMetadata
            }));
            
            if (streamedText.length > 5) {
                setIsLoading(false);
            }
        }
      );
    } catch (err: any) {
      console.error("Analysis Error:", err);
      // Ensure we never show [object Object]
      let msg = "An unexpected error occurred.";
      if (err instanceof Error) {
        msg = err.message;
      } else if (typeof err === 'string') {
        msg = err;
      }
      
      if (msg.includes("[object Object]") || msg === "{}") {
        msg = "System Error: Connection terminated unexpectedly.";
      }
      
      setError(msg);
      setIsLoading(false);
    } finally {
      setIsStreaming(false);
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!result) return;
    
    // Add User Message immediately
    const userMsg: ChatMessage = { role: 'user', text: message, timestamp: Date.now() };
    const newHistory = [...chatHistory];
    
    // If this is the FIRST chat message, we must ensure the 'initial analysis' is in the history as the first model response
    if (newHistory.length === 0) {
        newHistory.push({ role: 'model', text: result.text, timestamp: Date.now() });
    }
    
    // Update local state with user message
    const historyWithUser = [...newHistory, userMsg];
    setChatHistory(historyWithUser);

    try {
        // Add placeholder for AI response
        setChatHistory(prev => [...prev, { role: 'model', text: 'Thinking...', timestamp: Date.now() }]);

        let fullResponse = '';
        await continueConversationStream(
            newHistory, // Pass history BEFORE the new user message (the service adds the new one)
            message,
            initialContextParts,
            (streamedText) => {
                fullResponse = streamedText;
                // Update the last message (AI response) with streaming text
                setChatHistory(prev => {
                    const copy = [...prev];
                    copy[copy.length - 1] = { role: 'model', text: streamedText, timestamp: Date.now() };
                    return copy;
                });
            }
        );
    } catch (err: any) {
        console.error("Chat Error:", err);
        setChatHistory(prev => {
             const copy = [...prev];
             let msg = "Connection interrupted.";
             if (err instanceof Error) msg = err.message;
             if (msg.includes("[object Object]")) msg = "Connection interrupted (Unknown Error).";
             
             copy[copy.length - 1] = { role: 'model', text: `Error: ${msg}`, timestamp: Date.now() };
             return copy;
        });
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setIsStreaming(false);
    setIsVisualAnalysis(false);
    setChatHistory([]);
    setInitialContextParts([]);
  };

  return (
    <div className="relative min-h-screen font-sans selection:bg-gs-life selection:text-gs-void overflow-hidden perspective-1000">
      
      {/* Dynamic Aurora Background Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Ocean Aurora */}
        <div className="absolute -bottom-[20%] -left-[10%] w-[60rem] h-[60rem] bg-gradient-to-tr from-gs-ocean/20 to-transparent rounded-full mix-blend-screen filter blur-[120px] animate-blob opacity-40"></div>
        {/* Land Aurora */}
        <div className="absolute top-[10%] -right-[10%] w-[50rem] h-[50rem] bg-gradient-to-bl from-gs-land/20 to-transparent rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000 opacity-30"></div>
        {/* Life Aurora */}
        <div className="absolute top-[40%] left-[30%] w-[40rem] h-[40rem] bg-gradient-to-r from-gs-life/10 to-transparent rounded-full mix-blend-screen filter blur-[80px] animate-blob animation-delay-4000 opacity-30"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel border-b-0 border-b-white/5 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={reset}>
            <div className="w-12 h-12 rounded-full bg-black/50 border border-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(0,204,102,0.3)] group-hover:shadow-[0_0_40px_rgba(0,153,255,0.6)] transition-all duration-500 overflow-hidden relative group-hover:scale-110">
               {/* 3D Mini Earth Effect */}
               <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gs-ocean/40 to-gs-land/40 opacity-50 animate-spin-slow"></div>
               <i className="fa-solid fa-earth-americas text-white text-2xl z-10 drop-shadow-lg"></i>
               <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
            </div>
            <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tighter text-white leading-none tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  Global<span className="earth-gradient">Sight</span>
                </span>
                <span className="text-[10px] uppercase tracking-[0.3em] text-gs-ocean font-bold">Planetary Intelligence</span>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            {isStreaming && (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gs-ocean/10 border border-gs-ocean/40 animate-pulse shadow-[0_0_15px_rgba(0,153,255,0.3)]">
                    <i className="fa-solid fa-satellite-dish text-gs-ocean text-xs"></i>
                    <span className="text-gs-ocean font-mono text-xs tracking-wider font-bold">RECEIVING TELEMETRY...</span>
                </div>
            )}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10 backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gs-land opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-gs-land shadow-[0_0_10px_#00cc66]"></span>
                </span>
                <span className="text-slate-300 font-mono text-xs tracking-wider">ONLINE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Error Display */}
        {error && (
          <div className="max-w-3xl mx-auto mb-8 bg-gs-alert/10 border border-gs-alert/50 text-red-400 p-6 rounded-xl flex items-center gap-4 animate-pulse glass-panel shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
            <div>
              <h3 className="font-bold text-lg">System Alert</h3>
              <p className="opacity-80">{error}</p>
            </div>
          </div>
        )}

        {/* 3D Loading State Overlay */}
        {isLoading && (
          <div className="fixed inset-0 z-50 bg-gs-void/90 backdrop-blur-xl flex flex-col items-center justify-center text-center p-4">
             <div className="relative mb-16 perspective-1000">
                
                {/* 3D Wireframe Globe Construction */}
                <div className="relative w-64 h-64 wireframe-globe">
                   {/* Vertical Rings */}
                   <div className="globe-ring w-full h-full inset-0 rotate-y-0"></div>
                   <div className="globe-ring w-full h-full inset-0 rotate-y-45"></div>
                   <div className="globe-ring w-full h-full inset-0 rotate-y-90"></div>
                   <div className="globe-ring w-full h-full inset-0 rotate-y-135"></div>
                   {/* Horizontal Rings */}
                   <div className="globe-ring w-[90%] h-[90%] top-[5%] left-[5%] rotate-x-90"></div>
                   <div className="globe-ring w-[70%] h-[70%] top-[15%] left-[15%] rotate-x-90"></div>
                   <div className="globe-ring w-[40%] h-[40%] top-[30%] left-[30%] rotate-x-90"></div>

                   {/* Glowing Core */}
                   <div className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-gs-ocean blur-xl opacity-50 animate-pulse"></div>
                   <div className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-white blur-md opacity-80"></div>
                </div>

                {/* Orbiting Elements */}
                <div className="absolute inset-[-40px] border border-gs-land/30 rounded-full w-80 h-80 animate-[spin_4s_linear_infinite] border-dashed"></div>
                <div className="absolute inset-[-80px] border border-gs-life/20 rounded-full w-[26rem] h-[26rem] animate-[spin_7s_linear_infinite_reverse] opacity-50"></div>

             </div>
             
             <h2 className="text-5xl font-black text-white mb-4 tracking-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
               {isVisualAnalysis ? "ANALYZING VISUAL CORTEX" : "SCANNING BIOSPHERE"}
             </h2>
             <p className="text-gs-ocean font-mono text-sm uppercase tracking-[0.5em] mb-12 animate-pulse font-bold">
               {isVisualAnalysis ? "Extracting Patterns & Anomalies..." : "Synthesizing Global Data Streams..."}
             </p>
             
             {/* Progress Bar */}
             <div className="w-96 h-2 bg-black/50 rounded-full overflow-hidden relative border border-white/10 shadow-[0_0_20px_rgba(0,153,255,0.2)]">
                <div className="absolute inset-0 bg-gradient-to-r from-gs-ocean via-gs-land to-gs-life animate-[progress_2s_ease-in-out_infinite] w-full origin-left scale-x-0 blur-[2px]"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-gs-ocean via-gs-land to-gs-life animate-[progress_2s_ease-in-out_infinite] w-full origin-left scale-x-0"></div>
             </div>

             <div className="mt-8 flex gap-10 text-xs text-slate-400 font-mono uppercase tracking-widest">
                <span className={`flex items-center gap-2 ${isVisualAnalysis ? 'text-white font-bold shadow-gs-life drop-shadow-[0_0_5px_rgba(255,170,0,0.8)]' : ''}`}>
                    <i className="fa-solid fa-eye"></i> Visual
                </span>
                <span className="flex items-center gap-2 text-gs-land shadow-gs-land drop-shadow-[0_0_5px_rgba(0,204,102,0.5)]">
                    <i className="fa-solid fa-tree"></i> Terrain
                </span>
                <span className="flex items-center gap-2 text-gs-ocean shadow-gs-ocean drop-shadow-[0_0_5px_rgba(0,153,255,0.5)]">
                    <i className="fa-solid fa-water"></i> Ocean
                </span>
             </div>
          </div>
        )}

        {/* Conditional Rendering */}
        {!result ? (
          <div className="flex flex-col items-center animate-[fadeIn_0.8s_ease-out]">
            <div className="text-center mb-16 space-y-6 max-w-5xl relative">
              {/* Hero Badge */}
              <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-white/5 border border-white/10 text-gs-life text-xs font-bold uppercase tracking-[0.2em] mb-4 hover:bg-white/10 transition-all cursor-default hover:scale-105 hover:border-gs-life/50 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                <span className="w-2 h-2 rounded-full bg-gs-life animate-ping"></span>
                Gemini 3 Pro // Multimodal Core Active
              </div>
              
              <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-tight drop-shadow-2xl">
                Analyze <span className="earth-gradient">Our World.</span>
              </h1>
              <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-light">
                <b className="text-gs-ocean">See the unseen.</b> Upload visual evidence or voice context to generate deep insights using the world's most advanced <span className="text-white font-bold border-b border-gs-land">Planetary Intelligence Engine</span>.
              </p>
            </div>

            <InputSection onAnalyze={handleAnalyze} isLoading={isLoading} />
            
            {/* 3D Features Grid */}
            <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 w-full max-w-6xl">
                {[
                  { icon: 'fa-tree', color: 'text-gs-land', label: 'Ecosystems' },
                  { icon: 'fa-city', color: 'text-gs-life', label: 'Infrastructure' },
                  { icon: 'fa-heart-pulse', color: 'text-gs-alert', label: 'Risks' },
                  { icon: 'fa-scale-balanced', color: 'text-gs-ocean', label: 'Policy' }
                ].map((item, idx) => (
                  <div key={idx} className="glass-panel p-6 rounded-2xl flex flex-col items-center gap-4 hover-lift group cursor-default">
                      <div className={`text-4xl ${item.color} group-hover:scale-125 transition-transform duration-300 drop-shadow-[0_0_15px_currentColor]`}>
                          <i className={`fa-solid ${item.icon}`}></i>
                      </div>
                      <span className="text-xs font-bold tracking-[0.2em] uppercase text-slate-400 group-hover:text-white transition-colors">{item.label}</span>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div className="animate-[fadeIn_0.5s_ease-out]">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-md shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-gs-ocean/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500"></div>
                
                <button 
                  onClick={reset}
                  className="group flex items-center gap-3 text-slate-300 hover:text-white transition-all px-4 py-2 rounded-lg hover:bg-white/10 relative z-10"
                >
                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-gs-ocean group-hover:border-gs-ocean group-hover:text-white transition-all shadow-lg group-hover:shadow-[0_0_20px_rgba(0,153,255,0.5)]">
                      <i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
                    </div>
                    <span className="font-bold tracking-wide">New Global Scan</span>
                </button>
                <div className="flex items-center gap-4 mt-4 md:mt-0 relative z-10">
                   <div className="flex flex-col items-end">
                     <span className="text-[10px] uppercase tracking-widest text-slate-500">Session ID</span>
                     <span className="font-mono text-gs-life font-bold text-lg drop-shadow-[0_0_10px_rgba(255,170,0,0.3)]">
                       EARTH-{Math.random().toString(36).substr(2, 6).toUpperCase()}
                     </span>
                   </div>
                   <i className="fa-solid fa-fingerprint text-3xl text-white/10"></i>
                </div>
            </div>
            <AnalysisDisplay result={result} chatHistory={chatHistory} onSendMessage={handleSendMessage} />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 bg-gs-void/80 backdrop-blur-lg py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm font-medium">
            &copy; {new Date().getFullYear()} GlobalSight Intelligence. 
            <span className="mx-3 opacity-30">|</span> 
            <span className="text-gs-land font-bold drop-shadow-[0_0_10px_rgba(0,204,102,0.3)]">Powered by Gemini 3 Pro</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;