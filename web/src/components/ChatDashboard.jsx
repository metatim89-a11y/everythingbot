import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatWindow from './ChatWindow';
import ChatInput from './ChatInput';

const ChatDashboard = ({
    messages,
    theme,
    handleDeleteMessage,
    chatWindowRef,
    isTransitioning,
    currentSessionId,
    handleSendMessage,
    setSettingsOpen,
    isSettingsOpen
}) => {
    return (
        <main className="chat-main w-full h-full flex flex-col">
            <div ref={chatWindowRef} className="messages-container custom-scrollbar px-4 flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                    {!isTransitioning && (
                        <motion.div
                            key={currentSessionId}
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -300, scale: 0.2, filter: 'blur(15px)', transition: { duration: 0.5 } }}
                        >
                            <ChatWindow messages={messages} theme={theme} onDeleteMessage={handleDeleteMessage} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="p-8">
                <div className="max-w-4xl mx-auto">
                    <ChatInput
                        onSendMessage={handleSendMessage}
                        theme={theme}
                        onToggleSettings={() => setSettingsOpen(!isSettingsOpen)}
                        onTrainBot={() => { }}
                        currentSessionId={currentSessionId}
                    />
                </div>
            </div>
        </main>
    );
};

export default ChatDashboard;
