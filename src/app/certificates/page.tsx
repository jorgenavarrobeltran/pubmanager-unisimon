'use client';
import { Award, Plus, Search } from 'lucide-react';

export default function CertificatesPage() {
  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Certificados</h2>
            <p>Generación y registro de certificados para pares, autores y participantes</p>
          </div>
          <button className="btn btn-primary"><Plus size={18} /> Nuevo Certificado</button>
        </div>
      </div>
      <div className="page-content">
        <div className="stats-grid mb-6">
          {['Par Evaluador', 'Autor', 'Escuela de Editores', 'Comité Editorial', 'Genérico'].map((type, i) => (
            <div key={i} className="stat-card">
              <div className="stat-icon" style={{ background: ['#E8F5E9','#E3F2FD','#FFF3E0','#F3E5F5','#F5F5F5'][i] }}>
                <Award size={22} color={['var(--primary)','var(--info)','#E65100','#7B1FA2','var(--gray-600)'][i]} />
              </div>
              <div className="stat-info">
                <h4>{type}</h4>
                <div className="stat-value">0</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📜</div>
            <h3>Certificados</h3>
            <p>Genera certificados PDF con membrete y firma digital. Lleva un registro de todos los expedidos.</p>
            <button className="btn btn-primary"><Plus size={16} /> Generar Certificado</button>
          </div>
        </div>
      </div>
    </>
  );
}
