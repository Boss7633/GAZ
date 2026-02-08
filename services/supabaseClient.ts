
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jeagmpvnxojpzmpdzelv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplYWdtcHZueG9qcHptcGR6ZWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MDMyMTgsImV4cCI6MjA4NjA3OTIxOH0.5As4PI8WjKKP1go9cbZ4yygZD6ek-7rOzWIfuYXFNPk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
