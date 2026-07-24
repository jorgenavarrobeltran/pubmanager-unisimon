import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// We'll use the anon key but with RLS disabled for this migration
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });

  const outputDir = join(__dirname, '..', 'scripts', 'output');

  // Read and execute SQL files in order
  const files = [
    '01_books_all_fixed.sql',
    '02_chapters_all_fixed.sql', 
    '03_people_all_fixed.sql',
    '04_book_authors_all_fixed.sql',
  ];

  for (const file of files) {
    const filePath = join(outputDir, file);
    console.log(`\nExecuting ${file}...`);
    
    try {
      const sql = readFileSync(filePath, 'utf-8');
      
      // Split into individual INSERT statements
      const statements = sql.split(';\n').filter(s => s.trim());
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim() + ';';
        const { error } = await supabase.rpc('exec_sql', { query: stmt });
        if (error) {
          console.error(`  Error in statement ${i + 1}: ${error.message}`);
        } else {
          console.log(`  ✅ Statement ${i + 1}/${statements.length}`);
        }
      }
    } catch (err) {
      console.error(`  Error reading ${file}: ${err}`);
    }
  }

  console.log('\nDone!');
}

main();
