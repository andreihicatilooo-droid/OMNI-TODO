import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Menu, X, Settings, Plus, Search, Trash2, Pin, Share2, GitBranch, Clock, LogOut, KeyRound, Bot, Send, Image as ImageIcon, Loader2, XCircle, Lock, Database, Download, Upload, Network, CheckCircle, Eye, Pencil, Link2, Hash, FileText, ArrowUpRight, CornerDownLeft, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MindmapView from './MindmapView';
import { Markdown, buildLinkGraph, buildTagIndex, findNoteByTitle, extractTags } from '../lib/obsidian.jsx';
// ==== ELEGANT TITLE ====
export const ElegantTitle = ({ children, className = '' }) => {
  return (
    <h1 className={`font-serif tracking-wide text-theme-text ${className}`}>
      {children}
    </h1>
  );
};


// ==== QUICK SWITCHER (Ctrl+O / Ctrl+P) ====
const QuickSwitcher = ({ items, onPick, onClose }) => {
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? items.filter(i => (i.title || '').toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q))
      : [...items].sort((a, b) => new Date(b.created) - new Date(a.created));
    return list.slice(0, 12);
  }, [query, items]);

  useEffect(() => { setIdx(0); }, [query]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[idx]) onPick(results[idx].id);
      else if (query.trim()) onPick(query.trim()); // open/create by name
    } else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4 bg-theme-text/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: -10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: -10 }}
        className="w-full max-w-xl bg-theme-panel border border-theme-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-theme-border">
          <Search size={18} className="text-theme-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Перейти к заметке…"
            className="flex-1 bg-transparent text-theme-text focus:outline-none placeholder-theme-muted/50"
          />
          <kbd className="text-[10px] font-mono text-theme-muted border border-theme-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar py-1">
          {results.map((item, i) => (
            <button
              key={item.id}
              onMouseEnter={() => setIdx(i)}
              onClick={() => onPick(item.id)}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${i === idx ? 'bg-theme-accent/10' : 'hover:bg-theme-text/5'}`}
            >
              <span className="shrink-0">{item.type === 'idea' ? '💡' : item.type === 'task' ? '✅' : item.type === 'interesting' ? '🔖' : item.type === 'link' ? '🔗' : '📝'}</span>
              <span className="flex-1 truncate text-sm text-theme-text">{item.title || 'Без названия'}</span>
              {i === idx && <CornerDownLeft size={14} className="text-theme-muted shrink-0" />}
            </button>
          ))}
          {results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-theme-muted">
              {query.trim() ? <>Нажмите <kbd className="font-mono">Enter</kbd>, чтобы создать «{query.trim()}»</> : 'Нет заметок'}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ==== LINKS PANEL (backlinks + outgoing, Obsidian-style) ====
const LinksPanel = ({ note, graph, items, onOpenNote }) => {
  const [open, setOpen] = useState(true);
  if (!note) return null;
  const backlinks = graph.backlinks.get(note.id) || [];
  const outgoing = (graph.outgoing.get(note.id) || []);
  const total = backlinks.length + outgoing.length;

  return (
    <div className="border-t border-theme-border bg-theme-bg shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2 flex items-center gap-2 text-xs font-bold text-theme-muted hover:text-theme-text transition-colors"
      >
        <Link2 size={14} className="text-theme-accent" />
        Связи
        <span className="ml-1 px-1.5 py-0.5 rounded bg-theme-accent/10 text-theme-accent">{total}</span>
        <span className="ml-auto">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-40 overflow-y-auto custom-scrollbar">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-theme-muted mb-1.5 flex items-center gap-1">
              <CornerDownLeft size={11} /> Обратные ссылки ({backlinks.length})
            </div>
            {backlinks.length === 0 && <div className="text-xs text-theme-muted/60 italic">Нет упоминаний</div>}
            <div className="flex flex-col gap-1">
              {backlinks.map(b => (
                <button key={b.id} onClick={() => onOpenNote(b.title)} className="text-left text-sm text-theme-accent hover:text-theme-accent-hover truncate">
                  ← {b.title}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-theme-muted mb-1.5 flex items-center gap-1">
              <ArrowUpRight size={11} /> Исходящие ({outgoing.length})
            </div>
            {outgoing.length === 0 && <div className="text-xs text-theme-muted/60 italic">Нет ссылок</div>}
            <div className="flex flex-col gap-1">
              {outgoing.map((o, i) => (
                <button key={i} onClick={() => onOpenNote(o.title)} className={`text-left text-sm truncate ${o.id ? 'text-theme-accent hover:text-theme-accent-hover' : 'text-theme-accent/50 italic hover:text-theme-accent'}`}>
                  → {o.alias || o.title}{!o.id && ' (новая)'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==== BASE VIEW (Obsidian-style notes) ====
const BaseView = ({ state, dispatch }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarMode, setSidebarMode] = useState('sections'); // 'sections' | 'structure' | 'tags'
  const [activeSection, setActiveSection] = useState('all');
  const [activeTag, setActiveTag] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [viewMode, setViewMode] = useState('edit'); // 'edit' | 'preview'

  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('idea');
  const [search, setSearch] = useState('');
  const [suggest, setSuggest] = useState(null); // { query } for [[ autocomplete
  const [showSwitcher, setShowSwitcher] = useState(false);

  const taRef = useRef(null);

  const graph = useMemo(() => buildLinkGraph(state.items), [state.items]);
  const tagIndex = useMemo(() => buildTagIndex(state.items), [state.items]);
  const selectedItem = selectedItemId ? state.items.find(i => i.id === selectedItemId) : null;

  // Sync local editor state from selected item
  useEffect(() => {
    if (selectedItemId) {
      const item = state.items.find(i => i.id === selectedItemId);
      if (item) {
        if ((item.title || '') !== title) setTitle(item.title || '');
        if ((item.description || '') !== text) setText(item.description || '');
        setType(item.type || 'idea');
      }
    } else {
      setTitle('');
      setText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId]);

  // Global Quick Switcher shortcut (Ctrl/Cmd + O)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        setShowSwitcher(s => !s);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Live-commit edits to the reducer so links/tags/backlinks stay current.
  const commit = (patch) => {
    if (selectedItemId) dispatch({ type: 'UPDATE_ITEM', payload: { id: selectedItemId, ...patch } });
  };

  const handleTitleChange = (v) => { setTitle(v); commit({ title: v }); };
  const handleTypeChange = (v) => { setType(v); commit({ type: v }); };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    commit({ description: val });
    const pos = e.target.selectionStart;
    const before = val.slice(0, pos);
    const m = before.match(/\[\[([^[\]\n]*)$/);
    setSuggest(m ? { query: m[1] } : null);
  };

  const suggestions = useMemo(() => {
    if (!suggest) return [];
    const q = suggest.query.toLowerCase();
    return state.items
      .filter(it => it.id !== selectedItemId && (it.title || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [suggest, state.items, selectedItemId]);

  const applySuggestion = (linkTitle) => {
    const ta = taRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = text.slice(0, pos).replace(/\[\[([^[\]\n]*)$/, `[[${linkTitle}]]`);
    const after = text.slice(pos);
    const newVal = before + after;
    setText(newVal);
    commit({ description: newVal });
    setSuggest(null);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(before.length, before.length); });
  };

  // Open a note by its title; create it if it doesn't exist (Obsidian behavior).
  const openNote = (noteTitle) => {
    const found = findNoteByTitle(state.items, noteTitle);
    if (found) {
      setSelectedItemId(found.id);
      setViewMode('preview');
      return;
    }
    const id = Date.now();
    dispatch({ type: 'ADD_ITEM', payload: { id, title: noteTitle, description: '', type: 'idea' } });
    setSelectedItemId(id);
    setViewMode('edit');
  };

  const pickFromSwitcher = (idOrTitle) => {
    setShowSwitcher(false);
    if (typeof idOrTitle === 'number') { setSelectedItemId(idOrTitle); setViewMode('preview'); }
    else openNote(idOrTitle);
  };

  const handleNewNote = () => {
    const id = Date.now();
    dispatch({ type: 'ADD_ITEM', payload: { id, title: '', description: '', type } });
    setSelectedItemId(id);
    setViewMode('edit');
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    dispatch({ type: 'DELETE_ITEM', payload: id });
    if (selectedItemId === id) setSelectedItemId(null);
  };

  let filtered = state.items.filter(item =>
    (item.title?.toLowerCase().includes(search.toLowerCase()) ||
     item.description?.toLowerCase().includes(search.toLowerCase()) ||
     item.url?.toLowerCase().includes(search.toLowerCase()))
  );
  if (activeSection !== 'all') filtered = filtered.filter(item => item.type === activeSection);
  if (activeTag) filtered = filtered.filter(item => extractTags(`${item.title || ''}\n${item.description || ''}`).includes(activeTag));
  filtered = filtered.sort((a, b) => new Date(b.created) - new Date(a.created));

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4 animate-in fade-in duration-500">
      <AnimatePresence>
        {showSwitcher && (
          <QuickSwitcher items={state.items} onPick={pickFromSwitcher} onClose={() => setShowSwitcher(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="shrink-0 flex flex-col glass-panel"
          >
            <div className="p-3 border-b border-theme-border grid grid-cols-3 gap-1.5">
              {[['sections', 'Разделы'], ['structure', 'Заметки'], ['tags', 'Теги']].map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setSidebarMode(m)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${sidebarMode === m ? 'bg-theme-accent text-theme-bg shadow-sm' : 'bg-transparent text-theme-muted hover:bg-theme-text/5'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
              {sidebarMode === 'sections' && (
                <>
                  {['all', 'idea', 'task', 'interesting', 'link'].map(sec => (
                    <button
                      key={sec}
                      onClick={() => { setActiveSection(sec); setActiveTag(null); }}
                      className={`flex items-center justify-start gap-2 px-3 py-2 rounded-xl text-sm transition-all ${activeSection === sec && !activeTag ? 'bg-theme-panel text-theme-text border border-theme-accent/30 shadow-sm' : 'text-theme-muted hover:bg-theme-panel/50 hover:text-theme-text border border-transparent'}`}
                    >
                      {sec === 'all' && '📂 Все записи'}
                      {sec === 'idea' && '💡 Идеи'}
                      {sec === 'task' && '✅ Задачи'}
                      {sec === 'interesting' && '🔖 Интересное'}
                      {sec === 'link' && '🔗 Ссылки'}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowSwitcher(true)}
                    className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-theme-muted hover:bg-theme-panel/50 hover:text-theme-text border border-dashed border-theme-border transition-all"
                  >
                    <Command size={13} /> Быстрый переход <kbd className="ml-auto font-mono text-[10px]">Ctrl+O</kbd>
                  </button>
                </>
              )}

              {sidebarMode === 'structure' && (
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
                  {activeTag && (
                    <button onClick={() => setActiveTag(null)} className="mb-1 self-start inline-flex items-center gap-1 text-xs bg-theme-accent/10 text-theme-accent px-2 py-1 rounded-md">
                      #{activeTag} <X size={11} />
                    </button>
                  )}
                  <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                    {filtered.map(item => (
                      <div
                        key={item.id}
                        onClick={() => { setSelectedItemId(item.id); setViewMode('preview'); }}
                        className={`group flex items-center justify-between px-3 py-2 rounded-xl text-sm cursor-pointer transition-all border ${selectedItemId === item.id ? 'bg-theme-panel border-theme-accent/30 text-theme-text shadow-sm' : 'bg-transparent border-transparent text-theme-muted hover:bg-theme-panel/50 hover:text-theme-text'}`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span>{item.type === 'idea' ? '💡' : item.type === 'task' ? '✅' : item.type === 'interesting' ? '🔖' : item.type === 'link' ? '🔗' : '📝'}</span>
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

              {sidebarMode === 'tags' && (
                <div className="flex flex-wrap gap-1.5 content-start">
                  {tagIndex.length === 0 && <div className="text-center text-theme-muted text-xs mt-4 w-full">Нет тегов. Добавьте #тег в заметку.</div>}
                  {tagIndex.map(([tag, count]) => (
                    <button
                      key={tag}
                      onClick={() => { setActiveTag(tag); setActiveSection('all'); setSidebarMode('structure'); }}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${activeTag === tag ? 'bg-theme-accent text-theme-bg' : 'bg-theme-accent/10 text-theme-accent hover:bg-theme-accent/20'}`}
                    >
                      <Hash size={11} />{tag}<span className="opacity-60">{count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-theme-border shrink-0">
              <button
                onClick={handleNewNote}
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
              onChange={e => handleTypeChange(e.target.value)}
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
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Заголовок..."
              className="flex-1 bg-transparent text-theme-text font-serif font-bold px-2 py-1 focus:outline-none placeholder-theme-muted/40 min-w-0"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex bg-theme-panel border border-theme-border rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('edit')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'edit' ? 'bg-theme-accent text-theme-bg shadow-sm' : 'text-theme-muted hover:text-theme-text'}`}
                title="Редактировать"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'preview' ? 'bg-theme-accent text-theme-bg shadow-sm' : 'text-theme-muted hover:text-theme-text'}`}
                title="Просмотр"
              >
                <Eye size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-theme-panel overflow-hidden relative">
          {viewMode === 'edit' ? (
            <div className="flex-1 p-4 flex flex-col relative overflow-hidden">
              <textarea
                ref={taRef}
                value={text}
                onChange={handleTextChange}
                onBlur={() => setTimeout(() => setSuggest(null), 150)}
                placeholder="Начните писать… Используйте # для заголовков, **жирный**, - списки, [[ссылки]] и #теги."
                className="flex-1 w-full bg-transparent text-theme-text placeholder-theme-muted/30 focus:outline-none resize-none custom-scrollbar leading-relaxed font-mono text-sm"
              />
              {suggest && suggestions.length > 0 && (
                <div className="absolute left-4 bottom-4 z-20 w-72 max-h-56 overflow-y-auto custom-scrollbar bg-theme-panel border border-theme-border rounded-xl shadow-2xl py-1">
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-theme-muted">Связать с заметкой</div>
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      onMouseDown={(e) => { e.preventDefault(); applySuggestion(s.title); }}
                      className="w-full text-left px-3 py-2 text-sm text-theme-text hover:bg-theme-accent/10 truncate flex items-center gap-2"
                    >
                      <FileText size={14} className="text-theme-accent shrink-0" />{s.title || 'Без названия'}
                    </button>
                  ))}
                  {suggest.query.trim() && !findNoteByTitle(state.items, suggest.query) && (
                    <button
                      onMouseDown={(e) => { e.preventDefault(); applySuggestion(suggest.query.trim()); }}
                      className="w-full text-left px-3 py-2 text-sm text-theme-accent hover:bg-theme-accent/10 truncate flex items-center gap-2 border-t border-theme-border"
                    >
                      <Plus size={14} className="shrink-0" />Создать «{suggest.query.trim()}»
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
              {(title || text) ? (
                <>
                  {title && <h1 className="font-serif font-bold text-2xl text-theme-text mb-3">{title}</h1>}
                  <Markdown content={text} items={state.items} onOpenNote={openNote} onTagClick={(t) => { setActiveTag(t); setSidebarMode('structure'); }} />
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                  <FileText size={48} className="text-theme-accent mb-3" />
                  <p className="text-theme-muted italic font-serif">Пустая заметка. Переключитесь в режим редактирования.</p>
                </div>
              )}
            </div>
          )}

          <LinksPanel note={selectedItem} graph={graph} items={state.items} onOpenNote={openNote} />
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

