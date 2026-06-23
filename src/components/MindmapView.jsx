import React, { useState, useCallback, useMemo } from 'react';
import { Network, Plus, Trash2, ChevronLeft, Bot, Send, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactFlow, Controls, Background, addEdge, applyNodeChanges, applyEdgeChanges, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const MindmapView = ({ state, dispatch }) => {
  const [activeMapId, setActiveMapId] = useState(null);
  const [newName, setNewName] = useState('');
  
  // For AI generation
  const [aiText, setAiText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  const activeMap = useMemo(() => {
    return state.mindmaps?.find(m => m.id === activeMapId) || null;
  }, [state.mindmaps, activeMapId]);

  const addMindmap = () => {
    if (!newName.trim()) return;
    dispatch({
      type: 'ADD_MINDMAP',
      payload: {
        name: newName,
        nodes: [{ id: 'root', position: { x: 250, y: 250 }, data: { label: newName }, type: 'input' }],
        edges: []
      }
    });
    setNewName('');
  };

  const onNodesChange = useCallback(
    (changes) => {
      if (activeMap) {
        dispatch({
          type: 'UPDATE_MINDMAP',
          payload: {
            id: activeMap.id,
            nodes: applyNodeChanges(changes, activeMap.nodes),
          }
        });
      }
    },
    [activeMap, dispatch]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      if (activeMap) {
        dispatch({
          type: 'UPDATE_MINDMAP',
          payload: {
            id: activeMap.id,
            edges: applyEdgeChanges(changes, activeMap.edges),
          }
        });
      }
    },
    [activeMap, dispatch]
  );

  const onConnect = useCallback(
    (params) => {
      if (activeMap) {
        dispatch({
          type: 'UPDATE_MINDMAP',
          payload: {
            id: activeMap.id,
            edges: addEdge(params, activeMap.edges),
          }
        });
      }
    },
    [activeMap, dispatch]
  );

  const generateWithAI = async () => {
    if (!aiText.trim() || !activeMap) return;
    setIsGenerating(true);
    setAiError('');

    try {
      const prompt = `
Extract a mindmap from the following text. 
Return ONLY a valid JSON object without any markdown tags or code blocks.
The JSON must have this structure:
{
  "nodes": [{ "id": "1", "label": "Node Label" }],
  "edges": [{ "source": "1", "target": "2" }]
}
Text: ${aiText}
      `;

      const response = await fetch('/api/omni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt })
      });

      const data = await response.json();
      let aiResponseText = data.responses?.[0]?.text || data.reply?.[0]?.text || "";
      
      // Clean up markdown if any
      aiResponseText = aiResponseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      const parsed = JSON.parse(aiResponseText);
      
      if (parsed.nodes && parsed.edges) {
        // Layout algorithm (simple circular)
        const radius = 150;
        const centerX = 250;
        const centerY = 250;
        
        const newNodes = parsed.nodes.map((n, i) => {
          const angle = (i / parsed.nodes.length) * 2 * Math.PI;
          return {
            id: `ai_node_${Date.now()}_${n.id}`,
            position: {
              x: centerX + radius * Math.cos(angle),
              y: centerY + radius * Math.sin(angle)
            },
            data: { label: n.label }
          };
        });

        // Add root node to connect generated ones if needed
        const newEdges = parsed.edges.map(e => ({
          id: `ai_edge_${Date.now()}_${e.source}_${e.target}`,
          source: `ai_node_${Date.now()}_${e.source}`,
          target: `ai_node_${Date.now()}_${e.target}`,
        }));

        dispatch({
          type: 'UPDATE_MINDMAP',
          payload: {
            id: activeMap.id,
            nodes: [...activeMap.nodes, ...newNodes],
            edges: [...activeMap.edges, ...newEdges]
          }
        });
        setAiText('');
      } else {
        throw new Error('Invalid JSON format from AI');
      }
    } catch (err) {
      setAiError('Не удалось сгенерировать карту. ' + err.message);
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  if (activeMapId) {
    if (!activeMap) {
       setActiveMapId(null);
       return null;
    }
    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <div className="flex items-center justify-between mb-4 bg-theme-panel p-4 rounded-2xl border border-theme-border shadow-sm">
          <button 
            onClick={() => setActiveMapId(null)}
            className="flex items-center gap-2 text-theme-muted hover:text-theme-text transition-colors"
          >
            <ChevronLeft size={20} /> Назад
          </button>
          <h3 className="text-xl font-serif font-bold text-theme-text flex items-center gap-2">
            <Network className="text-theme-accent" /> {activeMap.name}
          </h3>
          <div className="w-20"></div> {/* spacer for centering */}
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-4 h-[calc(100%-5rem)]">
          {/* React Flow Canvas */}
          <div className="flex-1 bg-theme-panel rounded-2xl border border-theme-border overflow-hidden relative shadow-sm">
            <ReactFlow
              nodes={activeMap.nodes || []}
              edges={activeMap.edges || []}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
              className="bg-theme-bg"
              colorMode={state.settings?.theme === 'liwood' ? 'light' : 'dark'}
            >
              <Background color="var(--accent-color)" gap={20} size={1} opacity={0.15} />
              <Controls className="!bg-theme-panel !border-theme-border !fill-[var(--text-primary)]" />
              <MiniMap className="!bg-theme-panel !border-theme-border" maskColor="var(--border-color)" nodeColor="var(--accent-color)" />
            </ReactFlow>
          </div>

          {/* AI Panel */}
          <div className="w-full lg:w-80 bg-theme-panel border border-theme-border rounded-2xl p-5 flex flex-col gap-4 shadow-sm overflow-y-auto">
            <h4 className="font-serif font-bold text-theme-text flex items-center gap-2">
              <Bot className="text-theme-accent" size={20} /> AI Генерация
            </h4>
            <p className="text-xs text-theme-muted">Вставьте текст (заметки, идеи), и OMNI извлечет из него связи и узлы для карты.</p>
            
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Текст для анализа..."
              className="flex-1 min-h-[150px] bg-theme-bg border border-theme-border rounded-xl p-3 text-theme-text text-sm focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-border resize-none custom-scrollbar placeholder-theme-muted/40"
            />
            
            {aiError && <div className="text-red-500 text-xs bg-red-500/10 border border-red-500/20 p-2 rounded-lg">{aiError}</div>}
            
            <button
              onClick={generateWithAI}
              disabled={isGenerating || !aiText.trim()}
              className="btn-gold disabled:opacity-50 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold shadow-sm hover:shadow-md"
            >
              {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Send size={16} /> Сгенерировать</>}
            </button>

            {/* Quick add node */}
            <div className="pt-4 border-t border-theme-border mt-2 font-serif">
               <h4 className="font-serif font-bold text-theme-text text-sm mb-3">Добавить узел вручную</h4>
               <button 
                onClick={() => {
                  const newNode = {
                    id: `node_${Date.now()}`,
                    position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
                    data: { label: 'Новый узел' }
                  };
                  dispatch({ type: 'UPDATE_MINDMAP', payload: { id: activeMap.id, nodes: [...activeMap.nodes, newNode] } });
                }}
                className="w-full bg-theme-panel hover:bg-theme-accent/10 border border-theme-border text-theme-text py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-2 font-medium shadow-sm"
               >
                 <Plus size={16}/> Добавить
               </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="glass-panel p-6 shadow-sm">
        <h3 className="text-lg font-serif font-bold text-theme-text mb-4 flex items-center gap-2">
          <Network className="text-theme-accent" size={20} /> Новая карта мыслей
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Название Mindmap..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMindmap()}
            className="input-field flex-1"
          />
          <button
            onClick={addMindmap}
            className="btn-gold whitespace-nowrap"
          >
            Создать
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatePresence>
          {(state.mindmaps || []).map(map => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={map.id}
              onClick={() => setActiveMapId(map.id)}
              className="glass-panel p-5 cursor-pointer hover:border-theme-accent/50 hover:shadow-md transition-all group relative bg-theme-panel"
            >
              <div className="flex justify-between items-start mb-3">
                <Network className="text-theme-accent" size={24} />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if(confirm('Удалить карту?')) dispatch({ type: 'DELETE_MINDMAP', payload: map.id });
                  }} 
                  className="text-theme-muted hover:text-red-500 p-1.5 opacity-0 group-hover:opacity-100 transition-all bg-theme-panel hover:bg-red-500/10 border border-theme-border rounded-lg shadow-sm"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <h3 className="text-theme-text font-serif font-bold text-lg mb-1">{map.name}</h3>
              <p className="text-theme-muted text-xs mb-4">Узлов: {map.nodes?.length || 0}</p>
              <div className="text-[10px] text-theme-muted/70 font-mono">
                Создано {new Date(map.created).toLocaleDateString()}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {(!state.mindmaps || state.mindmaps.length === 0) && (
        <div className="text-center py-20 bg-theme-panel/50 rounded-2xl border border-theme-border border-dashed backdrop-blur-sm">
          <div className="text-5xl mb-4 opacity-50">🧠</div>
          <p className="text-theme-muted text-lg font-serif">Нет карт мыслей.</p>
          <p className="text-theme-muted/70 text-sm mt-2">Визуализируйте свои идеи!</p>
        </div>
      )}
    </div>
  );
};

export default MindmapView;
