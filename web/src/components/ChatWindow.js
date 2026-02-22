// Version: 1.04
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Message from './Message';

const ChatWindow = ({ messages, onRateMessage, onDeleteMessage, theme }) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="messages-list mx-auto">
      <AnimatePresence mode="popLayout">
        {messages.map((msg, index) => (
          <motion.div
            key={msg.id || `msg-${index}-${msg.text.substring(0, 10)}`}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Message 
              message={msg} 
              onRateMessage={onRateMessage} 
              onDelete={onDeleteMessage}
              theme={theme} 
            />
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={messagesEndRef} className="h-4" />
    </div>
  );
};

export default ChatWindow;
