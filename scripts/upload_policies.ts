import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Supabase details
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yonklzparwtjdwzltivr.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvbmtsenBhcnd0amR3emx0aXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjA1MTksImV4cCI6MjA5NjY5NjUxOX0.Q8qQwV-LXd262RfibOTiggSB0YjwpZH1vmxwOtyItZM';
const supabase = createClient(supabaseUrl, supabaseKey);

const FILES = [
  {
    path: '/Users/joarnabe/Library/CloudStorage/OneDrive-Personal/Unisimon/Lineamiento  de publicación 2026 VF (2).pdf',
    title: 'Lineamiento de publicación 2026',
    category: 'general'
  },
  {
    path: '/Users/joarnabe/Library/CloudStorage/OneDrive-Personal/Unisimon/Politicas Editoriales/Comité editorial.pdf',
    title: 'Comité Editorial',
    category: 'general'
  },
  {
    path: '/Users/joarnabe/Library/CloudStorage/OneDrive-Personal/Unisimon/Politicas Editoriales/Lineamientos editoriales Dpto publicaciones.pdf',
    title: 'Lineamientos editoriales Dpto publicaciones',
    category: 'general'
  },
  {
    path: '/Users/joarnabe/Library/CloudStorage/OneDrive-Personal/Unisimon/Politicas Editoriales/Politica editorial Dpto publicaciones.pdf',
    title: 'Política editorial Dpto publicaciones',
    category: 'general'
  }
];

async function run() {
  console.log('Starting policy upload...');
  
  for (const file of FILES) {
    try {
      console.log(`Processing ${file.title}...`);
      
      if (!fs.existsSync(file.path)) {
        console.error(`File not found: ${file.path}`);
        continue;
      }
      
      const fileBuffer = fs.readFileSync(file.path);
      const fileName = path.basename(file.path);
      const storagePath = `policies/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('policies_files')
        .upload(storagePath, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });
        
      if (uploadError) {
        console.error('Storage upload error:', uploadError.message);
        continue;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('policies_files')
        .getPublicUrl(storagePath);
        
      // Insert to DB
      const { error: dbError } = await supabase.from('policies').insert({
        title: file.title,
        description: null,
        category: file.category,
        file_url: publicUrl,
        file_name: fileName,
        version: null,
        uploaded_by: null // system
      });
      
      if (dbError) {
        console.error('DB insert error:', dbError.message);
      } else {
        console.log(`✅ Successfully uploaded and saved: ${file.title}`);
      }
      
    } catch (e) {
      console.error(`Unexpected error processing ${file.title}:`, e);
    }
  }
  
  console.log('Done.');
}

run();
