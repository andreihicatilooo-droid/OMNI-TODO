import { useState, useCallback, useRef } from 'react';
import {
  ReactFlow, Controls, Background, addEdge,
  applyNodeChanges, applyEdgeChanges, MiniMap,
  Handle, Position, BaseEdge, EdgeLabelRenderer, getStraightPath,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, ArrowLeft, Play,
  CheckCircle2, Clock, Ban, X, Edit3,
} from 'lucide-react';

// ── Status config ──────────────────────────────────────────────────────────
const STATUS = {
  pending:     { label: 'Pending',     color: 'var(--text-muted)',  icon: Clock },
  'in-progress': { label: 'In Progress', color: 'var(--accent-color)', icon: Play },
  done:        { label: 'Done',        color: '#22c55e',            icon: CheckCircle2 },
  blocked:     { label: 'Blocked',     color: '#ef4444',            icon: Ban },
};

const NODE_TYPES_CONFIG = {
  start:    { label: 'Start',     shape: 'pill',    bg: '#22c55e', text: '#fff' },
  process:  { label: 'Process',   shape: 'rect',    bg: 'var(--panel-bg)', text: 'var(--text-primary)' },
  decision: { label: 'Decision',  shape: 'diamond', bg: '#f59e0b', text: '#fff' },
  end:      { label: 'End',       shape: 'pill',    bg: '#ef4444', text: '#fff' },
};

// ── Custom Nodes ───────────────────────────────────────────────────────────
const StartEndNode = ({ data, selected }) => (
  <div
    className={`flex items-center justify-center min-w-[80px] h-10 px-5 rounded-full shadow-md border-2 transition-all ${selected ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
    style={{
      backgroundColor: data.bg || '#22c55e',
      color: data.textColor || '#fff',
      borderColor: selected ? '#60a5fa' : 'transparent',
    }}
  >
    <Handle type="source" position={Position.Bottom} className="!bg-white/70 !border-white/40" />
    <Handle type="target" position={Position.Top} className="!bg-white/70 !border-white/40" />
    <span className="text-xs font-bold tracking-wide">{data.label}</span>
  </div>
);

const ProcessNode = ({ data, selected }) => {
  const StatusIcon = data.status ? STATUS[data.status]?.icon : null;
  const statusColor = data.status ? STATUS[data.status]?.color : 'var(--text-muted)';
  return (
    <div
      className={`min-w-[140px] max-w-[220px] rounded-lg shadow-md border-2 transition-all ${selected ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
      style={{
        backgroundColor: 'var(--panel-bg)',
        borderColor: selected ? '#60a5fa' : statusColor,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-[var(--accent-color)] !border-[var(--panel-bg)]" />
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--accent-color)] !border-[var(--panel-bg)]" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-[var(--accent-color)] !border-[var(--panel-bg)]" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-[var(--accent-color)] !border-[var(--panel-bg)]" />
      <div className="px-3 py-2">
        <div className="flex items-start gap-1.5">
          {StatusIcon && <StatusIcon size={12} style={{ color: statusColor, marginTop: 2, flexShrink: 0 }} />}
          <span className="text-xs font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
            {data.label}
          </span>
        </div>
        {data.description && (
          <p className="text-[10px] mt-1 leading-snug" style={{ color: 'var(--text-muted)' }}>
            {data.description}
          </p>
        )}
      </div>
    </div>
  );
};

const DecisionNode = ({ data, selected }) => (
  <div className="relative flex items-center justify-center" style={{ width: 110, height: 70 }}>
    <Handle type="target" position={Position.Top} className="!bg-white/70 !border-white/40" />
    <Handle type="source" position={Position.Bottom} id="yes" className="!bg-white/70 !border-white/40" />
    <Handle type="source" position={Position.Right} id="no" className="!bg-white/70 !border-white/40" />
    <svg
      viewBox="0 0 110 70"
      className="absolute inset-0 w-full h-full"
      style={{ filter: selected ? 'drop-shadow(0 0 4px #60a5fa)' : 'drop-shadow(0 2px 3px rgba(0,0,0,0.2))' }}
    >
      <polygon
        points="55,4 106,35 55,66 4,35"
        fill={data.bg || '#f59e0b'}
        stroke={selected ? '#60a5fa' : 'rgba(255,255,255,0.3)'}
        strokeWidth={selected ? 2 : 1}
      />
    </svg>
    <span className="relative text-[11px] font-bold text-white z-10 px-1 text-center leading-tight">
      {data.label}
    </span>
  </div>
);

const nodeTypes = {
  start: StartEndNode,
  end: StartEndNode,
  process: ProcessNode,
  decision: DecisionNode,
};

// ── Custom Edge with label ─────────────────────────────────────────────────
const LabeledEdge = ({ id, sourceX, sourceY, targetX, targetY, data, selected, markerEnd }) => {
  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? '#60a5fa' : 'var(--accent-color)',
          strokeWidth: selected ? 2.5 : 1.5,
          opacity: 0.8,
        }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute px-1.5 py-0.5 rounded text-[10px] font-mono pointer-events-all cursor-pointer"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              backgroundColor: 'var(--panel-bg)',
              color: 'var(--accent-color)',
              border: '1px solid var(--border-color)',
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const edgeTypes = { labeled: LabeledEdge };

// ── Node panel (properties) ────────────────────────────────────────────────
const NodePanel = ({ node, onUpdate, onDelete, onClose }) => {
  const [label, setLabel] = useState(node.data.label || '');
  const [desc, setDesc] = useState(node.data.description || '');
  const [status, setStatus] = useState(node.data.status || 'pending');

  const save = () => {
    onUpdate(node.id, { label, description: desc, status });
    onClose();
  };

  const isProcess = node.type === 'process';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-64 rounded-xl border border-theme-border bg-theme-panel shadow-xl flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-theme-border">
        <span className="text-xs font-semibold text-theme-text flex items-center gap-1.5">
          <Edit3 size={12} className="text-theme-accent" />
          {NODE_TYPES_CONFIG[node.type]?.label || 'Node'}
        </span>
        <button onClick={onClose} className="text-theme-muted hover:text-theme-text transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="p-3 flex flex-col gap-3">
        <div>
          <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider mb-1 block">Label</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="w-full bg-theme-bg border border-theme-border rounded-md px-2 py-1.5 text-xs text-theme-text focus:outline-none focus:border-theme-accent/60"
          />
        </div>
        {isProcess && (
          <>
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider mb-1 block">Description</label>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                rows={2}
                className="w-full bg-theme-bg border border-theme-border rounded-md px-2 py-1.5 text-xs text-theme-text focus:outline-none focus:border-theme-accent/60 resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider mb-1 block">Status</label>
              <div className="flex flex-col gap-1">
                {Object.entries(STATUS).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setStatus(key)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all ${status === key ? 'bg-theme-accent/15 border border-theme-accent/40' : 'border border-transparent hover:bg-theme-text/5'}`}
                    >
                      <Icon size={12} style={{ color: cfg.color }} />
                      <span className="text-theme-text">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={save}
            className="flex-1 py-1.5 rounded-md bg-theme-accent/20 hover:bg-theme-accent/30 text-theme-accent text-xs font-medium transition-all border border-theme-accent/30"
          >
            Save
          </button>
          <button
            onClick={() => { onDelete(node.id); onClose(); }}
            className="px-3 py-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition-all border border-red-500/20"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ── Main WorkflowView ──────────────────────────────────────────────────────
export default function WorkflowView({ state, dispatch }) {
  const workflows = state.workflows || [];
  const [activeId, setActiveId] = useState(null);
  const [newName, setNewName] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [edgeLabelDraft, setEdgeLabelDraft] = useState('');
  const [pendingEdge, setPendingEdge] = useState(null);
  const reactFlowWrapper = useRef(null);
  const [rfInstance, setRfInstance] = useState(null);

  const activeFlow = workflows.find(w => w.id === activeId);

  // ── dispatch helpers ─────────────────────────────────────────────────────
  const updateFlow = useCallback((patch) => {
    if (!activeId) return;
    dispatch({ type: 'UPDATE_WORKFLOW', payload: { id: activeId, ...patch } });
  }, [activeId, dispatch]);

  // ── Node/edge handlers ───────────────────────────────────────────────────
  const onNodesChange = useCallback((changes) => {
    if (!activeFlow) return;
    updateFlow({ nodes: applyNodeChanges(changes, activeFlow.nodes || []) });
  }, [activeFlow, updateFlow]);

  const onEdgesChange = useCallback((changes) => {
    if (!activeFlow) return;
    updateFlow({ edges: applyEdgeChanges(changes, activeFlow.edges || []) });
  }, [activeFlow, updateFlow]);

  const onConnect = useCallback((params) => {
    setPendingEdge(params);
    setEdgeLabelDraft('');
  }, []);

  const confirmEdge = () => {
    if (!pendingEdge || !activeFlow) return;
    const edge = {
      ...pendingEdge,
      type: 'labeled',
      data: { label: edgeLabelDraft.trim() },
      markerEnd: { type: 'arrowclosed' },
    };
    updateFlow({ edges: addEdge(edge, activeFlow.edges || []) });
    setPendingEdge(null);
    setEdgeLabelDraft('');
  };

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const updateNode = (nodeId, patch) => {
    if (!activeFlow) return;
    updateFlow({
      nodes: (activeFlow.nodes || []).map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n
      ),
    });
  };

  const deleteNode = (nodeId) => {
    if (!activeFlow) return;
    updateFlow({
      nodes: (activeFlow.nodes || []).filter(n => n.id !== nodeId),
      edges: (activeFlow.edges || []).filter(e => e.source !== nodeId && e.target !== nodeId),
    });
    setSelectedNode(null);
  };

  // ── Add node ─────────────────────────────────────────────────────────────
  const addNode = useCallback((type) => {
    if (!activeFlow) return;
    const cfg = NODE_TYPES_CONFIG[type];
    const id = `node_${Date.now()}`;
    const center = rfInstance
      ? rfInstance.screenToFlowPosition({ x: (reactFlowWrapper.current?.clientWidth || 600) / 2, y: (reactFlowWrapper.current?.clientHeight || 400) / 2 })
      : { x: 200 + Math.random() * 200, y: 150 + Math.random() * 100 };

    const newNode = {
      id,
      type,
      position: center,
      data: {
        label: cfg.label,
        bg: cfg.bg,
        textColor: cfg.text,
        status: type === 'process' ? 'pending' : undefined,
      },
    };
    updateFlow({ nodes: [...(activeFlow.nodes || []), newNode] });
  }, [activeFlow, rfInstance, updateFlow]);

  // ── Create workflow ──────────────────────────────────────────────────────
  const createWorkflow = () => {
    if (!newName.trim()) return;
    dispatch({
      type: 'ADD_WORKFLOW',
      payload: {
        name: newName.trim(),
        nodes: [
          { id: 'start', type: 'start', position: { x: 200, y: 60 }, data: { label: 'Start', bg: '#22c55e', textColor: '#fff' } },
          { id: 'end', type: 'end', position: { x: 200, y: 340 }, data: { label: 'End', bg: '#ef4444', textColor: '#fff' } },
        ],
        edges: [],
      },
    });
    setNewName('');
  };

  const deleteWorkflow = (id) => {
    dispatch({ type: 'DELETE_WORKFLOW', payload: id });
    if (activeId === id) setActiveId(null);
  };

  // ── Stats helper ─────────────────────────────────────────────────────────
  const flowStats = (flow) => {
    const steps = (flow.nodes || []).filter(n => n.type === 'process');
    const done = steps.filter(n => n.data?.status === 'done').length;
    return { total: steps.length, done };
  };

  // ── Canvas view ──────────────────────────────────────────────────────────
  if (activeId) {
    if (!activeFlow) { setActiveId(null); return null; }
    const { total, done } = flowStats(activeFlow);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    return (
      <div className="flex flex-col h-full animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-theme-border bg-theme-panel/60 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setActiveId(null); setSelectedNode(null); }}
              className="flex items-center gap-1.5 text-xs text-theme-muted hover:text-theme-accent transition-colors"
            >
              <ArrowLeft size={14} /> Workflows
            </button>
            <span className="text-theme-border">/</span>
            <span className="text-sm font-semibold text-theme-text">{activeFlow.name}</span>
            {total > 0 && (
              <span className="text-[10px] font-mono text-theme-muted bg-theme-bg px-2 py-0.5 rounded-full border border-theme-border">
                {done}/{total} done · {pct}%
              </span>
            )}
          </div>
          {/* Add node toolbar */}
          <div className="flex items-center gap-1.5">
            {Object.entries(NODE_TYPES_CONFIG).map(([type, cfg]) => (
              <button
                key={type}
                onClick={() => addNode(type)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all hover:opacity-80"
                style={{
                  backgroundColor: `${cfg.bg}20`,
                  borderColor: `${cfg.bg}50`,
                  color: cfg.bg === 'var(--panel-bg)' ? 'var(--text-primary)' : cfg.bg,
                }}
                title={`Add ${cfg.label}`}
              >
                + {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas + side panel */}
        <div className="flex flex-1 overflow-hidden gap-0 relative">
          <div ref={reactFlowWrapper} className="flex-1 h-full">
            <ReactFlow
              nodes={activeFlow.nodes || []}
              edges={activeFlow.edges || []}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onInit={setRfInstance}
              fitView
              defaultEdgeOptions={{ type: 'labeled', markerEnd: { type: 'arrowclosed' } }}
              className="bg-theme-bg"
              colorMode={state.settings?.theme === 'liwood' ? 'light' : 'dark'}
            >
              <Background color="var(--accent-color)" gap={24} size={1} opacity={0.1} />
              <Controls className="!bg-theme-panel !border-theme-border" />
              <MiniMap
                className="!bg-theme-panel !border-theme-border"
                maskColor="var(--border-color)"
                nodeColor={(n) => {
                  if (n.type === 'start') return '#22c55e';
                  if (n.type === 'end') return '#ef4444';
                  if (n.type === 'decision') return '#f59e0b';
                  const s = n.data?.status;
                  return s === 'done' ? '#22c55e' : s === 'blocked' ? '#ef4444' : 'var(--accent-color)';
                }}
              />
            </ReactFlow>
          </div>

          {/* Node properties panel */}
          <div className="absolute top-3 right-3 z-10">
            <AnimatePresence mode="wait">
              {selectedNode && (
                <NodePanel
                  key={selectedNode.id}
                  node={selectedNode}
                  onUpdate={updateNode}
                  onDelete={deleteNode}
                  onClose={() => setSelectedNode(null)}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Edge label dialog */}
          <AnimatePresence>
            {pendingEdge && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 flex items-center justify-center z-20"
                style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
              >
                <div className="bg-theme-panel border border-theme-border rounded-xl p-5 shadow-2xl flex flex-col gap-3 w-72">
                  <p className="text-sm font-semibold text-theme-text">Edge Label <span className="text-theme-muted font-normal">(optional)</span></p>
                  <input
                    autoFocus
                    value={edgeLabelDraft}
                    onChange={e => setEdgeLabelDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmEdge()}
                    placeholder="e.g. Yes / No / Approved…"
                    className="bg-theme-bg border border-theme-border rounded-md px-3 py-2 text-sm text-theme-text focus:outline-none focus:border-theme-accent/60"
                  />
                  <div className="flex gap-2">
                    <button onClick={confirmEdge} className="flex-1 py-1.5 rounded-md bg-theme-accent/20 hover:bg-theme-accent/30 text-theme-accent text-xs font-medium border border-theme-accent/30 transition-all">
                      Add Edge
                    </button>
                    <button onClick={() => setPendingEdge(null)} className="px-3 py-1.5 rounded-md text-theme-muted hover:text-theme-text text-xs border border-theme-border transition-all">
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ── Card list view ────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-4xl mx-auto">
      {/* Create new */}
      <div className="bg-theme-panel/60 backdrop-blur-md rounded-xl border border-theme-border p-5">
        <h3 className="text-sm font-semibold text-theme-text mb-3 flex items-center gap-2">
          <Plus size={14} className="text-theme-accent" /> New Workflow
        </h3>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createWorkflow()}
            placeholder="Workflow name…"
            className="flex-1 bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text placeholder-theme-muted/50 focus:outline-none focus:border-theme-accent/60 transition-colors"
          />
          <button
            onClick={createWorkflow}
            disabled={!newName.trim()}
            className="px-4 py-2 rounded-lg bg-theme-accent/20 hover:bg-theme-accent/30 text-theme-accent text-sm font-medium border border-theme-accent/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create
          </button>
        </div>
      </div>

      {/* Workflow cards */}
      {workflows.length === 0 ? (
        <div className="text-center py-16 text-theme-muted text-sm space-y-2">
          <div className="text-3xl opacity-30">⬡</div>
          <p className="font-medium">No workflows yet</p>
          <p className="text-xs opacity-70">Create one above to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map(flow => {
            const { total, done } = flowStats(flow);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const steps = (flow.nodes || []).filter(n => n.type === 'process');
            const blocked = steps.filter(n => n.data?.status === 'blocked').length;
            const inProg = steps.filter(n => n.data?.status === 'in-progress').length;
            return (
              <motion.div
                key={flow.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="group bg-theme-panel/60 backdrop-blur-md rounded-xl border border-theme-border hover:border-theme-accent/40 p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-theme-accent/5 flex flex-col gap-3"
                onClick={() => setActiveId(flow.id)}
              >
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold text-theme-text text-sm leading-snug">{flow.name}</h4>
                  <button
                    onClick={e => { e.stopPropagation(); deleteWorkflow(flow.id); }}
                    className="opacity-0 group-hover:opacity-100 text-theme-muted hover:text-red-400 transition-all ml-2 shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Node type chips */}
                <div className="flex flex-wrap gap-1.5">
                  {['start', 'process', 'decision', 'end'].map(t => {
                    const count = (flow.nodes || []).filter(n => n.type === t).length;
                    if (!count) return null;
                    const cfg = NODE_TYPES_CONFIG[t];
                    return (
                      <span
                        key={t}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border"
                        style={{ color: cfg.bg === 'var(--panel-bg)' ? 'var(--text-muted)' : cfg.bg, borderColor: `${cfg.bg}40`, backgroundColor: `${cfg.bg}15` }}
                      >
                        {count} {cfg.label}
                      </span>
                    );
                  })}
                </div>

                {/* Progress bar */}
                {total > 0 && (
                  <div className="space-y-1">
                    <div className="w-full h-1.5 rounded-full bg-theme-bg overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pct === 100 ? '#22c55e' : blocked > 0 ? '#ef4444' : 'var(--accent-color)',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-theme-muted">
                      <span>{done}/{total} steps done</span>
                      <span className="flex gap-2">
                        {inProg > 0 && <span style={{ color: 'var(--accent-color)' }}>{inProg} active</span>}
                        {blocked > 0 && <span className="text-red-400">{blocked} blocked</span>}
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-[10px] font-mono text-theme-muted/60 mt-auto">
                  {new Date(flow.created).toLocaleDateString()}
                </p>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
