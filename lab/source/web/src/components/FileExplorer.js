// Version: 1.02
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const MCP_SERVER_URL = 'http://localhost:3000';

const FileExplorer = ({ isOpen, onClose, theme, currentSessionId, isEmbedded = false }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchFiles = async () => {
    if (!currentSessionId) return;
    setLoading(true);
    try {
      // Corrected: pass currentSessionId to get session-specific files
      const response = await axios.get(`${MCP_SERVER_URL}/files/${currentSessionId}`);
      setFiles(response.data.files || []);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen) fetchFiles();
  }, [currentSessionId, isOpen]); // Keep isOpen in dependencies to trigger fetch when it opens

  const handleDelete = async (filename) => {
    if (!window.confirm(`Delete ${filename}?`)) return;
    try {
      await axios.delete(`${MCP_SERVER_URL}/file/${filename}`);
      fetchFiles();
    } catch (error) {
      alert("Delete failed");
    }
  };

  if (!isOpen) return null;

  const content = (
    <div className={`w-full ${isEmbedded ? 'h-full glass-3d shadow-[0_10px_40px_rgba(0,0,0,0.8)]' : 'max-w-2xl max-h-[80vh] shadow-2xl animate-in fade-in zoom-in duration-300'} overflow-hidden flex flex-col rounded-3xl border ${theme.border} ${theme.sidebar}`}>
      <div className={`p-6 border-b ${theme.border} flex justify-between items-center bg-white/5`}>
        <h2 className={`text-xl font-black uppercase tracking-tighter ${theme.accent}`}>File Explorer</h2>
        {!isEmbedded && <button onClick={onClose} className="text-2xl opacity-50 hover:opacity-100 transition-opacity">×</button>}
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {!currentSessionId ? (
          <div className="text-center p-10 opacity-30 text-sm">Please select a session to see its files.</div>
        ) : loading ? (
          <div className="flex justify-center p-10 opacity-50 font-bold tracking-widest text-xs">LOADING FILES...</div>
        ) : files.length === 0 ? (
          <div className="text-center p-10 opacity-30 text-sm">No files uploaded for this session yet.</div>
        ) : (
          <div className="space-y-2">
            {files.map(file => (
              <div key={file.filename} className={`flex items-center justify-between p-4 rounded-xl border ${theme.border} bg-white/5 hover:bg-white/10 transition-all group`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/20 text-blue-400 font-bold text-[10px]`}>DOC</div>
                  <span className="text-sm font-medium">{file.original_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`${MCP_SERVER_URL}/file/${file.filename}`}
                    target="_blank"
                    rel="noreferrer"
                    className="opacity-0 group-hover:opacity-100 p-2 text-[10px] font-black uppercase tracking-widest bg-white/10 rounded-lg hover:bg-white/20 transition-all"
                  >
                    View
                  </a>
                  <button
                    onClick={() => handleDelete(file.filename)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (isEmbedded) {
    return <div className="p-8 h-full max-w-4xl mx-auto">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {content}
    </div>
  );
};

export default FileExplorer;
