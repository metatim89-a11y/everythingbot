// Version: 1.01
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

import { WindowManager } from './WindowManager';

const MCP_SERVER_URL = 'http://localhost:3000';

const ScraperPanel = ({ theme }) => {
    const [uiConfig, setUiConfig] = useState(null);
    const [macroNameState, setMacroNameState] = useState('');
    const [profiles, setProfiles] = useState([]);
    const [leads, setLeads] = useState([]);
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileKeywords, setNewProfileKeywords] = useState('');
    const [newProfileUrl, setNewProfileUrl] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await axios.get(`${MCP_SERVER_URL}/api/ui/config`);
                setUiConfig(res.data);
            } catch (e) { console.error("Failed to load ui config", e); }
        };
        fetchConfig();
    }, []);

    const saveUiConfig = async (newConfig) => {
        setUiConfig(newConfig);
        try {
            await axios.post(`${MCP_SERVER_URL}/api/ui/config`, newConfig);
        } catch (e) { console.error("Failed to save ui config", e); }
    };

    const handleMacroCommand = async (commandStr, payloadConfig) => {
        if (!commandStr) return;
        const [method, route] = commandStr.split(' ');

        // Basic payload replacement for state context
        let payload = {};
        if (payloadConfig && payloadConfig.name === '{macroName}') {
            payload.name = macroNameState;
        }

        try {
            if (method === 'POST') {
                const res = await axios.post(`${MCP_SERVER_URL}${route}`, payload);
                console.log(res.data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchProfiles = async () => {
        try {
            const res = await axios.get(`${MCP_SERVER_URL}/api/profiles`);
            if (res.data.success) setProfiles(res.data.profiles);
        } catch (e) {
            console.error("Failed to fetch profiles", e);
        }
    };

    const fetchLeads = async () => {
        try {
            const res = await axios.get(`${MCP_SERVER_URL}/api/leads`);
            if (res.data.success) setLeads(res.data.leads);
        } catch (e) {
            console.error("Failed to fetch leads", e);
        }
    };

    useEffect(() => {
        fetchProfiles();
        fetchLeads();
        const interval = setInterval(fetchLeads, 30000); // Polling for new leads
        return () => clearInterval(interval);
    }, []);

    const handleAddProfile = async (e) => {
        e.preventDefault();
        if (!newProfileName || !newProfileKeywords) return;

        const keywordsArray = newProfileKeywords.split(',').map(k => k.trim()).filter(k => k);
        try {
            await axios.post(`${MCP_SERVER_URL}/api/profiles`, {
                name: newProfileName,
                keywords: JSON.stringify(keywordsArray),
                target_url: newProfileUrl.trim()
            });
            setNewProfileName('');
            setNewProfileKeywords('');
            setNewProfileUrl('');
            fetchProfiles();
        } catch (e) {
            console.error("Failed to add profile", e);
        }
    };

    const handleDeleteProfile = async (id) => {
        try {
            await axios.delete(`${MCP_SERVER_URL}/api/profiles/${id}`);
            fetchProfiles();
        } catch (e) {
            console.error("Failed to delete profile", e);
        }
    };

    const handleStartScraper = async (profileName) => {
        setLoading(true);
        try {
            await axios.post(`${MCP_SERVER_URL}/api/scrape`, { profile_name: profileName });
        } catch (e) {
            console.error("Failed to start scraper", e);
        } finally {
            setTimeout(() => setLoading(false), 2000); // UI feedback
        }
    };

    const renderProfilesWidget = () => (
        <div>
            <form onSubmit={handleAddProfile} className="flex flex-col gap-4 mb-6">
                <div className="flex gap-4">
                    <input type="text" placeholder="Profile Name" value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} className={`bg-black/20 border border-white/10 rounded-lg px-4 py-2 flex-1 focus:outline-none focus:border-white/30 text-white`} />
                    <input type="text" placeholder="Keywords (comma separated)" value={newProfileKeywords} onChange={(e) => setNewProfileKeywords(e.target.value)} className={`bg-black/20 border border-white/10 rounded-lg px-4 py-2 flex-2 focus:outline-none focus:border-white/30 text-white w-1/2`} />
                </div>
                <div className="flex gap-4">
                    <input type="text" placeholder="Target URL" value={newProfileUrl} onChange={(e) => setNewProfileUrl(e.target.value)} className={`bg-black/20 border border-white/10 rounded-lg px-4 py-2 flex-1 focus:outline-none focus:border-white/30 text-white`} />
                    <button type="submit" className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold text-white transition-colors">Add Target</button>
                </div>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence>
                    {profiles.map(p => {
                        const kws = JSON.parse(p.keywords || '[]');
                        return (
                            <motion.div key={p.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="p-4 rounded-xl bg-black/30 border border-white/5 relative group text-white">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-lg">{p.name}</h4>
                                    <button onClick={() => handleDeleteProfile(p.id)} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs uppercase">Delete</button>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {kws.map((k, i) => <span key={i} className="text-xs px-2 py-1 bg-white/10 rounded-full opacity-80">{k}</span>)}
                                </div>
                                {p.target_url && <div className="text-[10px] opacity-50 mb-4 truncate" title={p.target_url}>🎯 {p.target_url}</div>}
                                <button onClick={() => handleStartScraper(p.name)} disabled={loading} className={`w-full py-2 rounded-lg font-bold text-sm transition-all ${loading ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}>
                                    {loading ? 'LAUNCHING WORKER...' : '▶ LAUNCH HUNTER'}
                                </button>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );

    const renderLeadsWidget = () => (
        <div className="overflow-x-auto text-white">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-white/10 opacity-60">
                        <th className="pb-3 font-medium">Time</th>
                        <th className="pb-3 font-medium">Profile</th>
                        <th className="pb-3 font-medium">Contact</th>
                        <th className="pb-3 font-medium">Address</th>
                        <th className="pb-3 font-medium">Snippet</th>
                    </tr>
                </thead>
                <tbody>
                    {leads.map(lead => (
                        <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-3 opacity-60">{new Date(lead.found_at || lead.timestamp).toLocaleTimeString()}</td>
                            <td className="py-3 font-bold text-green-400">{lead.profile_name}</td>
                            <td className="py-3 text-xs opacity-80">{lead.phone ? `📞 ${lead.phone}` : ''} {lead.email ? `✉️ ${lead.email}` : ''}</td>
                            <td className="py-3 text-xs opacity-80">{lead.address || '-'}</td>
                            <td className="py-3 pr-4 truncate max-w-xs">{lead.raw_message || lead.content}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderCustomComponent = (compName) => {
        if (compName === 'ProfilesWidget') return renderProfilesWidget();
        if (compName === 'LeadsWidget') return renderLeadsWidget();
        return null;
    };

    return (
        <div className="w-full h-full relative" onInput={(e) => {
            // Hacky global input listener for the dynamic JSON inputs to lift state up
            if (e.target.placeholder === "Macro Name") {
                setMacroNameState(e.target.value);
            }
        }}>
            <WindowManager
                config={uiConfig?.pages?.hunter}
                onUpdateConfig={(newHunterConfig) => {
                    saveUiConfig({
                        ...uiConfig,
                        pages: {
                            ...uiConfig.pages,
                            hunter: newHunterConfig
                        }
                    });
                }}
                renderCustomComponent={renderCustomComponent}
                handleMacroCommand={handleMacroCommand}
                pageContext={{ type: 'HUNTER', profiles, leads, macroNameState }}
                theme={theme}
            />
        </div>
    );
};

export default ScraperPanel;
