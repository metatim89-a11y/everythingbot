// Version: 1.00
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { WindowManager } from './WindowManager';

const MCP_SERVER_URL = 'http://localhost:3000';

const CommandCenter = ({ theme }) => {
    const [metrics, setMetrics] = useState(null);
    const [logs, setLogs] = useState([]);
    const [uiConfig, setUiConfig] = useState({
        windows: [
            {
                id: 'sys-health',
                title: 'System Health',
                x: 50, y: 50, w: 400, h: 300,
                custom_component: 'MetricsWidget',
                style: { bg: 'bg-slate-900/80', border: 'border-blue-500/30' }
            },
            {
                id: 'sys-controls',
                title: 'Service Controls',
                x: 500, y: 50, w: 300, h: 400,
                custom_component: 'ControlsWidget',
                style: { bg: 'bg-slate-900/80', border: 'border-purple-500/30' }
            },
            {
                id: 'sys-logs',
                title: 'Live System Logs',
                x: 50, y: 400, w: 750, h: 300,
                custom_component: 'LogsWidget',
                style: { bg: 'bg-black/90', border: 'border-green-500/30' }
            }
        ]
    });

    useEffect(() => {
        const eventSource = new EventSource(`${MCP_SERVER_URL}/api/events`);
        
        eventSource.addEventListener('metrics', (event) => {
            const data = JSON.parse(event.data);
            setMetrics(data);
        });

        // Mock log stream for now, could be real SSE event 'logs'
        const logInterval = setInterval(() => {
            // In a real scenario, we'd listen for a 'log' event from SSE
        }, 5000);

        return () => {
            eventSource.close();
            clearInterval(logInterval);
        };
    }, []);

    const handleServiceAction = async (action, service) => {
        try {
            const endpoint = `/api/system/${action}/${service}`;
            await axios.post(`${MCP_SERVER_URL}${endpoint}`);
            alert(`${service} ${action} sequence initiated.`);
        } catch (e) {
            console.error(e);
            alert(`Failed to ${action} ${service}.`);
        }
    };

    const renderMetricsWidget = () => {
        if (!metrics) return <div className="text-blue-400 animate-pulse">Establishing data link...</div>;
        const { os, app } = metrics;
        return (
            <div className="space-y-4 text-xs font-mono">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-2 bg-black/40 rounded border border-white/5">
                        <p className="opacity-40 uppercase text-[10px]">CPU Load</p>
                        <p className="text-blue-400 font-bold">{os.cpuUsage.toFixed(2)}%</p>
                    </div>
                    <div className="p-2 bg-black/40 rounded border border-white/5">
                        <p className="opacity-40 uppercase text-[10px]">Memory Use</p>
                        <p className="text-green-400 font-bold">{(os.totalMem - os.freeMem) / 1024 / 1024 / 1024 > 1 ? `${((os.totalMem - os.freeMem) / 1024 / 1024 / 1024).toFixed(2)} GB` : `${((os.totalMem - os.freeMem) / 1024 / 1024).toFixed(2)} MB`}</p>
                    </div>
                </div>
                <div className="p-3 bg-black/40 rounded border border-white/5">
                    <p className="opacity-40 uppercase text-[10px] mb-2">Network Metrics</p>
                    <div className="flex justify-between">
                        <span>Latency</span>
                        <span className="text-yellow-400">{app.avgLatencyMs}ms</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Requests</span>
                        <span className="text-purple-400">{app.totalRequests}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Errors</span>
                        <span className={app.errorCount > 0 ? 'text-red-500' : 'text-green-500'}>{app.errorCount}</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderControlsWidget = () => (
        <div className="space-y-6">
            {['mcp', 'nlp', 'web'].map(service => (
                <div key={service} className="p-3 bg-black/40 rounded-xl border border-white/5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-60">{service} orchestrator</h4>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => handleServiceAction('relaunch', service)}
                            className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-[10px] font-black rounded border border-blue-500/30 transition-all"
                        >
                            RELAUNCH
                        </button>
                        <button 
                            onClick={() => handleServiceAction('stop', service)}
                            className="flex-1 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-[10px] font-black rounded border border-red-500/30 transition-all"
                        >
                            STOP
                        </button>
                    </div>
                </div>
            ))}
            <button 
                onClick={() => handleServiceAction('relaunch', '')}
                className="w-full py-3 bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 text-[10px] font-black rounded-xl border border-yellow-500/30 transition-all"
            >
                GLOBAL SYSTEM RELAUNCH
            </button>
        </div>
    );

    const renderLogsWidget = () => (
        <div className="h-full font-mono text-[10px] overflow-y-auto custom-scrollbar bg-black p-2 rounded border border-white/10">
            {logs.length === 0 && <p className="opacity-20 italic">Awaiting signed system input...</p>}
            {logs.map((log, i) => (
                <div key={i} className="mb-1">
                    <span className="text-green-500">[{new Date().toLocaleTimeString()}]</span>
                    <span className="text-gray-400 ml-2">{log}</span>
                </div>
            ))}
        </div>
    );

    const renderCustomComponent = (compName) => {
        if (compName === 'MetricsWidget') return renderMetricsWidget();
        if (compName === 'ControlsWidget') return renderControlsWidget();
        if (compName === 'LogsWidget') return renderLogsWidget();
        return null;
    };

    return (
        <div className="w-full h-full relative bg-[#020617] overflow-hidden">
            <WindowManager 
                config={uiConfig}
                onUpdateConfig={setUiConfig}
                renderCustomComponent={renderCustomComponent}
                theme={theme}
            />
            
            {/* Background Aesthetic Layer */}
            <div className="absolute inset-0 pointer-events-none opacity-10">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent" />
            </div>
        </div>
    );
};

export default CommandCenter;
