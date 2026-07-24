'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { parseFinancesExcel, ParsedExcelResult } from '@/lib/excelUtils';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Modal from '@/components/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
  selectedYear: number;
}

export default function ExcelImportModal({ isOpen, onClose, onImported, selectedYear }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedExcelResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<{ gastos: number; ingresos: number } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.endsWith('.xlsx') && !selected.name.endsWith('.xls')) {
      setError('Por favor selecciona un archivo de Excel válido (.xlsx o .xls)');
      return;
    }

    setFile(selected);
    setError(null);
    setParsing(true);
    setSuccessCount(null);

    try {
      const data = await parseFinancesExcel(selected, selectedYear);
      setParsedData(data);
    } catch (err: any) {
      console.error('Error parseando Excel:', err);
      setError('No se pudo leer el archivo de Excel. Verifica que cumpla con el formato institucional.');
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedData) return;
    setImporting(true);
    setError(null);

    try {
      const supabase = createClient();

      // 1. Insertar Gastos Generales en `production_costs`
      let gastosCount = 0;
      if (parsedData.gastos.length > 0) {
        // Obtenemos un libro o revista por defecto para asociar si es requerido
        const { data: books } = await supabase.from('books').select('id').limit(1);
        const defaultBookId = books?.[0]?.id || null;

        const costsToInsert = parsedData.gastos.map(g => ({
          entity_type: 'book',
          entity_id: defaultBookId,
          cost_type: g.cost_type,
          description: g.description,
          amount: g.amount,
          date: `${selectedYear}-01-15`,
          invoice_number: g.invoice_number || null,
        }));

        const { error: costErr } = await supabase.from('production_costs').insert(costsToInsert);
        if (costErr) console.warn('Error insertando costos:', costErr);
        else gastosCount = costsToInsert.length;
      }

      // 2. Insertar Ingresos en `external_services`
      let ingresosCount = 0;
      if (parsedData.ingresos.length > 0) {
        const servicesToInsert = parsedData.ingresos.map(i => ({
          service_type: i.request_type.toLowerCase().includes('venta') ? 'otro' : 'edicion',
          client_name: i.client_name,
          description: i.description,
          amount: i.amount,
          date: i.date,
          invoice_number: i.invoice_number || null,
          status: i.status,
        }));

        const { error: srvErr } = await supabase.from('external_services').insert(servicesToInsert);
        if (srvErr) console.warn('Error insertando servicios:', srvErr);
        else ingresosCount = servicesToInsert.length;
      }

      setSuccessCount({ gastos: gastosCount, ingresos: ingresosCount });
      setTimeout(() => {
        onImported();
        handleClose();
      }, 1800);
    } catch (err: any) {
      console.error('Error importando a Supabase:', err);
      setError('Ocurrió un error al guardar los registros en la base de datos.');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData(null);
    setError(null);
    setSuccessCount(null);
    onClose();
  };

  const formatCOP = (a: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(a);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="📥 Importar Seguimiento Financiero Excel">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Subida de archivo */}
        {!successCount && (
          <div style={{
            border: '2px dashed var(--gray-300)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            textAlign: 'center',
            background: 'var(--gray-50)',
            cursor: 'pointer',
            position: 'relative'
          }}>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer'
              }}
            />
            <FileSpreadsheet size={40} color="var(--primary)" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
              {file ? file.name : 'Selecciona o arrastra el archivo Excel (.xlsx)'}
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>
              Plantilla oficial: <em>SEGUMIENTO A GASTOS GENERALES E INGRESOS DPTO PUBLICACIONES {selectedYear}.xlsx</em>
            </p>
          </div>
        )}

        {parsing && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px' }}>
            <Loader2 className="animate-spin" size={20} color="var(--primary)" />
            <span style={{ fontSize: '14px', color: 'var(--gray-600)' }}>Leyendo pestañas del Excel...</span>
          </div>
        )}

        {error && (
          <div style={{ padding: '12px', background: '#FFEBEE', color: '#C62828', borderRadius: 'var(--radius-md)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Resumen de datos detectados */}
        {parsedData && !successCount && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>📋 Resumen de datos detectados:</h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div style={{ background: '#FFEBEE', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '11px', color: '#C62828', fontWeight: 600 }}>Gastos Generales</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#D32F2F' }}>{parsedData.gastos.length} filas</div>
                <div style={{ fontSize: '11px', color: '#B71C1C' }}>
                  {formatCOP(parsedData.gastos.reduce((s, g) => s + g.amount, 0))}
                </div>
              </div>

              <div style={{ background: '#E8F5E9', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '11px', color: '#2E7D32', fontWeight: 600 }}>Ingresos / Ventas</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#388E3C' }}>{parsedData.ingresos.length} filas</div>
                <div style={{ fontSize: '11px', color: '#1B5E20' }}>
                  {formatCOP(parsedData.ingresos.reduce((s, i) => s + i.amount, 0))}
                </div>
              </div>

              <div style={{ background: '#E3F2FD', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '11px', color: '#1565C0', fontWeight: 600 }}>Financiamiento</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#1976D2' }}>{parsedData.financiamiento.length} convenios</div>
                <div style={{ fontSize: '11px', color: '#0D47A1' }}>
                  {formatCOP(parsedData.financiamiento.reduce((s, f) => s + f.amount, 0))}
                </div>
              </div>
            </div>

            {/* Vista previa rápida de filas */}
            <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-500)', marginBottom: '4px' }}>Muestra de registros a importar:</div>
              {parsedData.gastos.slice(0, 3).map((g, idx) => (
                <div key={idx} style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <span style={{ color: 'var(--gray-700)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '300px' }}>📉 {g.description}</span>
                  <span style={{ fontWeight: 600, color: '#E53935' }}>{formatCOP(g.amount)}</span>
                </div>
              ))}
              {parsedData.ingresos.slice(0, 3).map((i, idx) => (
                <div key={idx} style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <span style={{ color: 'var(--gray-700)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '300px' }}>📈 {i.client_name}: {i.description}</span>
                  <span style={{ fontWeight: 600, color: '#43A047' }}>{formatCOP(i.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notificación de éxito */}
        {successCount && (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <CheckCircle2 size={48} color="#43A047" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>¡Importación completada!</h3>
            <p style={{ fontSize: '14px', color: 'var(--gray-600)', marginTop: '4px' }}>
              Se importaron <strong>{successCount.gastos} gastos</strong> y <strong>{successCount.ingresos} ingresos</strong> correctamente.
            </p>
          </div>
        )}

        {/* Acciones */}
        {!successCount && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button className="btn btn-secondary" onClick={handleClose} disabled={importing}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirmImport}
              disabled={!parsedData || importing || (parsedData.gastos.length === 0 && parsedData.ingresos.length === 0)}
            >
              {importing ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Importando...
                </>
              ) : (
                <>
                  <Upload size={16} /> Confirmar e Importar
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
