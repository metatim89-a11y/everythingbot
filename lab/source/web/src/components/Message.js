// Version: 1.10
import React from 'react';
import { motion } from 'framer-motion';

const Message = ({ message, onRateMessage, onDelete, theme }) => {
  const handleRate = (rating) => {
    if (message.id) onRateMessage(message.id, rating, message.text);
  };

  const isUser = message.sender === 'user';
  const isBot = message.sender === 'bot';
  const isSystem = message.sender === 'system';

  const messageBg = isUser ? theme.userBubble : isSystem ? 'bg-red-900/50' : theme.botBubble;
  const bubbleTextColor = isUser ? 'text-white' : theme.bubbleText;
  
  // Interactive Kinetic Feedback classes
  const glowClass = isUser ? 'message-glow-user' : isBot ? 'message-glow-bot' : '';

  // Format timestamp for display
  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  };

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4 message-bubble-container`}>
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>

        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className={`p-2 rounded-2xl ${messageBg} ${bubbleTextColor} ${isUser ? 'rounded-tr-none' : 'rounded-tl-none'} border ${theme.border} shadow-lg overflow-hidden transition-all duration-500 relative ${glowClass}`}
        >
          {!isSystem && (
            <div className={`text-[8px] font-bold uppercase tracking-tighter mb-1 opacity-40 flex items-center gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="flex items-center gap-1">
                <div className={`w-1 h-1 rounded-full ${isUser ? 'bg-white' : 'bg-current'}`}></div>
                {message.sender}
              </div>
              <span className="font-mono lowercase opacity-60">{formatTime(message.timestamp)}</span>
            </div>
          )}
          <div className="text-[11px] leading-tight whitespace-pre-wrap break-words">
            {message.text}
          </div>


          <div className="flex justify-between items-center mt-1 pt-1 border-t border-white/5">
            <button onClick={() => onDelete(message.id)} className="msg-delete-btn text-[10px]" title="Delete">×</button>
            {isBot && (
              <div className="flex gap-2">
                <button onClick={() => handleRate('good')} className="opacity-40 hover:opacity-100"><svg className="h-2 w-2" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a2 2 0 00-.8 1.6V10.333z" /></svg></button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Message;
