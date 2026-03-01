// Version: 1.00
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const MCP_SERVER_URL = 'http://localhost:3000';

const ScraperPanel = ({ theme }) => {
    const [profiles, setProfiles] = useState([]);
    const [leads, setLeads] = useState([]);
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileKeywords, setNewProfileKeywords] = useState('');
    const [loading, setLoading] = useState(false);

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
        const interval = setInterval(fetchLeads, 10000); // Polling for new leads
        return () => clearInterval(interval);
    }, []);

    const handleAddProfile = async (e) => {
        e.preventDefault();
        if (!newProfileName || !newProfileKeywords) return;

        const keywordsArray = newProfileKeywords.split(',').map(k => k.trim()).filter(k => k);
        try {
            await axios.post(`${MCP_SERVER_URL}/api/profiles`, {
                name: newProfileName,
                keywords: JSON.stringify(keywordsArray)
            });
            setNewProfileName('');
            setNewProfileKeywords('');
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

    return (
        <div className={`p-6 space-y-8 ${theme.text}`}>
            <h2 className="text-2xl font-black mb-4 title-gold-shine">Logistics Command Center</h2>

            {/* Keyword Profiles Section */}
            <div className={`p-6 rounded-2xl border ${theme.border} bg-white/5 backdrop-blur-md`}>
                <h3 className="text-sm uppercase tracking-widest opacity-60 mb-4 font-bold">Hunting Profiles</h3>

                <form onSubmit={handleAddProfile} className="flex gap-4 mb-6">
                    <input
                        type="text"
                        placeholder="Profile Name (e.g., Firewood)"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        className={`bg-black/20 border border-white/10 rounded-lg px-4 py-2 flex-1 focus:outline-none focus:border-white/30 ${theme.text}`}
                    />
                    <input
                        type="text"
                        placeholder="Keywords (comma separated)"
                        value={newProfileKeywords}
                        onChange={(e) => setNewProfileKeywords(e.target.value)}
                        className={`bg-black/20 border border-white/10 rounded-lg px-4 py-2 flex-2 focus:outline-none focus:border-white/30 w-1/2 ${theme.text}`}
                    />
                    <button type="submit" className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition-colors">
                        Add Target
                    </button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence>
                        {profiles.map(p => {
                            const kws = JSON.parse(p.keywords || '[]');
                            return (
                                <motion.div
                                    key={p.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="p-4 rounded-xl bg-black/30 border border-white/5 relative group"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-lg">{p.name}</h4>
                                        <button
                                            onClick={() => handleDeleteProfile(p.id)}
                                            className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs uppercase"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {kws.map((k, i) => (
                                            <span key={i} className="text-xs px-2 py-1 bg-white/10 rounded-full opacity-80">{k}</span>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => handleStartScraper(p.name)}
                                        disabled={loading}
                                        className={`w-full py-2 rounded-lg font-bold text-sm transition-all ${loading ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}
                                    >
                                        {loading ? 'LAUNCHING WORKER...' : '▶ LAUNCH HUNTER'}
                                    </button>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            {/* Results Section */}
            <div className={`p-6 rounded-2xl border ${theme.border} bg-white/5 backdrop-blur-md`}>
                <h3 className="text-sm uppercase tracking-widest opacity-60 mb-4 font-bold">Acquired Leads ({leads.length})</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/10 opacity-60">
                                <th className="pb-3 font-medium">Time</th>
                                <th className="pb-3 font-medium">Profile</th>
                                <th className="pb-3 font-medium">Platform</th>
                                <th className="pb-3 font-medium">Content / Snippet</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leads.map(lead => (
                                <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-3 opacity-60">{new Date(lead.timestamp).toLocaleTimeString()}</td>
                                    <td className="py-3 font-bold">{lead.profile_name}</td>
                                    <td className="py-3">{lead.platform}</td>
                                    <td className="py-3 pr-4 truncate max-w-xs">{lead.content}</td>
                                </tr>
                            ))}
                            {leads.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="py-8 text-center opacity-40 italic">
                                        No leads acquired yet. Launch a hunter profile.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ScraperPanel;
