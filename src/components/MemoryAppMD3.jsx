import React, { useState, useEffect } from 'react';
import { Menu, X, Database, FolderOpen, GitBranch, Image as ImageIcon, Zap, Settings, Plus, Search, Tag, Link2, ChevronRight, ArrowLeft } from 'lucide-react';

const MD3_COLORS = {
  primary: '#D0BCFF',
  primaryContainer: '#6750A4',
  secondary: '#CCC2DC',
  secondaryContainer: '#4A4458',
  tertiary: '#EFB8C8',
  tertiaryContainer: '#633B48',
  error: '#F2B8B5',
  errorContainer: '#8C1D18',
  background: '#1C1B1F',
  surface: '#1C1B1F',
  surfaceVariant: '#49454E',
  outline: '#79747E',
  outlineVariant: '#49454E',
  scrim: 'rgba(0, 0, 0, 0.4)',
  onBackground: '#E6E1E5',
  onSurface: '#E6E1E5',
  onSurfaceVariant: '#CAC7D0',
};

const DBManager = {
  dbName: 'MemoryAppDB',
  storeName: 'data',

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  },

  async save(key, data, password) {
    const db = await this.init();
    const encrypted = await this.encrypt(JSON.stringify(data), password);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(encrypted, key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  },

  async load(key, password) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        if (request.result) {
          try {
            const decrypted = await this.decrypt(request.result, password);
            resolve(JSON.parse(decrypted));
          } catch (e) {
            reject(new Error('Неправильный пароль'));
          }
        } else {
          resolve(null);
        }
      };
    });
  },

  async encrypt(text, password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    const derivedKey = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBuffer, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await crypto.subtle.importKey('raw', derivedKey, 'AES-GCM', false, ['encrypt']);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const combined = new Uint8Array(saltBuffer.length + iv.length + encrypted.byteLength);
    combined.set(saltBuffer, 0);
    combined.set(iv, saltBuffer.length);
    combined.set(new Uint8Array(encrypted), saltBuffer.length + iv.length);
    return btoa(String.fromCharCode(...combined));
  },

  async decrypt(encoded, password) {
    const combined = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const saltBuffer = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    const derivedKey = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBuffer, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
    const key = await crypto.subtle.importKey('raw', derivedKey, 'AES-GCM', false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
  }
};

export default function MemoryAppMD3() {
  const [activeTab, setActiveTab] = useState('Данные');
  const [dataSubmenu, setDataSubmenu] = useState(false);
  const [selectedDataItem, setSelectedDataItem] = useState('Заметки');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [password, setPassword] = useState(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');

  const [projects, setProjects] = useState([
    {
      id: 1,
      name: 'Memory App',
      description: 'Приложение для управления заметками',
      created: '2024-01-10',
      tasks: [
        { id: 1, title: 'Система заметок', description: 'Создать функционал заметок', status: 'done', priority: 'high', created: '2024-01-10' },
        { id: 2, title: 'Шифрование БД', description: 'AES-256', status: 'done', priority: 'high', created: '2024-01-12' },
        { id: 3, title: 'Material Design 3', description: 'Обновить стиль', status: 'in_progress', priority: 'medium', created: '2024-01-20' }
      ]
    }
  ]);

  const [notes, setNotes] = useState([
    { id: 1, title: 'React Hooks', content: 'useState, useEffect\n[[Custom Hooks]]\n#react #frontend', tags: ['react', 'frontend'], links: ['Custom Hooks'], created: '2024-01-15' },
    { id: 2, title: 'Design System', content: 'Material Design 3\n#design #ui', tags: ['design', 'ui'], links: [], created: '2024-01-20' }
  ]);

  const [currentProject, setCurrentProject] = useState(null);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(!showCommandPalette);
        setCommandSearch('');
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCommandPalette]);

  useEffect(() => {
    loadDataFromDB();
  }, [password]);

  const loadDataFromDB = async () => {
    if (!password) return;
    try {
      const savedData = await DBManager.load('appdata', password);
      if (savedData) {
        if (savedData.notes) setNotes(savedData.notes);
        if (savedData.projects) setProjects(savedData.projects);
      }
    } catch (e) {
      console.error('Ошибка загрузки:', e.message);
    }
  };

  const saveToDBAsync = async (updatedNotes) => {
    if (!password) return;
    try {
      const appData = { notes: updatedNotes, projects };
      await DBManager.save('appdata', appData, password);
    } catch (e) {
      console.error('Ошибка сохранения:', e.message);
    }
  };

  const handleUnlock = async () => {
    if (!passwordInput.trim()) {
      alert('Введи пароль');
      return;
    }
    try {
      const savedData = await DBManager.load('appdata', passwordInput);
      setPassword(passwordInput);
      setShowPasswordPrompt(false);
      if (savedData) {
        if (savedData.notes) setNotes(savedData.notes);
        if (savedData.projects) setProjects(savedData.projects);
      }
    } catch (e) {
      alert('Неправильный пароль');
      setPasswordInput('');
    }
  };

  const handleAddNote = () => {
    const newNote = {
      id: Math.max(...notes.map(n => n.id), 0) + 1,
      title: 'Новая заметка',
      content: '',
      tags: [],
      links: [],
      created: new Date().toISOString().split('T')[0]
    };
    const updatedNotes = [...notes, newNote];
    setNotes(updatedNotes);
    setSelectedNote(newNote.id);
    saveToDBAsync(updatedNotes);
  };

  const handleUpdateNote = (updatedContent) => {
    const tagMatches = updatedContent.match(/#\w+/g) || [];
    const linkMatches = updatedContent.match(/\[\[([^\]]+)\]\]/g) || [];
    const updatedNotes = notes.map(n =>
      n.id === selectedNote ? {
        ...n,
        content: updatedContent,
        tags: tagMatches.map(t => t.slice(1)),
        links: linkMatches.map(l => l.slice(2, -2))
      } : n
    );
    setNotes(updatedNotes);
    saveToDBAsync(updatedNotes);
  };

  // ==== ЭКРАН РАЗБЛОКИРОВКИ ====
  if (showPasswordPrompt) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center" style={{ backgroundColor: MD3_COLORS.background }}>
        <style>{`body { background-color: ${MD3_COLORS.background}; }`}</style>
        <div className="w-full max-w-md mx-4">
          <div className="rounded-3xl shadow-2xl p-8" style={{
            backgroundColor: MD3_COLORS.surface,
            border: `1px solid ${MD3_COLORS.outlineVariant}20`
          }}>
            <h1 className="text-4xl font-bold text-center mb-2" style={{ color: MD3_COLORS.primary }}>
              Memory App
            </h1>
            <p className="text-center mb-8" style={{ color: MD3_COLORS.onSurfaceVariant }}>
              Локальная зашифрованная база данных
            </p>
            <div className="space-y-4">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleUnlock()}
                placeholder="Введи пароль..."
                className="w-full p-4 rounded-2xl focus:outline-none transition text-sm"
                style={{
                  backgroundColor: MD3_COLORS.surfaceVariant,
                  color: MD3_COLORS.onSurface,
                  border: `2px solid ${MD3_COLORS.outline}40`
                }}
                autoFocus
              />
              <button
                onClick={handleUnlock}
                className="w-full py-3 font-semibold rounded-2xl transition hover:shadow-lg text-sm"
                style={{ backgroundColor: MD3_COLORS.primary, color: MD3_COLORS.primaryContainer }}
              >
                Разблокировать
              </button>
              <p className="text-xs text-center mt-6" style={{ color: MD3_COLORS.onSurfaceVariant }}>
                ✓ AES-256 шифрование<br />
                ✓ Локальное хранилище<br />
                ✓ PBKDF2 ключи
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==== COMMAND PALETTE ====
  const CommandPalette = () => {
    const commands = [
      { id: 'data-ideas', label: 'Данные: Идеи', action: () => { setActiveTab('Данные'); setSelectedDataItem('Идеи'); setDataSubmenu(true); setShowCommandPalette(false); }, icon: '💡' },
      { id: 'data-tasks', label: 'Данные: Задачи', action: () => { setActiveTab('Данные'); setSelectedDataItem('Задачи'); setDataSubmenu(true); setShowCommandPalette(false); }, icon: '✓' },
      { id: 'data-notes', label: 'Данные: Заметки', action: () => { setActiveTab('Данные'); setSelectedDataItem('Заметки'); setDataSubmenu(true); setShowCommandPalette(false); }, icon: '📝' },
      { id: 'data-links', label: 'Данные: Ссылки', action: () => { setActiveTab('Данные'); setSelectedDataItem('Ссылки'); setDataSubmenu(true); setShowCommandPalette(false); }, icon: '🔗' },
      { id: 'data-interesting', label: 'Данные: Интересное', action: () => { setActiveTab('Данные'); setSelectedDataItem('Интересное'); setDataSubmenu(true); setShowCommandPalette(false); }, icon: '⭐' },
      { id: 'sep1', isSeparator: true },
      { id: 'projects', label: 'Перейти в Проекты', action: () => { setActiveTab('Проекты'); setShowCommandPalette(false); }, icon: '📁' },
      { id: 'mindmap', label: 'Перейти в MindMap', action: () => { setActiveTab('MindMap'); setShowCommandPalette(false); }, icon: '🧠' },
      { id: 'gallery', label: 'Перейти в Галерею', action: () => { setActiveTab('Галерея'); setShowCommandPalette(false); }, icon: '🖼' },
      { id: 'ai', label: 'Перейти в AI', action: () => { setActiveTab('AI'); setShowCommandPalette(false); }, icon: '⚡' },
      { id: 'settings', label: 'Перейти в Настройки', action: () => { setActiveTab('Настройки'); setShowCommandPalette(false); }, icon: '⚙' },
      { id: 'sep2', isSeparator: true },
      { id: 'new-note', label: 'Создать новую заметку', action: () => { setActiveTab('Данные'); setSelectedDataItem('Заметки'); setDataSubmenu(true); handleAddNote(); setShowCommandPalette(false); }, icon: '✨' },
      { id: 'sep3', isSeparator: true },
      { id: 'logout', label: 'Выход', action: () => { setPassword(null); setShowPasswordPrompt(true); setShowCommandPalette(false); }, icon: '🚪' }
    ];

    const filteredCommands = commands.filter(cmd => cmd.isSeparator || cmd.label.toLowerCase().includes(commandSearch.toLowerCase()));

    return (
      <div className="fixed inset-0 z-50 flex items-end" style={{ backgroundColor: MD3_COLORS.scrim }}>
        <div className="w-full rounded-t-3xl shadow-2xl max-h-96 overflow-hidden flex flex-col" style={{ backgroundColor: MD3_COLORS.surface }}>
          <div className="p-4 border-b" style={{ borderColor: MD3_COLORS.outlineVariant + '40' }}>
            <input
              type="text"
              placeholder="Команда или раздел..."
              value={commandSearch}
              onChange={(e) => setCommandSearch(e.target.value)}
              className="w-full p-3 rounded-2xl focus:outline-none text-sm transition"
              style={{
                backgroundColor: MD3_COLORS.surfaceVariant,
                color: MD3_COLORS.onSurface,
                border: `2px solid ${MD3_COLORS.outline}40`
              }}
              autoFocus
            />
            <p className="text-xs mt-2" style={{ color: MD3_COLORS.onSurfaceVariant }}>Нажми Esc для закрытия</p>
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredCommands.map((cmd) => {
              if (cmd.isSeparator) {
                return <div key={cmd.id} className="my-1" style={{ borderTop: `1px solid ${MD3_COLORS.outlineVariant}40` }} />;
              }
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  className="w-full text-left px-4 py-3 transition flex items-center gap-3 text-sm hover:opacity-80"
                  style={{ color: MD3_COLORS.onSurface }}
                >
                  <span className="text-lg">{cmd.icon}</span>
                  <span className="font-medium">{cmd.label}</span>
                </button>
              );
            })}
          </div>
          <div className="p-3 border-t text-xs" style={{ borderColor: MD3_COLORS.outlineVariant + '40', backgroundColor: MD3_COLORS.surfaceVariant + '40', color: MD3_COLORS.onSurfaceVariant }}>
            Tip: Ctrl+K (Cmd+K на Mac) в любой момент
          </div>
        </div>
      </div>
    );
  };

  // ==== NOTES VIEW ====
  const NotesView = () => (
    <div className="flex h-full" style={{ backgroundColor: MD3_COLORS.background }}>
      {/* Sidebar */}
      <div className="w-64 border-r flex-col hidden sm:flex" style={{ borderColor: MD3_COLORS.outlineVariant + '40', backgroundColor: MD3_COLORS.background }}>
        <div className="p-4 border-b" style={{ borderColor: MD3_COLORS.outlineVariant + '40' }}>
          <div className="flex items-center gap-2 p-2 rounded-2xl" style={{ backgroundColor: MD3_COLORS.surfaceVariant }}>
            <Search size={16} style={{ color: MD3_COLORS.onSurfaceVariant }} />
            <input type="text" placeholder="Поиск..." className="flex-1 outline-none text-sm rounded-lg" style={{ backgroundColor: 'transparent', color: MD3_COLORS.onSurface }} />
          </div>
        </div>

        <button
          onClick={handleAddNote}
          className="m-4 p-2 rounded-2xl transition hover:shadow-lg text-sm font-semibold flex items-center justify-center gap-2"
          style={{ backgroundColor: MD3_COLORS.primary, color: MD3_COLORS.primaryContainer }}
        >
          <Plus size={18} /> Новая
        </button>

        <div className="px-4 pb-4 space-y-2">
          {[
            { title: '🔖 Закладка', tags: ['bookmark', 'интересное'], bg: MD3_COLORS.tertiaryContainer },
            { title: '📌 Идея', tags: ['идея', 'идеи'], bg: MD3_COLORS.secondaryContainer },
            { title: '✓ Задача', tags: ['задача', 'todo'], bg: MD3_COLORS.errorContainer }
          ].map(template => (
            <button
              key={template.title}
              onClick={() => {
                const newNote = {
                  id: Math.max(...notes.map(n => n.id), 0) + 1,
                  title: template.title,
                  content: template.tags.map(t => `#${t}`).join(' '),
                  tags: template.tags,
                  links: [],
                  created: new Date().toISOString().split('T')[0]
                };
                const updated = [...notes, newNote];
                setNotes(updated);
                setSelectedNote(newNote.id);
                saveToDBAsync(updated);
              }}
              className="w-full px-2 py-1.5 rounded-xl text-xs hover:opacity-80 transition font-medium"
              style={{ backgroundColor: template.bg, color: MD3_COLORS.onSurface }}
            >
              {template.title}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {notes.map(note => (
            <button
              key={note.id}
              onClick={() => setSelectedNote(note.id)}
              className="w-full text-left p-3 rounded-xl transition"
              style={{
                backgroundColor: selectedNote === note.id ? MD3_COLORS.primaryContainer + '40' : 'transparent',
                borderLeft: selectedNote === note.id ? `3px solid ${MD3_COLORS.primary}` : 'none',
                color: MD3_COLORS.onSurface
              }}
            >
              <p className="font-semibold text-sm truncate">{note.title}</p>
              <p className="text-xs" style={{ color: MD3_COLORS.onSurfaceVariant }}>{note.created}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            {/* Note header */}
            <div
              className="border-b p-4 flex items-center justify-between sticky top-0 z-10"
              style={{ borderColor: MD3_COLORS.outlineVariant + '40', backgroundColor: MD3_COLORS.surface + 'e6', backdropFilter: 'blur(10px)' }}
            >
              <input
                type="text"
                value={notes.find(n => n.id === selectedNote)?.title || ''}
                onChange={(e) => setNotes(notes.map(n => n.id === selectedNote ? { ...n, title: e.target.value } : n))}
                className="text-2xl font-bold outline-none flex-1"
                style={{ backgroundColor: 'transparent', color: MD3_COLORS.onSurface }}
              />
              <button
                onClick={() => setEditMode(!editMode)}
                className="px-4 py-2 rounded-2xl text-sm ml-4 transition hover:shadow-lg font-semibold"
                style={{ backgroundColor: MD3_COLORS.primary, color: MD3_COLORS.primaryContainer }}
              >
                {editMode ? 'Просмотр' : 'Редактор'}
              </button>
            </div>

            {/* Note body */}
            <div className="flex-1 p-6 overflow-auto">
              {editMode ? (
                <textarea
                  value={notes.find(n => n.id === selectedNote)?.content || ''}
                  onChange={(e) => handleUpdateNote(e.target.value)}
                  className="w-full h-full p-4 rounded-2xl font-mono text-sm resize-none outline-none transition"
                  style={{
                    backgroundColor: MD3_COLORS.surfaceVariant,
                    color: MD3_COLORS.onSurface,
                    border: `2px solid ${MD3_COLORS.outline}40`,
                    minHeight: '300px'
                  }}
                  placeholder="Напиши заметку..."
                />
              ) : (
                <div>
                  {/* Rendered content with #tags and [[links]] */}
                  <div className="space-y-2 mb-6">
                    {(notes.find(n => n.id === selectedNote)?.content || '').split('\n').map((line, i) => {
                      const parts = line.split(/(#\w+|\[\[[^\]]+\]\])/g);
                      return (
                        <p key={i} className="text-sm leading-relaxed" style={{ color: MD3_COLORS.onSurface }}>
                          {parts.map((part, j) => {
                            if (part.startsWith('#')) {
                              return (
                                <span
                                  key={j}
                                  className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold mr-1"
                                  style={{ backgroundColor: MD3_COLORS.secondaryContainer, color: MD3_COLORS.secondary }}
                                >
                                  {part}
                                </span>
                              );
                            }
                            if (part.startsWith('[[')) {
                              const linkText = part.slice(2, -2);
                              return (
                                <button
                                  key={j}
                                  onClick={() => {
                                    const linked = notes.find(n => n.title === linkText);
                                    if (linked) setSelectedNote(linked.id);
                                  }}
                                  className="font-medium underline mx-0.5 hover:opacity-70 transition"
                                  style={{ color: MD3_COLORS.primary }}
                                >
                                  {linkText}
                                </button>
                              );
                            }
                            return <span key={j}>{part}</span>;
                          })}
                        </p>
                      );
                    })}
                  </div>

                  {/* Tags */}
                  {(notes.find(n => n.id === selectedNote)?.tags || []).length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <Tag size={14} style={{ color: MD3_COLORS.onSurfaceVariant }} />
                      {notes.find(n => n.id === selectedNote).tags.map(tag => (
                        <span
                          key={tag}
                          className="px-3 py-1 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: MD3_COLORS.secondaryContainer, color: MD3_COLORS.secondary }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Links */}
                  {(notes.find(n => n.id === selectedNote)?.links || []).length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Link2 size={14} style={{ color: MD3_COLORS.onSurfaceVariant }} />
                      {notes.find(n => n.id === selectedNote).links.map(link => (
                        <button
                          key={link}
                          onClick={() => {
                            const linked = notes.find(n => n.title === link);
                            if (linked) setSelectedNote(linked.id);
                          }}
                          className="px-3 py-1 rounded-full text-xs font-semibold transition hover:opacity-80"
                          style={{ backgroundColor: MD3_COLORS.primaryContainer + '40', color: MD3_COLORS.primary }}
                        >
                          [[{link}]]
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color: MD3_COLORS.onSurfaceVariant }}>
            <div className="text-center">
              <p className="text-lg font-semibold mb-2">Выберите заметку</p>
              <p className="text-sm opacity-60">или создайте новую</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ==== PROJECTS VIEW ====
  const ProjectsView = () => {
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');

    const addProject = () => {
      if (!newName.trim()) return;
      setProjects([...projects, {
        id: Date.now(),
        name: newName,
        description: newDesc,
        created: new Date().toISOString().split('T')[0],
        tasks: []
      }]);
      setNewName('');
      setNewDesc('');
      setShowNewProjectForm(false);
    };

    return (
      <div className="p-6 space-y-4" style={{ color: MD3_COLORS.onSurface }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Проекты</h2>
          <button
            onClick={() => setShowNewProjectForm(!showNewProjectForm)}
            className="px-4 py-2 rounded-2xl text-sm font-semibold flex items-center gap-2 transition hover:shadow-lg"
            style={{ backgroundColor: MD3_COLORS.primary, color: MD3_COLORS.primaryContainer }}
          >
            <Plus size={16} /> Новый
          </button>
        </div>

        {showNewProjectForm && (
          <div className="p-4 rounded-2xl space-y-3" style={{ backgroundColor: MD3_COLORS.surfaceVariant }}>
            <input
              type="text"
              placeholder="Название проекта..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full p-3 rounded-xl outline-none text-sm"
              style={{ backgroundColor: MD3_COLORS.background, color: MD3_COLORS.onSurface }}
              autoFocus
            />
            <input
              type="text"
              placeholder="Описание..."
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="w-full p-3 rounded-xl outline-none text-sm"
              style={{ backgroundColor: MD3_COLORS.background, color: MD3_COLORS.onSurface }}
            />
            <div className="flex gap-2">
              <button
                onClick={addProject}
                className="flex-1 py-2 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: MD3_COLORS.primary, color: MD3_COLORS.primaryContainer }}
              >
                Создать
              </button>
              <button
                onClick={() => setShowNewProjectForm(false)}
                className="flex-1 py-2 rounded-xl text-sm"
                style={{ backgroundColor: MD3_COLORS.surfaceVariant, color: MD3_COLORS.onSurfaceVariant }}
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {projects.map(project => (
            <div
              key={project.id}
              className="p-4 rounded-2xl cursor-pointer transition hover:opacity-90"
              style={{ backgroundColor: MD3_COLORS.surfaceVariant }}
              onClick={() => setCurrentProject(project.id === currentProject ? null : project.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{project.name}</p>
                  {project.description && (
                    <p className="text-xs mt-1" style={{ color: MD3_COLORS.onSurfaceVariant }}>{project.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: MD3_COLORS.secondaryContainer, color: MD3_COLORS.secondary }}>
                    {project.tasks?.length || 0} задач
                  </span>
                  <ChevronRight size={16} style={{ color: MD3_COLORS.onSurfaceVariant, transform: currentProject === project.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>
              </div>

              {currentProject === project.id && (
                <div className="mt-4 space-y-2">
                  {(project.tasks || []).map(task => (
                    <div key={task.id} className="flex items-center gap-3 p-2 rounded-xl" style={{ backgroundColor: MD3_COLORS.background }}>
                      <span className="text-lg">{task.status === 'done' ? '✓' : task.status === 'in_progress' ? '⏳' : '○'}</span>
                      <div>
                        <p className="text-xs font-medium">{task.title}</p>
                        <p className="text-xs" style={{ color: MD3_COLORS.onSurfaceVariant }}>{task.description}</p>
                      </div>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{
                        backgroundColor: task.priority === 'high' ? MD3_COLORS.errorContainer : task.priority === 'medium' ? MD3_COLORS.tertiaryContainer : MD3_COLORS.secondaryContainer,
                        color: task.priority === 'high' ? MD3_COLORS.error : task.priority === 'medium' ? MD3_COLORS.tertiary : MD3_COLORS.secondary
                      }}>
                        {task.priority}
                      </span>
                    </div>
                  ))}
                  {(project.tasks || []).length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: MD3_COLORS.onSurfaceVariant }}>Задач нет</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {projects.length === 0 && (
            <div className="text-center py-12" style={{ color: MD3_COLORS.onSurfaceVariant }}>
              <p className="text-4xl mb-3">📁</p>
              <p className="text-sm">Нет проектов</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==== PLACEHOLDER VIEW ====
  const PlaceholderView = ({ icon, label }) => (
    <div className="flex-1 flex items-center justify-center" style={{ color: MD3_COLORS.onSurfaceVariant }}>
      <div className="text-center">
        <p className="text-5xl mb-4">{icon}</p>
        <p className="text-lg font-semibold">{label}</p>
        <p className="text-sm opacity-60 mt-1">В разработке</p>
      </div>
    </div>
  );

  // ==== NAVIGATION ====
  const navItems = [
    { id: 'Данные', icon: <Database size={20} />, label: 'Данные' },
    { id: 'Проекты', icon: <FolderOpen size={20} />, label: 'Проекты' },
    { id: 'MindMap', icon: <GitBranch size={20} />, label: 'MindMap' },
    { id: 'Галерея', icon: <ImageIcon size={20} />, label: 'Галерея' },
    { id: 'AI', icon: <Zap size={20} />, label: 'AI' },
    { id: 'Настройки', icon: <Settings size={20} />, label: 'Настройки' },
  ];

  // ==== MAIN RENDER ====
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: MD3_COLORS.background }}>
      <style>{`body { background-color: ${MD3_COLORS.background}; margin: 0; }`}</style>

      {/* Command Palette */}
      {showCommandPalette && <CommandPalette />}

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 sm:hidden"
          style={{ backgroundColor: MD3_COLORS.scrim }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed sm:relative z-50 sm:z-auto flex flex-col h-full w-64 shrink-0 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}`}
        style={{ backgroundColor: MD3_COLORS.surface, borderRight: `1px solid ${MD3_COLORS.outlineVariant}40` }}
      >
        {/* Logo */}
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-widest" style={{ color: MD3_COLORS.primary }}>MEMORY</h1>
          <button className="sm:hidden p-1" onClick={() => setSidebarOpen(false)} style={{ color: MD3_COLORS.onSurfaceVariant }}>
            <X size={20} />
          </button>
        </div>

        {/* Cmd palette hint */}
        <button
          onClick={() => { setShowCommandPalette(true); setSidebarOpen(false); }}
          className="mx-4 mb-4 p-3 rounded-2xl flex items-center gap-2 text-sm transition hover:opacity-80"
          style={{ backgroundColor: MD3_COLORS.surfaceVariant, color: MD3_COLORS.onSurfaceVariant }}
        >
          <Search size={16} />
          <span>Поиск...</span>
          <span className="ml-auto text-xs opacity-60">Ctrl+K</span>
        </button>

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition"
              style={{
                backgroundColor: activeTab === item.id ? MD3_COLORS.primaryContainer + '30' : 'transparent',
                color: activeTab === item.id ? MD3_COLORS.primary : MD3_COLORS.onSurfaceVariant
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Lock */}
        <div className="p-4">
          <button
            onClick={() => { setPassword(null); setShowPasswordPrompt(true); }}
            className="w-full py-2 rounded-2xl text-sm font-semibold transition hover:opacity-80"
            style={{ backgroundColor: MD3_COLORS.errorContainer, color: MD3_COLORS.error }}
          >
            Заблокировать
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header
          className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
          style={{ borderColor: MD3_COLORS.outlineVariant + '40', backgroundColor: MD3_COLORS.surface }}
        >
          <button
            className="sm:hidden p-2 rounded-xl"
            style={{ color: MD3_COLORS.onSurfaceVariant }}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <h2 className="text-sm font-semibold" style={{ color: MD3_COLORS.onSurface }}>
            {activeTab}
            {activeTab === 'Данные' && ` / ${selectedDataItem}`}
          </h2>

          {/* Data submenu */}
          {activeTab === 'Данные' && (
            <div className="flex gap-1 ml-4 overflow-x-auto">
              {['Заметки', 'Идеи', 'Задачи', 'Ссылки', 'Интересное'].map(item => (
                <button
                  key={item}
                  onClick={() => setSelectedDataItem(item)}
                  className="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition"
                  style={{
                    backgroundColor: selectedDataItem === item ? MD3_COLORS.primaryContainer : MD3_COLORS.surfaceVariant,
                    color: selectedDataItem === item ? MD3_COLORS.primary : MD3_COLORS.onSurfaceVariant
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-hidden">
          {activeTab === 'Данные' && selectedDataItem === 'Заметки' && <NotesView />}
          {activeTab === 'Данные' && selectedDataItem !== 'Заметки' && (
            <PlaceholderView icon="📂" label={selectedDataItem} />
          )}
          {activeTab === 'Проекты' && <ProjectsView />}
          {activeTab === 'MindMap' && <PlaceholderView icon="🧠" label="MindMap" />}
          {activeTab === 'Галерея' && <PlaceholderView icon="🖼️" label="Галерея" />}
          {activeTab === 'AI' && <PlaceholderView icon="⚡" label="AI Ассистент" />}
          {activeTab === 'Настройки' && (
            <div className="p-6" style={{ color: MD3_COLORS.onSurface }}>
              <h2 className="text-xl font-bold mb-6">Настройки</h2>
              <div className="p-4 rounded-2xl space-y-2" style={{ backgroundColor: MD3_COLORS.surfaceVariant }}>
                <p className="text-sm font-medium">Безопасность</p>
                <p className="text-xs" style={{ color: MD3_COLORS.onSurfaceVariant }}>
                  AES-256 · PBKDF2 · 100 000 итераций
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
