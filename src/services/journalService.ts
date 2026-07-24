import { createClient } from '@/lib/supabase/client';
import { Journal } from '../types';

export interface JournalResponse {
  success: boolean;
  data?: Journal[];
  journal?: Journal;
  message?: string;
}

export const journalService = {
  getJournals: async (query?: string): Promise<JournalResponse> => {
    try {
      const supabase = createClient();
      
      const [jRes, idxRes] = await Promise.all([
        supabase
          .from('journals')
          .select('id, name, type, issn_print, issn_online, area, specialty, grand_area, ojs_url, google_scholar_url, editor_name, editor_email, faculty_id, description, h_index, status')
          .order('name'),
        supabase
          .from('journal_indexations')
          .select('journal_id, indexer, category, year')
          .order('year', { ascending: false })
      ]);

      if (jRes.error) throw jRes.error;
      if (idxRes.error) throw idxRes.error;

      const idxList = idxRes.data || [];
      const enriched: Journal[] = (jRes.data || []).map((j: any) => {
        const scopus = idxList
          ?.filter((i: any) => i.journal_id === j.id && i.indexer === 'scopus')
          .sort((a: any, b: any) => b.year - a.year);
        const publindex = idxList
          ?.filter((i: any) => i.journal_id === j.id && i.indexer === 'publindex')
          .sort((a: any, b: any) => b.year - a.year);

        return {
          ...j,
          scopus_quartile: scopus?.[0]?.category || undefined,
          publindex_category: publindex?.[0]?.category || undefined,
        };
      });

      let items = enriched;

      if (query) {
        const q = query.toLowerCase();
        items = items.filter(j =>
          j.name?.toLowerCase().includes(q) ||
          j.editor_name?.toLowerCase().includes(q) ||
          j.area?.toLowerCase().includes(q)
        );
      }

      return {
        success: true,
        data: items,
        message: 'Revistas obtenidas correctamente'
      };
    } catch (error: any) {
      console.error('Error al obtener revistas:', error);
      return { success: false, message: error.message || 'Error al conectar con el servicio de revistas' };
    }
  },

  createJournal: async (data: Omit<Journal, 'id' | 'created_at' | 'updated_at'>): Promise<JournalResponse> => {
    try {
      const supabase = createClient();
      const { data: newJournal, error } = await supabase
        .from('journals')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return { success: true, journal: newJournal, message: 'Revista creada exitosamente' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Error al crear revista' };
    }
  },

  updateJournal: async (id: string, data: Partial<Journal>): Promise<JournalResponse> => {
    try {
      const supabase = createClient();
      const { data: updatedJournal, error } = await supabase
        .from('journals')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, journal: updatedJournal, message: 'Revista actualizada exitosamente' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Error al actualizar revista' };
    }
  },

  getJournalById: async (id: string): Promise<JournalResponse> => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('journals')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, journal: data, message: 'Detalle de revista obtenido' };
    } catch (error: any) {
      console.error(`Error al obtener revista ${id}:`, error);
      return { success: false, message: error.message || 'Error al obtener el detalle de la revista' };
    }
  },

  deleteJournal: async (id: string): Promise<JournalResponse> => {
    try {
      const supabase = createClient();
      
      // Delete related data first in order to satisfy FK constraints
      await supabase.from('journal_indexations').delete().eq('journal_id', id);
      await supabase.from('journal_links').delete().eq('journal_id', id);
      await supabase.from('journal_metrics').delete().eq('journal_id', id);
      
      const { error } = await supabase
        .from('journals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true, message: 'Revista eliminada exitosamente' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Error al eliminar revista' };
    }
  }
};
