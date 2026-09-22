'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, X, Calendar, Send, Download, Copy, Check,
  BookOpen, Library, DollarSign, BarChart3, MessageSquare,
  Loader2, FileText, GraduationCap, Award, Users, Receipt,
} from 'lucide-react';
import { exportReportToWord } from '@/lib/reportWordGenerator';

/* ─── Types ─── */
interface ReportType {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const REPORT_TYPES: ReportType[] = [
  { key: 'apc', label: 'Informe de Pagos APC', icon: <Receipt size={20} />, description: 'Bolsa presupuestal anual, artículos APC financiados, cuartiles e investigadores líderes', color: '#09843B' },
  { key: 'books', label: 'Informe de Libros', icon: <Library size={20} />, description: 'Producción de libros, capítulos, autores, tipos y tendencias', color: '#1B5E20' },
  { key: 'journals', label: 'Informe de Revistas', icon: <BookOpen size={20} />, description: 'Estado de indexación, cuartiles Scopus, categorías Publindex', color: '#1565C0' },
  { key: 'mentoring', label: 'Informe de Mentorías', icon: <GraduationCap size={20} />, description: 'Sesiones de acompañamiento por mentor, facultad y grupo', color: '#00695C' },
  { key: 'finances', label: 'Informe Financiero', icon: <DollarSign size={20} />, description: 'Balance de gastos por categoría y período', color: '#E65100' },
  { key: 'certificates', label: 'Informe de Certificados', icon: <Award size={20} />, description: 'Certificados emitidos por tipo, destinatario y período', color: '#4E342E' },
  { key: 'team', label: 'Equipo Editorial', icon: <Users size={20} />, description: 'Composición de roles, editores de revistas y personal activo', color: '#00838F' },
  { key: 'editors_school', label: 'Escuela de Editores', icon: <FileText size={20} />, description: 'Formación editorial: módulos, asistencia y evaluaciones', color: '#283593' },
  { key: 'executive', label: 'Informe Ejecutivo', icon: <BarChart3 size={20} />, description: 'Resumen holístico integral de toda la gestión editorial', color: '#6A1B9A' },
  { key: 'custom', label: 'Análisis Personalizado', icon: <MessageSquare size={20} />, description: 'Escribe tu propia pregunta sobre los datos', color: '#37474F' },
];

const PERIOD_PRESETS = [
  { label: '📅 Año en curso (2026)', years: 1 },
  { label: '3 años', years: 3 },
  { label: '5 años', years: 5 },
  { label: '10 años', years: 10 },
  { label: 'Todo el histórico', years: 0 },
];

const LENGTH_PRESETS = [
  { key: 'brief', label: '📋 Breve', desc: '~300 palabras, solo cifras clave' },
  { key: 'executive', label: '📊 Ejecutivo', desc: '~600 palabras, hallazgos y recomendaciones' },
  { key: 'detailed', label: '📖 Detallado', desc: '~1500 palabras, análisis profundo' },
];

/* ─── Simple markdown renderer ─── */
function renderMarkdown(md: string) {
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  function flushTable() {
    if (tableRows.length < 2) return;
    const headerCells = tableRows[0].split('|').map(c => c.trim()).filter(Boolean);
    const bodyRows = tableRows.slice(2); // skip separator
    elements.push(
      <div key={`t${elements.length}`} style={{ overflowX: 'auto', margin: '16px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              {headerCells.map((cell, i) => (
                <th key={i} style={{
                  padding: '8px 12px', textAlign: 'left', fontWeight: 700,
                  borderBottom: '2px solid var(--gray-200)', color: 'var(--gray-700)',
                  background: 'var(--gray-50)', fontSize: '12px',
                }}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, ri) => {
              const cells = row.split('|').map(c => c.trim()).filter(Boolean);
              return (
                <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'var(--gray-50)' }}>
                  {cells.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: '7px 12px', borderBottom: '1px solid var(--gray-100)',
                      color: 'var(--gray-600)',
                    }} dangerouslySetInnerHTML={{ __html: inlineFormat(cell) }} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  }

  function flushList() {
    if (listItems.length === 0) return;
    elements.push(<ul key={`ul${elements.length}`} style={{ margin: '8px 0', paddingLeft: '24px' }}>{listItems}</ul>);
    listItems = [];
    inList = false;
  }

  function flushCode() {
    elements.push(
      <pre key={`code${elements.length}`} style={{
        background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
        borderRadius: '8px', padding: '14px', fontSize: '12px', overflowX: 'auto',
        margin: '12px 0', lineHeight: 1.6,
      }}>
        <code>{codeLines.join('\n')}</code>
      </pre>
    );
    codeLines = [];
    inCodeBlock = false;
  }

  function inlineFormat(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:var(--gray-100);padding:2px 5px;border-radius:3px;font-size:12px">$1</code>');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) { flushCode(); continue; }
      if (inTable) flushTable();
      if (inList) flushList();
      inCodeBlock = true;
      continue;
    }
    if (inCodeBlock) { codeLines.push(line); continue; }

    // Table lines
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (!inTable) { if (inList) flushList(); inTable = true; }
      tableRows.push(line);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // List items
    if (/^(\s*[-*•]\s|^\s*\d+\.\s)/.test(line)) {
      if (!inList) inList = true;
      const text = line.replace(/^\s*[-*•]\s+|^\s*\d+\.\s+/, '');
      listItems.push(
        <li key={`li${elements.length}-${listItems.length}`} style={{
          marginBottom: '4px', fontSize: '14px', color: 'var(--gray-700)', lineHeight: 1.6,
        }} dangerouslySetInnerHTML={{ __html: inlineFormat(text) }} />
      );
      continue;
    } else if (inList) {
      flushList();
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={`br${i}`} style={{ height: '8px' }} />);
      continue;
    }

    // Headings
    if (line.startsWith('#### ')) {
      elements.push(<h5 key={`h4${i}`} style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-700)', margin: '16px 0 6px' }} dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(5)) }} />);
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(<h4 key={`h3${i}`} style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-800)', margin: '20px 0 8px' }} dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(4)) }} />);
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={`h2${i}`} style={{ fontSize: '17px', fontWeight: 800, color: 'var(--primary)', margin: '24px 0 10px', paddingBottom: '6px', borderBottom: '1px solid var(--gray-200)' }} dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(3)) }} />);
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={`h1${i}`} style={{ fontSize: '20px', fontWeight: 800, color: 'var(--gray-900)', margin: '0 0 12px' }} dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(2)) }} />);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={`hr${i}`} style={{ border: 'none', borderTop: '1px solid var(--gray-200)', margin: '16px 0' }} />);
      continue;
    }

    // Paragraph
    elements.push(
      <p key={`p${i}`} style={{ fontSize: '14px', color: 'var(--gray-700)', lineHeight: 1.7, margin: '4px 0' }}
        dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
    );
  }

  if (inTable) flushTable();
  if (inList) flushList();
  if (inCodeBlock) flushCode();

  return elements;
}

/* ─── Main component ─── */
interface AIReportGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: string;
  initialPeriodYears?: number;
}

export default function AIReportGenerator({ isOpen, onClose, initialType = 'books', initialPeriodYears = 1 }: AIReportGeneratorProps) {
  const currentYear = new Date().getFullYear();
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set([initialType]));
  const [periodYears, setPeriodYears] = useState(initialPeriodYears);

  useEffect(() => {
    if (isOpen) {
      if (initialType) setSelectedTypes(new Set([initialType]));
      if (initialPeriodYears !== undefined) setPeriodYears(initialPeriodYears);
    }
  }, [isOpen, initialType, initialPeriodYears]);

  const toggleType = (key: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // keep at least 1
      } else {
        // executive/custom are exclusive
        if (key === 'executive' || key === 'custom') {
          return new Set([key]);
        }
        next.delete('executive');
        next.delete('custom');
        next.add(key);
      }
      return next;
    });
  };
  const [customPrompt, setCustomPrompt] = useState('');
  const [reportLength, setReportLength] = useState('executive');
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState('');
  const [copied, setCopied] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const yearFrom = periodYears === 0 ? 1997 : currentYear - periodYears + 1;
  const yearTo = currentYear;

  // Auto-scroll as content streams
  useEffect(() => {
    if (contentRef.current && generating) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [report, generating]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setReport('');
    setError(null);
    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/ai-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportTypes: Array.from(selectedTypes),
          yearFrom,
          yearTo,
          reportLength,
          customPrompt: customPrompt.trim() || undefined,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setReport(fullText);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Error al generar el informe');
    } finally {
      setGenerating(false);
    }
  }, [selectedTypes, yearFrom, yearTo, customPrompt, reportLength]);

  const handleStop = () => {
    abortRef.current?.abort();
    setGenerating(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPDF = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const selectedList = REPORT_TYPES.filter(t => selectedTypes.has(t.key));
    const title = selectedList.length === 1
      ? selectedList[0].label
      : (selectedTypes.has('executive') ? 'Informe Ejecutivo General' : `Informe Editorial`);
    win.document.write(`
      <!DOCTYPE html>
      <html><head>
        <title>${title} - PubManager</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #333; line-height: 1.7; font-size: 14px; }
          h1 { color: #1B5E20; border-bottom: 2px solid #1B5E20; padding-bottom: 8px; }
          h2 { color: #2E7D32; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-top: 28px; }
          h3 { color: #333; margin-top: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
          th { background: #f5f5f5; padding: 8px 12px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 700; }
          td { padding: 7px 12px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) { background: #fafafa; }
          ul { padding-left: 24px; }
          li { margin-bottom: 4px; }
          strong { color: #111; }
          code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; font-size: 12px; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #999; text-align: center; }
          @media print { body { margin: 20px; } .no-print { display: none; } }
        </style>
      </head><body>
        <div class="no-print" style="margin-bottom:20px; text-align:right;">
          <button onclick="window.print()" style="padding:8px 20px; background:#1B5E20; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;">🖨️ Imprimir / Guardar PDF</button>
        </div>
        ${markdownToHtml(report)}
        <div class="footer">
          Generado por PubManager AI · Universidad Simón Bolívar · ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </body></html>
    `);
    win.document.close();
  };

  const handleExportWord = async () => {
    if (!report) return;
    setExportingWord(true);
    try {
      const selectedList = REPORT_TYPES.filter(t => selectedTypes.has(t.key));
      const title = selectedList.length === 1
        ? selectedList[0].label
        : (selectedTypes.has('executive') ? 'Informe Ejecutivo General' : `Informe Editorial`);

      await exportReportToWord({
        title,
        reportMarkdown: report,
        period: yearFrom === yearTo ? `Año ${yearTo} (en curso)` : `${yearFrom}–${yearTo}`,
        fileName: `${title.replace(/\s+/g, '_')}_${yearFrom === yearTo ? yearTo : `${yearFrom}-${yearTo}`}.docx`,
      });
    } catch (err: any) {
      console.error('Error al exportar Word:', err);
      alert('Error al generar el archivo de Word: ' + (err.message || err));
    } finally {
      setExportingWord(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }} onClick={e => { if (e.target === e.currentTarget && !generating) onClose(); }}>
      <div style={{
        background: '#ffffff', borderRadius: '16px',
        width: '100%', maxWidth: report ? '1100px' : '700px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        transition: 'max-width 0.3s ease',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--gray-200)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #1B5E20, #43A047)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--gray-900)' }}>
                Informes con Inteligencia Artificial
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--gray-500)' }}>
                Powered by Gemini · Datos en tiempo real de PubManager
              </p>
            </div>
          </div>
          <button onClick={generating ? handleStop : onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px', borderRadius: '6px', color: 'var(--gray-500)',
          }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Left panel: config */}
          <div style={{
            width: report ? '300px' : '100%', padding: '20px',
            borderRight: report ? '1px solid var(--gray-200)' : 'none',
            overflowY: 'auto', transition: 'width 0.3s ease',
            flexShrink: 0,
          }}>
            {/* Report type selector */}
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Tipo de Informe
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--gray-400)', marginBottom: '2px' }}>Puedes seleccionar varios módulos a la vez</div>
              {REPORT_TYPES.map(type => {
                const isSelected = selectedTypes.has(type.key);
                const isMulti = type.key !== 'executive' && type.key !== 'custom';
                return (
                  <button
                    key={type.key}
                    onClick={() => toggleType(type.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 14px', borderRadius: '10px',
                      border: isSelected ? `2px solid ${type.color}` : '2px solid var(--gray-200)',
                      background: isSelected ? `${type.color}10` : 'transparent',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}
                  >
                    {/* Checkbox indicator */}
                    <div style={{
                      width: '18px', height: '18px', borderRadius: isMulti ? '4px' : '50%',
                      border: isSelected ? `2px solid ${type.color}` : '2px solid var(--gray-300)',
                      background: isSelected ? type.color : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 0.15s',
                    }}>
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div style={{ color: isSelected ? type.color : 'var(--gray-400)', flexShrink: 0 }}>
                      {type.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? type.color : 'var(--gray-700)' }}>
                        {type.label}
                      </div>
                      {!report && (
                        <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '2px' }}>
                          {type.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Period */}
            <div style={{ marginTop: '20px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Calendar size={12} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                Período
              </label>
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                {PERIOD_PRESETS.map(p => (
                  <button
                    key={p.years}
                    onClick={() => setPeriodYears(p.years)}
                    style={{
                      padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                      border: 'none', cursor: 'pointer',
                      background: periodYears === p.years ? 'var(--primary)' : 'var(--gray-100)',
                      color: periodYears === p.years ? '#fff' : 'var(--gray-600)',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '6px' }}>
                Analizando: <strong>{yearFrom === yearTo ? `Año ${yearTo} (Vigencia en curso)` : `${yearFrom}–${yearTo}`}</strong>
              </div>
            </div>

            {/* Report length */}
            <div style={{ marginTop: '20px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ✏️ Extensión
              </label>
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                {LENGTH_PRESETS.map(l => (
                  <button
                    key={l.key}
                    onClick={() => setReportLength(l.key)}
                    title={l.desc}
                    style={{
                      flex: 1, padding: '7px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                      border: 'none', cursor: 'pointer',
                      background: reportLength === l.key ? 'var(--primary)' : 'var(--gray-100)',
                      color: reportLength === l.key ? '#fff' : 'var(--gray-600)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--gray-400)', marginTop: '4px' }}>
                {LENGTH_PRESETS.find(l => l.key === reportLength)?.desc}
              </div>
            </div>

            {/* Custom focus */}
            <div style={{ marginTop: '20px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {selectedTypes.has('custom') ? '¿Qué quieres analizar?' : 'Enfoque especial (opcional)'}
              </label>
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder={selectedTypes.has('custom')
                  ? 'Ej: "¿Cuáles son las revistas con mejor posicionamiento?"'
                  : 'Ej: "Comparar 2024 vs 2023", "Enfocarse en libros compilatorios"'
                }
                style={{
                  width: '100%', marginTop: '8px', padding: '10px 12px',
                  borderRadius: '8px', border: '1px solid var(--gray-300)',
                  fontSize: '13px', resize: 'vertical', minHeight: '60px',
                  fontFamily: 'inherit', color: 'var(--gray-700)',
                  background: '#ffffff',
                }}
              />
            </div>

            {/* Generate button */}
            <button
              onClick={generating ? handleStop : handleGenerate}
              disabled={selectedTypes.has('custom') && !customPrompt.trim()}
              style={{
                width: '100%', marginTop: '20px', padding: '12px',
                borderRadius: '10px', border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: 700,
                background: generating
                  ? 'var(--error)'
                  : 'linear-gradient(135deg, #1B5E20, #2E7D32)',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                opacity: selectedTypes.has('custom') && !customPrompt.trim() ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
            >
              {generating ? (
                <><Loader2 size={16} className="spin" /> Detener generación</>
              ) : (
                <><Sparkles size={16} /> Generar Informe con IA</>
              )}
            </button>

            {error && (
              <div style={{
                marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
                background: '#FEF2F2', border: '1px solid #FECACA',
                fontSize: '12px', color: '#DC2626',
              }}>
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Right panel: report output */}
          {report && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {/* Toolbar */}
              <div style={{
                padding: '10px 16px', borderBottom: '1px solid var(--gray-200)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--gray-50)', flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} color="var(--gray-500)" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-600)' }}>
                    {REPORT_TYPES.filter(t => selectedTypes.has(t.key)).map(t => t.label).join(' + ')}
                  </span>
                  {generating && (
                    <span style={{
                      fontSize: '10px', color: 'var(--primary)', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                      <Loader2 size={10} className="spin" /> Generando...
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleCopy} className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>
                    {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                  </button>
                  <button
                    onClick={handleExportWord}
                    disabled={exportingWord}
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: '11px',
                      background: '#2B579A15',
                      color: '#2B579A',
                      borderColor: '#2B579A30',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontWeight: 600,
                    }}
                    title="Exportar informe editable en formato Microsoft Word (.docx)"
                  >
                    {exportingWord ? (
                      <><Loader2 size={12} className="spin" /> Word...</>
                    ) : (
                      <>
                        <FileText size={12} color="#2B579A" />
                        Word (.docx)
                      </>
                    )}
                  </button>
                  <button onClick={handleExportPDF} className="btn btn-secondary btn-sm" style={{ fontSize: '11px' }}>
                    <Download size={12} /> PDF
                  </button>
                </div>
              </div>

              {/* Content */}
              <div
                ref={contentRef}
                style={{
                  flex: 1, padding: '24px 28px', overflowY: 'auto',
                  lineHeight: 1.7,
                }}
              >
                {renderMarkdown(report)}
                {generating && (
                  <span style={{
                    display: 'inline-block', width: '8px', height: '18px',
                    background: 'var(--primary)', borderRadius: '2px',
                    animation: 'blink 1s infinite', verticalAlign: 'text-bottom',
                    marginLeft: '2px',
                  }} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ─── Markdown to HTML (for PDF export) ─── */
function markdownToHtml(md: string): string {
  return md
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/^---+$/gm, '<hr/>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\|(.+)\|/g, (match) => {
      if (/^[\s|:-]+$/.test(match)) return '';
      const cells = match.split('|').filter(Boolean).map(c => c.trim());
      return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>')
    .replace(/^(?!<[hluot])/gm, '<p>')
    .replace(/<p>\s*$/gm, '')
    ;
}
