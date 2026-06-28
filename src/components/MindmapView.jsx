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
  const [generationDepth, setGenerationDepth] = useState(3);
  const [generationIterations, setGenerationIterations] = useState(1);
  const [generationStep, setGenerationStep] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [editRequest, setEditRequest] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const activeMap = useMemo(() => {
    return state.mindmaps?.find(m => m.id === activeMapId) || null;
  }, [state.mindmaps, activeMapId]);

  const selectedNode = useMemo(() => {
    if (!activeMap || !selectedNodeId) return null;
    return (activeMap.nodes || []).find((n) => n.id === selectedNodeId) || null;
  }, [activeMap, selectedNodeId]);

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

  const onNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id);
  }, []);

  const extractOmniText = (data) => {
    if (!data) return '';

    if (Array.isArray(data.outputs) && data.outputs.length > 0) {
      const fromOutputs = data.outputs
        .map((o) => o?.text)
        .filter(Boolean)
        .join('\n\n')
        .trim();
      if (fromOutputs) return fromOutputs;
    }

    if (Array.isArray(data.responses) && data.responses.length > 0) {
      const fromResponses = data.responses
        .map((r) => r?.text)
        .filter(Boolean)
        .join('\n\n')
        .trim();
      if (fromResponses) return fromResponses;
    }

    if (Array.isArray(data.reply) && data.reply.length > 0) {
      const fromReply = data.reply
        .map((r) => r?.text)
        .filter(Boolean)
        .join('\n\n')
        .trim();
      if (fromReply) return fromReply;
    }

    return '';
  };

  const buildPrompt = ({ text, depth, iteration, totalIterations, existingNodes, focusNodeLabel }) => {
    const existingLabels = existingNodes
      .map((n) => n?.data?.label)
      .filter(Boolean)
      .join(', ');

    if (iteration === 1 && !focusNodeLabel) {
      return `
Построй mindmap из текста ниже.
Ограничение глубины: ${depth}.
Текущая итерация: ${iteration} из ${totalIterations}.

Верни ТОЛЬКО валидный JSON без markdown:
{
  "nodes": [{ "id": "1", "label": "Node Label" }],
  "edges": [{ "source": "1", "target": "2" }]
}

Текст: ${text}
      `;
    }

    if (focusNodeLabel) {
      return `
Продолжи существующую mindmap только от выбранной ноды "${focusNodeLabel}".
Сделай новые дочерние ветки и подветки от этой ноды.
Ограничение глубины: ${depth}.
Текущая итерация: ${iteration} из ${totalIterations}.
Не дублируй уже существующие узлы.
Существующие узлы: ${existingLabels || 'нет'}.
Контекст пользователя: ${text || 'Расширь выбранный узел по текущему контексту карты'}.

Верни ТОЛЬКО валидный JSON без markdown:
{
  "nodes": [{ "id": "1", "label": "Node Label" }],
  "edges": [{ "source": "1", "target": "2" }]
}
      `;
    }

    return `
Расширь существующую mindmap новыми ветками, не дублируй уже существующие узлы.
Ограничение глубины: ${depth}.
Текущая итерация: ${iteration} из ${totalIterations}.
Существующие узлы: ${existingLabels || 'нет'}.
Исходный текст: ${text}

Верни ТОЛЬКО валидный JSON без markdown:
{
  "nodes": [{ "id": "1", "label": "Node Label" }],
  "edges": [{ "source": "1", "target": "2" }]
}
    `;
  };

  const parseMindmapJson = (rawText) => {
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1));
      }
      throw new Error('Некорректный JSON от AI');
    }
  };

  const buildEditPrompt = ({ request, focusNodeLabel, currentNodes, currentEdges }) => {
    const nodesPayload = (currentNodes || []).map((n) => ({
      id: n.id,
      label: n?.data?.label || '',
    }));

    const edgesPayload = (currentEdges || []).map((e) => ({
      source: e.source,
      target: e.target,
    }));

    return `
Ты редактор mindmap.
Нужно изменить текущую карту по запросу пользователя.
${focusNodeLabel ? `Фокусная нода: ${focusNodeLabel}. Если уместно, приоритезируй изменения вокруг нее.` : ''}

Запрос пользователя:
${request}

Текущая карта:
${JSON.stringify({ nodes: nodesPayload, edges: edgesPayload })}

Верни ТОЛЬКО валидный JSON БЕЗ markdown в формате:
{
  "nodes": [{ "id": "1", "label": "Node Label" }],
  "edges": [{ "source": "1", "target": "2" }]
}

Важно:
- верни полную итоговую карту после редактирования,
- не добавляй комментарии,
- избегай дубликатов по label.
    `;
  };

  const applyEditedMindmap = ({ parsedNodes, parsedEdges, currentNodes, focusNode }) => {
    const existingByLabel = new Map();
    (currentNodes || []).forEach((n) => {
      const label = String(n?.data?.label || '').trim().toLowerCase();
      if (label) existingByLabel.set(label, n);
    });

    const anchorX = focusNode?.position?.x ?? 300;
    const anchorY = focusNode?.position?.y ?? 260;
    const radius = 170;

    const idMap = new Map();
    const finalNodes = [];
    const seenLabels = new Set();

    (parsedNodes || []).forEach((n, idx) => {
      const label = String(n?.label || '').trim();
      if (!label) return;

      const labelKey = label.toLowerCase();
      if (seenLabels.has(labelKey)) return;
      seenLabels.add(labelKey);

      const existingNode = existingByLabel.get(labelKey);
      const nodeId = existingNode?.id || `edit_node_${Date.now()}_${idx}`;
      idMap.set(String(n.id), nodeId);

      const position = existingNode?.position || {
        x: anchorX + radius * Math.cos((idx / Math.max(parsedNodes.length, 1)) * 2 * Math.PI),
        y: anchorY + radius * Math.sin((idx / Math.max(parsedNodes.length, 1)) * 2 * Math.PI),
      };

      finalNodes.push({
        id: nodeId,
        position,
        data: { label },
      });
    });

    const edgeKeys = new Set();
    const finalEdges = [];

    (parsedEdges || []).forEach((e, idx) => {
      const source = idMap.get(String(e.source));
      const target = idMap.get(String(e.target));
      if (!source || !target || source === target) return;

      const key = `${source}->${target}`;
      if (edgeKeys.has(key)) return;
      edgeKeys.add(key);

      finalEdges.push({
        id: `edit_edge_${Date.now()}_${idx}`,
        source,
        target,
      });
    });

    return { nodes: finalNodes, edges: finalEdges };
  };

  const mergeMindmapData = ({ currentNodes, currentEdges, parsedNodes, parsedEdges, iteration, focusNodeId }) => {
    const nodes = [...(currentNodes || [])];
    const edges = [...(currentEdges || [])];

    const labelToNodeId = new Map();
    const parsedIdToLabel = new Map();

    nodes.forEach((n) => {
      const label = n?.data?.label?.trim();
      if (label) labelToNodeId.set(label.toLowerCase(), n.id);
    });

    const radius = 180 + iteration * 35;
    const centerX = 300;
    const centerY = 260;
    const createdNodeIds = [];

    (parsedNodes || []).forEach((n, idx) => {
      const label = String(n?.label || '').trim();
      if (!label) return;

      parsedIdToLabel.set(String(n.id), label);

      const key = label.toLowerCase();
      if (labelToNodeId.has(key)) return;

      const angle = ((nodes.length + idx) / Math.max((parsedNodes || []).length, 1)) * 2 * Math.PI;
      const nodeId = `ai_node_${Date.now()}_${iteration}_${idx}`;

      labelToNodeId.set(key, nodeId);
      createdNodeIds.push(nodeId);
      nodes.push({
        id: nodeId,
        position: {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        },
        data: { label },
      });
    });

    const edgeKeySet = new Set(edges.map((e) => `${e.source}->${e.target}`));

    (parsedEdges || []).forEach((e, idx) => {
      const sourceLabel = parsedIdToLabel.get(String(e.source));
      const targetLabel = parsedIdToLabel.get(String(e.target));
      if (!sourceLabel || !targetLabel) return;

      const sourceId = labelToNodeId.get(sourceLabel.toLowerCase());
      const targetId = labelToNodeId.get(targetLabel.toLowerCase());

      if (!sourceId || !targetId || sourceId === targetId) return;

      const edgeKey = `${sourceId}->${targetId}`;
      if (edgeKeySet.has(edgeKey)) return;

      edgeKeySet.add(edgeKey);
      edges.push({
        id: `ai_edge_${Date.now()}_${iteration}_${idx}`,
        source: sourceId,
        target: targetId,
      });
    });

    if (focusNodeId) {
      const connectedNodeIds = new Set();
      edges.forEach((e) => {
        connectedNodeIds.add(e.source);
        connectedNodeIds.add(e.target);
      });

      createdNodeIds.forEach((nodeId, idx) => {
        if (nodeId === focusNodeId) return;
        if (connectedNodeIds.has(nodeId)) return;

        const fallbackKey = `${focusNodeId}->${nodeId}`;
        if (edgeKeySet.has(fallbackKey)) return;

        edgeKeySet.add(fallbackKey);
        edges.push({
          id: `ai_edge_focus_${Date.now()}_${iteration}_${idx}`,
          source: focusNodeId,
          target: nodeId,
        });
      });
    }

    return { nodes, edges };
  };

  const generateWithAI = async () => {
    if (!activeMap) return;
    if (!aiText.trim() && !selectedNode) return;
    setIsGenerating(true);
    setAiError('');
    setGenerationStep(0);

    try {
      let mergedNodes = [...(activeMap.nodes || [])];
      let mergedEdges = [...(activeMap.edges || [])];

      for (let iteration = 1; iteration <= generationIterations; iteration += 1) {
        setGenerationStep(iteration);

        const prompt = buildPrompt({
          text: aiText,
          depth: generationDepth,
          iteration,
          totalIterations: generationIterations,
          existingNodes: mergedNodes,
          focusNodeLabel: selectedNode?.data?.label,
        });

        const response = await fetch('/api/omni', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: prompt }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error?.message || data?.error || 'Ошибка генерации');
        }

        const aiResponseText = extractOmniText(data);
        const parsed = parseMindmapJson(aiResponseText);

        if (!parsed?.nodes || !parsed?.edges) {
          throw new Error('AI вернул неполный mindmap JSON');
        }

        const merged = mergeMindmapData({
          currentNodes: mergedNodes,
          currentEdges: mergedEdges,
          parsedNodes: parsed.nodes,
          parsedEdges: parsed.edges,
          iteration,
          focusNodeId: selectedNode?.id,
        });

        mergedNodes = merged.nodes;
        mergedEdges = merged.edges;
      }

      dispatch({
        type: 'UPDATE_MINDMAP',
        payload: {
          id: activeMap.id,
          nodes: mergedNodes,
          edges: mergedEdges,
        },
      });
      setAiText('');
    } catch (err) {
      setAiError('Не удалось сгенерировать карту. ' + err.message);
      console.error(err);
    } finally {
      setIsGenerating(false);
      setGenerationStep(0);
    }
  };

  const editWithAIRequest = async () => {
    if (!activeMap || !editRequest.trim()) return;

    setIsEditing(true);
    setAiError('');

    try {
      const prompt = buildEditPrompt({
        request: editRequest.trim(),
        focusNodeLabel: selectedNode?.data?.label,
        currentNodes: activeMap.nodes,
        currentEdges: activeMap.edges,
      });

      const response = await fetch('/api/omni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || data?.error || 'Ошибка редактирования');
      }

      const aiResponseText = extractOmniText(data);
      const parsed = parseMindmapJson(aiResponseText);
      if (!parsed?.nodes || !parsed?.edges) {
        throw new Error('AI вернул неполный mindmap JSON');
      }

      const edited = applyEditedMindmap({
        parsedNodes: parsed.nodes,
        parsedEdges: parsed.edges,
        currentNodes: activeMap.nodes,
        focusNode: selectedNode,
      });

      dispatch({
        type: 'UPDATE_MINDMAP',
        payload: {
          id: activeMap.id,
          nodes: edited.nodes,
          edges: edited.edges,
        },
      });

      setEditRequest('');
    } catch (err) {
      setAiError('Не удалось отредактировать карту. ' + err.message);
      console.error(err);
    } finally {
      setIsEditing(false);
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
              onNodeClick={onNodeClick}
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

            <div className="text-xs rounded-lg border border-theme-border bg-theme-bg px-3 py-2 text-theme-muted">
              {selectedNode
                ? <>Выбрана нода: <span className="text-theme-text font-semibold">{selectedNode.data?.label || selectedNode.id}</span></>
                : 'Нода не выбрана. Кликните по узлу на карте, чтобы продолжить генерацию от него.'}
            </div>
            
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Текст для анализа..."
              className="flex-1 min-h-[150px] bg-theme-bg border border-theme-border rounded-xl p-3 text-theme-text text-sm focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-border resize-none custom-scrollbar placeholder-theme-muted/40"
            />

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-theme-muted flex flex-col gap-1">
                Глубина
                <select
                  value={generationDepth}
                  onChange={(e) => setGenerationDepth(Number(e.target.value))}
                  className="bg-theme-bg border border-theme-border rounded-lg px-2 py-2 text-theme-text text-sm focus:outline-none"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                  <option value={6}>6</option>
                </select>
              </label>

              <label className="text-xs text-theme-muted flex flex-col gap-1">
                Итерации
                <select
                  value={generationIterations}
                  onChange={(e) => setGenerationIterations(Number(e.target.value))}
                  className="bg-theme-bg border border-theme-border rounded-lg px-2 py-2 text-theme-text text-sm focus:outline-none"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </label>
            </div>
            
            {aiError && <div className="text-red-500 text-xs bg-red-500/10 border border-red-500/20 p-2 rounded-lg">{aiError}</div>}
            
            <button
              onClick={generateWithAI}
              disabled={isGenerating || (!aiText.trim() && !selectedNode)}
              className="btn-gold disabled:opacity-50 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold shadow-sm hover:shadow-md"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {generationStep > 0 ? `Итерация ${generationStep}/${generationIterations}` : 'Генерация...'}
                </>
              ) : (
                <><Send size={16} /> {selectedNode ? 'Продолжить от ноды' : 'Сгенерировать'}</>
              )}
            </button>

            {selectedNode && (
              <button
                onClick={() => setSelectedNodeId(null)}
                className="w-full bg-theme-panel hover:bg-theme-bg border border-theme-border text-theme-muted hover:text-theme-text py-2 rounded-xl transition text-xs"
              >
                Сбросить выбор ноды
              </button>
            )}

            <div className="pt-4 border-t border-theme-border mt-2">
              <h4 className="font-serif font-bold text-theme-text text-sm mb-2">Редактирование по запросу</h4>
              <textarea
                value={editRequest}
                onChange={(e) => setEditRequest(e.target.value)}
                placeholder="Например: объедини дублирующиеся ветки, сократи карту до ключевых блоков, переименуй узлы в более короткие"
                className="w-full min-h-[90px] bg-theme-bg border border-theme-border rounded-xl p-3 text-theme-text text-sm focus:outline-none resize-none placeholder-theme-muted/40"
              />
              <button
                onClick={editWithAIRequest}
                disabled={isEditing || !editRequest.trim()}
                className="btn-primary mt-3 w-full text-sm py-2.5 disabled:opacity-50"
              >
                {isEditing ? 'Применяю правки...' : selectedNode ? 'Редактировать от выбранной ноды' : 'Редактировать карту по запросу'}
              </button>
            </div>

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
