import { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert } from '../../utils/alerts';
import { journalService } from '../../services/journalService';
import { useJournals } from '../../contexts/JournalContext';
import { Journal } from '../../types';
import { journalValidator } from '../../utils/validators';

export const useJournalsBoard = (onSavedCallback?: () => void) => {
  const { searchTerm, setSearchTerm } = useJournals();

  const [journals, setJournals] = useState<Journal[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [currentJournal, setCurrentJournal] = useState<Partial<Journal> | null>(null);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);

  const loadJournals = useCallback(async () => {
    setIsListLoading(true);
    const result = await journalService.getJournals();
    if (result.success && result.data) {
      setJournals(result.data);
    } else {
      Alert.error('Error al cargar revistas', result.message);
    }
    setIsListLoading(false);
  }, []);

  useEffect(() => {
    loadJournals();
  }, [loadJournals]);

  const filteredJournals = useMemo(() => {
    if (!searchTerm.trim()) return journals;
    const term = searchTerm.toLowerCase();
    return journals.filter(j =>
      j.name?.toLowerCase().includes(term) ||
      j.editor_name?.toLowerCase().includes(term) ||
      j.area?.toLowerCase().includes(term) ||
      j.specialty?.toLowerCase().includes(term)
    );
  }, [journals, searchTerm]);

  const handleOpenCreate = () => {
    setFormErrors({});
    setCurrentJournal({
      name: '',
      type: 'cientifica',
      issn_print: '',
      issn_online: '',
      area: '',
      specialty: '',
      grand_area: '',
      ojs_url: '',
      google_scholar_url: '',
      editor_name: '',
      editor_email: '',
      faculty_id: null,
      description: '',
      h_index: null,
      status: 'activa'
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = async (journal: Journal) => {
    setFormErrors({});
    setIsFetchingDetail(true);
    try {
      const result = await journalService.getJournalById(journal.id);
      if (result.success && result.journal) {
        setCurrentJournal(result.journal);
        setIsFormOpen(true);
      } else {
        Alert.error(result.message || 'No se pudo obtener la información actualizada', 'Por favor, intenta nuevamente');
      }
    } catch {
      Alert.error('Error al cargar la información', 'Ocurrió un problema de red o el servicio no respondió');
    } finally {
      setIsFetchingDetail(false);
    }
  };

  const handleOpenDetail = async (journal: Journal) => {
    setIsFetchingDetail(true);
    try {
      const result = await journalService.getJournalById(journal.id);
      if (result.success && result.journal) {
        setSelectedJournal(result.journal);
        setIsDetailOpen(true);
      } else {
        Alert.error(result.message || 'No se pudo obtener el detalle', 'Por favor, intenta nuevamente');
      }
    } catch {
      Alert.error('Error al cargar los detalles', 'Ocurrió un problema de red o el servicio no respondió');
    } finally {
      setIsFetchingDetail(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentJournal) return;

    const validation = journalValidator.validate(currentJournal);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = currentJournal.id
        ? await journalService.updateJournal(currentJournal.id, currentJournal)
        : await journalService.createJournal(currentJournal as Omit<Journal, 'id'>);

      if (result.success) {
        Alert.success(result.message || 'Revista guardada correctamente');
        setIsFormOpen(false);
        loadJournals();
        if (onSavedCallback) onSavedCallback();
      } else {
        Alert.error('Error al guardar', result.message);
      }
    } catch {
      Alert.error('Error', 'Error al procesar la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await Alert.confirm('¿Confirmar eliminación?', 'Esta acción eliminará la revista y todos sus registros asociados. No se puede deshacer.', 'Sí, eliminar');
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const result = await journalService.deleteJournal(id);
      if (result.success) {
        Alert.success(result.message || 'Revista eliminada con éxito');
        loadJournals();
        if (onSavedCallback) onSavedCallback();
      } else {
        Alert.error('Error al eliminar', result.message);
      }
    } catch {
      Alert.error('Error', 'Error al eliminar debido a un fallo en el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    journals,
    filteredJournals,
    searchTerm,
    setSearchTerm,
    isListLoading,
    isFormOpen,
    setIsFormOpen,
    isDetailOpen,
    setIsDetailOpen,
    currentJournal,
    setCurrentJournal,
    selectedJournal,
    isSubmitting,
    formErrors,
    isFetchingDetail,
    handleOpenCreate,
    handleOpenEdit,
    handleOpenDetail,
    handleSubmit,
    handleDelete,
    loadJournals
  };
};
