import React, { useState, useEffect } from 'react';
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

const FREE_TEXT_MODEL_PRESETS = [
  { value: 'llama3.2:3b', label: 'Llama 3.2 3B' },
  { value: 'qwen2.5:3b', label: 'Qwen 2.5 3B' },
  { value: 'gemma2:2b', label: 'Gemma 2 2B' },
  { value: 'phi3:mini', label: 'Phi-3 Mini' },
];

// ==== OMNI AI VIEW (Mind Extractor) ====
const OmniView = ({ state, dispatch }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [freeModels, setFreeModels] = useState([]);
  const [freeModelsLoading, setFreeModelsLoading] = useState(false);
  const [freeModelsError, setFreeModelsError] = useState('');

  const history = state.cerberHistory || [];
  const assistantProvider = state.settings?.assistantProvider || 'omni';
  const selectedFreeModel = state.settings?.freeTextModel || FREE_TEXT_MODEL_PRESETS[0].value;
  const isLocalModelMode = assistantProvider === 'ollama';
  const isGeminiMode = assistantProvider === 'gemini';

  const freeModelOptions = [
    ...freeModels.map((model) => ({ value: model.name, label: model.name })),
    ...FREE_TEXT_MODEL_PRESETS.filter((preset) => !freeModels.some((model) => model.name === preset.value)),
  ];

  const updateAssistantSettings = (payload) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload });
  };

  const loadFreeModels = React.useCallback(async () => {
    setFreeModelsLoading(true);
    setFreeModelsError('');

    try {
      const response = await fetch('/api/ollama/models');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Не удалось загрузить бесплатные модели');
      }

      const models = Array.isArray(data.models) ? data.models : [];
      setFreeModels(models);
      if (models.length === 0) {
        setFreeModelsError('Ollama доступен, но моделей пока нет. Например: ollama pull llama3.2:3b');
      }
    } catch (error) {
      setFreeModels([]);
      setFreeModelsError(error.message || 'Не удалось подключиться к Ollama');
    } finally {
      setFreeModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadFreeModels();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadFreeModels]);

  const parseActions = (text) => {
    const actions = [];
    const reminderRegex = /set_reminder\s*\(\s*task\s*=\s*["']([^"']+)["']\s*(?:,\s*date_time_str\s*=\s*["']([^"']+)["'])?\s*\)/g;
    let match;
    while ((match = reminderRegex.exec(text)) !== null) {
      actions.push({ type: 'ADD_ITEM', payload: { title: match[1], type: 'task', content: match[2] || 'Извлечено через ассистента' } });
    }

    if (text.toLowerCase().includes('создать проект') || text.toLowerCase().includes('create project')) {
      const projectMatch = text.match(/(?:проект|project)\s*["']([^"']+)["']/i);
      if (projectMatch) {
        actions.push({ type: 'ADD_PROJECT', payload: { name: projectMatch[1], description: 'Инициировано AI-ассистентом' } });
      }
    }

    return actions;
  };

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

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    const requestPath = isGeminiMode ? '/api/gemini/chat' : isLocalModelMode ? '/api/ollama' : '/api/omni';
    const requestBody = isGeminiMode
      ? { text: userMsg, history: history.filter(m => ['user', 'assistant'].includes(m.role)) }
      : isLocalModelMode
        ? { prompt: userMsg, model: selectedFreeModel }
        : { text: userMsg };

    setInput('');

    dispatch({
      type: 'ADD_CERBER_MSG',
      payload: { role: 'user', content: userMsg, timestamp: new Date().toISOString() }
    });

    setLoading(true);
    try {
      const response = await fetch(requestPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      let aiText = isGeminiMode
        ? 'Gemini не вернул ответ.'
        : isLocalModelMode
          ? 'Локальная модель не вернула текст.'
          : 'Извините, ядро OMNI не ответило.';

      if (response.ok) {
        aiText = isGeminiMode
          ? (data.response || '').trim() || aiText
          : isLocalModelMode
            ? (data.response || '').trim() || aiText
            : extractOmniText(data) || JSON.stringify(data);
      } else if (data.error) {
        const errorText = typeof data.error === 'string'
         ? data.error
         : data.error.message || JSON.stringify(data.error);
        const errorDetails = data.message ? ` — ${data.message}` : '';
        aiText = isGeminiMode
         ? `Ошибка Gemini: ${errorText}${errorDetails}`
         : isLocalModelMode
           ? `Ошибка локальной модели: ${errorText}${errorDetails}`
           : `Ошибка ядра: ${errorText}`;
      }

      dispatch({
        type: 'ADD_CERBER_MSG',
        payload: {
         role: 'assistant',
         content: aiText,
         timestamp: new Date().toISOString(),
         actions: parseActions(aiText),
         provider: isGeminiMode ? 'gemini' : isLocalModelMode ? 'ollama' : 'omni',
         model: isGeminiMode ? (data.model || 'gemini') : isLocalModelMode ? selectedFreeModel : 'omni-core'
        }
      });
    } catch {
      dispatch({
        type: 'ADD_CERBER_MSG',
        payload: {
         role: 'system',
         content: isGeminiMode
           ? 'Ошибка связи с Gemini. Проверьте API Key или авторизацию Google.'
           : isLocalModelMode
             ? 'Ошибка связи с локальной моделью. Проверьте, что Ollama запущен.'
             : 'Ошибка связи с ядром OMNI. Проверьте соединение.',
         timestamp: new Date().toISOString()
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const executeAction = (action) => {
    dispatch(action);
    alert(`Выполнено: ${action.type === 'ADD_ITEM' ? 'Задача создана' : 'Проект создан'}`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] animate-in fade-in duration-500">
      <div className="bg-theme-panel border-b-0 border border-theme-border rounded-t-2xl p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between shadow-sm">
        <h3 className="text-lg font-serif font-bold text-theme-text flex items-center gap-2">
         <Bot className="text-theme-accent" size={20} /> Личный ассистент
        </h3>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
         <select
           value={assistantProvider}
           onChange={(e) => {
             updateAssistantSettings({ assistantProvider: e.target.value });
             if (e.target.value === 'ollama') {
               loadFreeModels();
             }
           }}
           className="bg-theme-bg border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text focus:outline-none"
         >
           <option value="omni">OMNI Core</option>
           <option value="gemini">Google Gemini</option>
           <option value="ollama">Бесплатные локальные модели</option>
         </select>
         {isLocalModelMode && (
           <>
             <select
               value={selectedFreeModel}
               onChange={(e) => updateAssistantSettings({ freeTextModel: e.target.value })}
               className="bg-theme-bg border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text focus:outline-none"
             >
               {freeModelOptions.map((model) => (
                 <option key={model.value} value={model.value}>{model.label}</option>
               ))}
             </select>
             <button
               onClick={loadFreeModels}
               className="px-3 py-2 rounded-xl border border-theme-border text-xs text-theme-text hover:bg-theme-bg transition-all"
               disabled={freeModelsLoading}
             >
               {freeModelsLoading ? 'Обновляю модели...' : 'Обновить модели'}
             </button>
           </>
         )}
         <span className="text-xs font-mono text-theme-accent bg-theme-panel px-2 py-1 rounded">
           {isLocalModelMode ? `LOCAL MODEL: ${selectedFreeModel}` : 'MIND_LINK: ESTABLISHED'}
         </span>
        </div>
      </div>

      <div className="flex-1 bg-theme-bg border-l border-r border-theme-border overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {isLocalModelMode && freeModelsError && (
         <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-2xl px-4 py-3 text-sm">
           {freeModelsError}
         </div>
        )}
        {history.length === 0 ? (
         <div className="h-full flex flex-col items-center justify-center opacity-50 text-center">
           <Bot size={64} className="text-theme-accent mb-4" />
           <p className="text-theme-muted max-w-md italic font-serif text-lg">
             {isLocalModelMode
               ? '«Выберите бесплатную локальную модель и задайте ей вопрос. Всё работает через Ollama.»'
               : '«Расскажите мне о ваших планах, и я превращу их в структуру.»'}
           </p>
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
                 {msg.role === 'assistant'
                   ? (msg.provider === 'ollama' ? `FREE MODEL · ${msg.model}` : msg.provider === 'gemini' ? `GEMINI · ${msg.model || 'gemini'}` : 'АССИСТЕНТ')
                   : msg.role.toUpperCase()}
               </div>
               <div className="whitespace-pre-wrap">{msg.content}</div>

               {msg.actions && msg.actions.length > 0 && (
                 <div className="mt-4 pt-3 border-t border-theme-border flex flex-wrap gap-2">
                   {msg.actions.map((action, aIdx) => (
                     <button
                       key={aIdx}
                       onClick={() => executeAction(action)}
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
             {isLocalModelMode ? 'Локальная модель отвечает...' : isGeminiMode ? 'Gemini думает...' : 'Анализ запроса...'}
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
         placeholder={isLocalModelMode ? 'Спросите локальную модель...' : isGeminiMode ? 'Спросите Google Gemini...' : 'Опишите вашу идею или задачу...'}
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
const SettingsView = ({ state, dispatch, onExportVault, onLock, auth, githubRepos, fetchGitHubRepos, geminiPrompt, setGeminiPrompt, geminiResult, geminiError, geminiLoading, handleGeminiTest, loginMethod, setLoginMethod, handleLogin, aiHealth, runAiHealthCheck, oauthForm, setOauthForm, oauthSaving, oauthMessage, loadOAuthConfig, saveOAuthConfig }) => {
  const handleExportJSON = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    document.body.appendChild(link);
    link.href = url;
    link.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const googleConnection = auth.providers?.google;
  const githubConnection = auth.providers?.github;
  const isGoogleConnected = Boolean(googleConnection?.connected);
  const isGithubConnected = Boolean(githubConnection?.connected);
  const showRepos = isGithubConnected;

  return (
    <div className="max-w-5xl space-y-8 animate-in fade-in duration-500">
      <div className="glass-panel p-6 sm:p-8">
        <h3 className="text-xl font-serif font-bold text-theme-text mb-6 flex items-center gap-2 border-b border-theme-border pb-4">
          <Settings className="text-theme-accent" /> Настройки системы
        </h3>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
          <div className="bg-theme-panel border border-theme-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-theme-text">Настройка OAuth и локальных моделей</p>
              <button onClick={loadOAuthConfig} className="text-xs text-theme-accent hover:underline">Обновить поля</button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mb-3 text-xs">
              <div className="bg-theme-bg border border-theme-border rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-theme-muted">Google OAuth</span>
                <span className={auth.configured?.google ? 'text-green-600' : 'text-amber-500'}>
                  {auth.configured?.google ? 'Настроен' : 'Нужны Client ID / Secret'}
                </span>
              </div>
              <div className="bg-theme-bg border border-theme-border rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-theme-muted">GitHub OAuth</span>
                <span className={auth.configured?.github ? 'text-green-600' : 'text-amber-500'}>
                  {auth.configured?.github ? 'Настроен' : 'Нужны Client ID / Secret'}
                </span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <input
                value={oauthForm.googleClientId}
                onChange={(e) => setOauthForm((p) => ({ ...p, googleClientId: e.target.value }))}
                placeholder="GOOGLE_CLIENT_ID"
                className="bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none"
              />
              <input
                value={oauthForm.googleClientSecret}
                onChange={(e) => setOauthForm((p) => ({ ...p, googleClientSecret: e.target.value }))}
                placeholder="GOOGLE_CLIENT_SECRET"
                className="bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none"
              />
              <input
                value={oauthForm.githubClientId}
                onChange={(e) => setOauthForm((p) => ({ ...p, githubClientId: e.target.value }))}
                placeholder="GITHUB_CLIENT_ID"
                className="bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none"
              />
              <input
                value={oauthForm.githubClientSecret}
                onChange={(e) => setOauthForm((p) => ({ ...p, githubClientSecret: e.target.value }))}
                placeholder="GITHUB_CLIENT_SECRET"
                className="bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none"
              />
              <input
                value={oauthForm.googleRedirectUri}
                onChange={(e) => setOauthForm((p) => ({ ...p, googleRedirectUri: e.target.value }))}
                placeholder="GOOGLE_REDIRECT_URI"
                className="bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none"
              />
              <input
                value={oauthForm.githubRedirectUri}
                onChange={(e) => setOauthForm((p) => ({ ...p, githubRedirectUri: e.target.value }))}
                placeholder="GITHUB_REDIRECT_URI"
                className="bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none"
              />
              <input
                value={oauthForm.frontendUrl}
                onChange={(e) => setOauthForm((p) => ({ ...p, frontendUrl: e.target.value }))}
                placeholder="FRONTEND_URL"
                className="bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none"
              />
              <input
                value={oauthForm.googleGeminiProject}
                onChange={(e) => setOauthForm((p) => ({ ...p, googleGeminiProject: e.target.value }))}
                placeholder="GOOGLE_GEMINI_PROJECT"
                className="bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none"
              />
              <input
                type="password"
                value={oauthForm.googleGeminiApiKey}
                onChange={(e) => setOauthForm((p) => ({ ...p, googleGeminiApiKey: e.target.value }))}
                placeholder="GOOGLE_GEMINI_API_KEY (AI Studio)"
                className="bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none"
              />
              <input
                value={oauthForm.ollamaBaseUrl}
                onChange={(e) => setOauthForm((p) => ({ ...p, ollamaBaseUrl: e.target.value }))}
                placeholder="OLLAMA_BASE_URL"
                className="bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none"
              />
            </div>

            <button
              onClick={saveOAuthConfig}
              disabled={oauthSaving}
              className="btn-primary mt-3 w-full text-sm py-2.5 disabled:opacity-50"
            >
              {oauthSaving ? 'Сохраняю...' : 'Сохранить конфигурацию в .env'}
            </button>
            {oauthMessage && <p className="text-xs text-theme-muted mt-2">{oauthMessage}</p>}
            <p className="text-[11px] text-theme-muted mt-2">
              Для локальной разработки используйте callback URL'ы вида <span className="font-mono">http://localhost:3001/auth/google/callback</span> и <span className="font-mono">http://localhost:3001/auth/github/callback</span>.
            </p>
            <p className="text-[11px] text-theme-muted mt-1">
              Бесплатные текстовые модели работают через Ollama. По умолчанию используется <span className="font-mono">http://localhost:11434</span>.
            </p>
          </div>

          <div className="bg-theme-panel border border-theme-border rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-semibold text-theme-text">Способ входа</p>
              <select
                value={loginMethod}
                onChange={(e) => setLoginMethod(e.target.value)}
                className="bg-theme-bg border border-theme-border rounded-lg px-3 py-1.5 text-xs text-theme-text focus:outline-none"
              >
                <option value="popup">Popup окно</option>
                <option value="redirect">Redirect в текущем окне</option>
              </select>
            </div>
            <p className="text-xs text-theme-muted">Выберите удобный способ авторизации для Google/GitHub.</p>
          </div>

          <div className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-theme-panel border border-theme-border rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-theme-text">Google Gemini</p>
                    <p className="text-xs text-theme-muted">Gemini API Key или авторизация Google OAuth</p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full ${isGoogleConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isGoogleConnected ? 'Подключено' : 'Не подключено'}
                  </span>
                </div>
                <p className="text-xs text-theme-muted mb-4">{isGoogleConnected ? googleConnection?.user?.email || googleConnection?.user?.name : 'Авторизуйтесь через Google или введите Gemini API Key в настройках ниже.'}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleLogin('google')}
                    className="btn-gold w-full text-sm py-3"
                    disabled={auth.isLoading || !auth.configured?.google}
                  >
                    {auth.isLoading ? 'Ожидание...' : isGoogleConnected ? 'Обновить Google' : 'Подключить Google'}
                  </button>
                  {isGoogleConnected && (
                    <button
                      onClick={() => auth.disconnect('google')}
                      className="px-4 py-3 rounded-xl border border-theme-border text-sm text-theme-text hover:bg-theme-bg transition-all"
                    >
                      Отключить
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-theme-panel border border-theme-border rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-theme-text">GitHub</p>
                    <p className="text-xs text-theme-muted">Авторизация через GitHub для репозиториев и профиля</p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full ${isGithubConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isGithubConnected ? 'Подключено' : 'Не подключено'}
                  </span>
                </div>
                <p className="text-xs text-theme-muted mb-4">{isGithubConnected ? githubConnection?.user?.login || githubConnection?.user?.email || githubConnection?.user?.name : 'Авторизуйтесь через GitHub для доступа к репозиториям.'}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleLogin('github')}
                    className="btn-gold w-full text-sm py-3"
                    disabled={auth.isLoading || !auth.configured?.github}
                  >
                    {auth.isLoading ? 'Ожидание...' : isGithubConnected ? 'Обновить GitHub' : 'Подключить GitHub'}
                  </button>
                  {isGithubConnected && (
                    <button
                      onClick={() => auth.disconnect('github')}
                      className="px-4 py-3 rounded-xl border border-theme-border text-sm text-theme-text hover:bg-theme-bg transition-all"
                    >
                      Отключить
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-theme-panel border border-theme-border rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-semibold text-theme-text">Бесплатные локальные модели</p>
                  <p className="text-xs text-theme-muted">Ассистент умеет работать через Ollama без Google OAuth.</p>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full ${aiHealth.ollama === 'ok' ? 'bg-green-100 text-green-700' : aiHealth.ollama === 'empty' ? 'bg-amber-100 text-amber-700' : aiHealth.ollama === 'fail' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                  {aiHealth.ollama === 'ok' ? 'Готово' : aiHealth.ollama === 'empty' ? 'Нужна модель' : aiHealth.ollama === 'fail' ? 'Проверьте Ollama' : 'Не проверено'}
                </span>
              </div>
              <p className="text-xs text-theme-muted">
                Запустите <span className="font-mono">ollama serve</span> и установите хотя бы одну модель, например <span className="font-mono">ollama pull llama3.2:3b</span>.
              </p>
            </div>

            {showRepos && (
            <div className="bg-theme-panel border border-theme-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-theme-text">Репозитории GitHub</p>
                  <button
                    onClick={fetchGitHubRepos}
                    className="text-xs text-theme-accent hover:underline"
                  >
                    Обновить
                  </button>
                </div>
                <div className="grid gap-2">
                  {githubRepos.length > 0 ? githubRepos.slice(0, 5).map(repo => (
                    <div key={repo.id} className="bg-theme-bg border border-theme-border rounded-xl p-3 text-sm text-theme-text">
                      <div className="font-semibold">{repo.full_name}</div>
                      <div className="text-theme-muted text-xs mt-1">{repo.private ? 'Private' : 'Public'}</div>
                    </div>
                  )) : (
                    <p className="text-xs text-theme-muted">Нет репозиториев или нет доступа.</p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-theme-panel border border-theme-border rounded-xl p-4">
              <div className="mb-4">
                <p className="text-sm font-semibold text-theme-text">Тест Google Gemini</p>
                <p className="text-xs text-theme-muted">Отправьте простой запрос в Gemini, если подключен Google.</p>
              </div>
              <textarea
                value={geminiPrompt}
                onChange={(e) => setGeminiPrompt(e.target.value)}
                placeholder="Например: Напиши краткий план для утреннего ритуала"
                className="w-full min-h-[100px] bg-theme-bg border border-theme-border rounded-xl p-3 text-sm text-theme-text focus:outline-none resize-none"
              />
              <button
                onClick={handleGeminiTest}
                disabled={geminiLoading || !geminiPrompt.trim()}
                className="btn-primary mt-3 w-full text-sm py-3"
              >
                {geminiLoading ? 'Запрос...' : 'Отправить Gemini'}
              </button>
              {geminiError && <p className="text-red-400 text-xs mt-3">{geminiError}</p>}
              {geminiResult && (
                <div className="mt-4 bg-theme-bg border border-theme-border rounded-xl p-3 text-sm text-theme-text whitespace-pre-wrap">
                  {geminiResult.response || JSON.stringify(geminiResult, null, 2)}
                </div>
              )}
            </div>

            <div className="bg-theme-panel border border-theme-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-theme-text">Статус ИИ проверки</p>
                <button
                  onClick={runAiHealthCheck}
                  className="text-xs text-theme-accent hover:underline disabled:opacity-50"
                  disabled={aiHealth.checking}
                >
                  {aiHealth.checking ? 'Проверяю...' : 'Проверить'}
                </button>
              </div>

              <div className="grid gap-2 text-xs">
                <div className="flex items-center justify-between bg-theme-bg border border-theme-border rounded-lg px-3 py-2">
                  <span className="text-theme-muted">OMNI API</span>
                  <span className={aiHealth.omni === 'ok' ? 'text-green-600' : aiHealth.omni === 'fail' ? 'text-red-500' : 'text-theme-muted'}>
                    {aiHealth.omni === 'ok' ? 'OK' : aiHealth.omni === 'fail' ? 'Ошибка' : 'Не проверено'}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-theme-bg border border-theme-border rounded-lg px-3 py-2">
                  <span className="text-theme-muted">Gemini API</span>
                  <span className={aiHealth.gemini === 'ok' ? 'text-green-600' : aiHealth.gemini === 'fail' ? 'text-red-500' : aiHealth.gemini === 'unauthorized' ? 'text-amber-500' : 'text-theme-muted'}>
                    {aiHealth.gemini === 'ok' ? 'OK' : aiHealth.gemini === 'fail' ? 'Ошибка' : aiHealth.gemini === 'unauthorized' ? 'Нужен Google login' : 'Не проверено'}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-theme-bg border border-theme-border rounded-lg px-3 py-2">
                  <span className="text-theme-muted">Ollama / free models</span>
                  <span className={aiHealth.ollama === 'ok' ? 'text-green-600' : aiHealth.ollama === 'empty' ? 'text-amber-500' : aiHealth.ollama === 'fail' ? 'text-red-500' : 'text-theme-muted'}>
                    {aiHealth.ollama === 'ok' ? 'OK' : aiHealth.ollama === 'empty' ? 'Нет моделей' : aiHealth.ollama === 'fail' ? 'Ошибка' : 'Не проверено'}
                  </span>
                </div>
              </div>

              {aiHealth.details && (
                <p className="mt-3 text-[11px] text-theme-muted break-words">{aiHealth.details}</p>
              )}
            </div>
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


const VaultDashboard = ({ auth, state, dispatch, onLock, onExportVault }) => {
  const [activeTab, setActiveTab] = useState('base');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // The rest of the state and functions specific to the dashboard views (like Gemini test) can remain if they are not directly tied to the auth flow itself.
  const [githubRepos, setGithubRepos] = useState([]);
  const [geminiPrompt, setGeminiPrompt] = useState('');
  const [geminiResult, setGeminiResult] = useState(null);
  const [geminiError, setGeminiError] = useState('');
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState('popup');
  const [aiHealth, setAiHealth] = useState({ checking: false, omni: 'idle', gemini: 'idle', ollama: 'idle', details: '' });
  const [oauthForm, setOauthForm] = useState({
    googleClientId: '',
    googleClientSecret: '',
    googleRedirectUri: 'http://localhost:3001/auth/google/callback',
    githubClientId: '',
    githubClientSecret: '',
    githubRedirectUri: 'http://localhost:3001/auth/github/callback',
    frontendUrl: window.location.origin,
    googleGeminiProject: '',
    googleGeminiApiKey: '',
    ollamaBaseUrl: 'http://localhost:11434',
  });
  const [oauthSaving, setOauthSaving] = useState(false);
  const [oauthMessage, setOauthMessage] = useState('');

  const extractOmniText = (data) => {
    if (!data) return '';
    if (Array.isArray(data.outputs)) {
      const text = data.outputs.map((o) => o?.text).filter(Boolean).join('\n').trim();
      if (text) return text;
    }
    if (Array.isArray(data.responses)) {
      const text = data.responses.map((o) => o?.text).filter(Boolean).join('\n').trim();
      if (text) return text;
    }
    if (Array.isArray(data.reply)) {
      const text = data.reply.map((o) => o?.text).filter(Boolean).join('\n').trim();
      if (text) return text;
    }
    return '';
  };

  const handleLogin = (provider) => {
    auth.login(provider, loginMethod);
  };

  const fetchGitHubRepos = async () => {
    // This can be refactored into the useAuth hook later if needed
    try {
      const response = await fetch('/api/github/repos', { method: 'POST', credentials: 'include' });
      if (!response.ok) {
        console.warn('GitHub repos request failed');
        return;
      }
      const data = await response.json();
      setGithubRepos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch GitHub repos:', err);
    }
  };
  
  useEffect(() => {
    if (auth.providers?.github?.connected) {
        fetchGitHubRepos();
    }
  }, [auth.providers?.github?.connected]);

  const loadOAuthConfig = async () => {
    try {
      const response = await fetch('/api/config/oauth');
      if (!response.ok) throw new Error('Не удалось загрузить OAuth настройки');
      const data = await response.json();
      setOauthForm((prev) => ({
        ...prev,
        googleClientId: data.googleClientId || '',
        googleClientSecret: '',
        googleRedirectUri: data.googleRedirectUri || prev.googleRedirectUri,
        githubClientId: data.githubClientId || '',
        githubClientSecret: '',
        githubRedirectUri: data.githubRedirectUri || prev.githubRedirectUri,
        frontendUrl: data.frontendUrl || prev.frontendUrl,
        googleGeminiProject: data.googleGeminiProject || '',
        googleGeminiApiKey: '',
        ollamaBaseUrl: data.ollamaBaseUrl || prev.ollamaBaseUrl,
      }));
    } catch (err) {
      setOauthMessage(err.message || 'Ошибка загрузки OAuth настроек');
    }
  };

  useEffect(() => {
    loadOAuthConfig();
  }, []);

  const saveOAuthConfig = async () => {
    setOauthSaving(true);
    setOauthMessage('');
    try {
      const response = await fetch('/api/config/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(oauthForm),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || data.error || 'Ошибка сохранения OAuth настроек');
      }
      setOauthMessage(data.message || 'Сохранено. Конфигурация применена.');
      await auth.refreshStatus();
    } catch (err) {
      setOauthMessage(err.message || 'Ошибка сохранения OAuth настроек');
    } finally {
      setOauthSaving(false);
    }
  };


  const handleGeminiTest = async () => {
    if (!geminiPrompt.trim()) return;
    setGeminiError('');
    setGeminiLoading(true);
    setGeminiResult(null);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: geminiPrompt.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        setGeminiError(data.error || 'Не удалось выполнить запрос Gemini');
      } else {
        setGeminiResult(data);
      }
    } catch (err) {
      setGeminiError(err.message || 'Ошибка Gemini');
      console.error(err);
    } finally {
      setGeminiLoading(false);
    }
  };

  const runAiHealthCheck = async () => {
    setAiHealth({ checking: true, omni: 'idle', gemini: 'idle', ollama: 'idle', details: '' });

    let omniStatus = 'fail';
    let geminiStatus;
    let ollamaStatus;
    const details = [];

    try {
      const omniResp = await fetch('/api/omni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Коротко ответь: сервис доступен.' }),
      });

      const omniData = await omniResp.json();
      const omniText = extractOmniText(omniData);
      if (omniResp.ok && omniText) {
        omniStatus = 'ok';
      } else {
        details.push('OMNI API не вернул корректный текстовый ответ.');
      }
    } catch {
      details.push('OMNI API недоступен.');
    }

    try {
      const gemResp = await fetch('/api/gemini/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Say: ok' }),
      });

      const gemData = await gemResp.json();
      if (gemResp.ok) {
        geminiStatus = 'ok';
      } else if (gemResp.status === 401) {
        geminiStatus = 'unauthorized';
        details.push('Для Gemini нужен API Key или авторизация Google.');
      } else {
        geminiStatus = 'fail';
        details.push(`Gemini ошибка: ${gemData?.error || 'unknown'}`);
      }
    } catch {
      geminiStatus = 'fail';
      details.push('Gemini API недоступен.');
    }

    try {
      const ollamaResp = await fetch('/api/ollama/models');
      const ollamaData = await ollamaResp.json();
      if (ollamaResp.ok && Array.isArray(ollamaData.models) && ollamaData.models.length > 0) {
        ollamaStatus = 'ok';
      } else if (ollamaResp.ok) {
        ollamaStatus = 'empty';
        details.push('Ollama запущен, но локальные модели не установлены.');
      } else {
        ollamaStatus = 'fail';
        details.push(`Ollama ошибка: ${ollamaData?.error || 'unknown'}`);
      }
    } catch {
      ollamaStatus = 'fail';
      details.push('Ollama недоступен.');
    }

    setAiHealth({
      checking: false,
      omni: omniStatus,
      gemini: geminiStatus,
      ollama: ollamaStatus,
      details: details.join(' '),
    });
  };

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

          {/* User Info & Bottom Actions */}
          <div className="p-2 border-t border-theme-border flex flex-col gap-1">
             {auth.isAuthenticated && (
                <div className={`flex items-center gap-2 p-2 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                    <img src={auth.user.picture} alt="avatar" className="w-8 h-8 rounded-full" />
                    {!isSidebarCollapsed && (
                        <div className="text-xs truncate">
                            <p className="font-bold text-theme-text truncate">{auth.user.name}</p>
                            <p className="text-theme-muted truncate">{auth.user.email}</p>
                        </div>
                    )}
                </div>
             )}
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
                <SettingsView
                  state={state}
                  dispatch={dispatch}
                  onExportVault={onExportVault}
                  onLock={onLock}
                  auth={auth}
                  githubRepos={githubRepos}
                  fetchGitHubRepos={fetchGitHubRepos}
                  geminiPrompt={geminiPrompt}
                  setGeminiPrompt={setGeminiPrompt}
                  geminiResult={geminiResult}
                  geminiError={geminiError}
                  geminiLoading={geminiLoading}
                  handleGeminiTest={handleGeminiTest}
                  loginMethod={loginMethod}
                  setLoginMethod={setLoginMethod}
                  handleLogin={handleLogin}
                  aiHealth={aiHealth}
                  runAiHealthCheck={runAiHealthCheck}
                  oauthForm={oauthForm}
                  setOauthForm={setOauthForm}
                  oauthSaving={oauthSaving}
                  oauthMessage={oauthMessage}
                  loadOAuthConfig={loadOAuthConfig}
                  saveOAuthConfig={saveOAuthConfig}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default VaultDashboard;
