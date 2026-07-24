'use client';

// Alert utility to standardize user feedback
export const Alert = {
  success: (title: string, desc?: string) => {
    if (typeof window !== 'undefined') {
      window.alert(`✅ ${title}\n\n${desc || ''}`);
    }
  },
  error: (title: string, desc?: string) => {
    if (typeof window !== 'undefined') {
      window.alert(`❌ ${title}\n\n${desc || ''}`);
    }
  },
  confirm: async (title: string, desc?: string, confirmText?: string): Promise<boolean> => {
    if (typeof window !== 'undefined') {
      const result = window.confirm(`${title}\n\n${desc || ''}`);
      return Promise.resolve(result);
    }
    return Promise.resolve(false);
  }
};
