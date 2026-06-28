import React, { useState, useCallback, useMemo } from 'react';
import { Network, Plus, Trash2, ChevronLeft, Bot, Send, Search, Lightbulb, LayoutDashboard, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactFlow, Controls, Background, addEdge, applyNodeChanges, applyEdgeChanges, MiniMap, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { MODEL_OPTIONS, DEFAULT_MODEL } from '../lib/aiProviders';
import { callModel } from '../lib/aiClient';

// ─── Auto-layout helpers ────────────────────────────────────────────────────

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

const LAYOUT_DIRECTIONS = {
  TB: 'Дерево ↓',
  LR: 'Дерево →',
  radial: 'Радиально',
};

function applyDagreLayout(nodes, edges, direction = 'TB') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80, marginx: 40, marginy: 40 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
  });
}

function applyRadialLayout(nodes, edges) {
  if (nodes.length === 0) return nodes;

  // Build adjacency for BFS to find root (node with no incoming edges)
  const hasIncoming = new Set(edges.map((e) => e.target));
  const root = nodes.find((n) => !hasIncoming.has(n.id)) || nodes[0];

  const children = new Map();
  nodes.forEach((n) => children.set(n.id, []));
  edges.forEach((e) => {
    if (children.has(e.source)) children.get(e.source).push(e.target);
  });

  const visited = new Set();
  const levels = [];
  let queue = [root.id];
  visited.add(root.id);

  while (queue.length > 0) {
    levels.push([...queue]);
    const next = [];
    queue.forEach((id) => {
      (children.get(id) || []).forEach((c) => {
        if (!visited.has(c)) { visited.add(c); next.push(c); }
      });
    });
    queue = next;
  }

  // Nodes not in BFS (disconnected)
  nodes.forEach((n) => { if (!visited.has(n.id)) levels.push([n.id]); });

  const posMap = new Map();
  const cx = 0, cy = 0;
  posMap.set(root.id, { x: cx, y: cy });

  levels.forEach((level, li) => {
    if (li === 0) return;
    const radius = li * 200;
    level.forEach((id, idx) => {
      const angle = (idx / level.length) * 2 * Math.PI - Math.PI / 2;
      posMap.set(id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    });
  });

  return nodes.map((n) => {
    const p = posMap.get(n.id) || { x: Math.random() * 400, y: Math.random() * 400 };
    return { ...n, position: p };
  });
}

export function autoLayout(nodes, edges, direction = 'TB') {
  if (!nodes || nodes.length === 0) return nodes;
  if (direction === 'radial') return applyRadialLayout(nodes, edges);
  return applyDagreLayout(nodes, edges, direction);
}

// ─── Node shape styles ───────────────────────────────────────────────────────

const SHAPE_CLASSES = {
  rounded: 'rounded-xl',
  pill: 'rounded-full',
  rect: 'rounded-md',
  diamond: 'rotate-45',
};

const FONT_SIZE_CLASSES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

const PRESET_COLORS = [
  '#ffffff', '#fef3c7', '#dbeafe', '#d1fae5',
  '#fce7f3', '#ede9fe', '#fee2e2', '#f3f4f6',
  '#1e293b', '#7c3aed', '#0ea5e9', '#10b981',
];

// ─── Custom Node ─────────────────────────────────────────────────────────────

const CustomNode = ({ data, selected }) => {
  const fmt = data.formatting || {};
  const bgColor = fmt.bgColor || 'var(--panel-bg)';
  const textColor = fmt.textColor || 'var(--text-primary)';
  const shape = fmt.shape || 'rounded';
  const fontSize = FONT_SIZE_CLASSES[fmt.fontSize || 'md'];
  const isDiamond = shape === 'diamond';

  return (
    <div
      className={`shadow-md border-2 transition-colors min-w-[80px] max-w-[200px]
        ${selected ? 'border-theme-accent shadow-theme-accent/20 shadow-lg' : 'border-theme-border'}
        ${SHAPE_CLASSES[shape] || 'rounded-xl'}`}
      style={{ backgroundColor: bgColor }}
    >
      {isDiamond ? (
        // Diamond renders rotated outer, inner counter-rotated text
        <div className="px-4 py-2">
          <div className={`-rotate-45 text-center ${fontSize} ${fmt.bold ? 'font-bold' : ''} ${fmt.italic ? 'italic' : ''} ${fmt.underline ? 'underline' : ''}`}
            style={{ color: textColor }}>
            {data.label}
          </div>
        </div>
      ) : (
        <>
          <Handle type="target" position={Position.Top} className="w-full !bg-theme-accent/50 !h-1.5 opacity-0 hover:opacity-100 transition-opacity !rounded-none !border-0" />
          <div className="px-4 py-2">
            <div className={`text-center ${fontSize} ${fmt.bold ? 'font-bold' : ''} ${fmt.italic ? 'italic' : ''} ${fmt.underline ? 'underline' : ''}`}
              style={{ color: textColor }}>
              {data.label}
            </div>
            {data.comment && (
              <div className="mt-1 text-[10px] opacity-80 border-t border-black/10 pt-1 max-w-[160px] whitespace-pre-wrap break-words text-left"
                style={{ color: textColor }}>
                {data.comment}
              </div>
            )}
          </div>
          <Handle type="source" position={Position.Bottom} className="w-full !bg-theme-accent/50 !h-1.5 opacity-0 hover:opacity-100 transition-opacity !rounded-none !border-0" />
        </>
      )}
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

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
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState('TB');
  // Модель ИИ для карты: по умолчанию глобальная из настроек, можно сменить локально.
  const [mindmapModel, setMindmapModel] = useState(state.settings?.aiModel || DEFAULT_MODEL);

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
        nodes: [{ id: 'root', position: { x: 250, y: 250 }, data: { label: newName, comment: '', formatting: {} }, type: 'custom' }],
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

  const runAutoLayout = useCallback(() => {
    if (!activeMap) return;
    const laid = autoLayout(activeMap.nodes || [], activeMap.edges || [], layoutDirection);
    dispatch({ type: 'UPDATE_MINDMAP', payload: { id: activeMap.id, nodes: laid } });
  }, [activeMap, layoutDirection, dispatch]);

  // Тот же примитив callModel, что в чате,
  // но с system-промптом, требующим чистый JSON, и без стриминга (нужен полный ответ).
  const callMindmapAI = async (prompt) => {
    const mindmapSettings = {
      ...state.settings,
      aiSystemPrompt: 'Ты генератор mindmap. Возвращай ТОЛЬКО валидный JSON без markdown, пояснений и текста вокруг.',
      aiTemperature: state.settings?.aiTemperature ?? 0.4,
    };
    const { text } = await callModel({
      modelId: mindmapModel,
      prompt,
      settings: mindmapSettings,
      stream: false,
    });
    return text;
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

  const buildBrainstormPrompt = ({ focusNodeLabel }) => {
    return `
Ты генератор идей для мозгового штурма (brainstorming).
Узел: "${focusNodeLabel}".
Сгенерируй 4-7 креативных, нестандартных и практически полезных идей (дочерних узлов) для этого узла.

Верни ТОЛЬКО валидный JSON БЕЗ markdown в формате:
{
  "nodes": [{ "id": "b1", "label": "Идея 1" }, { "id": "b2", "label": "Идея 2" }],
  "edges": [{ "source": "root", "target": "b1" }, { "source": "root", "target": "b2" }]
}
Важно: в edges поле source всегда должно быть равно строке "root".
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
        data: { label, comment: '', formatting: {} },
        type: 'custom'
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

        const aiResponseText = await callMindmapAI(prompt);
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

      const aiResponseText = await callMindmapAI(prompt);
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

  const brainstormWithAI = async () => {
    if (!activeMap || !selectedNode) return;

    setIsBrainstorming(true);
    setAiError('');

    try {
      const prompt = buildBrainstormPrompt({
        focusNodeLabel: selectedNode.data?.label,
      });

      const aiResponseText = await callMindmapAI(prompt);
      const parsed = parseMindmapJson(aiResponseText);
      if (!parsed?.nodes || !parsed?.edges) {
        throw new Error('AI вернул неполный mindmap JSON');
      }

      // Подменяем 'root' на ID выбранной ноды
      const adjustedEdges = parsed.edges.map(e => ({
        source: e.source === 'root' ? selectedNode.id : e.source,
        target: e.target
      }));

      const merged = mergeMindmapData({
        currentNodes: activeMap.nodes,
        currentEdges: activeMap.edges,
        parsedNodes: parsed.nodes,
        parsedEdges: adjustedEdges,
        iteration: 1,
        focusNodeId: selectedNode.id,
      });

      dispatch({
        type: 'UPDATE_MINDMAP',
        payload: {
          id: activeMap.id,
          nodes: merged.nodes,
          edges: merged.edges,
        },
      });

    } catch (err) {
      setAiError('Не удалось провести мозговой штурм. ' + err.message);
      console.error(err);
    } finally {
      setIsBrainstorming(false);
    }
  };

  if (activeMapId) {
    if (!activeMap) {
       setActiveMapId(null);
       return null;
    }
    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <div className="flex items-center justify-between mb-4 bg-theme-panel p-4 rounded-2xl border border-theme-border shadow-sm flex-wrap gap-2">
          <button 
            onClick={() => setActiveMapId(null)}
            className="flex items-center gap-2 text-theme-muted hover:text-theme-text transition-colors"
          >
            <ChevronLeft size={20} /> Назад
          </button>
          <h3 className="text-xl font-serif font-bold text-theme-text flex items-center gap-2">
            <Network className="text-theme-accent" /> {activeMap.name}
          </h3>
          {/* Auto-layout controls */}
          <div className="flex items-center gap-2">
            <select
              value={layoutDirection}
              onChange={(e) => setLayoutDirection(e.target.value)}
              className="bg-theme-bg border border-theme-border rounded-lg px-2 py-1.5 text-theme-text text-xs focus:outline-none focus:border-theme-accent"
              title="Тип раскладки"
            >
              {Object.entries(LAYOUT_DIRECTIONS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <button
              onClick={runAutoLayout}
              className="flex items-center gap-1.5 bg-theme-accent/10 hover:bg-theme-accent/20 border border-theme-accent/30 text-theme-accent px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              title="Авто-распределить узлы"
            >
              <LayoutDashboard size={14} /> Авто-раскладка
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-4 h-[calc(100%-5rem)]">
          {/* React Flow Canvas */}
          <div className="flex-1 bg-theme-panel rounded-2xl border border-theme-border overflow-hidden relative shadow-sm">
            <ReactFlow
              nodes={(activeMap.nodes || []).map(n => ({...n, type: n.type === 'input' || n.type === 'default' || !n.type ? 'custom' : n.type}))}
              edges={activeMap.edges || []}
              nodeTypes={nodeTypes}
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
            <p className="text-xs text-theme-muted">Вставьте текст (заметки, идеи), и выбранная нейросеть извлечёт из него связи и узлы для карты.</p>

            <label className="text-xs text-theme-muted flex flex-col gap-1">
              Нейросеть
              <select
                value={mindmapModel}
                onChange={(e) => setMindmapModel(e.target.value)}
                className="bg-theme-bg border border-theme-border rounded-lg px-2 py-2 text-theme-text text-sm focus:outline-none focus:border-theme-accent"
              >
                {Object.entries(
                  MODEL_OPTIONS.reduce((groups, opt) => {
                    (groups[opt.group] ||= []).push(opt);
                    return groups;
                  }, {})
                ).map(([group, opts]) => (
                  <optgroup key={group} label={group}>
                    {opts.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <div className="text-xs rounded-lg border border-theme-border bg-theme-bg px-3 py-2 text-theme-muted">
              {selectedNode ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-theme-border pb-2">
                    <span className="font-semibold text-theme-text flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-theme-accent"></span> Нода выбрана</span>
                    <button onClick={() => setSelectedNodeId(null)} className="text-theme-muted hover:text-red-500"><XCircle size={14} /></button>
                  </div>
                  <input
                    value={selectedNode.data?.label || ''}
                    onChange={(e) => {
                      const newNodes = activeMap.nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, label: e.target.value } } : n);
                      dispatch({ type: 'UPDATE_MINDMAP', payload: { id: activeMap.id, nodes: newNodes } });
                    }}
                    className="w-full bg-theme-panel border border-theme-border rounded px-2 py-1 text-sm text-theme-text focus:border-theme-accent focus:outline-none"
                    placeholder="Название узла"
                  />
                  <textarea
                    value={selectedNode.data?.comment || ''}
                    onChange={(e) => {
                      const newNodes = activeMap.nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, comment: e.target.value } } : n);
                      dispatch({ type: 'UPDATE_MINDMAP', payload: { id: activeMap.id, nodes: newNodes } });
                    }}
                    className="w-full h-20 bg-theme-panel border border-theme-border rounded px-2 py-1 text-xs text-theme-text focus:border-theme-accent focus:outline-none resize-none custom-scrollbar"
                    placeholder="Комментарий (описание)..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setIsGenerating(true);
                        setAiError('');
                        try {
                          const res = await callModel({
                            modelId: mindmapModel,
                            prompt: `Сгенерируй короткий комментарий (описание) для узла mindmap с названием "${selectedNode.data?.label}". Верни ТОЛЬКО текст комментария без кавычек и форматирования. Максимум 2-3 предложения.`,
                            settings: state.settings,
                            stream: false
                          });
                          const newNodes = activeMap.nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, comment: res.text } } : n);
                          dispatch({ type: 'UPDATE_MINDMAP', payload: { id: activeMap.id, nodes: newNodes } });
                        } catch (e) {
                          setAiError(e.message);
                        } finally {
                          setIsGenerating(false);
                        }
                      }}
                      disabled={isGenerating || !selectedNode.data?.label}
                      className="flex-1 bg-theme-panel hover:bg-theme-bg border border-theme-border text-theme-accent text-[10px] py-1.5 rounded transition flex justify-center items-center gap-1"
                    >
                      <Bot size={12} /> Сгенерировать коммент
                    </button>
                  </div>

                  {/* ── Text style ── */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-theme-muted/70 uppercase tracking-wide">Стиль текста</p>
                    <div className="flex gap-1.5 items-center flex-wrap">
                      {[
                        { key: 'bold', label: <b>B</b> },
                        { key: 'italic', label: <i>I</i> },
                        { key: 'underline', label: <u>U</u> },
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => {
                            const newNodes = activeMap.nodes.map(n => n.id === selectedNode.id
                              ? { ...n, data: { ...n.data, formatting: { ...n.data.formatting, [key]: !n.data.formatting?.[key] } } } : n);
                            dispatch({ type: 'UPDATE_MINDMAP', payload: { id: activeMap.id, nodes: newNodes } });
                          }}
                          className={`w-7 h-7 flex items-center justify-center rounded border transition text-xs
                            ${selectedNode.data?.formatting?.[key] ? 'bg-theme-accent text-theme-bg border-theme-accent' : 'bg-theme-panel border-theme-border text-theme-text'}`}
                        >{label}</button>
                      ))}
                      {/* Font size */}
                      <select
                        value={selectedNode.data?.formatting?.fontSize || 'md'}
                        onChange={(e) => {
                          const newNodes = activeMap.nodes.map(n => n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, formatting: { ...n.data.formatting, fontSize: e.target.value } } } : n);
                          dispatch({ type: 'UPDATE_MINDMAP', payload: { id: activeMap.id, nodes: newNodes } });
                        }}
                        className="bg-theme-panel border border-theme-border rounded px-1.5 py-0.5 text-[10px] text-theme-text focus:outline-none ml-auto"
                        title="Размер текста"
                      >
                        <option value="sm">S</option>
                        <option value="md">M</option>
                        <option value="lg">L</option>
                      </select>
                    </div>
                  </div>

                  {/* ── Node shape ── */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-theme-muted/70 uppercase tracking-wide">Форма узла</p>
                    <div className="flex gap-1.5">
                      {[
                        { val: 'rounded', label: '⬜' },
                        { val: 'pill', label: '💊' },
                        { val: 'rect', label: '▬' },
                        { val: 'diamond', label: '◆' },
                      ].map(({ val, label }) => (
                        <button
                          key={val}
                          title={val}
                          onClick={() => {
                            const newNodes = activeMap.nodes.map(n => n.id === selectedNode.id
                              ? { ...n, data: { ...n.data, formatting: { ...n.data.formatting, shape: val } } } : n);
                            dispatch({ type: 'UPDATE_MINDMAP', payload: { id: activeMap.id, nodes: newNodes } });
                          }}
                          className={`flex-1 py-1 rounded border text-sm transition
                            ${(selectedNode.data?.formatting?.shape || 'rounded') === val ? 'bg-theme-accent text-theme-bg border-theme-accent' : 'bg-theme-panel border-theme-border text-theme-text'}`}
                        >{label}</button>
                      ))}
                    </div>
                  </div>

                  {/* ── Colors ── */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-theme-muted/70 uppercase tracking-wide">Цвета</p>
                    {/* Preset palette for bg */}
                    <p className="text-[10px] text-theme-muted">Фон узла</p>
                    <div className="flex flex-wrap gap-1">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            const newNodes = activeMap.nodes.map(n => n.id === selectedNode.id
                              ? { ...n, data: { ...n.data, formatting: { ...n.data.formatting, bgColor: c } } } : n);
                            dispatch({ type: 'UPDATE_MINDMAP', payload: { id: activeMap.id, nodes: newNodes } });
                          }}
                          className="w-5 h-5 rounded-full border-2 transition hover:scale-110"
                          style={{ backgroundColor: c, borderColor: (selectedNode.data?.formatting?.bgColor === c) ? 'var(--accent-color)' : 'transparent' }}
                          title={c}
                        />
                      ))}
                      <input
                        type="color"
                        value={selectedNode.data?.formatting?.bgColor || '#ffffff'}
                        onChange={(e) => {
                          const newNodes = activeMap.nodes.map(n => n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, formatting: { ...n.data.formatting, bgColor: e.target.value } } } : n);
                          dispatch({ type: 'UPDATE_MINDMAP', payload: { id: activeMap.id, nodes: newNodes } });
                        }}
                        className="w-5 h-5 p-0 border-0 rounded-full cursor-pointer"
                        title="Свой цвет фона"
                      />
                    </div>
                    <p className="text-[10px] text-theme-muted mt-1">Цвет текста</p>
                    <div className="flex items-center gap-2">
                      {['#1e293b','#7c3aed','#0ea5e9','#dc2626','#16a34a','#d97706','#ffffff'].map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            const newNodes = activeMap.nodes.map(n => n.id === selectedNode.id
                              ? { ...n, data: { ...n.data, formatting: { ...n.data.formatting, textColor: c } } } : n);
                            dispatch({ type: 'UPDATE_MINDMAP', payload: { id: activeMap.id, nodes: newNodes } });
                          }}
                          className="w-5 h-5 rounded-full border-2 transition hover:scale-110"
                          style={{ backgroundColor: c, borderColor: (selectedNode.data?.formatting?.textColor === c) ? 'var(--accent-color)' : 'transparent' }}
                        />
                      ))}
                      <input
                        type="color"
                        value={selectedNode.data?.formatting?.textColor || '#1e293b'}
                        onChange={(e) => {
                          const newNodes = activeMap.nodes.map(n => n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, formatting: { ...n.data.formatting, textColor: e.target.value } } } : n);
                          dispatch({ type: 'UPDATE_MINDMAP', payload: { id: activeMap.id, nodes: newNodes } });
                        }}
                        className="w-5 h-5 p-0 border-0 rounded-full cursor-pointer"
                        title="Свой цвет текста"
                      />
                    </div>
                  </div>

                  {/* Delete node */}
                  <button
                    onClick={() => {
                      const newNodes = activeMap.nodes.filter(n => n.id !== selectedNode.id);
                      const newEdges = (activeMap.edges || []).filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id);
                      dispatch({ type: 'UPDATE_MINDMAP', payload: { id: activeMap.id, nodes: newNodes, edges: newEdges } });
                      setSelectedNodeId(null);
                    }}
                    className="w-full mt-1 py-1.5 rounded border border-red-500/30 bg-red-500/5 text-red-500 text-[10px] hover:bg-red-500/10 transition flex items-center justify-center gap-1"
                  >
                    <Trash2 size={10} /> Удалить узел
                  </button>
                </div>
              ) : (
                <div className="text-center py-4 opacity-50">
                  Кликните по узлу на карте для генерации или редактирования
                </div>
              )}
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



            <div className="pt-4 border-t border-theme-border mt-2">
              <h4 className="font-serif font-bold text-theme-text text-sm mb-2 flex items-center gap-2">
                <Lightbulb className="text-theme-accent" size={16} /> Мозговой штурм
              </h4>
              <p className="text-[10px] text-theme-muted mb-3">Выберите узел, и ИИ предложит 5-7 креативных идей или направлений для его развития.</p>
              <button
                onClick={brainstormWithAI}
                disabled={isBrainstorming || !selectedNode}
                className="btn-gold mt-1 w-full text-sm py-2.5 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isBrainstorming ? 'Генерирую идеи...' : 'Мозговой штурм от узла'}
              </button>
            </div>

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
                    data: { label: 'Новый узел', comment: '', formatting: {} },
                    type: 'custom'
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
