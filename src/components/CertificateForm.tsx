'use client';

import { useState, useEffect } from 'react';
import { X, FileText, Download, ChevronRight, ChevronLeft, Check, Loader2, BookOpen, Search } from 'lucide-react';
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

type Step = 'category' | 'template' | 'book_select' | 'fields' | 'preview';

export default function CertificateForm({ onClose, onGenerated }: CertificateFormProps) {
  const [step, setStep] = useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = useState<CertificateCategory | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateConfig | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Book/author pre-loading
  const [books, setBooks] = useState<BookOption[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [bookSearch, setBookSearch] = useState('');
  const [selectedBook, setSelectedBook] = useState<BookOption | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  const categories = Object.keys(CATEGORY_LABELS) as CertificateCategory[];
  const supabase = createClient();

  // Load book list (lightweight) when entering the book selection step
  useEffect(() => {
    if (step === 'book_select') {
      loadBookList();
    }
  }, [step]);

  const loadBookList = async () => {
    setLoadingBooks(true);
    try {
      // Just fetch book metadata — no authors/chapters yet
      const { data: booksData } = await supabase
        .from('books')
        .select('id, title, isbn_digital, isbn_print, editorial, year_published, book_type')
        .order('title');

      if (!booksData || booksData.length === 0) {
        setBooks([]);
        setLoadingBooks(false);
        return;
      }

      // Get chapter counts per book (lightweight)
      const { data: chaptersCount } = await supabase
        .from('book_chapters')
        .select('book_id');

      // Count chapters per book
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
    } catch (err) {
      console.error('Error loading books:', err);
    }
    setLoadingBooks(false);
  };

  // Load full details (authors, chapters, chapter_authors) for a specific book
  const loadBookDetails = async (bookId: string): Promise<BookOption | null> => {
    try {
      // Fetch book authors
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

      // Fetch chapters
      const { data: chaptersData } = await supabase
        .from('book_chapters')
        .select('id, title, chapter_number, start_page, end_page')
        .eq('book_id', bookId)
        .order('chapter_number');

      // Fetch chapter authors for these chapters
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

      // Find the original book from the list
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
    // Load full details for this book
    setLoadingBooks(true);
    const detailed = await loadBookDetails(book.id);
    setLoadingBooks(false);
    
    if (!detailed) {
      setSelectedBook(book);
      return;
    }

    setSelectedBook(detailed);
    // Pre-fill form data from the book
    const prefilled: Record<string, string> = {
      ...formData,
      libro_titulo: detailed.title || '',
      autores: detailed.authors.join(', '),
      editores: detailed.editors.length > 0 ? detailed.editors.join(' y ') : '',
      isbn_impreso: detailed.isbn_print || '',
      isbn_digital: detailed.isbn_digital || '',
      editorial: detailed.editorial || 'Ediciones Universidad Simón Bolívar',
      anio_publicacion: detailed.year_published?.toString() || '',
      ciudad: 'Barranquilla, Colombia',
    };
    setFormData(prefilled);
  };

  const handleChapterSelect = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    const chapter = selectedBook?.chapters.find(c => c.id === chapterId);
    if (chapter) {
      setFormData(prev => ({
        ...prev,
        capitulo_titulo: chapter.title,
        nombre_autor: chapter.authors.length > 0 ? chapter.authors[0] : prev.nombre_autor || '',
        autores: chapter.authors.length > 0 ? chapter.authors.join(', ') : prev.autores || '',
      }));
    }
  };

  const handleContinueToFields = () => {
    setStep('fields');
  };

  const handleSkipBookSelect = () => {
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
      // For multi-chapter templates, pass chapter data as array
      let dataForTemplate: Record<string, any> = { ...formData };
      if (selectedTemplate.id.includes('varios-capitulos') && selectedBook) {
        dataForTemplate.capitulos = selectedBook.chapters.map(ch => ({
          cap_titulo: ch.title,
          cap_autores: ch.authors.join(', '),
          paginas: ch.start_page && ch.end_page ? `${ch.start_page}-${ch.end_page}` : (ch.start_page ? `${ch.start_page}` : ''),
        }));
        dataForTemplate.editores = formData.editores || '';
        console.log('Capitulos data:', JSON.stringify(dataForTemplate.capitulos, null, 2));
      }
      const result = await generateCertificate(selectedTemplate.id, dataForTemplate);
      if (!result.success) {
        setError(result.error || 'Error al generar');
        setGenerating(false);
        return;
      }

      const { error: dbError } = await supabase.from('certificates').insert({
        certificate_type: selectedTemplate.id,
        recipient_name: formData.nombre_autor || formData.autores || 'Sin destinatario',
        recipient_cedula: formData.cedula || null,
        title_reference: formData.libro_titulo || formData.capitulo_titulo || null,
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
        console.warn('Error saving to DB (certificate was generated):', dbError);
      }

      setGenerating(false);
      onGenerated();
    } catch (err) {
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

  const filteredBooks = books.filter(b =>
    !bookSearch || b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
    b.authors.some(a => a.toLowerCase().includes(bookSearch.toLowerCase()))
  );

  // Check if selected template needs chapter info
  const needsChapter = selectedTemplate?.fields.some(f => f.key === 'capitulo_titulo') || false;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px',
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '720px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #eee',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileText size={20} color="var(--primary)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Generar Certificado</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>
                {step === 'category' && 'Paso 1: Selecciona la categoría'}
                {step === 'template' && 'Paso 2: Selecciona el tipo de certificado'}
                {step === 'book_select' && 'Paso 3: Selecciona un libro'}
                {step === 'fields' && 'Paso 4: Completa los datos'}
                {step === 'preview' && 'Paso 5: Revisa y genera'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
            color: '#999', borderRadius: '8px',
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '0 24px', paddingTop: '12px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['category', 'template', 'book_select', 'fields', 'preview'].map((s, i) => (
              <div key={s} style={{
                flex: 1, height: '3px', borderRadius: '2px',
                background: ['category', 'template', 'book_select', 'fields', 'preview'].indexOf(step) >= i
                  ? 'var(--primary)' : '#eee',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

          {/* Step 1: Category Selection */}
          {step === 'category' && (
            <div style={{ display: 'grid', gap: '10px' }}>
              {categories.map(cat => {
                const info = CATEGORY_COLORS[cat];
                const count = getTemplatesByCategory(cat).length;
                return (
                  <button key={cat} onClick={() => handleCategorySelect(cat)} style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '16px 18px', borderRadius: '12px',
                    border: '1px solid #eee', background: 'white',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                  }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = info.color; (e.currentTarget as HTMLElement).style.background = info.bg; }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = '#eee'; (e.currentTarget as HTMLElement).style.background = 'white'; }}
                  >
                    <span style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: info.bg, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '20px', flexShrink: 0,
                    }}>
                      {info.icon}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#1a1a2e' }}>
                        {CATEGORY_LABELS[cat]}
                      </div>
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                        {count} {count === 1 ? 'tipo disponible' : 'tipos disponibles'}
                      </div>
                    </div>
                    <ChevronRight size={18} color="#ccc" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Template Selection */}
          {step === 'template' && selectedCategory && (
            <div style={{ display: 'grid', gap: '10px' }}>
              {getTemplatesByCategory(selectedCategory).map(tpl => (
                <button key={tpl.id} onClick={() => handleTemplateSelect(tpl)} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 18px', borderRadius: '12px',
                  border: selectedTemplate?.id === tpl.id ? `2px solid ${CATEGORY_COLORS[selectedCategory].color}` : '1px solid #eee',
                  background: selectedTemplate?.id === tpl.id ? CATEGORY_COLORS[selectedCategory].bg : 'white',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = CATEGORY_COLORS[selectedCategory].color; }}
                onMouseOut={e => { if (selectedTemplate?.id !== tpl.id) (e.currentTarget as HTMLElement).style.borderColor = '#eee'; }}
                >
                  <FileText size={18} color={CATEGORY_COLORS[selectedCategory].color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#1a1a2e' }}>{tpl.label}</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{tpl.description}</div>
                  </div>
                  <ChevronRight size={16} color="#ccc" />
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Book Selection (NEW) */}
          {step === 'book_select' && (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div style={{
                padding: '12px 16px', borderRadius: '10px',
                background: '#E3F2FD', border: '1px solid #90CAF920',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1565C0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={16} /> Selecciona un libro para pre-cargar datos
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  Los campos se llenarán automáticamente con la información del libro y sus autores.
                </div>
              </div>

              {loadingBooks ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
                  <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '13px' }}>Cargando libros...</p>
                </div>
              ) : books.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
                  <BookOpen size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <p style={{ fontSize: '13px', fontWeight: 600 }}>No hay libros registrados</p>
                  <p style={{ fontSize: '12px' }}>Puedes continuar e ingresar los datos manualmente.</p>
                </div>
              ) : (
                <>
                  {/* Search */}
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                    <input
                      type="text" placeholder="Buscar por título o autor..."
                      value={bookSearch} onChange={e => setBookSearch(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px',
                        border: '1px solid #ddd', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Book list */}
                  <div style={{ maxHeight: '320px', overflow: 'auto', display: 'grid', gap: '8px' }}>
                    {filteredBooks.map(book => (
                      <button key={book.id} onClick={() => handleBookSelect(book)} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '12px',
                        padding: '14px 16px', borderRadius: '12px', textAlign: 'left',
                        border: selectedBook?.id === book.id ? '2px solid var(--primary)' : '1px solid #eee',
                        background: selectedBook?.id === book.id ? '#E8F5E910' : 'white',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseOver={e => { if (selectedBook?.id !== book.id) (e.currentTarget as HTMLElement).style.borderColor = '#ccc'; }}
                      onMouseOut={e => { if (selectedBook?.id !== book.id) (e.currentTarget as HTMLElement).style.borderColor = '#eee'; }}
                      >
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
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
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              👤 {book.authors.join(', ')}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                            {book.isbn_print && <span style={{ fontSize: '10px', color: '#999' }}>ISBN: {book.isbn_print}</span>}
                            {book.year_published && <span style={{ fontSize: '10px', color: '#999' }}>📅 {book.year_published}</span>}
                            {((book as any)._chapterCount > 0 || book.chapters.length > 0) && <span style={{ fontSize: '10px', color: '#1565C0' }}>📑 {book.chapters.length || (book as any)._chapterCount} capítulos</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Chapter selection (if applicable and book selected) */}
                  {selectedBook && needsChapter && selectedBook.chapters.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '8px', display: 'block' }}>
                        Selecciona el capítulo:
                      </label>
                      <div style={{ display: 'grid', gap: '6px', maxHeight: '180px', overflow: 'auto' }}>
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
              </div>

              {selectedTemplate.fields.map(field => (
                <div key={field.key}>
                  <label style={{
                    display: 'block', fontSize: '12px', fontWeight: 600,
                    color: '#555', marginBottom: '6px',
                  }}>
                    {field.label} {field.required && <span style={{ color: '#E53935' }}>*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={formData[field.key] || ''}
                      onChange={e => handleFieldChange(field.key, e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '10px',
                        border: '1px solid #ddd', fontSize: '13px', background: '#fafafa',
                        outline: 'none', color: '#333',
                      }}
                    >
                      <option value="">Seleccionar...</option>
                      {field.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={formData[field.key] || ''}
                      onChange={e => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '10px',
                        border: '1px solid #ddd', fontSize: '13px', background: formData[field.key] ? '#f0f9f0' : '#fafafa',
                        outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                        boxSizing: 'border-box',
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData[field.key] || ''}
                      onChange={e => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '10px',
                        border: '1px solid #ddd', fontSize: '13px',
                        background: formData[field.key] ? '#f0f9f0' : '#fafafa',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Step 5: Preview */}
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
                  Template: {selectedTemplate.templateFile}
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
                  Datos del certificado
                </div>
                {getCertificatePreview(selectedTemplate.id, formData).map((item, i) => (
                  <div key={i} style={{
                    padding: '10px 16px', display: 'flex',
                    borderBottom: '1px solid #f0f0f0',
                    fontSize: '13px',
                  }}>
                    <span style={{ color: '#888', width: '140px', flexShrink: 0 }}>{item.label}</span>
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

        {/* Footer */}
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
                {selectedBook ? 'Continuar con datos' : 'Continuar sin libro'} <ChevronRight size={16} />
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
                  <><Download size={16} /> Generar y Descargar</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
