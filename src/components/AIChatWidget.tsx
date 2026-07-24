'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Mic, MicOff, Paperclip, Sparkles, Trash2, Globe, Check, XCircle, BookOpen, DollarSign, FileText } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  sources?: { title: string; url: string }[];
  pendingAction?: PendingAction | null;
  actionResult?: ActionResult | null;
  timestamp: Date;
}

interface Attachment {
  type: 'image' | 'audio';
  mimeType: string;
  data: string;
  preview?: string;
  name?: string;
}

interface PendingAction {
  action: string;
  args: any;
  status: 'pending' | 'confirmed' | 'rejected';
}

interface ActionResult {
  success: boolean;
  message?: string;
  error?: string;
  book_id?: string;
  title?: string;
  autores_registrados?: string[];
  url?: string;
}

const QUICK_PROMPTS = [
  { icon: '📚', label: '¿Cuántos libros?', prompt: '¿Cuántos libros tenemos publicados en total?' },
  { icon: '📊', label: 'Estado revistas', prompt: '¿Cuál es el estado actual de nuestras revistas en Scopus y Publindex?' },
  { icon: '👥', label: 'Top autores', prompt: '¿Quiénes son los 10 autores con más publicaciones?' },
  { icon: '💰', label: 'Balance financiero', prompt: '¿Cuál es el balance financiero actual?' },
  { icon: '📷', label: 'Registrar libro', prompt: 'Envíame una foto de un libro y lo registro automáticamente en el sistema' },
  { icon: '🔍', label: 'Buscar en Google', prompt: '¿Cuáles son las fechas de la próxima convocatoria Publindex?' },
];

const ACTION_LABELS: Record<string, { icon: any; label: string; color: string }> = {
  create_book: { icon: BookOpen, label: 'Registrar Libro', color: '#09843B' },
  create_chapter: { icon: FileText, label: 'Registrar Capítulo', color: '#1565C0' },
  create_expense: { icon: DollarSign, label: 'Registrar Gasto', color: '#E65100' },
};

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showPulse, setShowPulse] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      setShowPulse(false);
    }
  }, [isOpen]);

  // Load/save history
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pubmanager-chat-history');
      if (saved) {
        const parsed = JSON.parse(saved);
        setMessages(parsed.map((m: any) => ({
          ...m, timestamp: new Date(m.timestamp),
          pendingAction: m.pendingAction ? { ...m.pendingAction, status: m.pendingAction.status === 'pending' ? 'rejected' : m.pendingAction.status } : null,
        })));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      try {
        const toSave = messages.slice(-50).map(m => ({
          ...m,
          attachments: m.attachments?.map(a => ({ ...a, data: '', preview: a.type === 'image' ? a.preview : '' })),
        }));
        localStorage.setItem('pubmanager-chat-history', JSON.stringify(toSave));
      } catch { /* ignore */ }
    }
  }, [messages]);

  const sendMessage = useCallback(async (overrideContent?: string) => {
    const content = overrideContent || input.trim();
    if (!content && pendingAttachments.length === 0) return;

    const userMessage: Message = {
      role: 'user',
      content: content || (pendingAttachments.length > 0 ? '(archivo adjunto)' : ''),
      attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setPendingAttachments([]);
    setLoading(true);

    try {
      const history = [...messages.slice(-10), userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          attachments: userMessage.attachments?.map(a => ({
            type: a.type, mimeType: a.mimeType, data: a.data,
          })),
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages(prev => [...prev, {
          role: 'assistant', content: `❌ Error: ${data.error}`, timestamp: new Date(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response,
          sources: data.sources,
          pendingAction: data.pendingAction ? { ...data.pendingAction, status: 'pending' as const } : null,
          timestamp: new Date(),
        }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant', content: `❌ Error de conexión: ${err.message}`, timestamp: new Date(),
      }]);
    }

    setLoading(false);
  }, [input, messages, pendingAttachments]);

  // Confirm or reject a pending action
  const handleActionConfirm = useCallback(async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg?.pendingAction) return;

    // Mark as loading
    setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, pendingAction: { ...m.pendingAction!, status: 'confirmed' as const } } : m));
    setLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'confirm' }],
          confirmAction: msg.pendingAction,
        }),
      });

      const data = await res.json();

      setMessages(prev => {
        const updated = [...prev];
        updated[msgIndex] = { ...updated[msgIndex], pendingAction: { ...updated[msgIndex].pendingAction!, status: 'confirmed' as const } };
        // Add result message
        updated.push({
          role: 'assistant',
          content: data.actionResult?.success
            ? `✅ **¡Listo!** ${data.actionResult.message || 'Registro creado exitosamente.'}${data.actionResult.autores_registrados?.length ? '\n\n**Autores registrados:**\n' + data.actionResult.autores_registrados.join('\n') : ''}`
            : `❌ **Error:** ${data.actionResult?.error || 'No se pudo crear el registro.'}`,
          actionResult: data.actionResult,
          timestamp: new Date(),
        });
        return updated;
      });
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant', content: `❌ Error al confirmar: ${err.message}`, timestamp: new Date(),
      }]);
    }

    setLoading(false);
  }, [messages]);

  const handleActionReject = useCallback((msgIndex: number) => {
    setMessages(prev => prev.map((m, i) => 
      i === msgIndex ? { ...m, pendingAction: { ...m.pendingAction!, status: 'rejected' as const } } : m
    ));
    setMessages(prev => [...prev, {
      role: 'assistant', content: '🚫 Operación cancelada. Los datos **no** fueron guardados. ¿Deseas hacer alguna corrección?', timestamp: new Date(),
    }]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const preview = reader.result as string;
        const isImage = file.type.startsWith('image/');
        if (isImage || file.type.startsWith('audio/')) {
          setPendingAttachments(prev => [...prev, {
            type: isImage ? 'image' : 'audio', mimeType: file.type,
            data: base64, preview: isImage ? preview : undefined, name: file.name,
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          setPendingAttachments(prev => [...prev, {
            type: 'audio', mimeType: 'audio/webm', data: base64, name: `Nota de voz (${recordingTime}s)`,
          }]);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) { console.error('Mic error:', err); }
  }, [recordingTime]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
  }, []);

  const clearHistory = useCallback(() => { setMessages([]); localStorage.removeItem('pubmanager-chat-history'); }, []);
  const removeAttachment = useCallback((idx: number) => { setPendingAttachments(prev => prev.filter((_, i) => i !== idx)); }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');
  };

  // Render the action card for pending confirmations
  const renderActionCard = (action: PendingAction, msgIndex: number) => {
    const meta = ACTION_LABELS[action.action] || { icon: FileText, label: action.action, color: '#666' };
    const IconComponent = meta.icon;
    const args = action.args || {};

    return (
      <div className="ai-action-card" style={{ borderLeftColor: meta.color }}>
        <div className="ai-action-header">
          <IconComponent size={16} style={{ color: meta.color }} />
          <span style={{ color: meta.color, fontWeight: 700 }}>{meta.label}</span>
          {action.status === 'confirmed' && <span className="ai-action-badge confirmed">✅ Confirmado</span>}
          {action.status === 'rejected' && <span className="ai-action-badge rejected">🚫 Cancelado</span>}
        </div>

        <div className="ai-action-fields">
          {action.action === 'create_book' && (
            <>
              <div className="ai-action-field"><span>📖 Título</span><strong>{args.title}</strong></div>
              {args.subtitle && <div className="ai-action-field"><span>📝 Subtítulo</span><strong>{args.subtitle}</strong></div>}
              {args.authors?.length > 0 && (
                <div className="ai-action-field">
                  <span>👥 Autores</span>
                  <strong>{args.authors.map((a: any) => typeof a === 'string' ? a : `${a.name} (${a.role})`).join(', ')}</strong>
                </div>
              )}
              {args.isbn_print && <div className="ai-action-field"><span>🔢 ISBN Impreso</span><strong>{args.isbn_print}</strong></div>}
              {args.isbn_digital && <div className="ai-action-field"><span>🔢 ISBN Digital</span><strong>{args.isbn_digital}</strong></div>}
              {args.editorial && <div className="ai-action-field"><span>🏢 Editorial</span><strong>{args.editorial}</strong></div>}
              {args.year_published && <div className="ai-action-field"><span>📅 Año</span><strong>{args.year_published}</strong></div>}
              {args.page_count && <div className="ai-action-field"><span>📄 Páginas</span><strong>{args.page_count}</strong></div>}
              {args.book_type && <div className="ai-action-field"><span>📚 Tipo</span><strong>{args.book_type}</strong></div>}
              {args.doi && <div className="ai-action-field"><span>🔗 DOI</span><strong>{args.doi}</strong></div>}
              {args.format && <div className="ai-action-field"><span>📱 Formato</span><strong>{args.format}</strong></div>}
              {args.notes && <div className="ai-action-field"><span>📝 Notas</span><strong>{args.notes}</strong></div>}
            </>
          )}
          {action.action === 'create_chapter' && (
            <>
              <div className="ai-action-field"><span>📄 Capítulo</span><strong>{args.title}</strong></div>
              {args.book_title && <div className="ai-action-field"><span>📖 Libro</span><strong>{args.book_title}</strong></div>}
              {args.authors?.length > 0 && <div className="ai-action-field"><span>👥 Autores</span><strong>{args.authors.join(', ')}</strong></div>}
              {args.page_start && <div className="ai-action-field"><span>📄 Páginas</span><strong>{args.page_start}–{args.page_end}</strong></div>}
            </>
          )}
          {action.action === 'create_expense' && (
            <>
              <div className="ai-action-field"><span>📝 Descripción</span><strong>{args.description}</strong></div>
              <div className="ai-action-field"><span>💰 Monto</span><strong>${args.amount?.toLocaleString()}</strong></div>
              {args.category && <div className="ai-action-field"><span>📂 Categoría</span><strong>{args.category}</strong></div>}
              {args.date && <div className="ai-action-field"><span>📅 Fecha</span><strong>{args.date}</strong></div>}
              {args.vendor && <div className="ai-action-field"><span>🏢 Proveedor</span><strong>{args.vendor}</strong></div>}
            </>
          )}
        </div>

        {action.status === 'pending' && (
          <div className="ai-action-buttons">
            <button className="ai-action-btn-confirm" onClick={() => handleActionConfirm(msgIndex)} disabled={loading}>
              <Check size={14} /> Confirmar y Guardar
            </button>
            <button className="ai-action-btn-reject" onClick={() => handleActionReject(msgIndex)}>
              <XCircle size={14} /> Cancelar
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="ai-chat-fab" title="Asistente IA">
          <Sparkles size={24} />
          {showPulse && <span className="ai-chat-fab-pulse" />}
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="ai-chat-panel">
          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-chat-header-info">
              <div className="ai-chat-avatar"><Sparkles size={18} /></div>
              <div>
                <h4>Asistente PubManager</h4>
                <span className="ai-chat-status">
                  <span className="ai-chat-status-dot" /> Gemini · Multimodal + Acciones
                </span>
              </div>
            </div>
            <div className="ai-chat-header-actions">
              <button onClick={clearHistory} title="Limpiar historial" className="ai-chat-header-btn"><Trash2 size={16} /></button>
              <button onClick={() => setIsOpen(false)} className="ai-chat-header-btn"><X size={18} /></button>
            </div>
          </div>

          {/* Messages */}
          <div className="ai-chat-messages">
            {messages.length === 0 && (
              <div className="ai-chat-empty">
                <div className="ai-chat-empty-icon">🧠</div>
                <h4>¡Hola Jorge!</h4>
                <p>Puedo consultar datos, analizar imágenes, escuchar audio, buscar en Google y <strong>crear registros automáticamente</strong> desde fotos.</p>
                <div className="ai-chat-prompts">
                  {QUICK_PROMPTS.map((p, i) => (
                    <button key={i} className="ai-chat-prompt-chip" onClick={() => sendMessage(p.prompt)}>
                      <span>{p.icon}</span> {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`ai-chat-msg ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="ai-chat-msg-avatar"><Sparkles size={14} /></div>
                )}
                <div className="ai-chat-msg-content">
                  {/* Image attachments */}
                  {msg.attachments?.filter(a => a.type === 'image' && a.preview).map((att, j) => (
                    <img key={j} src={att.preview} alt="Adjunto" className="ai-chat-msg-image" />
                  ))}
                  {/* Audio attachments */}
                  {msg.attachments?.filter(a => a.type === 'audio').map((att, j) => (
                    <div key={j} className="ai-chat-msg-audio">🎙️ {att.name || 'Nota de voz'}</div>
                  ))}
                  {/* Text */}
                  {msg.content && (
                    <div className="ai-chat-msg-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                  )}
                  {/* Action Card */}
                  {msg.pendingAction && renderActionCard(msg.pendingAction, i)}
                  {/* Google Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="ai-chat-sources">
                      <div className="ai-chat-sources-label"><Globe size={12} /> Fuentes web</div>
                      {msg.sources.map((s, j) => (
                        <a key={j} href={s.url} target="_blank" rel="noopener noreferrer" className="ai-chat-source-link">{s.title || s.url}</a>
                      ))}
                    </div>
                  )}
                  <span className="ai-chat-msg-time">
                    {msg.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="ai-chat-msg assistant">
                <div className="ai-chat-msg-avatar"><Sparkles size={14} /></div>
                <div className="ai-chat-msg-content">
                  <div className="ai-chat-typing"><span /><span /><span /></div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Pending Attachments */}
          {pendingAttachments.length > 0 && (
            <div className="ai-chat-attachments-bar">
              {pendingAttachments.map((att, i) => (
                <div key={i} className="ai-chat-attachment-preview">
                  {att.type === 'image' && att.preview ? (
                    <img src={att.preview} alt="Preview" />
                  ) : (
                    <span className="ai-chat-attachment-icon">🎙️</span>
                  )}
                  <button onClick={() => removeAttachment(i)} className="ai-chat-attachment-remove"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="ai-chat-input-area">
            <input ref={fileInputRef} type="file" accept="image/*,audio/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
            <div className="ai-chat-input-row">
              <button className="ai-chat-action-btn" onClick={() => fileInputRef.current?.click()} title="Adjuntar imagen o audio">
                <Paperclip size={18} />
              </button>
              <button className={`ai-chat-action-btn ${isRecording ? 'recording' : ''}`} onClick={isRecording ? stopRecording : startRecording} title={isRecording ? 'Detener' : 'Grabar voz'}>
                {isRecording ? <><MicOff size={18} /><span className="ai-chat-rec-time">{recordingTime}s</span></> : <Mic size={18} />}
              </button>
              <textarea
                ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={isRecording ? 'Grabando...' : 'Pregunta algo o adjunta una imagen...'}
                className="ai-chat-textarea" rows={1} disabled={loading || isRecording}
              />
              <button className="ai-chat-send-btn" onClick={() => sendMessage()} disabled={loading || (!input.trim() && pendingAttachments.length === 0)}>
                <Send size={18} />
              </button>
            </div>
            <div className="ai-chat-capabilities">
              <span>📊 Datos</span>
              <span>🖼️ Imágenes</span>
              <span>🎙️ Audio</span>
              <span>🌐 Google</span>
              <span>✏️ Crear registros</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
