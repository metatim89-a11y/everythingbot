// Version: 1.01
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { WindowManager } from './WindowManager';

const MCP_SERVER_URL = 'http://localhost:3000';

const FileEditorWidget = ({ filepath, theme }) => {
  const [content, setContent] = useState('Loading...');

  useEffect(() => {
    const fetchFile = async () => {
      try {
        const res = await axios.get(`${MCP_SERVER_URL}/api/file/read?path=${filepath}`);
        if (res.data.success) {
          setContent(res.data.content);
        } else {
          setContent('Error loading file.');
        }
      } catch (e) {
        setContent('Error loading file.');
      }
    };
    fetchFile();
  }, [filepath]);

  return (
    <div className="w-full text-white text-xs font-mono h-[calc(100%-20px)]">
      <textarea
        className="w-full h-full bg-black/50 border border-white/10 rounded p-4 focus:outline-none focus:border-blue-500 custom-scrollbar"
        value={content}
        readOnly
      />
    </div>
  );
};

const FileExplorer = ({ isOpen, onClose, theme, currentSessionId, isEmbedded = false }) => {
  const [uiConfig, setUiConfig] = useState(null);
  const [files, setFiles] = useState([]);
  const currentPath = '/';
  const error = null;
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

  const fetchFiles = async () => {
    if (!currentSessionId) return;
    try {
      const response = await axios.get(`${MCP_SERVER_URL}/files/${currentSessionId}`);
      setFiles(response.data.files || []);
    } catch (error) {
      console.error("Error fetching files:", error);
    }
  };

  useEffect(() => {
    if (isOpen) fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentSessionId]);

  const handleDelete = async (filename) => {
    if (!window.confirm(`Delete ${filename}?`)) return;
    try {
      await axios.delete(`${MCP_SERVER_URL}/file/${filename}`);
      fetchFiles();
    } catch (error) {
      alert("Delete failed");
    }
  };

  const renderFileTreeWidget = () => (
    <div className="text-white">
      <div className="mb-4">
        <button className="px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded border border-blue-500/30 transition-all text-xs font-bold uppercase tracking-wider w-full">
          Upload File
        </button>
      </div>
      {!currentSessionId ? (
        <div className="text-center p-10 opacity-30 text-sm">Please select a session.</div>
      ) : files.length === 0 ? (
        <div className="text-center p-10 opacity-30 text-sm">No files uploaded.</div>
      ) : (
        <div className="space-y-2">
          {files.map(file => (
            <div key={file.filename} className="flex items-center justify-between p-3 rounded border border-white/10 bg-white/5 hover:bg-white/10 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-blue-500/20 text-blue-400 font-bold text-[8px]">DOC</div>
                <span className="text-xs font-medium">{file.original_name}</span>
              </div>
              <div className="flex gap-2">
                <button className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-300 transition-all" onClick={() => handleDelete(file.filename)}>Del</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCustomComponent = (compName, payload) => {
    if (compName === 'FileTreeWidget') return renderFileTreeWidget();
    if (compName === 'FileEditorWidget') return <FileEditorWidget filepath={payload?.filepath} theme={theme} />;
    return null;
  };

  if (!isOpen) return null;

  if (isEmbedded) {
    return (
      <div className="w-full h-full relative" style={{ minHeight: '600px' }}>
        <WindowManager
          config={uiConfig?.pages?.files}
          onUpdateConfig={(newFilesConfig) => {
            saveUiConfig({
              ...uiConfig,
              pages: {
                ...uiConfig.pages,
                files: newFilesConfig
              }
            });
          }}
          renderCustomComponent={renderCustomComponent}
          pageContext={{ type: 'FILES', currentPath, files, error }}
          theme={theme}
        />
      </div>
    );
  }
  return null;
};

export default FileExplorer;
