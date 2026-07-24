'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { JournalContextType } from '../types';

const JournalContext = createContext<JournalContextType | undefined>(undefined);

export const JournalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <JournalContext.Provider value={{ searchTerm, setSearchTerm }}>
      {children}
    </JournalContext.Provider>
  );
};

export const useJournals = () => {
  const context = useContext(JournalContext);
  if (context === undefined) {
    throw new Error('useJournals must be used within a JournalProvider');
  }
  return context;
};
