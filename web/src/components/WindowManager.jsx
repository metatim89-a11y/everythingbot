import React from 'react';
import { Rnd } from 'react-rnd';
import AgentWidget from './AgentWidget';

export function WindowManager({ config, onUpdateConfig, renderCustomComponent, handleMacroCommand, pageContext, theme, onCloseWindow }) {
    if (!config || !config.windows) return <div>Loading OS...</div>;

    const toggleMinimize = (id) => {
        const updatedWindows = config.windows.map(win => {
            if (win.id === id) {
                return { ...win, minimized: !win.minimized };
            }
            return win;
        });
        onUpdateConfig({ ...config, windows: updatedWindows });
    };

    const handleDragStop = (id, e, d) => {
        const updatedWindows = config.windows.map(win => {
            if (win.id === id) {
                return { ...win, x: d.x, y: d.y };
            }
            return win;
        });
        onUpdateConfig({ ...config, windows: updatedWindows });
    };

    const handleResizeStop = (id, e, direction, ref, delta, position) => {
        const updatedWindows = config.windows.map(win => {
            if (win.id === id) {
                return {
                    ...win,
                    w: parseInt(ref.style.width, 10),
                    h: parseInt(ref.style.height, 10),
                    ...position
                };
            }
            return win;
        });
        onUpdateConfig({ ...config, windows: updatedWindows });
    };

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {config.windows.map(win => (
                <Rnd
                    key={win.id}
                    size={{ width: win.w, height: win.h }}
                    position={{ x: win.x, y: win.y }}
                    onDragStop={(e, d) => handleDragStop(win.id, e, d)}
                    onResizeStop={(e, dir, ref, delta, pos) => handleResizeStop(win.id, e, dir, ref, delta, pos)}
                    bounds="parent"
                    cancel=".cancel-drag"
                    className={`pointer-events-auto rounded-xl shadow-2xl flex flex-col overflow-hidden ${win.style?.border || 'border-white/10'} border ${win.style?.bg || 'bg-black/50'} backdrop-blur-md ${win.minimized ? 'minified-window' : ''}`}
                    disableDragging={false}
                    enableResizing={!win.minimized}
                >
                    {/* Window Header (Drag Handle) */}
                    <div className={`p-2 cursor-move flex justify-between items-center ${win.style?.header || 'bg-white/10'}`}>
                        <h3 className="text-xs font-bold uppercase tracking-wider">{win.title}</h3>
                        <div className="flex gap-2">
                            <button onClick={() => toggleMinimize(win.id)} className="w-3 h-3 rounded-full bg-yellow-500/50 hover:bg-yellow-400 transition-colors z-50 cursor-pointer" title="Minimize/Restore"></button>
                            <button onClick={() => onCloseWindow ? onCloseWindow(win.id) : null} className="w-3 h-3 rounded-full bg-red-500/50 hover:bg-red-400 transition-colors z-50 cursor-pointer" title="Close"></button>
                        </div>
                    </div>

                    {/* Window Body */}
                    {!win.minimized && (
                        <div className="flex-1 p-4 overflow-y-auto cancel-drag">
                        {win.custom_component === 'AgentWidget' && <AgentWidget context={pageContext} theme={theme} />}
                        {win.custom_component !== 'AgentWidget' && renderCustomComponent && renderCustomComponent(win.custom_component, win.payload)}

                        {/* Dynamic Components Render */}
                        {win.components && win.components.map((comp, idx) => {
                            if (comp.type === 'text') {
                                return <p key={idx} className={comp.className}>{comp.content}</p>
                            }
                            if (comp.type === 'input') {
                                return <input key={idx} type="text" placeholder={comp.placeholder} className={comp.className} />
                            }
                            if (comp.type === 'button') {
                                return (
                                    <button
                                        key={idx}
                                        className={comp.className}
                                        onClick={() => handleMacroCommand && handleMacroCommand(comp.command, comp.payload)}
                                    >
                                        {comp.label}
                                    </button>
                                )
                            }
                            return null;
                        </div>
                    )}
                </Rnd>
            ))}
        </div>
    );
}
