import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const MCP_SERVER_URL = 'http://localhost:3000';

const AgentWidget = ({ context, theme }) => {
    const [messages, setMessages] = useState([
        { sender: 'bot', text: "I'm your Local Omni-Agent. I can see the data on this page. What do you want to extract or execute?" }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    // 3-Step Verification State
    const [pendingAction, setPendingAction] = useState(null); // { type: 'EXTRACTION' | 'PARSE' | 'DB_INSERT', payload: any }

    const messagesEndRef = useRef(null);
    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    useEffect(scrollToBottom, [messages, pendingAction]);

    const handleSend = async (overrideText = null, actionResponse = null) => {
        const textToSend = overrideText || input;
        if (!textToSend.trim() && !actionResponse) return;

        if (!actionResponse) {
            setMessages(prev => [...prev, { sender: 'user', text: textToSend }]);
            setInput('');
        }

        setLoading(true);

        try {
            const res = await axios.post(`${MCP_SERVER_URL}/api/agent/chat`, {
                message: textToSend,
                context: context, // The raw data of whatever page we are on
                actionResponse: actionResponse // e.g., { approved: true, step: 'EXTRACTION' }
            });

            const { response, pending_action } = res.data;

            setMessages(prev => [...prev, { sender: 'bot', text: response }]);

            if (pending_action) {
                setPendingAction(pending_action);
            } else {
                setPendingAction(null);
            }

        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { sender: 'bot', text: 'Error communicating with Local NLP Service.' }]);
        } finally {
            setLoading(false);
        }
    };

    const handleActionReponse = (approved) => {
        if (!pendingAction) return;

        // Optimistic UI for the user's choice
        setMessages(prev => [...prev, {
            sender: 'user',
            text: approved ? `[System] User APPROVED ${pendingAction.type}` : `[System] User REJECTED ${pendingAction.type}`
        }]);

        // Send the decision back to the orchestrator
        handleSend(`[Hidden] User decision: ${approved}`, {
            approved,
            step: pendingAction.type,
            payload: pendingAction.payload
        });

        setPendingAction(null);
    };

    return (
        <div className="flex flex-col h-full text-white text-sm">
            <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar pr-2 space-y-4">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-3 rounded-xl max-w-[85%] ${msg.sender === 'user' ? 'bg-blue-600/50 text-blue-50 border border-blue-500/30' : 'bg-black/40 text-gray-200 border border-white/10'}`}>
                            {msg.text}
                        </div>
                    </div>
                ))}

                {/* 3-Step Verification UI Injector */}
                <AnimatePresence>
                    {pendingAction && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="bg-yellow-900/40 border border-yellow-500/50 rounded-xl p-4 mt-4"
                        >
                            <h4 className="font-bold text-yellow-500 uppercase tracking-widest text-xs mb-2">
                                ⚠️ VERIFICATION REQUIRED: {pendingAction.type}
                            </h4>
                            <div className="bg-black/50 p-2 rounded text-xs font-mono text-yellow-200 mb-4 max-h-32 overflow-y-auto border border-yellow-500/20">
                                {typeof pendingAction.payload === 'object' ? JSON.stringify(pendingAction.payload, null, 2) : pendingAction.payload}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleActionReponse(true)}
                                    className="flex-1 bg-green-600/40 hover:bg-green-600/60 text-green-300 font-bold py-2 rounded border border-green-500/30 transition-colors"
                                >
                                    YES, PROCEED
                                </button>
                                <button
                                    onClick={() => handleActionReponse(false)}
                                    className="flex-1 bg-red-600/40 hover:bg-red-600/60 text-red-300 font-bold py-2 rounded border border-red-500/30 transition-colors"
                                >
                                    NO, REJECT
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {loading && (
                    <div className="flex justify-start">
                        <div className="p-3 rounded-xl bg-black/40 text-gray-400 border border-white/10 text-xs tracking-widest animate-pulse">
                            Phi-1.5 is thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="relative">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={loading || pendingAction}
                    placeholder={pendingAction ? "Awaiting your verification above..." : "Command the Omni-Agent..."}
                    className="w-full bg-black/50 border border-white/10 rounded-lg pl-4 pr-12 py-3 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                />
                <button
                    onClick={() => handleSend()}
                    disabled={loading || pendingAction || !input.trim()}
                    className="absolute right-2 top-2 p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/40 disabled:opacity-30 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </button>
            </div>
        </div>
    );
};

export default AgentWidget;
