const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env keys");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, role');
  
  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }
  
  console.log("=== Active Profiles ===");
  console.log(JSON.stringify(profiles, null, 2));
}

check();
