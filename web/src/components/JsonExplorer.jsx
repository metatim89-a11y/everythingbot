import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Rnd } from 'react-rnd';
import AgentWidget from './AgentWidget';

const MCP_SERVER_URL = 'http://localhost:3000';

const JsonExplorer = ({ isOpen, onClose, theme, isEmbedded = false }) => {
    const [jsonText, setJsonText] = useState('Loading...');
    const [status, setStatus] = useState('');
    const [layouts, setLayouts] = useState([]);
    const [selectedLayout, setSelectedLayout] = useState('');
    const [newLayoutName, setNewLayoutName] = useState('');

    const fetchJson = async () => {
        try {
            const res = await axios.get(`${MCP_SERVER_URL}/api/ui/config`);
            setJsonText(JSON.stringify(res.data, null, 2));
            setStatus('Loaded from server.');
        } catch (e) {
            setStatus('Failed to load JSON.');
            console.error(e);
        }
    };

    const fetchLayouts = async () => {
        try {
            const res = await axios.get(`${MCP_SERVER_URL}/api/ui/layouts`);
            if (res.data.success) setLayouts(res.data.layouts);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (isOpen) {
            fetchJson();
            fetchLayouts();
        }
    }, [isOpen]);

    const handleSave = async () => {
        try {
            const parsed = JSON.parse(jsonText);
            await axios.post(`${MCP_SERVER_URL}/api/ui/config`, parsed);
            setStatus('Saved successfully! Refreshing...');
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } catch (e) {
            setStatus('Invalid JSON format! Review your brackets.');
        }
    };

    const handleSaveAs = async () => {
        if (!newLayoutName) return;
        try {
            const parsed = JSON.parse(jsonText);
            await axios.post(`${MCP_SERVER_URL}/api/ui/layouts`, { name: newLayoutName, config: parsed });
            setStatus(`Saved as layout: ${newLayoutName}`);
            setNewLayoutName('');
            fetchLayouts();
        } catch (e) {
            setStatus('Invalid JSON or server error.');
        }
    };

    const handleLoadLayout = async () => {
        if (!selectedLayout) return;
        try {
            await axios.post(`${MCP_SERVER_URL}/api/ui/layout/load`, { name: selectedLayout });
            setStatus(`Loaded layout: ${selectedLayout}. Refreshing...`);
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } catch (e) {
            setStatus('Failed to load layout.');
        }
    };

    if (!isOpen) return null;

    const content = (
        <div className={`w-full ${isEmbedded ? 'h-full glass-3d shadow-[0_10px_40px_rgba(0,0,0,0.8)]' : 'max-w-4xl max-h-[80vh] shadow-2xl animate-in fade-in zoom-in duration-300'} overflow-hidden flex flex-col rounded-3xl border ${theme.border} ${theme.sidebar}`}>
            <div className={`p-6 border-b ${theme.border} flex flex-col gap-4 bg-white/5`}>
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <h2 className={`text-xl font-black uppercase tracking-tighter ${theme.accent}`}>Live JSON OS Editor</h2>
                        <span className="text-xs opacity-50 font-mono mt-1">{status}</span>
                    </div>
                    <div className="flex gap-4 items-center">
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-green-500/20 text-green-400 font-bold hover:bg-green-500/30 transition-colors rounded-lg border border-green-500/30"
                        >
                            APPLY ACTUALLY
                        </button>
                        {!isEmbedded && <button onClick={onClose} className="text-2xl opacity-50 hover:opacity-100 transition-opacity">×</button>}
                    </div>
                </div>

                {/* Profiles & Layouts Section */}
                <div className="flex items-center gap-6 p-4 rounded-xl bg-black/40 border border-white/5">
                    <div className="flex gap-2 items-center text-sm w-1/2">
                        <span className="font-bold opacity-60 w-32">Load Layout:</span>
                        <select
                            value={selectedLayout}
                            onChange={(e) => setSelectedLayout(e.target.value)}
                            className="flex-1 bg-black/50 border border-white/10 rounded px-3 py-2 text-white outline-none"
                        >
                            <option value="">-- Select Profile --</option>
                            {layouts.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <button onClick={handleLoadLayout} className="px-4 py-2 bg-blue-500/20 text-blue-400 font-bold hover:bg-blue-500/30 rounded border border-blue-500/30">LOAD</button>
                    </div>

                    <div className="flex gap-2 items-center text-sm w-1/2 border-l border-white/10 pl-6">
                        <span className="font-bold opacity-60 w-32">Save Layout As:</span>
                        <input
                            type="text"
                            placeholder="New Layout Name"
                            value={newLayoutName}
                            onChange={(e) => setNewLayoutName(e.target.value)}
                            className="flex-1 bg-black/50 border border-white/10 rounded px-3 py-2 text-white outline-none"
                        />
                        <button onClick={handleSaveAs} className="px-4 py-2 bg-purple-500/20 text-purple-400 font-bold hover:bg-purple-500/30 rounded border border-purple-500/30 text-nowrap">SAVE PROFILE</button>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-0 overflow-hidden bg-[#0d1117]">
                <textarea
                    value={jsonText}
                    onChange={(e) => {
                        setJsonText(e.target.value);
                        setStatus('Unsaved changes...');
                    }}
                    className="w-full h-full bg-transparent text-[#e6edf3] font-mono text-xs p-6 outline-none resize-none custom-scrollbar"
                    spellCheck={false}
                />
            </div>
            {/* Hardcoded Agent injection for JsonExplorer until it runs entirely on WindowManager */}
            <Rnd
                default={{ x: 800, y: 50, width: 350, height: 500 }}
                bounds="parent"
                className={`pointer-events-auto rounded-xl shadow-2xl flex flex-col overflow-hidden border-orange-500/30 border bg-slate-900/80 backdrop-blur-md`}
            >
                <div className="p-2 cursor-move flex justify-between items-center bg-orange-900/40 text-orange-300 border-b border-orange-500/30">
                    <h3 className="text-xs font-bold uppercase tracking-wider">🧠 Omni-Agent Local LLM</h3>
                </div>
                <div className="flex-1 p-4 overflow-y-auto cancel-drag">
                    <AgentWidget context={{ type: 'JSON_EDITOR', jsonText }} theme={theme} />
                </div>
            </Rnd>
        </div>
    );

    if (isEmbedded) {
        return <div className="p-8 h-full mx-auto max-w-6xl">{content}</div>;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            {content}
        </div>
    );
};

export default JsonExplorer;
