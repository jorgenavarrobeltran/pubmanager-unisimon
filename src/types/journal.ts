export interface Journal {
  id: string; // UUID in Supabase
  name: string;
  type: 'cientifica' | 'academica';
  issn_print: string;
  issn_online: string;
  area: string;
  specialty: string;
  grand_area: string;
  ojs_url: string;
  google_scholar_url: string | null;
  editor_name: string;
  editor_email: string;
  faculty_id: string | null;
  description: string | null;
  h_index: number | null;
  status: string;
  scopus_quartile?: string;
  publindex_category?: string;
  created_at?: string;
  updated_at?: string;
}

export interface JournalContextType {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}
