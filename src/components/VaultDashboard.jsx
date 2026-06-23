import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Menu, Database, Settings, Search, Hash, Lock, Download, Upload,
  ShieldAlert, CheckCircle2, Trash2, Plus, X, Tag, Network,
  Send, GitBranch
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MindmapView from './MindmapView';

// ── Helpers ───────────────────────────────────────────────────────────────────
const extractTags = (text) => {
  const matches = (text || '').match(/#[\wа-яёА-ЯЁ]+/gu) || [];
  return [...new Set(matches)];
};

const formatDate = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const diff = Date.now() - d;
  if (diff < 60_000) return 'только что';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} мин назад`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ч назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

const uid = () => `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ── Sidebar note list ─────────────────────────────────────────────────────────
const NoteList = ({ notes, selectedId, onSelect, onDelete, onCreate, search, setSearch, activeTag, setActiveTag }) => {
  const allTags = [...new Set(notes.flatMap(n => n.tags || []))].sort();

  const filtered = notes
    .filter(n => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (n.title || '').toLowerCase().includes(q) ||
        (n.preview || '').toLowerCase().includes(q) ||
        (n.tags || []).some(t => t.toLowerCase().includes(q));
      const matchTag = !activeTag || (n.tags || []).includes(activeTag);
      return matchSearch && matchTag;
    })
    .sort((a, b) => (b.updated || 0) - (a.updated || 0));

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-theme-border shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-2.5 text-theme-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full bg-theme-bg border border-theme-border rounded-lg pl-8 pr-3 py-2 text-sm text-theme-text placeholder-theme-muted/40 focus:outline-none focus:border-theme-accent"
          />
        </div>
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="px-3 py-2 border-b border-theme-border flex flex-wrap gap-1 shrink-0">
          {activeTag ? (
            <button
              onClick={() => setActiveTag(null)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-theme-accent/20 text-theme-accent text-[11px] border border-theme-accent/30"
            >
              <X size={9} /> {activeTag}
            </button>
          ) : allTags.slice(0, 7).map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-theme-panel text-theme-muted text-[11px] border border-theme-border hover:text-theme-accent hover:border-theme-accent/30 transition-colors"
            >
              <Hash size={9} />{tag.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
        {filtered.map(note => (
          <div
            key={note.id}
            onClick={() => onSelect(note.id)}
            className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${
              selectedId === note.id
                ? 'bg-theme-accent/10 border-theme-accent/30 text-theme-text'
                : 'border-transparent hover:bg-theme-panel/80 text-theme-muted hover:text-theme-text'
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <p className="text-sm font-medium truncate leading-snug">{note.title || 'Без названия'}</p>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-theme-muted hover:text-red-400 transition-all shrink-0 mt-0.5"
              >
                <Trash2 size={12} />
              </button>
            </div>
            {note.preview && (
              <p className="text-xs text-theme-muted/60 mt-0.5 truncate">{note.preview}</p>
            )}
            <div className="flex items-center justify-between mt-1.5">
              <div className="flex gap-1 flex-wrap">
                {(note.tags || []).slice(0, 2).map(t => (
                  <span key={t} className="text-[10px] text-theme-accent/50 font-mono">{t}</span>
                ))}
              </div>
              <span className="text-[10px] text-theme-muted/40 shrink-0">{formatDate(note.updated)}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-10 text-center text-theme-muted/40 text-sm">
            {search ? 'Ничего не найдено' : 'Нет заметок'}
          </div>
        )}
      </div>

      {/* New note */}
      <div className="p-3 border-t border-theme-border shrink-0">
        <button
          onClick={onCreate}
          className="w-full py-2 rounded-xl bg-theme-accent/10 hover:bg-theme-accent/20 text-theme-accent border border-theme-accent/20 hover:border-theme-accent/40 text-sm font-semibold transition-all flex items-center justify-center gap-2"
        >
          <Plus size={14} /> Новая заметка
        </button>
      </div>
    </div>
  );
};

// ── Settings panel ────────────────────────────────────────────────────────────
const SettingsPanel = ({ client, notes, onLock, onNotesChange }) => {
  const [status, setStatus] = useState(''); // 'ok' | 'error' | 'exporting'
  const importRef = useRef(null);

  const handleExport = async () => {
    setStatus('exporting');
    try {
      const buffer = await client.exec('EXPORT_VAULT');
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vault_${new Date().toISOString().split('T')[0]}.vault`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('export_ok');
    } catch {
      setStatus('error');
    } finally {
      setTimeout(() => setStatus(''), 3000);
    }
  };

  const handleImport = async (file) => {
    try {
      const buffer = await file.arrayBuffer();
      const updatedMeta = await client.exec('IMPORT_VAULT', { fileBuffer: buffer });
      onNotesChange(updatedMeta || []);
      setStatus('ok');
    } catch {
      setStatus('error');
    } finally {
      setTimeout(() => setStatus(''), 3000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
      <p className="text-[10px] font-mono text-theme-muted uppercase tracking-widest">Данные</p>

      <button
        onClick={handleExport}
        className="w-full flex items-center gap-3 p-3 rounded-xl bg-theme-panel/50 hover:bg-theme-panel border border-theme-border hover:border-theme-accent/30 text-theme-text text-sm transition-all"
      >
        <Download size={15} className="text-theme-accent shrink-0" />
        <div className="text-left">
          <p className="font-medium text-sm">Экспорт .vault</p>
          <p className="text-[11px] text-theme-muted">Зашифрованный бэкап</p>
        </div>
      </button>

      <label className="w-full flex items-center gap-3 p-3 rounded-xl bg-theme-panel/50 hover:bg-theme-panel border border-theme-border hover:border-theme-accent/30 text-theme-text text-sm transition-all cursor-pointer">
        <Upload size={15} className="text-theme-accent shrink-0" />
        <div className="text-left">
          <p className="font-medium text-sm">Импорт .vault</p>
          <p className="text-[11px] text-theme-muted">CRDT LWW merge</p>
        </div>
        <input
          ref={importRef}
          type="file"
          accept=".vault"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }}
        />
      </label>

      {status === 'ok' && (
        <div className="flex items-center gap-2 text-green-400 text-xs bg-green-500/10 border border-green-500/20 rounded-lg p-2">
          <CheckCircle2 size={12} /> Импорт выполнен
        </div>
      )}
      {status === 'export_ok' && (
        <div className="flex items-center gap-2 text-green-400 text-xs bg-green-500/10 border border-green-500/20 rounded-lg p-2">
          <CheckCircle2 size={12} /> Экспорт сохранён
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2">
          <ShieldAlert size={12} /> Ошибка: неверный ключ или файл
        </div>
      )}

      <div className="pt-4 border-t border-theme-border">
        <p className="text-[10px] font-mono text-theme-muted uppercase tracking-widest mb-3">Сессия</p>
        <button
          onClick={onLock}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-theme-panel/50 hover:bg-red-500/10 border border-theme-border hover:border-red-500/30 text-theme-text hover:text-red-400 text-sm transition-all"
        >
          <Lock size={15} className="shrink-0" />
          <span className="font-medium">Заблокировать</span>
        </button>
      </div>

      <div className="pt-4 border-t border-theme-border space-y-1 text-[10px] font-mono text-theme-muted/35">
        <p>OMNI_VAULT v3.0 · {notes.length} заметок</p>
        <p>AES-GCM-256 + HMAC-SHA-256</p>
        <p>CRDT LWW MERGE · IndexedDB · SubtleCrypto</p>
      </div>
    </div>
  );
};

// ── VaultDashboard ─────────────────────────────────────────────────────────────
const VaultDashboard = ({ client, initialNotes, onLock, onNotesChange }) => {
  const [notes, setNotes] = useState(initialNotes || []);
  const [activeTab, setActiveTab] = useState('notes'); // 'notes' | 'mindmap' | 'settings'
  const [selectedId, setSelectedId] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // 'saved' | 'error'
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isDirtyRef = useRef(false);
  const saveTimerRef = useRef(null);

  // Sync notes to parent
  useEffect(() => { onNotesChange?.(notes); }, [notes]);

  // Load content on note selection
  useEffect(() => {
    if (!selectedId) { setTitle(''); setContent(''); return; }
    const meta = notes.find(n => n.id === selectedId);
    if (meta) setTitle(meta.title || '');
    client.exec('LOAD_CONTENT', { noteId: selectedId })
      .then(c => { setContent(c || ''); isDirtyRef.current = false; })
      .catch(() => setContent(''));
  }, [selectedId]);

  // Auto-save debounce (1.5 s)
  useEffect(() => {
    if (!selectedId || !isDirtyRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveNote, 1500);
    return () => clearTimeout(saveTimerRef.current);
  }, [title, content]);

  const saveNote = useCallback(async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const tags = extractTags(content + ' ' + title);
      const existing = notes.find(n => n.id === selectedId);
      const meta = {
        id: selectedId,
        title: title || 'Без названия',
        tags,
        preview: content.replace(/#[\wа-яёА-ЯЁ]+/gu, '').trim().slice(0, 110),
        updated: Date.now(),
        created: existing?.created || Date.now(),
      };
      await client.exec('SAVE_NOTE', { meta, content });
      setNotes(prev => prev.map(n => n.id === selectedId ? meta : n));
      setSaveStatus('saved');
      isDirtyRef.current = false;
      setTimeout(() => setSaveStatus(''), 2000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [selectedId, title, content, notes, client]);

  const createNote = async () => {
    const id = uid();
    const meta = { id, title: 'Новая заметка', tags: [], preview: '', updated: Date.now(), created: Date.now() };
    await client.exec('SAVE_NOTE', { meta, content: '' });
    setNotes(prev => [meta, ...prev]);
    setSelectedId(id);
    setActiveTab('notes');
  };

  const deleteNote = async (noteId) => {
    if (!confirm('Удалить заметку?')) return;
    await client.exec('DELETE_NOTE', { noteId });
    setNotes(prev => prev.filter(n => n.id !== noteId));
    if (selectedId === noteId) setSelectedId(null);
  };

  const activeTags = selectedId ? extractTags(content + ' ' + title) : [];

  const navItems = [
    { id: 'notes', icon: Database, label: 'Заметки' },
    { id: 'mindmap', icon: Network, label: 'Mindmap' },
    { id: 'settings', icon: Settings, label: 'Настройки' },
  ];

  return (
    <div className="h-screen flex overflow-hidden bg-theme-bg text-theme-text relative z-10">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 272, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 flex flex-col border-r border-theme-border bg-theme-panel/40 backdrop-blur-sm overflow-hidden"
          >
            {/* Sidebar header */}
            <div className="px-4 py-3 border-b border-theme-border flex items-center justify-between shrink-0">
              <span className="font-serif font-black tracking-[0.18em] uppercase text-theme-text text-xs">OMNI VAULT</span>
              <div className="flex gap-0.5">
                {navItems.map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    title={label}
                    className={`p-1.5 rounded-lg transition-all ${activeTab === id ? 'bg-theme-accent/15 text-theme-accent' : 'text-theme-muted hover:text-theme-text hover:bg-theme-text/5'}`}
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </div>
            </div>

            {/* Sidebar body */}
            {activeTab === 'notes' && (
              <NoteList
                notes={notes}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDelete={deleteNote}
                onCreate={createNote}
                search={search}
                setSearch={setSearch}
                activeTag={activeTag}
                setActiveTag={setActiveTag}
              />
            )}
            {activeTab === 'mindmap' && (
              <div className="flex-1 p-4 flex flex-col items-center justify-center gap-3 text-theme-muted/40">
                <Network size={32} />
                <p className="text-xs">Откройте Mindmap</p>
              </div>
            )}
            {activeTab === 'settings' && (
              <SettingsPanel
                client={client}
                notes={notes}
                onLock={onLock}
                onNotesChange={(updated) => { setNotes(updated); setSelectedId(null); }}
              />
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 relative">

        {/* Toolbar */}
        <header className="flex items-center gap-3 px-4 py-2.5 border-b border-theme-border bg-theme-panel/30 backdrop-blur-sm shrink-0">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="p-1.5 text-theme-muted hover:text-theme-text rounded-lg hover:bg-theme-text/5 transition-colors shrink-0"
          >
            <Menu size={17} />
          </button>

          {activeTab === 'notes' && selectedId ? (
            <input
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); isDirtyRef.current = true; }}
              placeholder="Заголовок..."
              className="flex-1 bg-transparent text-theme-text font-serif font-bold text-base focus:outline-none placeholder-theme-muted/25 min-w-0"
            />
          ) : (
            <span className="font-serif font-bold text-base text-theme-text flex items-center gap-2">
              {activeTab === 'mindmap' && <><Network className="text-theme-accent" size={16} /> Mindmap</>}
              {activeTab === 'settings' && <><Settings className="text-theme-accent" size={16} /> Настройки</>}
              {activeTab === 'notes' && <span className="text-theme-muted/50 text-sm font-sans font-normal">Выберите или создайте заметку</span>}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2.5 shrink-0">
            {saving && <span className="text-xs text-theme-muted/50 animate-pulse font-mono">•••</span>}
            {saveStatus === 'saved' && (
              <span className="text-xs text-green-400 flex items-center gap-1 font-mono">
                <CheckCircle2 size={11} /> saved
              </span>
            )}
            {activeTab === 'notes' && selectedId && (
              <button
                onClick={saveNote}
                className="px-3 py-1.5 rounded-lg bg-theme-accent/12 hover:bg-theme-accent/22 text-theme-accent text-xs font-semibold border border-theme-accent/20 transition-all"
              >
                Сохранить
              </button>
            )}
            <button
              onClick={onLock}
              className="p-1.5 text-theme-muted hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
              title="Заблокировать"
            >
              <Lock size={15} />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === 'mindmap' ? (
              <motion.div
                key="mindmap"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0"
              >
                <MindmapView state={{ mindmaps: [] }} dispatch={() => {}} />
              </motion.div>
            ) : (
              <motion.div
                key="editor"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto custom-scrollbar"
              >
                {selectedId ? (
                  <textarea
                    value={content}
                    onChange={e => { setContent(e.target.value); isDirtyRef.current = true; }}
                    placeholder={"Начните писать...\n\nИспользуйте #теги для организации заметок"}
                    className="w-full h-full min-h-full bg-transparent text-theme-text placeholder-theme-muted/20 focus:outline-none resize-none leading-7 text-sm p-6"
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-5 select-none">
                    <div className="opacity-20 text-5xl">🔐</div>
                    <div className="text-center opacity-40">
                      <p className="text-theme-text font-serif text-base mb-1">Хранилище открыто</p>
                      <p className="text-theme-muted text-sm">
                        {notes.length === 0 ? 'Создайте первую заметку' : `${notes.length} заметок в базе`}
                      </p>
                    </div>
                    {notes.length === 0 && (
                      <button
                        onClick={createNote}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-theme-accent/12 hover:bg-theme-accent/22 text-theme-accent border border-theme-accent/20 text-sm font-semibold transition-all"
                      >
                        <Plus size={14} /> Создать заметку
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tag bar */}
        {selectedId && activeTags.length > 0 && (
          <div className="px-6 py-2 border-t border-theme-border bg-theme-panel/20 flex items-center gap-2 shrink-0 overflow-x-auto">
            <Tag size={10} className="text-theme-muted/40 shrink-0" />
            {activeTags.map(tag => (
              <span key={tag} className="text-[11px] font-mono text-theme-accent/50 bg-theme-accent/5 px-1.5 py-0.5 rounded border border-theme-accent/10 whitespace-nowrap shrink-0">
                {tag}
              </span>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default VaultDashboard;
import React, { useState } from 'react';
import { Menu, X, Settings, Plus, Search, Trash2, Pin, Share2, GitBranch, Clock, LogOut, KeyRound, Bot, Send, Image as ImageIcon, Loader2, XCircle, Lock, Database, Download, Upload, Network, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MindmapView from './MindmapView';
// ==== ELEGANT TITLE ====
export const ElegantTitle = ({ children, className = '' }) => {
  return (
    <h1 className={`font-serif tracking-wide text-theme-text ${className}`}>
      {children}
    </h1>
  );
};


// ==== BASE VIEW ====
const BaseView = ({ state, dispatch }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarMode, setSidebarMode] = useState('sections'); // 'sections' or 'structure'
  const [activeSection, setActiveSection] = useState('all');
  const [selectedItemId, setSelectedItemId] = useState(null);
  
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('idea');
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    if (selectedItemId) {
      const item = state.items.find(i => i.id === selectedItemId);
      if (item) {
        setTitle(item.title || '');
        setText(item.description || '');
        setType(item.type || 'idea');
      }
    } else {
      setTitle('');
      setText('');
    }
  }, [selectedItemId, state.items]);

  const handleSave = () => {
    if (!text.trim() && !title.trim()) return;

    if (selectedItemId) {
      dispatch({
        type: 'UPDATE_ITEM',
        payload: {
          id: selectedItemId,
          title: title || (type === 'link' ? 'Ссылка' : 'Без названия'),
          description: text || title,
          url: type === 'link' ? text : null,
          type
        }
      });
    } else {
      dispatch({
        type: 'ADD_ITEM',
        payload: {
          type,
          title: title || (type === 'link' ? 'Ссылка' : 'Без названия'),
          description: text || title,
          url: type === 'link' ? text : null,
          status: type === 'task' ? 'open' : undefined,
          priority: type === 'task' ? 'medium' : undefined
        }
      });
      setText('');
      setTitle('');
    }
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    dispatch({ type: 'DELETE_ITEM', payload: id });
    if (selectedItemId === id) {
      setSelectedItemId(null);
    }
  };

  const handleNew = () => {
    setSelectedItemId(null);
    setTitle('');
    setText('');
    setType('idea');
  };

  let filtered = state.items.filter(item => 
    (item.title?.toLowerCase().includes(search.toLowerCase()) ||
     item.description?.toLowerCase().includes(search.toLowerCase()) ||
     item.url?.toLowerCase().includes(search.toLowerCase()))
  );

  if (activeSection !== 'all') {
    filtered = filtered.filter(item => item.type === activeSection);
  }
  
  filtered = filtered.sort((a, b) => new Date(b.created) - new Date(a.created));

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4 animate-in fade-in duration-500">
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="shrink-0 flex flex-col glass-panel"
          >
            <div className="p-3 border-b border-theme-border flex gap-2">
              <button 
                onClick={() => setSidebarMode('sections')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${sidebarMode === 'sections' ? 'bg-theme-accent text-theme-bg shadow-sm' : 'bg-transparent text-theme-muted hover:bg-theme-text/5'}`}
              >
                Разделы
              </button>
              <button 
                onClick={() => setSidebarMode('structure')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${sidebarMode === 'structure' ? 'bg-theme-accent text-theme-bg shadow-sm' : 'bg-transparent text-theme-muted hover:bg-theme-text/5'}`}
              >
                Структура
              </button>
            </div>

            <div className="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
              {sidebarMode === 'sections' ? (
                <>
                  {['all', 'idea', 'task', 'interesting', 'link'].map(sec => (
                    <button 
                      key={sec}
                      onClick={() => setActiveSection(sec)}
                      className={`flex items-center justify-start gap-2 px-3 py-2 rounded-xl text-sm transition-all ${activeSection === sec ? 'bg-theme-panel text-theme-text border border-theme-accent/30 shadow-sm' : 'text-theme-muted hover:bg-theme-panel/50 hover:text-theme-text border border-transparent'}`}
                    >
                      {sec === 'all' && '📂 Все записи'}
                      {sec === 'idea' && '💡 Идеи'}
                      {sec === 'task' && '✅ Задачи'}
                      {sec === 'interesting' && '🔖 Интересное'}
                      {sec === 'link' && '🔗 Ссылки'}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <div className="relative mb-2 shrink-0">
                    <Search size={14} className="absolute left-3 top-2.5 text-theme-muted" />
                    <input 
                      type="text" 
                      placeholder="Поиск..." 
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full bg-theme-panel border border-theme-border rounded-lg pl-9 pr-3 py-2 text-sm text-theme-text focus:outline-none focus:border-theme-accent shadow-sm"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                    {filtered.map(item => (
                      <div 
                        key={item.id}
                        onClick={() => setSelectedItemId(item.id)}
                        className={`group flex items-center justify-between px-3 py-2 rounded-xl text-sm cursor-pointer transition-all border ${selectedItemId === item.id ? 'bg-theme-panel border-theme-accent/30 text-theme-text shadow-sm' : 'bg-transparent border-transparent text-theme-muted hover:bg-theme-panel/50 hover:text-theme-text'}`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span>
                            {item.type === 'idea' ? '💡' : item.type === 'task' ? '✅' : item.type === 'interesting' ? '🔖' : item.type === 'link' ? '🔗' : '📝'}
                          </span>
                          <span className="truncate">{item.title || 'Без названия'}</span>
                        </div>
                        <button onClick={(e) => handleDelete(item.id, e)} className="opacity-0 group-hover:opacity-100 text-theme-accent hover:text-red-500 transition-colors shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {filtered.length === 0 && <div className="text-center text-theme-muted text-xs mt-4">Ничего не найдено</div>}
                  </div>
                </>
              )}
            </div>
            
            <div className="p-3 border-t border-theme-border shrink-0">
              <button 
                onClick={handleNew}
                className="w-full bg-theme-text hover:bg-theme-text/90 text-theme-bg text-sm py-2 rounded-xl transition-all flex items-center justify-center gap-2 border border-transparent shadow-sm"
              >
                <Plus size={16} /> Новая запись
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col bg-theme-panel border border-theme-border rounded-2xl overflow-hidden shadow-sm relative">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute left-3 top-3.5 z-10 p-1.5 bg-theme-bg hover:bg-theme-panel text-theme-muted hover:text-theme-text rounded-lg transition-colors border border-theme-border shadow-sm"
        >
          <Menu size={16} />
        </button>

        <div className="pl-14 pr-4 py-3 border-b border-theme-border flex flex-wrap items-center justify-between gap-3 bg-theme-bg">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="bg-theme-panel border border-theme-border rounded-lg px-3 py-1.5 text-sm text-theme-text focus:outline-none focus:border-theme-accent cursor-pointer shadow-sm"
            >
              <option value="idea">💡 Идея</option>
              <option value="task">✅ Задача</option>
              <option value="interesting">🔖 Интересное</option>
              <option value="link">🔗 Ссылка</option>
            </select>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Заголовок..."
              className="flex-1 bg-transparent text-theme-text font-serif font-bold px-2 py-1 focus:outline-none placeholder-theme-muted/40 min-w-0"
            />
          </div>
          <button 
            onClick={handleSave}
            className="bg-theme-accent hover:bg-theme-accent-hover text-theme-bg text-sm font-semibold py-1.5 px-4 rounded-lg transition-all shadow-sm flex items-center gap-2 shrink-0 active:scale-95"
          >
            {selectedItemId ? 'Сохранить' : <><Plus size={16} /> Записать</>}
          </button>
        </div>

        <div className="flex-1 p-4 flex flex-col bg-theme-panel">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Начните писать здесь..."
            className="flex-1 w-full bg-transparent text-theme-text placeholder-theme-muted/30 focus:outline-none resize-none custom-scrollbar leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
};

// ==== OMNI AI VIEW (Mind Extractor) ====
const OmniView = ({ state, dispatch }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const history = state.cerberHistory || [];

  const parseActions = (text) => {
    const actions = [];
    // Pattern for set_reminder(task="...", date_time_str="...")
    const reminderRegex = /set_reminder\s*\(\s*task\s*=\s*["']([^"']+)["']\s*(?:,\s*date_time_str\s*=\s*["']([^"']+)["'])?\s*\)/g;
    let match;
    while ((match = reminderRegex.exec(text)) !== null) {
      actions.push({ type: 'ADD_ITEM', payload: { title: match[1], type: 'task', content: match[2] || 'Извлечено через OMNI' } });
    }

    // Pattern for new project suggestions
    if (text.toLowerCase().includes('создать проект') || text.toLowerCase().includes('create project')) {
       const projectMatch = text.match(/(?:проект|project)\s*["']([^"']+)["']/i);
       if (projectMatch) {
         actions.push({ type: 'ADD_PROJECT', payload: { name: projectMatch[1], description: 'Инициировано OMNI Orchestrator' } });
       }
    }

    return actions;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input.trim();
    setInput('');
    
    dispatch({
      type: 'ADD_CERBER_MSG',
      payload: { role: 'user', content: userMsg, timestamp: new Date().toISOString() }
    });

    setLoading(true);
    try {
      const response = await fetch('/api/omni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userMsg })
      });

      const data = await response.json();
      let aiText = "Извините, ядро OMNI не ответило.";
      
      if (response.ok) {
        aiText = data.responses?.[0]?.text || data.reply?.[0]?.text || JSON.stringify(data);
      } else if (data.error) {
        aiText = `Ошибка ядра: ${data.error.message || JSON.stringify(data.error)}`;
      }

      dispatch({
        type: 'ADD_CERBER_MSG',
        payload: { 
          role: 'assistant', 
          content: aiText, 
          timestamp: new Date().toISOString(),
          actions: parseActions(aiText) 
        }
      });
    } catch (err) {
      dispatch({
        type: 'ADD_CERBER_MSG',
        payload: { role: 'system', content: 'Ошибка связи с ядром OMNI. Проверьте соединение.', timestamp: new Date().toISOString() }
      });
    } finally {
      setLoading(false);
    }
  };

  const executeAction = (action, idx) => {
    dispatch(action);
    // Mark action as executed in UI (simple alert for now)
    alert(`Выполнено: ${action.type === 'ADD_ITEM' ? 'Задача создана' : 'Проект создан'}`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] animate-in fade-in duration-500">
      <div className="bg-theme-panel border-b-0 border border-theme-border rounded-t-2xl p-4 flex items-center justify-between shadow-sm">
         <h3 className="text-lg font-serif font-bold text-theme-text flex items-center gap-2">
          <Bot className="text-theme-accent" size={20} /> Личный ассистент
        </h3>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-[10px] font-mono text-theme-muted uppercase tracking-tighter">Mind Extraction Active</span>
          <span className="text-xs font-mono text-theme-accent bg-theme-panel px-2 py-1 rounded">MIND_LINK: ESTABLISHED</span>
        </div>
      </div>

      <div className="flex-1 bg-theme-bg border-l border-r border-theme-border overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {history.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-50 text-center">
            <Bot size={64} className="text-theme-accent mb-4" />
            <p className="text-theme-muted max-w-md italic font-serif text-lg">«Расскажите мне о ваших планах, и я превращу их в структуру.»</p>
          </div>
        ) : (
          history.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`
                max-w-[80%] rounded-2xl px-5 py-3 
                ${msg.role === 'user' 
                  ? 'bg-theme-text text-theme-bg rounded-tr-sm shadow-sm' 
                  : msg.role === 'system'
                    ? 'bg-red-500/10 text-red-500 border border-red-500/20 rounded-tl-sm'
                    : 'bg-theme-panel text-theme-text border border-theme-border rounded-tl-sm shadow-sm'}
              `}>
                <div className="text-xs opacity-50 mb-1 flex items-center gap-1">
                  {msg.role === 'assistant' && <Bot size={12} />}
                  {msg.role === 'assistant' ? 'АССИСТЕНТ' : msg.role.toUpperCase()}
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
                
                {/* Mind Extractor Actions */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-theme-border flex flex-wrap gap-2">
                    {msg.actions.map((action, aIdx) => (
                      <button 
                        key={aIdx}
                        onClick={() => executeAction(action, idx)}
                        className="bg-theme-panel hover:bg-theme-bg border border-theme-accent/30 text-theme-accent text-xs font-bold py-2 px-3 rounded-lg transition-all flex items-center gap-2 shadow-sm"
                      >
                        <Plus size={14} /> Выполнить: {action.payload.title || action.payload.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-theme-panel text-theme-muted border border-theme-border rounded-2xl rounded-tl-sm px-5 py-3 animate-pulse shadow-sm">
              Анализ запроса...
            </div>
          </div>
        )}
      </div>

      <div className="bg-theme-panel border border-t-0 border-theme-border rounded-b-2xl p-4 flex gap-3 shadow-sm">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Опишите вашу идею или задачу..."
          className="flex-1 bg-theme-bg border border-theme-border rounded-xl px-4 py-3 text-theme-text focus:outline-none focus:border-theme-accent transition-all shadow-inner"
        />
        <button 
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-theme-text hover:bg-theme-text/90 disabled:opacity-50 text-theme-bg p-3 rounded-xl transition-all shadow-md flex items-center justify-center"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};



// ==== PROJECTS VIEW ====
const ProjectsView = ({ state, dispatch }) => {
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState(null);

  const addProject = () => {
    if (!newName.trim()) return;
    dispatch({
      type: 'ADD_PROJECT',
      payload: {
        name: newName,
        description: '',
        status: 'planning',
        progress: 0
      }
    });
    setNewName('');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="glass-panel p-6">
        <h3 className="text-lg font-serif font-bold text-theme-text mb-4 flex items-center gap-2">
          <GitBranch className="text-theme-accent" size={20} /> Новый проект
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Название проекта..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addProject()}
            className="input-field"
          />
          <button
            onClick={addProject}
            className="btn-gold whitespace-nowrap"
          >
            Создать
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {state.projects.map(project => (
          <motion.div
            layout
            key={project.id}
            className="glass-panel overflow-hidden transition-all shadow-sm hover:shadow-md"
          >
            <div
              onClick={() => setExpanded(expanded === project.id ? null : project.id)}
              className="p-5 cursor-pointer flex items-center justify-between hover:bg-theme-panel/50 transition group"
            >
              <div className="flex-1">
                <h3 className="text-theme-text font-bold text-lg mb-2 flex items-center gap-2">
                  {project.name}
                  {expanded === project.id && <span className="px-2 py-0.5 rounded text-xs bg-theme-accent/10 text-theme-accent border border-theme-accent/20">Активен</span>}
                </h3>
                <div className="flex gap-4 text-sm text-theme-muted">
                  <span className="flex items-center gap-1.5"><Clock size={14} /> Обновлен {new Date(project.created).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-theme-accent"></span> Issues: {project.issues?.length || 0}</span>
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if(confirm('Удалить проект?')) dispatch({ type: 'DELETE_PROJECT', payload: project.id });
                }} 
                className="text-theme-muted hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all bg-theme-panel hover:bg-red-500/10 rounded-lg shadow-sm"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <AnimatePresence>
              {expanded === project.id && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-theme-border bg-theme-bg overflow-hidden"
                >
                  <div className="p-5 space-y-5">
                    <div>
                      <div className="flex justify-between text-xs text-theme-muted mb-2">
                        <span>Прогресс</span>
                        <span>{project.progress || 0}%</span>
                      </div>
                      <div className="w-full bg-theme-panel rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-theme-accent h-full rounded-full transition-all duration-1000 shadow-sm"
                          style={{ width: `${project.progress || 0}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-3">
                      <button className="flex-1 min-w-[120px] bg-theme-panel hover:bg-theme-bg border border-theme-border hover:border-theme-accent/50 text-theme-text py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-2 font-medium shadow-sm">
                        <Plus size={16} /> Создать Issue
                      </button>
                      <button className="flex-1 min-w-[120px] bg-theme-panel hover:bg-theme-bg border border-theme-border hover:border-theme-accent/50 text-theme-text py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-2 font-medium shadow-sm">
                        📊 Открыть Board
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}

        {state.projects.length === 0 && (
          <div className="text-center py-20 bg-theme-panel/50 rounded-2xl border border-theme-border border-dashed backdrop-blur-sm">
             <div className="text-5xl mb-4 opacity-50">🏗️</div>
            <p className="text-theme-muted text-lg">Нет проектов.</p>
            <p className="text-theme-muted/70 text-sm mt-2">Время построить что-то великое!</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ==== GALLERY VIEW ====
const GalleryView = ({ state, dispatch }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedImage, setExpandedImage] = useState(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/generate_image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Ошибка генерации');
      }
      
      const base64Image = data.predictions?.[0]?.bytesBase64Encoded;
      if (!base64Image) throw new Error('Не удалось получить изображение');
      
      dispatch({
        type: 'ADD_IMAGE',
        payload: {
          prompt: prompt.trim(),
          data: `data:image/png;base64,${base64Image}`
        }
      });
      setPrompt('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const images = state.gallery || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative h-full">
      <div className="glass-panel p-6">
        <h3 className="text-lg font-serif font-bold text-theme-text mb-4 flex items-center gap-2">
          <ImageIcon className="text-theme-accent" size={20} /> Создание изображений
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Опишите изображение (например: светлый интерьер, винтаж, эстетика)..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            className="input-field flex-1"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="btn-gold disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2 min-w-[140px]"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <ImageIcon size={20} />}
            {loading ? 'Создание...' : 'Создать'}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <AnimatePresence>
          {images.map(img => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={img.id}
              className="group relative rounded-2xl overflow-hidden border border-theme-border bg-theme-panel aspect-square cursor-pointer hover:border-theme-accent/50 transition-all shadow-sm hover:shadow-md"
              onClick={() => setExpandedImage(img)}
            >
              <img src={img.data} alt={img.prompt} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-theme-text/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                <p className="text-theme-bg font-serif text-sm font-medium line-clamp-2">{img.prompt}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-theme-bg/80">{new Date(img.created).toLocaleDateString()}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: 'DELETE_IMAGE', payload: img.id });
                    }}
                    className="p-1.5 hover:bg-red-500/80 rounded-lg text-theme-bg/70 hover:text-theme-bg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {images.length === 0 && !loading && (
        <div className="text-center py-20 bg-theme-panel/50 rounded-2xl border border-theme-border border-dashed backdrop-blur-sm">
          <div className="text-5xl mb-4 opacity-50">🖼️</div>
          <p className="text-theme-muted text-lg font-serif">Галерея пуста.</p>
          <p className="text-theme-muted/70 text-sm mt-2">Сгенерируйте свой первый шедевр!</p>
        </div>
      )}

      {/* Expanded Image Modal */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-theme-text/90 backdrop-blur-xl"
            onClick={() => setExpandedImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative max-w-5xl w-full max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setExpandedImage(null)}
                className="absolute -top-12 right-0 text-theme-bg/70 hover:text-theme-bg transition-colors"
              >
                <XCircle size={32} />
              </button>
              <img 
                src={expandedImage.data} 
                alt={expandedImage.prompt} 
                className="w-full h-full object-contain rounded-2xl border border-white/20 shadow-2xl" 
              />
              <div className="mt-4 bg-theme-bg backdrop-blur border border-theme-border p-4 rounded-xl shadow-lg">
                <p className="text-theme-text font-serif text-lg">{expandedImage.prompt}</p>
                <p className="text-theme-muted text-sm mt-1">{new Date(expandedImage.created).toLocaleString()}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ==== SETTINGS VIEW ====
const SettingsView = ({ state, dispatch, onExportVault, onLock }) => {
  const handleExportJSON = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };


  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in duration-500">
      <div className="glass-panel p-6 sm:p-8">
        <h3 className="text-xl font-serif font-bold text-theme-text mb-6 flex items-center gap-2 border-b border-theme-border pb-4">
          <Settings className="text-theme-accent" /> Настройки системы
        </h3>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-theme-text font-medium">Автоблокировка хранилища</p>
              <p className="text-sm text-theme-muted mt-1">Время бездействия до скрытия данных</p>
            </div>
            <select 
              value={state.settings?.lockTimeout || 15}
              onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', payload: { lockTimeout: Number(e.target.value) } })}
              className="bg-theme-panel border border-theme-border rounded-xl px-4 py-2.5 text-theme-text outline-none focus:border-theme-accent transition-all cursor-pointer shadow-sm"
            >
              <option value={5}>5 минут</option>
              <option value={15}>15 минут</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-theme-text font-medium">Оформление системы (Тема)</p>
              <p className="text-sm text-theme-muted mt-1">Визуальный стиль интерфейса</p>
            </div>
            <select 
              value={state.settings?.theme || 'liwood'}
              onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', payload: { theme: e.target.value } })}
              className="bg-theme-panel border border-theme-border rounded-xl px-4 py-2.5 text-theme-text outline-none focus:border-theme-accent transition-all cursor-pointer shadow-sm"
            >
              <option value="liwood">Miss Liwood (Светлая)</option>
              <option value="dark">Dark Elegance (Темная)</option>
              <option value="cyberpunk">OMNI Classic (Киберпанк)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 sm:p-8">
        <h3 className="text-xl font-serif font-bold text-theme-text mb-6 flex items-center gap-2 border-b border-theme-border pb-4">
          <Bot className="text-theme-accent" /> Интеграция ИИ и API (Agent Platform)
        </h3>
        
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <p className="text-theme-text font-medium">Способ авторизации API</p>
              <p className="text-sm text-theme-muted mt-1">
                Выберите метод подключения к сервисам ИИ
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <label className={`relative flex cursor-pointer rounded-lg border bg-theme-panel p-4 shadow-sm hover:border-theme-accent/50 focus:outline-none ${state.settings?.apiAuthMethod === 'adc' || !state.settings?.apiAuthMethod ? 'border-theme-accent ring-1 ring-theme-accent' : 'border-theme-border'}`}>
                <input 
                  type="radio" 
                  name="apiAuthMethod" 
                  value="adc" 
                  className="sr-only"
                  checked={state.settings?.apiAuthMethod === 'adc' || !state.settings?.apiAuthMethod}
                  onChange={() => dispatch({ type: 'UPDATE_SETTINGS', payload: { apiAuthMethod: 'adc' } })}
                />
                <span className="flex flex-1">
                  <span className="flex flex-col">
                    <span className="block text-sm font-bold text-theme-text flex items-center gap-2">
                      Application Default Credentials (ADC) <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded uppercase font-medium">Recommended</span>
                    </span>
                    <span className="mt-1 flex items-center text-sm text-theme-muted">
                      Безопасный стандартный способ подключения без ручного управления ключами.
                    </span>
                  </span>
                </span>
                <CheckCircle size={20} className={`h-5 w-5 text-theme-accent ${state.settings?.apiAuthMethod === 'adc' || !state.settings?.apiAuthMethod ? 'block' : 'hidden'}`} />
              </label>

              <label className={`relative flex cursor-pointer rounded-lg border bg-theme-panel/50 p-4 shadow-sm focus:outline-none opacity-60 ${state.settings?.apiAuthMethod === 'api_key' ? 'border-red-500 ring-1 ring-red-500' : 'border-theme-border'}`}>
                <input 
                  type="radio" 
                  name="apiAuthMethod" 
                  value="api_key" 
                  className="sr-only"
                  checked={state.settings?.apiAuthMethod === 'api_key'}
                  onChange={() => {
                    alert('Политика безопасности вашей организации запрещает использование API Keys. Пожалуйста, используйте Application Default Credentials (ADC).');
                  }}
                />
                <span className="flex flex-1">
                  <span className="flex flex-col">
                    <span className="block text-sm font-bold text-theme-text flex items-center gap-2">
                      API Keys <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded uppercase font-medium">Disallowed</span>
                    </span>
                    <span className="mt-1 flex items-center text-sm text-theme-muted">
                      Использование долгоживущих ключей отключено политикой безопасности.
                    </span>
                  </span>
                </span>
                <XCircle size={20} className="h-5 w-5 text-red-500 block" />
              </label>
            </div>
          </div>
          
          <div className="pt-4 border-t border-theme-border">
            <p className="text-theme-text font-medium mb-3 text-sm">Настройка ADC (Bash Script)</p>
            <div className="bg-theme-text rounded-lg p-3 relative group">
              <code className="text-xs text-theme-bg font-mono break-all select-all">
                bash &lt;(curl -sSL https://storage.googleapis.com/cloud-samples-data/adc/setup_adc.sh)
              </code>
              <button 
                onClick={() => navigator.clipboard.writeText("bash <(curl -sSL https://storage.googleapis.com/cloud-samples-data/adc/setup_adc.sh)")}
                className="absolute right-2 top-2 p-1.5 bg-theme-text rounded hover:bg-theme-text/90 text-theme-bg transition-colors"
                title="Копировать скрипт"
              >
                📋
              </button>
            </div>
            <p className="text-xs text-theme-muted mt-2">Выполните эту команду в терминале для настройки Application Default Credentials.</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 sm:p-8">
      <section>
        <h3 className="text-2xl font-serif font-bold text-theme-text mb-8 flex items-center gap-4">
          <Share2 className="text-theme-accent" size={28} /> 
          <span>Управление Данными</span>
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <p className="text-theme-muted leading-relaxed">
              Ваша база данных хранится локально в зашифрованном виде. Регулярно создавайте резервные копии для предотвращения потери данных.
            </p>
            <div className="flex flex-col gap-4">
              <button onClick={onExportVault} className="btn-primary flex items-center justify-center gap-3">
                <Lock size={20} /> Экспорт .vault (Зашифровано)
              </button>
              <button onClick={onLock} className="input-field hover:bg-theme-panel/5 transition-colors flex items-center justify-center gap-3">
                <LogOut size={20} /> Сменить файл БД / Выйти
              </button>
            </div>
          </div>

          <div className="glass-panel p-8 space-y-6 bg-theme-panel/30">
            <h4 className="font-bold text-theme-text flex items-center gap-2">
              <Database size={18} className="text-theme-accent" /> Перенос данных
            </h4>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={handleExportJSON} className="input-field text-sm py-3 flex items-center justify-center gap-3">
                <Download size={18} /> Экспорт JSON (Открытый текст)
              </button>
              <label className="input-field text-sm py-3 flex items-center justify-center gap-3 cursor-pointer hover:bg-theme-panel/10">
                <Upload size={18} /> Импорт из JSON
                <input type="file" className="hidden" accept=".json" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const imported = JSON.parse(event.target?.result);
                      dispatch({ type: 'LOAD', payload: imported });
                      alert('✅ Данные успешно импортированы!');
                    } catch {
                      alert('❌ Ошибка парсинга JSON');
                    }
                  };
                  reader.readAsText(file);
                }} />
              </label>
            </div>
          </div>
        </div>
      </section>
      </div>

      <section className="pt-8 border-t border-theme-border">
        <div className="flex items-center justify-between text-xs font-mono text-theme-muted">
          <span>OMNI_CORE_VERSION: 2.0.4-STABLE</span>
          <span>ENCRYPTION: AES-GCM-256</span>
        </div>
      </section>
    </div>
  );
};


const VaultDashboard = ({ state, dispatch, onLock, onExportVault }) => {
  const [activeTab, setActiveTab] = useState('base');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen p-0 relative z-10 flex flex-col xl:flex-row gap-0 w-full h-screen overflow-hidden bg-theme-panel text-theme-text custom-bg">
      {/* Mobile Header */}
      <div className="xl:hidden flex items-center justify-between bg-theme-panel border-b border-theme-border p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-theme-text p-2 hover:bg-theme-text/5 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <ElegantTitle className="text-lg font-bold text-theme-text tracking-widest uppercase">
            Miss Liwood
          </ElegantTitle>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`
        ${isMobileMenuOpen ? 'fixed inset-0 z-50 bg-theme-panel/95 backdrop-blur-xl' : 'hidden'} 
        xl:relative xl:flex flex-col shrink-0 h-full transition-all duration-300 ease-in-out border-r border-theme-border bg-theme-bg shadow-sm
        ${isSidebarCollapsed ? 'xl:w-[68px]' : 'xl:w-64'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header/Logo */}
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} p-4 mb-2`}>
            {!isSidebarCollapsed && (
              <ElegantTitle className="text-xl font-black text-theme-text tracking-[0.15em] uppercase truncate">
                L I W O O D
              </ElegantTitle>
            )}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
              className={`p-1.5 text-theme-muted hover:text-theme-text rounded-md hover:bg-theme-text/5 transition-colors`}
            >
              <Menu size={20} />
            </button>
          </div>
          
          {/* Navigation */}
          <nav className="flex flex-col gap-1 flex-1 overflow-y-auto custom-scrollbar px-2">
            {[
              { id: 'base', icon: KeyRound, label: 'База знаний' },
              { id: 'projects', icon: GitBranch, label: 'Проекты' },
              { id: 'mindmap', icon: Network, label: 'Mindmaps' },
              { id: 'omni', icon: Bot, label: 'OMNI AI' },
              { id: 'gallery', icon: ImageIcon, label: 'Галерея' },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
                className={`group relative flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2.5 gap-3'} rounded-md transition-all ${activeTab === tab.id ? 'bg-theme-accent/10 text-theme-text' : 'text-theme-muted hover:bg-theme-text/5 hover:text-theme-text'}`}
                title={isSidebarCollapsed ? tab.label : ''}
              >
                {activeTab === tab.id && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/4 bg-theme-accent rounded-r-full" />
                )}
                <tab.icon size={20} className={activeTab === tab.id ? 'text-theme-accent' : 'group-hover:text-theme-accent transition-colors'} />
                {!isSidebarCollapsed && <span className="tracking-wide text-sm font-medium">{tab.label}</span>}
              </button>
            ))}
          </nav>

          {/* Bottom Actions */}
          <div className="p-2 border-t border-theme-border flex flex-col gap-1">
             <button 
               onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
               className={`group relative flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2.5 gap-3'} rounded-md transition-all ${activeTab === 'settings' ? 'bg-theme-accent/10 text-theme-text' : 'text-theme-muted hover:bg-theme-text/5 hover:text-theme-text'}`}
               title={isSidebarCollapsed ? 'Настройки' : ''}
             >
                {activeTab === 'settings' && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/4 bg-theme-accent rounded-r-full" />
                )}
                <Settings size={20} className={activeTab === 'settings' ? 'text-theme-accent' : 'group-hover:text-theme-accent transition-colors'} />
                {!isSidebarCollapsed && <span className="tracking-wide text-sm font-medium">Настройки</span>}
             </button>
             <button 
              onClick={onLock}
              className={`group relative flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'px-3 py-2.5 gap-3'} rounded-md transition-all text-theme-muted hover:bg-red-50 hover:text-red-600`}
              title={isSidebarCollapsed ? 'Выход' : ''}
            >
              <LogOut size={20} className="group-hover:text-red-600 transition-colors" /> 
              {!isSidebarCollapsed && <span className="tracking-wide text-sm font-medium">Выход</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-transparent relative overflow-hidden">
        {/* IDE-like Header Tabs */}
        <header className="flex items-center justify-between border-b border-theme-border bg-theme-panel/50 backdrop-blur-md shrink-0 px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-serif font-bold text-theme-text flex items-center gap-2">
              {activeTab === 'base' && <><KeyRound className="text-theme-accent" size={16} /> База Знаний</>}
              {activeTab === 'projects' && <><GitBranch className="text-theme-accent" size={16} /> Проекты</>}
              {activeTab === 'mindmap' && <><Network className="text-theme-accent" size={16} /> Mindmaps</>}
              {activeTab === 'omni' && <><Bot className="text-theme-accent" size={16} /> Личный ассистент</>}
              {activeTab === 'gallery' && <><ImageIcon className="text-theme-accent" size={16} /> Галерея</>}
              {activeTab === 'settings' && <><Settings className="text-theme-accent" size={16} /> Настройки</>}
            </h2>
          </div>
          
          <div className="flex items-center gap-3 text-[10px] font-mono text-theme-muted tracking-tighter">
             <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-theme-accent animate-pulse"></span> READY</span>
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-transparent">
          <AnimatePresence mode="wait">
            {activeTab === 'base' && (
              <motion.div key="base" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                <BaseView state={state} dispatch={dispatch} />
              </motion.div>
            )}
            {activeTab === 'mindmap' && (
              <motion.div key="mindmap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                <MindmapView state={state} dispatch={dispatch} />
              </motion.div>
            )}
            {activeTab === 'projects' && (
              <motion.div key="projects" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                <ProjectsView state={state} dispatch={dispatch} />
              </motion.div>
            )}
            {activeTab === 'omni' && (
              <motion.div key="omni" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                <OmniView state={state} dispatch={dispatch} />
              </motion.div>
            )}
            {activeTab === 'gallery' && (
              <motion.div key="gallery" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                <GalleryView state={state} dispatch={dispatch} />
              </motion.div>
            )}
            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
                <SettingsView state={state} dispatch={dispatch} onExportVault={onExportVault} onLock={onLock} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default VaultDashboard;

