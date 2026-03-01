import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Rnd } from 'react-rnd';
import AgentWidget from './AgentWidget';

const MCP_SERVER_URL = 'http://localhost:3000';

const DatabaseExplorer = ({ isOpen, onClose, theme, isEmbedded = false }) => {
  const [dbName, setDbName] = useState('training');
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${MCP_SERVER_URL}/db/tables/${dbName}`);
      setTables(response.data.tables || []);
      setSelectedTable(null);
      setData([]);
    } catch (error) {
      console.error("Error fetching tables:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async (tableName) => {
    setLoading(true);
    setSelectedTable(tableName);
    try {
      const response = await axios.get(`${MCP_SERVER_URL}/db/data/${dbName}/${tableName}`);
      setData(response.data.rows || []);
    } catch (error) {
      console.error("Error fetching table data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dbName]);

  if (!isOpen) return null;

  const content = (
    <div className={`w-full ${isEmbedded ? 'h-full glass-3d shadow-[0_10px_40px_rgba(0,0,0,0.8)]' : 'max-w-5xl max-h-[90vh] shadow-2xl animate-in fade-in zoom-in duration-300'} overflow-hidden flex flex-col rounded-3xl border ${theme.border} ${theme.header}`}>
      <div className={`p-6 border-b ${theme.border} flex justify-between items-center bg-white/5`}>
        <div className="flex items-center gap-6">
          <h2 className={`text-xl font-black uppercase tracking-tighter ${theme.accent}`}>DB Explorer</h2>
          <select
            value={dbName}
            onChange={(e) => setDbName(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg text-xs font-bold p-2 outline-none focus:border-blue-500 transition-colors"
          >
            <option value="training">training.db</option>
            <option value="ai_only">ai_only.db</option>
            <option value="scraper_results">scraper_results.db</option>
          </select>
        </div>
        {!isEmbedded && <button onClick={onClose} className="text-2xl opacity-50 hover:opacity-100 transition-opacity">×</button>}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Table List Sidebar */}
        <div className={`w-48 border-r ${theme.border} p-4 overflow-y-auto custom-scrollbar`}>
          <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest mb-4">Tables</p>
          <div className="space-y-1">
            {tables.map(table => (
              <button
                key={table}
                onClick={() => fetchTableData(table)}
                className={`w-full text-left p-2 rounded-lg text-xs font-medium transition-all ${selectedTable === table ? 'bg-white/10 text-white shadow-lg' : 'opacity-50 hover:opacity-100 hover:bg-white/5'}`}
              >
                {table}
              </button>
            ))}
          </div>
        </div>

        {/* Data Grid */}
        <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-black/20">
          {loading ? (
            <div className="flex justify-center p-10 opacity-50 font-bold tracking-widest text-xs">QUERYING ENGINE...</div>
          ) : !selectedTable ? (
            <div className="text-center p-10 opacity-30 text-sm">Select a table to view data.</div>
          ) : data.length === 0 ? (
            <div className="text-center p-10 opacity-30 text-sm">Table is empty.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    {Object.keys(data[0]).map(key => (
                      <th key={key} className="p-3 font-black uppercase tracking-widest border-b border-white/10 text-blue-400">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} className="hover:bg-white/5 border-b border-white/5 transition-colors">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="p-3 opacity-80 whitespace-nowrap max-w-xs truncate">
                          {val === null ? <span className="opacity-20">NULL</span> : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Hardcoded Agent injection for DatabaseExplorer until it runs entirely on WindowManager */}
      <Rnd
        default={{ x: 750, y: 50, width: 350, height: 500 }}
        bounds="parent"
        className={`pointer-events-auto rounded-xl shadow-2xl flex flex-col overflow-hidden border-orange-500/30 border bg-slate-900/80 backdrop-blur-md`}
      >
        <div className="p-2 cursor-move flex justify-between items-center bg-orange-900/40 text-orange-300 border-b border-orange-500/30">
          <h3 className="text-xs font-bold uppercase tracking-wider">🧠 db-admin Omni-Agent</h3>
        </div>
        <div className="flex-1 p-4 overflow-y-auto cancel-drag">
          <AgentWidget context={{ type: 'DATABASE', dbName, tables, selectedTable, data }} theme={theme} />
        </div>
      </Rnd>
    </div>
  );

  if (isEmbedded) {
    return <div className="p-8 h-full">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {content}
    </div>
  );
};

export default DatabaseExplorer;
