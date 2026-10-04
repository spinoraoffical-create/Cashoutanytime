import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const db = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("=== Querying PostgreSQL pg_catalog for existing tables ===");
  const { data, error } = await db
    .rpc("get_db_tables"); // Let's check if there is an RPC we can use, or select from information_schema.tables
  
  if (error) {
    // If no RPC, let's try direct select from information_schema
    console.log("RPC get_db_tables not found, trying query...");
    const { data: tables, error: queryError } = await db
      .from("information_schema.tables") // wait, information_schema tables are not exposed by PostgREST by default
      .select("table_name")
      .eq("table_schema", "public");
      
    if (queryError) {
      console.log("Could not query information_schema:", queryError.message);
    } else {
      console.log("Tables in public schema:", tables);
    }
  } else {
    console.log("Tables list:", data);
  }
}

check();
