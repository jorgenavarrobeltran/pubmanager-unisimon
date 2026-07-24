import { Journal } from '../types';

export const journalValidator = {
  validate: (data: Partial<Journal>): { isValid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};

    if (!data.name || data.name.trim().length < 2) {
      errors.name = 'El nombre de la revista debe tener al menos 2 caracteres';
    }

    if (data.editor_email && data.editor_email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.editor_email)) {
        errors.editor_email = 'El correo electrónico del editor no es válido';
      }
    }

    if (data.h_index !== undefined && data.h_index !== null) {
      if (isNaN(data.h_index) || data.h_index < 0) {
        errors.h_index = 'El H-Index debe ser un número entero positivo o cero';
      }
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  }
};
