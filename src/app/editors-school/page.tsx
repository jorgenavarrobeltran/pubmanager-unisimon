'use client';
import { GraduationCap, Plus, Calendar } from 'lucide-react';

export default function EditorsSchoolPage() {
  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Escuela de Editores</h2>
            <p>Talleres, sesiones y participantes de formación editorial</p>
          </div>
          <button className="btn btn-primary">
            <Plus size={18} /> Nueva Sesión
          </button>
        </div>
      </div>
      <div className="page-content">
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🎓</div>
            <h3>Escuela de Editores</h3>
            <p>Aquí podrás gestionar talleres, sesiones y asistencia. Agrega tu primera sesión para comenzar.</p>
            <button className="btn btn-primary"><Plus size={16} /> Programar Sesión</button>
          </div>
        </div>
      </div>
    </>
  );
}
