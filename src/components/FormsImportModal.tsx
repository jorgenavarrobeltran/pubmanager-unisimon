'use client';

import { useState } from 'react';
import { X, Upload, FileSpreadsheet, Check, AlertCircle, Download, Loader2 } from 'lucide-react';
import { parseMicrosoftFormsExcel, type FormSubmissionRow } from '@/lib/formsImporter';
import { generateCertificate } from '@/lib/certificateGenerator';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/certificateTemplateMap';
import { createClient } from '@/lib/supabase/client';

interface FormsImportModalProps {
  onClose: () => void;
  onImportComplete: () => void;
}

export default function FormsImportModal({ onClose, onImportComplete }: FormsImportModalProps) {
  const [rows, setRows] = useState<FormSubmissionRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [generatingRowIdx, setGeneratingRowIdx] = useState<number | null>(null);
  const [generatedIds, setGeneratedIds] = useState<number[]>([]);
  const [error, setError] = useState('');

  const supabase = createClient();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError('');
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const parsed = parseMicrosoftFormsExcel(buffer);
        if (parsed.length === 0) {
          setError('El archivo no contiene filas o respuestas de Microsoft Forms válidas.');
          return;
        }
        setRows(parsed);
      } catch (err: any) {
        console.error('Error parsing Forms Excel:', err);
        setError('Error al procesar el archivo Excel. Asegúrese de que sea una exportación de Microsoft Forms.');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleGenerateRow = async (row: FormSubmissionRow) => {
    setGeneratingRowIdx(row.rowNumber);
    setError('');

    try {
      const res = await generateCertificate(row.targetTemplateId, row.formData);
      if (!res.success) {
        setError(`Error al generar para ${row.nombreCompleto}: ${res.error}`);
        setGeneratingRowIdx(null);
        return;
      }

      // Record in Supabase
      const titleRef = row.formData.libro_titulo || row.formData.capitulo_titulo || row.formData.titulo_obra || row.formData.titulo_publicacion || null;
      await supabase.from('certificates').insert({
        certificate_type: row.targetTemplateId,
        recipient_name: row.nombreCompleto,
        recipient_cedula: row.numeroDocumento || null,
        title_reference: titleRef,
        description: `Importado de Microsoft Forms: ${row.tipologiaRaw || row.targetTemplateId}`,
        document_category: row.documentCategory,
        publication_type: row.formData.capitulo_titulo ? 'capitulo' : 'libro',
        editorial_type: row.formData.editorial?.toLowerCase().includes('unisimon') ? 'sello_propio' : 'editorial_extranjera',
        template_file: `${row.targetTemplateId}.docx`,
        generated_data: row.formData,
        status: 'expedido',
      });

      setGeneratedIds(prev => [...prev, row.rowNumber]);
      onImportComplete();
    } catch (err: any) {
      console.error(err);
      setError(`Error inesperado al generar certificado: ${err.message}`);
    }

    setGeneratingRowIdx(null);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px',
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '880px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #eee',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={20} color="#2E7D32" /> Importar Solicitudes de Microsoft Forms
            </h3>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Formulario: &quot;SOLICITUD DE CERTIFICACIÓN Y/O AVAL DE PUBLICACIONES BIBLIOGRÁFICAS&quot;
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#f5f5f5', borderRadius: '8px', padding: '8px', cursor: 'pointer' }}>
            <X size={18} color="#666" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {rows.length === 0 ? (
            <div style={{
              border: '2px dashed #ddd', borderRadius: '14px', padding: '40px 20px',
              textAlign: 'center', background: '#fafafa',
            }}>
              <Upload size={36} color="#888" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: '#333' }}>
                Selecciona la exportación de respuestas en Excel (.xlsx)
              </h4>
              <p style={{ margin: '0 0 18px', fontSize: '12px', color: '#777', maxWidth: '480px', marginInline: 'auto' }}>
                Descarga el archivo Excel de respuestas desde Microsoft Forms y cárgalo aquí. El sistema detectará automáticamente al profesor, la tipología de producto solicitada (Libro, Capítulo, Formación, etc.) y preparará el certificado con el membrete institucional oficial.
              </p>

              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '10px 22px', borderRadius: '10px',
                background: 'var(--primary)', color: 'white',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              }}>
                <FileSpreadsheet size={16} /> Cargar Excel de Respuestas
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#333' }}>
                    Archivo: {fileName}
                  </span>
                  <span style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}>
                    ({rows.length} solicitudes encontradas)
                  </span>
                </div>
                <label style={{
                  fontSize: '11px', color: '#1565C0', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  Cambiar archivo
                  <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>

              {/* Table of Rows */}
              <div style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #eee', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px', color: '#555' }}>#</th>
                      <th style={{ padding: '10px 14px', color: '#555' }}>Investigador / Cédula</th>
                      <th style={{ padding: '10px 14px', color: '#555' }}>Tipología Solicitada</th>
                      <th style={{ padding: '10px 14px', color: '#555' }}>Obra / Publicación</th>
                      <th style={{ padding: '10px 14px', color: '#555', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isGenerated = generatedIds.includes(row.rowNumber);
                      const isCurrentGenerating = generatingRowIdx === row.rowNumber;
                      const catInfo = CATEGORY_COLORS[row.documentCategory] || { bg: '#eee', color: '#555', icon: '📄' };

                      return (
                        <tr key={row.rowNumber} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '10px 14px', color: '#888' }}>{row.rowNumber}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#222' }}>{row.nombreCompleto}</div>
                            {row.numeroDocumento && (
                              <div style={{ fontSize: '11px', color: '#777' }}>C.C. {row.numeroDocumento}</div>
                            )}
                            {row.facultad && (
                              <div style={{ fontSize: '10px', color: '#999' }}>{row.facultad}</div>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '2px 8px', borderRadius: '12px', fontSize: '11px',
                              fontWeight: 600, background: catInfo.bg, color: catInfo.color,
                            }}>
                              {catInfo.icon} {CATEGORY_LABELS[row.documentCategory] || row.documentCategory}
                            </span>
                            <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                              Template: {row.targetTemplateId}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', maxWidth: '260px' }}>
                            <div style={{
                              fontWeight: 500, color: '#333', overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {row.formData.libro_titulo || row.formData.capitulo_titulo || row.formData.titulo_obra || row.formData.titulo_publicacion || 'Sin título'}
                            </div>
                            {row.formData.isbn_impreso && (
                              <div style={{ fontSize: '10px', color: '#999' }}>ISBN: {row.formData.isbn_impreso}</div>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {isGenerated ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2E7D32', fontWeight: 600, fontSize: '11px' }}>
                                <Check size={14} /> Expedido
                              </span>
                            ) : (
                              <button
                                onClick={() => handleGenerateRow(row)}
                                disabled={isCurrentGenerating}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                                  padding: '6px 12px', borderRadius: '8px',
                                  background: 'var(--primary)', color: 'white',
                                  border: 'none', fontSize: '11px', fontWeight: 700,
                                  cursor: isCurrentGenerating ? 'wait' : 'pointer',
                                }}
                              >
                                {isCurrentGenerating ? (
                                  <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generando</>
                                ) : (
                                  <><Download size={12} /> Generar .docx</>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 16px', borderRadius: '10px',
              background: '#FFEBEE', border: '1px solid #FFCDD2',
              fontSize: '13px', color: '#C62828', marginTop: '16px',
            }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #eee',
          display: 'flex', justifyContent: 'flex-end', gap: '10px',
        }}>
          <button onClick={onClose} style={{
            padding: '10px 18px', borderRadius: '10px',
            border: '1px solid #ddd', background: 'white',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#555',
          }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
