'use client';

import { useState, useEffect } from 'react';
import { X, FileText, Download, ChevronRight, ChevronLeft, Check, Loader2, BookOpen, Search, Newspaper, CheckSquare, Square } from 'lucide-react';
import {
  TEMPLATE_CONFIGS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  getTemplatesByCategory,
  getTemplateById,
  type CertificateCategory,
  type TemplateConfig,
} from '@/lib/certificateTemplateMap';
import { generateCertificate, getCertificatePreview } from '@/lib/certificateGenerator';
import { createClient } from '@/lib/supabase/client';

interface CertificateFormProps {
  onClose: () => void;
  onGenerated: () => void;
}

interface BookOption {
  id: string;
  title: string;
  isbn_digital: string | null;
  isbn_print: string | null;
  editorial: string | null;
  year_published: number | null;
  book_type: string | null;
  authors: string[];
  editors: string[];
  chapters: { id: string; title: string; authors: string[]; start_page?: number | null; end_page?: number | null }[];
}

interface JournalOption {
  id: string;
  name: string;
  issn_online: string | null;
  issn_print: string | null;
  editor_name: string | null;
  ojs_url: string | null;
}

type Step = 'category' | 'template' | 'book_select' | 'fields' | 'preview';

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

export default function CertificateForm({ onClose, onGenerated }: CertificateFormProps) {
  const [step, setStep] = useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = useState<CertificateCategory | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateConfig | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Source selection: book vs journal
  const [sourceType, setSourceType] = useState<'book' | 'journal'>('book');

  // Book pre-loading
  const [books, setBooks] = useState<BookOption[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [bookSearch, setBookSearch] = useState('');
  const [selectedBook, setSelectedBook] = useState<BookOption | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedMultiChapterIds, setSelectedMultiChapterIds] = useState<string[]>([]);

  // Journal pre-loading
  const [journals, setJournals] = useState<JournalOption[]>([]);
  const [selectedJournal, setSelectedJournal] = useState<JournalOption | null>(null);

  const categories = Object.keys(CATEGORY_LABELS) as CertificateCategory[];
  const supabase = createClient();

  // Load books & journals when entering the book selection step
  useEffect(() => {
    if (step === 'book_select') {
      loadDataSources();
    }
  }, [step, selectedCategory]);

  const loadDataSources = async () => {
    setLoadingBooks(true);
    try {
      // 1. Fetch books
      const { data: booksData } = await supabase
        .from('books')
        .select('id, title, isbn_digital, isbn_print, editorial, year_published, book_type')
        .order('title');

      if (booksData) {
        const { data: chaptersCount } = await supabase
          .from('book_chapters')
          .select('book_id');

        const chCountMap = new Map<string, number>();
        (chaptersCount || []).forEach((c: any) => {
          chCountMap.set(c.book_id, (chCountMap.get(c.book_id) || 0) + 1);
        });

        const bookOptions: BookOption[] = booksData.map((book: any) => ({
          ...book,
          authors: [],
          editors: [],
          chapters: [],
          _chapterCount: chCountMap.get(book.id) || 0,
        }));
        setBooks(bookOptions as any);
      }

      // 2. Fetch journals if category is ERL or boletín
      if (selectedCategory === 'erl' || selectedCategory === 'boletin') {
        const { data: journalsData } = await supabase
          .from('journals')
          .select('id, name, issn_online, issn_print, editor_name, ojs_url')
          .order('name');
        if (journalsData) {
          setJournals(journalsData);
        }
      }
    } catch (err) {
      console.error('Error loading data sources:', err);
    }
    setLoadingBooks(false);
  };

  // Load full details for a specific book
  const loadBookDetails = async (bookId: string): Promise<BookOption | null> => {
    try {
      const { data: authorsData } = await supabase
        .from('book_authors')
        .select('person_id, role, people(full_name)')
        .eq('book_id', bookId)
        .order('author_order');

      const bookAuthors = (authorsData || [])
        .filter((a: any) => !(a.role || '').toLowerCase().includes('editor'))
        .map((a: any) => (a as any).people?.full_name || 'Desconocido');

      const bookEditors = (authorsData || [])
        .filter((a: any) => (a.role || '').toLowerCase().includes('editor'))
        .map((a: any) => (a as any).people?.full_name || 'Desconocido');

      const { data: chaptersData } = await supabase
        .from('book_chapters')
        .select('id, title, chapter_number, start_page, end_page')
        .eq('book_id', bookId)
        .order('chapter_number');

      const chapterIds = (chaptersData || []).map((c: any) => c.id);
      let chapterAuthorsData: any[] = [];
      if (chapterIds.length > 0) {
        const { data } = await supabase
          .from('chapter_authors')
          .select('chapter_id, people(full_name)')
          .in('chapter_id', chapterIds)
          .order('author_order');
        chapterAuthorsData = data || [];
      }

      const bookChapters = (chaptersData || []).map((ch: any) => ({
        id: ch.id,
        title: ch.title || 'Sin título',
        start_page: ch.start_page,
        end_page: ch.end_page,
        authors: chapterAuthorsData
          .filter((ca: any) => ca.chapter_id === ch.id)
          .map((ca: any) => (ca as any).people?.full_name || 'Desconocido'),
      }));

      const originalBook = books.find(b => b.id === bookId);
      if (!originalBook) return null;

      return {
        ...originalBook,
        authors: bookAuthors.length > 0 ? bookAuthors : (authorsData || []).map((a: any) => (a as any).people?.full_name || 'Desconocido'),
        editors: bookEditors,
        chapters: bookChapters,
      };
    } catch (err) {
      console.error('Error loading book details:', err);
      return null;
    }
  };

  const handleCategorySelect = (cat: CertificateCategory) => {
    setSelectedCategory(cat);
    const templates = getTemplatesByCategory(cat);
    if (templates.length === 1) {
      setSelectedTemplate(templates[0]);
      setStep('book_select');
    } else {
      setStep('template');
    }
  };

  const handleTemplateSelect = (tpl: TemplateConfig) => {
    setSelectedTemplate(tpl);
    setStep('book_select');
  };

  const handleBookSelect = async (book: BookOption) => {
    setLoadingBooks(true);
    const detailed = await loadBookDetails(book.id);
    setLoadingBooks(false);
    
    if (!detailed) {
      setSelectedBook(book);
      return;
    }

    setSelectedBook(detailed);
    setSelectedMultiChapterIds(detailed.chapters.map(c => c.id));

    const today = new Date();
    const currentDay = today.getDate().toString();
    const currentMonth = MONTH_NAMES[today.getMonth()];
    const currentYear = today.getFullYear().toString();

    // Pre-fill form data from the book
    const prefilled: Record<string, string> = {
      ...formData,
      libro_titulo: detailed.title || '',
      titulo_obra: detailed.title || '',
      titulo_publicacion: detailed.title || '',
      autores: detailed.authors.join(', '),
      editores: detailed.editors.length > 0 ? detailed.editors.join(' y ') : '',
      isbn_impreso: detailed.isbn_print || '',
      isbn_digital: detailed.isbn_digital || '',
      isbn_deposito: detailed.isbn_digital || detailed.isbn_print || '',
      codigo_issn_isbn: detailed.isbn_digital || detailed.isbn_print || '',
      tipo_codigo: 'ISBN',
      editorial: detailed.editorial || 'Ediciones Universidad Simón Bolívar',
      anio_publicacion: detailed.year_published?.toString() || currentYear,
      dia_expedicion: currentDay,
      mes_expedicion: currentMonth,
      anio_expedicion: currentYear,
      ciudad: 'Barranquilla, Colombia',
    };
    setFormData(prefilled);
  };

  const handleJournalSelect = (journal: JournalOption) => {
    setSelectedJournal(journal);
    setSelectedBook(null);

    const today = new Date();
    const currentDay = today.getDate().toString();
    const currentMonth = MONTH_NAMES[today.getMonth()];
    const currentYear = today.getFullYear().toString();

    const prefilled: Record<string, string> = {
      ...formData,
      titulo_publicacion: journal.name || '',
      titulo_boletin: journal.name || '',
      codigo_issn_isbn: journal.issn_online || journal.issn_print || '',
      identificador_serie: journal.issn_online || journal.issn_print || 'ISSN Institucional',
      tipo_codigo: 'ISSN',
      nombre_investigador: journal.editor_name || '',
      autores: journal.editor_name || '',
      rol_editorial: 'Editor General',
      enlace_publicacion: journal.ojs_url || '',
      url_bonga: journal.ojs_url || '',
      editorial: 'Ediciones Universidad Simón Bolívar',
      dia_expedicion: currentDay,
      mes_expedicion: currentMonth,
      anio_expedicion: currentYear,
      anio_publicacion: currentYear,
    };
    setFormData(prefilled);
  };

  const handleChapterSelect = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    const chapter = selectedBook?.chapters.find(c => c.id === chapterId);
    if (chapter) {
      const pageStr = chapter.start_page && chapter.end_page ? `${chapter.start_page}-${chapter.end_page}` : (chapter.start_page ? `${chapter.start_page}` : '');
      setFormData(prev => ({
        ...prev,
        capitulo_titulo: chapter.title,
        nombre_autor: chapter.authors.length > 0 ? chapter.authors[0] : prev.nombre_autor || '',
        autores: chapter.authors.length > 0 ? chapter.authors.join(', ') : prev.autores || '',
        paginas: pageStr,
        pagina_inicial: chapter.start_page?.toString() || '',
        pagina_final: chapter.end_page?.toString() || '',
      }));
    }
  };

  const toggleMultiChapter = (id: string) => {
    setSelectedMultiChapterIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleAllMultiChapters = () => {
    if (!selectedBook) return;
    if (selectedMultiChapterIds.length === selectedBook.chapters.length) {
      setSelectedMultiChapterIds([]);
    } else {
      setSelectedMultiChapterIds(selectedBook.chapters.map(c => c.id));
    }
  };

  const handleContinueToFields = () => {
    // If dates are not set, set default to today
    const today = new Date();
    setFormData(prev => ({
      ...prev,
      dia_expedicion: prev.dia_expedicion || today.getDate().toString(),
      mes_expedicion: prev.mes_expedicion || MONTH_NAMES[today.getMonth()],
      anio_expedicion: prev.anio_expedicion || today.getFullYear().toString(),
    }));
    setStep('fields');
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleBack = () => {
    if (step === 'preview') setStep('fields');
    else if (step === 'fields') setStep('book_select');
    else if (step === 'book_select') {
      const templates = selectedCategory ? getTemplatesByCategory(selectedCategory) : [];
      setStep(templates.length === 1 ? 'category' : 'template');
    }
    else if (step === 'template') setStep('category');
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    setGenerating(true);
    setError('');

    try {
      let dataForTemplate: Record<string, any> = { ...formData };

      // For multi-chapter templates, build chapters array
      if (selectedTemplate.id.includes('varios-capitulos') && selectedBook) {
        const chaptersToInclude = selectedBook.chapters.filter(ch => 
          selectedMultiChapterIds.length === 0 || selectedMultiChapterIds.includes(ch.id)
        );
        dataForTemplate.capitulos = chaptersToInclude.map((ch, idx) => {
          const pags = ch.start_page && ch.end_page ? `pp. ${ch.start_page}-${ch.end_page}` : (ch.start_page ? `p. ${ch.start_page}` : '');
          const autoresPags = ch.authors.join(', ') + (pags ? ` (${pags})` : '');
          return {
            cap_numero: (idx + 1).toString(),
            cap_titulo: ch.title,
            cap_autores: ch.authors.join(', '),
            cap_autores_pags: autoresPags,
            paginas: ch.start_page && ch.end_page ? `${ch.start_page}-${ch.end_page}` : (ch.start_page ? `${ch.start_page}` : ''),
            paginas_str: pags ? ` (${pags})` : '',
          };
        });
        dataForTemplate.editores = formData.editores || '';
      }

      const result = await generateCertificate(selectedTemplate.id, dataForTemplate);
      if (!result.success) {
        setError(result.error || 'Error al generar');
        setGenerating(false);
        return;
      }

      // Record certificate in database
      const recipient = formData.nombre_autor || formData.nombre_investigador || formData.autores || 'Sin destinatario';
      const titleRef = formData.libro_titulo || formData.capitulo_titulo || formData.titulo_obra || formData.titulo_publicacion || formData.titulo_boletin || null;

      const { error: dbError } = await supabase.from('certificates').insert({
        certificate_type: selectedTemplate.id,
        recipient_name: recipient,
        recipient_cedula: formData.cedula || formData.numero_documento || null,
        title_reference: titleRef,
        description: selectedTemplate.label,
        document_category: selectedTemplate.category,
        publication_type: formData.capitulo_titulo ? 'capitulo' : 'libro',
        editorial_type: selectedTemplate.id.includes('extranjera') ? 'editorial_extranjera' : 
                        selectedTemplate.id.includes('divulgacion') ? 'divulgacion' : 'sello_propio',
        template_file: selectedTemplate.templateFile,
        generated_data: formData,
        status: 'expedido',
      });

      if (dbError) {
        console.warn('Error saving certificate record to DB:', dbError);
      }

      setGenerating(false);
      onGenerated();
    } catch (err) {
      console.error(err);
      setError('Error inesperado al generar el certificado');
      setGenerating(false);
    }
  };

  const isFieldsValid = () => {
    if (!selectedTemplate) return false;
    return selectedTemplate.fields
      .filter(f => f.required)
      .every(f => formData[f.key]?.trim());
  };

  const isMultiChapter = selectedTemplate?.id.includes('varios-capitulos') || false;
  const needsSingleChapter = selectedTemplate?.fields.some(f => f.key === 'capitulo_titulo') || false;

  const filteredBooks = books.filter(b =>
    !bookSearch || b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.authors.some(a => a.toLowerCase().includes(bookSearch.toLowerCase()))
  );

  const filteredJournals = journals.filter(j =>
    !bookSearch || j.name.toLowerCase().includes(bookSearch.toLowerCase()) ||
    (j.editor_name && j.editor_name.toLowerCase().includes(bookSearch.toLowerCase()))
  );

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px',
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '780px',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #eee',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1a1a1a' }}>
              Nuevo Certificado Institucional
            </h3>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Bajo Membrete Oficial Unisimón • Modelo Minciencias 2024
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#f5f5f5', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}>
            <X size={18} color="#666" />
          </button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', padding: '12px 24px', background: '#fafafa', borderBottom: '1px solid #eee', gap: '8px', fontSize: '12px' }}>
          {[
            { key: 'category', label: '1. Tipología / Producto' },
            { key: 'template', label: '2. Formato' },
            { key: 'book_select', label: '3. Datos BD' },
            { key: 'fields', label: '4. Campos' },
            { key: 'preview', label: '5. Descargar' },
          ].map((s, i) => {
            const stepOrder = ['category', 'template', 'book_select', 'fields', 'preview'];
            const currentIdx = stepOrder.indexOf(step);
            const isCompleted = currentIdx > i;
            const isCurrent = step === s.key;
            return (
              <div key={s.key} style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                color: isCurrent ? 'var(--primary)' : isCompleted ? '#2E7D32' : '#aaa',
                fontWeight: isCurrent ? 700 : 500,
              }}>
                {isCompleted && <Check size={14} />}
                {s.label}
                {i < 4 && <span style={{ color: '#ddd', marginLeft: '6px' }}>›</span>}
              </div>
            );
          })}
        </div>

        {/* Content body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

          {/* Step 1: Category Selection */}
          {step === 'category' && (
            <div>
              <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
                Selecciona la tipología de producto académico o certificación que deseas emitir:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {categories.map(cat => {
                  const info = CATEGORY_COLORS[cat];
                  const count = getTemplatesByCategory(cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => handleCategorySelect(cat)}
                      style={{
                        padding: '16px', borderRadius: '12px',
                        border: '1px solid #e0e0e0', background: 'white',
                        textAlign: 'left', cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex', flexDirection: 'column', gap: '6px',
                      }}
                      onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = info.color; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; }}
                      onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e0e0e0'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '20px' }}>{info.icon}</span>
                        <span style={{ fontSize: '11px', color: '#888', background: info.bg, padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                          {count} formato{count > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#222' }}>
                        {CATEGORY_LABELS[cat]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Template Selection */}
          {step === 'template' && selectedCategory && (
            <div>
              <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
                Selecciona la variación específica del certificado:
              </p>
              <div style={{ display: 'grid', gap: '10px' }}>
                {getTemplatesByCategory(selectedCategory).map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => handleTemplateSelect(tpl)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 18px', borderRadius: '12px',
                      border: '1px solid #eee', background: 'white',
                      textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; }}
                    onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = '#eee'; }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#333' }}>{tpl.label}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{tpl.description}</div>
                    </div>
                    <ChevronRight size={16} color="#ccc" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Book / Journal Selection */}
          {step === 'book_select' && (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div style={{
                padding: '12px 16px', borderRadius: '10px',
                background: '#E3F2FD', border: '1px solid #90CAF920',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1565C0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={16} /> Pre-cargar datos desde la base de datos
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  Selecciona la publicación registrada para auto-llenar los títulos, autores, ISBN/ISSN y fechas en la plantilla oficial.
                </div>
              </div>

              {/* Source Toggle if ERL or Boletin */}
              {(selectedCategory === 'erl' || selectedCategory === 'boletin') && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setSourceType('book')}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                      border: sourceType === 'book' ? '2px solid var(--primary)' : '1px solid #ddd',
                      background: sourceType === 'book' ? '#E8F5E9' : 'white', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                    }}
                  >
                    <BookOpen size={14} /> Buscar en Catálogo de Libros
                  </button>
                  <button
                    onClick={() => setSourceType('journal')}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                      border: sourceType === 'journal' ? '2px solid var(--primary)' : '1px solid #ddd',
                      background: sourceType === 'journal' ? '#E8F5E9' : 'white', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                    }}
                  >
                    <Newspaper size={14} /> Buscar en Revistas Institucionales (OJS)
                  </button>
                </div>
              )}

              {loadingBooks ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
                  <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '13px' }}>Cargando catálogo...</p>
                </div>
              ) : (
                <>
                  {/* Search */}
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                    <input
                      type="text" placeholder={sourceType === 'journal' ? 'Buscar revista por nombre o editor...' : 'Buscar libro por título o autor...'}
                      value={bookSearch} onChange={e => setBookSearch(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px',
                        border: '1px solid #ddd', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Journals List */}
                  {sourceType === 'journal' ? (
                    <div style={{ maxHeight: '280px', overflow: 'auto', display: 'grid', gap: '8px' }}>
                      {filteredJournals.map(j => (
                        <button key={j.id} onClick={() => handleJournalSelect(j)} style={{
                          display: 'flex', alignItems: 'flex-start', gap: '12px',
                          padding: '12px 16px', borderRadius: '12px', textAlign: 'left',
                          border: selectedJournal?.id === j.id ? '2px solid var(--primary)' : '1px solid #eee',
                          background: selectedJournal?.id === j.id ? '#E8F5E910' : 'white',
                          cursor: 'pointer',
                        }}>
                          <Newspaper size={20} color="#1565C0" style={{ marginTop: '2px', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: '#333' }}>{j.name}</div>
                            {j.editor_name && (
                              <div style={{ fontSize: '11px', color: '#777', marginTop: '2px' }}>👤 Editor: {j.editor_name}</div>
                            )}
                            <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                              ISSN: {j.issn_online || j.issn_print || 'N/A'}
                            </div>
                          </div>
                          {selectedJournal?.id === j.id && <Check size={16} color="var(--primary)" />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    /* Books List */
                    <div style={{ maxHeight: '280px', overflow: 'auto', display: 'grid', gap: '8px' }}>
                      {filteredBooks.map(book => (
                        <button key={book.id} onClick={() => handleBookSelect(book)} style={{
                          display: 'flex', alignItems: 'flex-start', gap: '12px',
                          padding: '12px 16px', borderRadius: '12px', textAlign: 'left',
                          border: selectedBook?.id === book.id ? '2px solid var(--primary)' : '1px solid #eee',
                          background: selectedBook?.id === book.id ? '#E8F5E910' : 'white',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                            background: selectedBook?.id === book.id ? '#E8F5E9' : '#f5f5f5',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {selectedBook?.id === book.id ? <Check size={16} color="var(--primary)" /> : <BookOpen size={16} color="#999" />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: '#333', lineHeight: '1.3' }}>
                              {book.title}
                            </div>
                            {book.authors.length > 0 && (
                              <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>
                                👤 {book.authors.join(', ')}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                              {book.isbn_print && <span style={{ fontSize: '10px', color: '#999' }}>ISBN: {book.isbn_print}</span>}
                              {book.year_published && <span style={{ fontSize: '10px', color: '#999' }}>📅 {book.year_published}</span>}
                              {((book as any)._chapterCount > 0 || book.chapters.length > 0) && (
                                <span style={{ fontSize: '10px', color: '#1565C0' }}>📑 {book.chapters.length || (book as any)._chapterCount} capítulos</span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Multi-chapter selector (for compilatorios) */}
                  {selectedBook && isMultiChapter && selectedBook.chapters.length > 0 && (
                    <div style={{ marginTop: '8px', padding: '12px', background: '#F9FBE7', borderRadius: '10px', border: '1px solid #E6EE9C' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#33691E' }}>
                          Capítulos a certificar ({selectedMultiChapterIds.length} de {selectedBook.chapters.length} seleccionados):
                        </span>
                        <button
                          onClick={toggleAllMultiChapters}
                          style={{ border: 'none', background: 'none', color: '#1565C0', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          {selectedMultiChapterIds.length === selectedBook.chapters.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                        </button>
                      </div>
                      <div style={{ display: 'grid', gap: '6px', maxHeight: '160px', overflow: 'auto' }}>
                        {selectedBook.chapters.map(ch => {
                          const isChecked = selectedMultiChapterIds.includes(ch.id);
                          return (
                            <div
                              key={ch.id}
                              onClick={() => toggleMultiChapter(ch.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                                background: isChecked ? 'white' : '#f5f5f5', borderRadius: '8px', cursor: 'pointer',
                                border: isChecked ? '1px solid #C0CA33' : '1px solid #eee', fontSize: '12px',
                              }}
                            >
                              {isChecked ? <CheckSquare size={16} color="#33691E" /> : <Square size={16} color="#999" />}
                              <div style={{ flex: 1 }}>
                                <span style={{ fontWeight: isChecked ? 600 : 400, color: '#333' }}>{ch.title}</span>
                                {ch.authors.length > 0 && <span style={{ color: '#777', marginLeft: '6px', fontSize: '11px' }}>({ch.authors.join(', ')})</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Single chapter selector */}
                  {selectedBook && needsSingleChapter && selectedBook.chapters.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '8px', display: 'block' }}>
                        Selecciona el capítulo específico a certificar:
                      </label>
                      <div style={{ display: 'grid', gap: '6px', maxHeight: '160px', overflow: 'auto' }}>
                        {selectedBook.chapters.map(ch => (
                          <button key={ch.id} onClick={() => handleChapterSelect(ch.id)} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 14px', borderRadius: '10px', textAlign: 'left',
                            border: selectedChapterId === ch.id ? '2px solid #1565C0' : '1px solid #eee',
                            background: selectedChapterId === ch.id ? '#E3F2FD' : 'white',
                            cursor: 'pointer', fontSize: '12px',
                          }}>
                            <span style={{ color: selectedChapterId === ch.id ? '#1565C0' : '#999', fontWeight: 600 }}>📑</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500, color: '#333' }}>{ch.title}</div>
                              {ch.authors.length > 0 && (
                                <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                                  {ch.authors.join(', ')}
                                </div>
                              )}
                            </div>
                            {selectedChapterId === ch.id && <Check size={14} color="#1565C0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 4: Form Fields */}
          {step === 'fields' && selectedTemplate && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{
                padding: '12px 16px', borderRadius: '10px',
                background: CATEGORY_COLORS[selectedTemplate.category].bg,
                border: `1px solid ${CATEGORY_COLORS[selectedTemplate.category].color}20`,
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: CATEGORY_COLORS[selectedTemplate.category].color }}>
                  {selectedTemplate.label}
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{selectedTemplate.description}</div>
                {selectedBook && (
                  <div style={{ fontSize: '11px', color: '#2E7D32', marginTop: '4px', fontWeight: 500 }}>
                    📚 Datos pre-cargados de: {selectedBook.title}
                  </div>
                )}
                {selectedJournal && (
                  <div style={{ fontSize: '11px', color: '#1565C0', marginTop: '4px', fontWeight: 500 }}>
                    📰 Revista seleccionada: {selectedJournal.name}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gap: '14px' }}>
                {selectedTemplate.fields.map(field => (
                  <div key={field.key}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#444', marginBottom: '4px' }}>
                      {field.label} {field.required && <span style={{ color: '#E53935' }}>*</span>}
                    </label>

                    {field.type === 'textarea' ? (
                      <textarea
                        rows={2}
                        value={formData[field.key] || ''}
                        onChange={e => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: '8px',
                          border: '1px solid #ddd', fontSize: '13px', outline: 'none',
                          boxSizing: 'border-box', resize: 'vertical',
                        }}
                      />
                    ) : field.type === 'select' && field.options ? (
                      <select
                        value={formData[field.key] || ''}
                        onChange={e => handleFieldChange(field.key, e.target.value)}
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: '8px',
                          border: '1px solid #ddd', fontSize: '13px', outline: 'none',
                          boxSizing: 'border-box', background: 'white',
                        }}
                      >
                        <option value="">Seleccione una opción</option>
                        {field.options.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={formData[field.key] || ''}
                        onChange={e => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: '8px',
                          border: '1px solid #ddd', fontSize: '13px', outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Preview & Download */}
          {step === 'preview' && selectedTemplate && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{
                padding: '16px', borderRadius: '12px',
                background: CATEGORY_COLORS[selectedTemplate.category].bg,
                border: `1px solid ${CATEGORY_COLORS[selectedTemplate.category].color}30`,
              }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: CATEGORY_COLORS[selectedTemplate.category].color, marginBottom: '4px' }}>
                  {CATEGORY_COLORS[selectedTemplate.category].icon} {selectedTemplate.label}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  Plantilla Oficial: {selectedTemplate.templateFile}
                </div>
              </div>

              <div style={{
                border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden',
              }}>
                <div style={{
                  padding: '10px 16px', background: '#f8f9fa',
                  fontSize: '12px', fontWeight: 600, color: '#555',
                  borderBottom: '1px solid #eee',
                }}>
                  Datos del certificado a expedir
                </div>
                {getCertificatePreview(selectedTemplate.id, formData).map((item, i) => (
                  <div key={i} style={{
                    padding: '10px 16px', display: 'flex',
                    borderBottom: '1px solid #f0f0f0',
                    fontSize: '13px',
                  }}>
                    <span style={{ color: '#888', width: '160px', flexShrink: 0 }}>{item.label}</span>
                    <span style={{ color: '#333', fontWeight: 500 }}>{item.value}</span>
                  </div>
                ))}
              </div>

              {error && (
                <div style={{
                  padding: '12px 16px', borderRadius: '10px',
                  background: '#FFEBEE', border: '1px solid #FFCDD2',
                  fontSize: '13px', color: '#C62828',
                }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #eee',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            {step !== 'category' && (
              <button onClick={handleBack} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 16px', borderRadius: '10px',
                border: '1px solid #ddd', background: 'white',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#555',
              }}>
                <ChevronLeft size={16} /> Atrás
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{
              padding: '10px 18px', borderRadius: '10px',
              border: '1px solid #ddd', background: 'white',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#555',
            }}>
              Cancelar
            </button>
            {step === 'book_select' && (
              <button
                onClick={handleContinueToFields}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 20px', borderRadius: '10px',
                  border: 'none', background: 'var(--primary)',
                  color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                {selectedBook || selectedJournal ? 'Continuar con datos' : 'Continuar sin pre-cargar'} <ChevronRight size={16} />
              </button>
            )}
            {step === 'fields' && (
              <button
                onClick={() => setStep('preview')}
                disabled={!isFieldsValid()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 20px', borderRadius: '10px',
                  border: 'none', background: isFieldsValid() ? 'var(--primary)' : '#ccc',
                  color: 'white', fontSize: '13px', fontWeight: 700,
                  cursor: isFieldsValid() ? 'pointer' : 'not-allowed',
                }}
              >
                Revisar <ChevronRight size={16} />
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 24px', borderRadius: '10px',
                  border: 'none', background: generating ? '#aaa' : 'var(--primary)',
                  color: 'white', fontSize: '13px', fontWeight: 700,
                  cursor: generating ? 'wait' : 'pointer',
                  boxShadow: generating ? 'none' : '0 4px 12px rgba(9,132,59,0.3)',
                }}
              >
                {generating ? (
                  <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generando...</>
                ) : (
                  <><Download size={16} /> Generar y Descargar (.docx)</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
