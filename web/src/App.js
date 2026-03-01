// Version: 1.50
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import './index.css';

import ChatDashboard from './components/ChatDashboard';
import ScraperPanel from './components/ScraperPanel';
import FileExplorer from './components/FileExplorer';
import DatabaseExplorer from './components/DatabaseExplorer';
import JsonExplorer from './components/JsonExplorer';
import CommandCenter from './components/CommandCenter';

const MCP_SERVER_URL = 'http://localhost:3000';

const THEMES = {
  starryNight: { name: 'Starry', bg: 'bg-starry', sidebar: 'sidebar-starry', header: 'header-starry', text: 'text-blue-100', accent: 'starry-accent', border: 'starry-border', userBubble: 'user-bubble-starry', botBubble: 'bot-bubble-starry', bubbleText: 'text-sky-100' },
  darkWood: { name: 'Wood', bg: 'bg-dark-wood', sidebar: 'sidebar-dark-wood', header: 'header-dark-wood', text: 'text-[#d7ccc8]', accent: 'text-[#8d6e63]', border: 'dark-wood-border', userBubble: 'user-bubble-dark-wood', botBubble: 'bot-bubble-dark-wood', bubbleText: 'text-[#fbe9e7]' },
  metallic: { name: 'Metal', bg: 'bg-metallic-dark', sidebar: 'sidebar-metallic', header: 'header-metallic', text: 'text-gray-100', accent: 'metallic-text-shine', border: 'border-white/20', userBubble: 'user-bubble-metallic', botBubble: 'bot-bubble-metallic', bubbleText: 'text-white' },
  bamboo: { name: 'Bamboo', bg: 'bg-bamboo', sidebar: 'sidebar-bamboo', header: 'header-bamboo', text: 'text-[#a3b18a]', accent: 'text-[#588157]', border: 'bamboo-border', userBubble: 'user-bubble-bamboo', botBubble: 'bot-bubble-bamboo', bubbleText: 'text-[#dad7cd]' }
};

// Extracted the core layout and routing logic into a main component
function DashboardLayout() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentTheme, setCurrentTheme] = useState('starryNight');
  const [uiConfig, setUiConfig] = useState(null);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isQuickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isConnected, setIsConnected] = useState(true);
  const [maxTokens, setMaxTokens] = useState(128);
  const [temperature, setTemperature] = useState(0.7);
  const [proposal, setProposal] = useState(null);
  const [isProcessingProposal, setIsProcessingProposal] = useState(false);

  const location = useLocation();

  useEffect(() => {
    const fetchUiConfig = async () => {
      try {
        const res = await axios.get(`${MCP_SERVER_URL}/api/ui/config`);
        setUiConfig(res.data);
      } catch (e) { }
    };
    fetchUiConfig();
  }, []);

  const baseTheme = THEMES[currentTheme] || THEMES.starryNight;
  const theme = uiConfig?.theme ? { ...baseTheme, ...uiConfig.theme } : baseTheme;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        await axios.get(`${MCP_SERVER_URL}/health`, { timeout: 2000 });
        setIsConnected(true);
        const configRes = await axios.get(`${MCP_SERVER_URL}/config`);
        setMaxTokens(configRes.data.max_new_tokens);
        setTemperature(configRes.data.temperature);
      } catch (e) {
        setIsConnected(false);
      }
    };
    checkInitialStatus();

    const eventSource = new EventSource(`${MCP_SERVER_URL}/api/events`);
    
    eventSource.addEventListener('metrics', (event) => {
      setIsConnected(true);
    });

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => eventSource.close();
  }, []);

  useEffect(() => {
    const interceptor = axios.interceptors.request.use((config) => {
      config.headers['x-ai-only-token'] = 'e89b3f94-7a1a-4f5c-8d2b-6c4e1f7a8b9c';
      return config;
    });
    return () => axios.interceptors.request.eject(interceptor);
  }, []);

  const updateAIConfig = async (updates) => {
    try {
      const res = await axios.post(`${MCP_SERVER_URL}/config`, updates);
      if (res.data.success) {
        setMaxTokens(res.data.config.max_new_tokens);
        setTemperature(res.data.config.temperature);
      }
    } catch (e) { console.error("Config update failed", e); }
  };

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${MCP_SERVER_URL}/sessions`);
      setSessions(res.data.sessions);
      if (!currentSessionId && res.data.sessions.length > 0) setCurrentSessionId(res.data.sessions[0].id);
    } catch (e) { console.error(e); }
  };

  const fetchHistory = async (sid) => {
    try {
      const res = await axios.get(`${MCP_SERVER_URL}/history/${sid}`);
      const history = res.data.history.map(h => [
        { sender: 'user', text: h.user_input, timestamp: h.timestamp, id: `${h.id}-u` },
        { sender: 'bot', text: h.bot_response, timestamp: h.timestamp, id: `${h.id}-b`, rating: h.rating }
      ]).flat();
      setMessages(history);
    } catch (e) { console.error(e); }
  };

  const switchSession = async (sid) => {
    if (!sid || sid === currentSessionId || isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(async () => {
      setCurrentSessionId(sid);
      await fetchHistory(sid);
      setIsTransitioning(false);
    }, 500);
  };

  const handleDeleteMessage = async (mid) => {
    if (!mid) return;
    const id = String(mid).split('-')[0];
    try {
      await axios.delete(`${MCP_SERVER_URL}/history/delete/${id}`);
      if (currentSessionId) fetchHistory(currentSessionId);
    } catch (e) { console.error(e); }
  };

  const handleNewSession = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${MCP_SERVER_URL}/chat`, { message: "New session started." });
      if (response.data.session_id) {
        await fetchSessions();
        setCurrentSessionId(response.data.session_id);
        setMessages([]);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleDeleteSession = async (sid) => {
    if (!window.confirm("Delete session?")) return;
    try {
      await axios.delete(`${MCP_SERVER_URL}/sessions/${sid}`);
      await fetchSessions();
      if (currentSessionId === sid) { setCurrentSessionId(null); setMessages([]); }
    } catch (e) { console.error(e); }
  };

  const handleArchiveSession = async (sid) => {
    try {
      await axios.put(`${MCP_SERVER_URL}/sessions/archive/${sid}`);
      await fetchSessions();
      if (currentSessionId === sid) { setCurrentSessionId(null); setMessages([]); }
    } catch (e) { console.error(e); }
  };

  const handleRenameSession = async () => {
    const s = sessions.find(s => s.id === currentSessionId);
    if (!s) return;
    const name = window.prompt("Rename session:", s.name);
    if (name) {
      await axios.put(`${MCP_SERVER_URL}/sessions/${currentSessionId}`, { name: name.trim() });
      fetchSessions();
    }
  };

  useEffect(() => { fetchSessions(); }, []);
  useEffect(() => { if (currentSessionId) fetchHistory(currentSessionId); }, [currentSessionId]);

  const handleSendMessage = async (text) => {
    if (!currentSessionId) return;
    const userTimestamp = new Date().toISOString();
    setMessages((prev) => [...prev, { sender: 'user', text, timestamp: userTimestamp, id: Date.now() }]);
    setLoading(true);
    try {
      const res = await axios.post(`${MCP_SERVER_URL}/chat`, { message: text, session_id: currentSessionId });
      if (res.data.response && typeof res.data.response === 'object') {
        if (res.data.response.action === "change_theme") setCurrentTheme(res.data.response.theme);
      } else {
        setMessages((prev) => [...prev, {
          sender: 'bot',
          text: res.data.response,
          id: res.data.message_id,
          timestamp: res.data.timestamp || new Date().toISOString()
        }]);

        setTimeout(async () => {
          if (isProcessingProposal || proposal) return;
          try {
            const propRes = await axios.get(`${MCP_SERVER_URL}/proposals/latest`);
            if (propRes.data.success && propRes.data.has_proposal) {
              setProposal({ task: propRes.data.task, procedures: propRes.data.procedures });
            }
          } catch (e) { }
        }, 1500);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleApproveProposal = async () => {
    setIsProcessingProposal(true);
    try {
      const res = await axios.post(`${MCP_SERVER_URL}/proposals/approve`);
      if (!res.data.success) alert("Error: " + res.data.error);
    } catch (e) { alert("Error: " + e.message); } finally { setIsProcessingProposal(false); setProposal(null); }
  };

  const handleRejectProposal = async () => {
    setIsProcessingProposal(true);
    try {
      await axios.post(`${MCP_SERVER_URL}/proposals/reject`);
    } catch (e) { alert("Error: " + e.message); } finally { setIsProcessingProposal(false); setProposal(null); }
  };

  const currentSessionName = sessions.find(s => s.id === currentSessionId)?.name || 'Ready';

  // Status Indicator Styles & Brand Animation Linking
  let indicatorColor = "bg-green-500";
  let indicatorAnim = "animate-pulse";
  let brandColor1 = "text-green-400";
  let brandColor2 = "text-yellow-400";
  let brandGlowClass = "money-green-glow";

  if (!isConnected) {
    indicatorColor = "bg-red-600";
    indicatorAnim = "";
    brandColor1 = "text-red-500";
    brandColor2 = "text-red-600";
    brandGlowClass = "money-disconnected-glow animate-pulse";
  } else if (loading) {
    indicatorColor = "bg-yellow-400";
    indicatorAnim = "animate-thinking-blink";
    brandColor1 = "text-yellow-300";
    brandColor2 = "text-purple-400";
    brandGlowClass = "money-thinking-glow";
  }

  // Determine current active route for styling
  const isActive = (path) => location.pathname === path ? 'opacity-100 scale-110' : 'opacity-40 hover:opacity-100 text-white';

  return (
    <div className={`app-container ${theme.bg} ${theme.text} antialiased font-sans transition-colors duration-500`}>
      <header className={`header-fixed border-b-2 px-8 backdrop-blur-2xl relative glass-3d ${theme.header} border-black/80 shadow-[0_4px_30px_rgba(0,0,0,0.7)] transition-colors duration-500`}>
        <div className="flex items-center gap-4 w-64" />

        <div className="title-section group">
          <Link to="/" className="title-container mb-1 no-underline transition-all duration-700">
            <span className={`${brandColor1} transition-colors duration-700 ${brandGlowClass}`}>$</span>
            <span className="title-gold-shine px-1 drop-shadow-lg">ide</span>
            <span className={`${brandColor2} transition-colors duration-700 ${brandGlowClass}`}>$</span>
            <span className="title-gold-shine px-1 drop-shadow-lg">Fi</span>
            <span className={`${brandColor1} transition-colors duration-700 ${brandGlowClass}`}>$</span>
            <span className="title-gold-shine px-1 drop-shadow-lg">ale</span>
            <span className={`${brandColor2} font-black transition-colors duration-700 ${brandGlowClass}`}>$</span>
          </Link>
          <div className="header-session-name" onClick={handleRenameSession}>
            <AnimatePresence mode="wait">
              {!isTransitioning && (
                <motion.span key={currentSessionId} layoutId={`session-${currentSessionId}`} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                  {currentSessionName}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="text-[10px] font-black opacity-40 font-mono mt-1">
            {currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 w-64 relative">
          {/* React Router Navigation Links */}
          <Link to="/docs/commandcenter" className={`transition-all ${isActive('/docs/commandcenter')}`} title="System Command Center">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </Link>
          <Link to="/hunter" className={`transition-all ${isActive('/hunter')}`} title="Hunters Console">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </Link>
          <Link to="/json" className={`transition-all ${isActive('/json')}`} title="Live JSON Editor">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          </Link>
          <Link to="/files" className={`transition-all ${isActive('/files')}`} title="Files">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
          </Link>
          <Link to="/database" className={`transition-all ${isActive('/database')}`} title="Database">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
          </Link>

          <div className="relative ml-2 z-50">
            <button
              onClick={() => setQuickSettingsOpen(!isQuickSettingsOpen)}
              className={`w-3 h-3 rounded-full ${indicatorColor} ${indicatorAnim} cursor-pointer shadow-[0_0_10px_rgba(34,197,94,0.5)]`}
              title={isConnected ? (loading ? "AI is Thinking..." : "Connected") : "Disconnected"}
            />
          </div>
        </div>
      </header>

      <div className="sidebar-trigger-zone" />
      <aside className={`sidebar-overlay ${theme.sidebar} py-6 glass-3d shadow-[10px_0_30px_rgba(0,0,0,0.6)] group border-r border-white/20 transition-colors duration-500`}>
        <div className="w-[200px] flex flex-col items-center px-4 mb-8">
          <button onClick={handleNewSession} className="p-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 shrink-0" title="New Session">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>

        <div className="flex-1 w-[200px] flex flex-col custom-scrollbar overflow-y-auto overflow-x-hidden px-3">
          {!isSettingsOpen ? (
            <div className="w-full space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="relative flex items-center h-12 w-full rounded-xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all group/sid">
                  <div onClick={() => switchSession(s.id)} className={`cursor-pointer transition-all flex items-center w-full h-full rounded-xl ${currentSessionId === s.id ? 'opacity-100 text-white drop-shadow-md bg-white/10' : 'opacity-60 hover:opacity-100'}`} title={s.name}>
                    <div className="w-[46px] flex justify-center shrink-0">
                      <span className="invert-theme-bold">{s.name.substring(0, 4)}</span>
                    </div>
                    <span className="font-bold whitespace-nowrap text-sm truncate pr-2 box-border">{s.name}</span>
                  </div>
                  <div className="hidden group-hover:flex items-center gap-1 opacity-0 group-hover/sid:opacity-100 transition-opacity absolute right-1 bg-black/60 p-1 rounded-lg backdrop-blur-md">
                    <button onClick={() => handleArchiveSession(s.id)} className="text-yellow-500 font-black hover:text-yellow-400 p-1 rounded hover:bg-white/10" title="Archive"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg></button>
                    <button onClick={() => handleDeleteSession(s.id)} className="text-red-500 font-black hover:text-red-400 p-1 rounded hover:bg-white/10" title="Delete"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-center opacity-30 mb-4 whitespace-nowrap">Themes</div>
              {Object.keys(THEMES).map(t => (
                <button key={t} onClick={() => { setCurrentTheme(t); }}
                  className={`relative flex items-center h-12 w-full rounded-xl border transition-all overflow-hidden ${currentTheme === t ? 'bg-white/10 border-white/20 shadow-lg' : 'border-transparent hover:bg-white/5 opacity-60 hover:opacity-100'}`}>
                  <div className="w-[46px] flex justify-center shrink-0">
                    <div className={`w-4 h-4 rounded-full border border-white/20 ${THEMES[t].bg}`}></div>
                  </div>
                  <span className="text-xs font-bold truncate whitespace-nowrap">{THEMES[t].name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="w-[200px] flex justify-center mt-auto mb-2">
          <button onClick={() => setSettingsOpen(!isSettingsOpen)} className="p-3 opacity-40 hover:opacity-100 transition-all border border-transparent hover:bg-white/10 rounded-full">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </aside>

      <div className="flex-1 w-full h-full pt-20 overflow-hidden relative">
        <Routes>
          <Route path="/" element={<ChatDashboard messages={messages} theme={theme} isTransitioning={isTransitioning} currentSessionId={currentSessionId} handleSendMessage={handleSendMessage} handleDeleteMessage={handleDeleteMessage} setSettingsOpen={setSettingsOpen} isSettingsOpen={isSettingsOpen} />} />
          <Route path="/docs/commandcenter" element={<CommandCenter theme={theme} />} />
          <Route path="/hunter" element={<div className="w-full h-full p-8 overflow-y-auto custom-scrollbar"><ScraperPanel theme={theme} /></div>} />
          <Route path="/json" element={<div className="w-full h-full"><JsonExplorer isOpen={true} onClose={() => { }} theme={theme} isEmbedded={true} /></div>} />
          <Route path="/database" element={<div className="w-full h-full"><DatabaseExplorer isOpen={true} onClose={() => { }} theme={theme} isEmbedded={true} /></div>} />
          <Route path="/files" element={<div className="w-full h-full"><FileExplorer isOpen={true} onClose={() => { }} theme={theme} currentSessionId={currentSessionId} isEmbedded={true} /></div>} />
        </Routes>
      </div>

      <AnimatePresence>
        {proposal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999] bg-black/80 flex items-center justify-center p-8 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`w-full max-w-4xl max-h-full flex flex-col rounded-2xl glass-3d bevel-border ${theme.bg} overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)]`}>
              <div className={`p-4 border-b border-white/20 flex justify-between items-center ${theme.header}`}><div className="flex items-center gap-3"><span className="text-green-400 font-bold animate-pulse">●</span><h2 className="text-lg font-black tracking-widest uppercase">New Bot Proposal</h2></div></div>
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar text-sm opacity-90">
                <div><h3 className="text-xs font-black opacity-50 uppercase tracking-widest mb-2">task.md</h3><pre className="bg-black/40 p-4 rounded-xl border border-white/10 whitespace-pre-wrap font-mono relative">{proposal.task}</pre></div>
                <div><h3 className="text-xs font-black opacity-50 uppercase tracking-widest mb-2">procedures.txt</h3><pre className="bg-black/40 p-4 rounded-xl border border-white/10 whitespace-pre-wrap font-mono relative text-green-300">{proposal.procedures}</pre></div>
              </div>
              <div className={`p-4 border-t border-white/20 flex justify-end gap-3 ${theme.header}`}><button onClick={handleRejectProposal} disabled={isProcessingProposal} className="px-6 py-2 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/20 font-bold transition-all disabled:opacity-50">REJECT</button><button onClick={handleApproveProposal} disabled={isProcessingProposal} className="px-6 py-2 rounded-xl bg-green-500 hover:bg-green-400 text-black font-black transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:shadow-[0_0_25px_rgba(34,197,94,0.6)] disabled:opacity-50">{isProcessingProposal ? 'EXECUTING...' : 'APPROVE & EXECUTE'}</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DashboardLayout />
    </BrowserRouter>
  );
}
