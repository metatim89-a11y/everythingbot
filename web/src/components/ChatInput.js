// Version: 1.06
import React, { useState, useRef } from 'react';
import axios from 'axios';

const MCP_SERVER_URL = 'http://localhost:3000';

const ChatInput = ({ onSendMessage, theme, onToggleSettings, onTrainBot, trainingStatus, loading, currentSessionId }) => {
  const [inputText, setInputText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      uploadFile(file);
    }
  };

  const uploadFile = async (file) => {
    if (!currentSessionId) {
      alert("Please select a session before uploading files.");
      return;
    }
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', currentSessionId);

    try {
      await axios.post(`${MCP_SERVER_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(`File uploaded to session: ${file.name}`);
      setSelectedFile(null);
    } catch (error) {
      console.error('File upload failed:', error);
      alert(`Failed to upload file: ${file.name}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full flex flex-col items-center">
      {selectedFile && (
        <div className="mb-2 w-full px-4 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-lg flex items-center justify-between">
          <span>{uploading ? 'Uploading...' : 'Selected:'} {selectedFile.name}</span>
          {!uploading && (
            <button onClick={() => setSelectedFile(null)} className="hover:text-red-400">✕</button>
          )}
        </div>
      )}
      <form className="flex items-center space-x-2 w-full" onSubmit={handleSubmit}>
        <button
          type="button"
          onClick={onToggleSettings}
          className={`p-3 bg-gray-700/50 hover:bg-gray-700 text-gray-400 hover:text-white rounded-full transition-all duration-200`}
          title="Settings & Themes"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={triggerFileInput}
          disabled={uploading}
          className={`p-3 bg-gray-700/50 hover:bg-gray-700 text-gray-400 hover:text-white rounded-full transition-all duration-200 disabled:opacity-50`}
          title="Upload file"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 105.657 5.656L17.657 13" />
          </svg>
        </button>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask anything..."
          className={`flex-1 px-4 py-3 border ${theme.border} rounded-xl bg-gray-700/30 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-gray-700/50 transition-all duration-200`}
        />
        
        <button
          type="submit"
          disabled={!inputText.trim() || uploading}
          className={`p-3 ${theme.button} ${theme.buttonHover} text-white font-semibold rounded-full shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed`}
          title="Send message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
      
      {/* Train Bot Link underneath */}
      <button 
        onClick={onTrainBot}
        disabled={loading}
        className="mt-2 text-[9px] font-black tracking-[0.3em] uppercase opacity-20 hover:opacity-100 transition-opacity disabled:opacity-10"
        title="Start LoRA Fine-tuning"
      >
        {trainingStatus || 'Train Bot Engine'}
      </button>
    </div>
  );
};

export default ChatInput;
