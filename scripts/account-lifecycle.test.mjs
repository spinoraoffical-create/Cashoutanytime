/** Isolated account-close and fraud checks. Never connects to production. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const fraudList = readFileSync(path.join(root, "src/components/admin/admin-fraud-list.tsx"), "utf8");
const fraudActions = readFileSync(path.join(root, "src/lib/actions/admin-fraud.ts"), "utf8");
const testAction = readFileSync(path.join(root, "src/lib/actions/admin/test-accounts.ts"), "utf8");
const deleteAction = readFileSync(path.join(root, "src/lib/actions/admin/users.ts"), "utf8");
const migration = readFileSync(path.join(root, "supabase/migrations/20261022000300_account_lifecycle.sql"), "utf8");

assert.match(fraudList, /Unblock freeplay/);
assert.match(fraudList, /user\.rewards_blocked \?/);
assert.match(fraudList, /Review restriction/);
assert.equal(fraudActions.includes(".update({ is_suspended: false })"), false);
assert.match(fraudActions, /flags\.includes\("admin_manual_block"\)/);
assert.match(fraudActions, /if \(!ctx\?\.isSuperAdmin\)/);
assert.match(testAction, /Only the owner can create a test login/);
assert.match(testAction, /is_test: true/);
assert.equal(testAction.includes("tryGrantLoyaltyCoins"), false);
assert.match(deleteAction, /The owner account cannot be deleted/);
assert.match(deleteAction, /outcome === "anonymized"/);
assert.match(migration, /RETURN 'anonymized'/);
assert.match(migration, /loyalty_grants/);
assert.match(migration, /The owner account cannot be deleted/);

function loadModule(name) {
  const localRoot = path.resolve("package.json");
  try {
    return createRequire(pathToFileURL(localRoot))(name);
  } catch {
    return createRequire(pathToFileURL(path.join(tmpdir(), "rewards-pg-test", "package.json")))(name);
  }
}

const EmbeddedPostgres = loadModule("embedded-postgres").default ?? loadModule("embedded-postgres");
const postgres = loadModule("postgres");
const port = 47000 + (process.pid % 1000);
const databaseDir = mkdtempSync(path.join(tmpdir(), "lifecycle-pg-"));
const emptyUser = "44444444-4444-4444-8444-444444444444";
const historyUser = "55555555-5555-4555-8555-555555555555";
const testUser = "66666666-6666-4666-8666-666666666666";
const fraudUser = "77777777-7777-4777-8777-777777777777";
const ownerUser = "88888888-8888-4888-8888-888888888888";
const rejoinUser = "99999999-9999-4999-8999-999999999999";
const server = new EmbeddedPostgres({ databaseDir, user: "postgres", password: "postgres", port, persistent: true });
let sql;

try {
  await server.initialise();
  await server.start();
  await server.createDatabase("lifecycle_test");
  sql = postgres({ host: "127.0.0.1", port, database: "lifecycle_test", username: "postgres", password: "postgres", max: 2 });
  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY,
      email text,
      phone text,
      banned_until timestamptz,
      raw_user_meta_data jsonb
    );
    CREATE TABLE auth.sessions (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE auth.refresh_tokens (id uuid PRIMARY KEY, user_id uuid, session_id uuid);
    CREATE TABLE auth.identities (id uuid PRIMARY KEY, user_id uuid, email text);
    CREATE TABLE public.payment_intents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid);
    CREATE TABLE public.paydora_payout_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid);
    CREATE TABLE public.deposit_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid);
    CREATE TABLE public.game_load_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid);
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY,
      email text,
      full_name text,
      phone text,
      referred_by uuid,
      is_suspended boolean NOT NULL DEFAULT false,
      date_of_birth date,
      coins_balance bigint NOT NULL DEFAULT 0,
      vip_points integer NOT NULL DEFAULT 0,
      wallet_balance numeric NOT NULL DEFAULT 0,
      cashout_wallet numeric NOT NULL DEFAULT 0,
      bonus_wallet numeric NOT NULL DEFAULT 0,
      bonus_redeem_wallet numeric NOT NULL DEFAULT 0
    );
    CREATE TABLE public.site_settings (key text PRIMARY KEY, value jsonb);
    CREATE TABLE public.games (
      slug text PRIMARY KEY,
      first_deposit_bonus_percent numeric NOT NULL DEFAULT 50,
      reload_bonus_percent numeric NOT NULL DEFAULT 10
    );
    INSERT INTO public.games (slug) VALUES ('juwa');
    CREATE OR REPLACE FUNCTION public.is_service_role() RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT current_setting('request.jwt.claim.role', true) = 'service_role' $$;
    CREATE OR REPLACE FUNCTION public.protect_profile_columns() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF current_setting('app.wallet_update', true) = 'true' THEN RETURN NEW; END IF;
      IF to_jsonb(NEW)->>'coins_balance' IS DISTINCT FROM to_jsonb(OLD)->>'coins_balance'
         OR to_jsonb(NEW)->>'wallet_balance' IS DISTINCT FROM to_jsonb(OLD)->>'wallet_balance' THEN
        RAISE EXCEPTION 'column protected' USING ERRCODE = '42501';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER trg_protect_profile_columns BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();
    CREATE TABLE public.roles (id uuid PRIMARY KEY, key text UNIQUE);
    CREATE TABLE public.user_roles (user_id uuid, role_id uuid);
  `);
  for (const file of [
    "supabase/migrations/20261022000100_loyalty_coins.sql",
    "supabase/migrations/20261022000200_loyalty_completion.sql",
    "supabase/migrations/20261022000300_account_lifecycle.sql",
  ]) {
    await sql.unsafe(readFileSync(path.join(root, file), "utf8"));
  }

  async function asService(fn) {
    return sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.role', 'service_role', true)`);
      await tx.unsafe(`set local role service_role`);
      return fn(tx);
    });
  }

  await sql`
    insert into auth.users (id, email) values
      (${emptyUser}, 'empty@example.com'),
      (${historyUser}, 'history@example.com'),
      (${testUser}, 'test@example.com'),
      (${fraudUser}, 'fraud@example.com'),
      (${ownerUser}, 'owner@example.com')
  `;
  await sql`
    insert into public.profiles (id, email, full_name, wallet_balance) values
      (${emptyUser}, 'empty@example.com', 'Empty', 0),
      (${historyUser}, 'history@example.com', 'History', 12.50),
      (${testUser}, 'test@example.com', 'Test', 0),
      (${fraudUser}, 'fraud@example.com', 'Fraud', 0),
      (${ownerUser}, 'owner@example.com', 'Owner', 0)
  `;
  await sql`update public.profiles set is_test = true where id = ${testUser}`;
  await sql`insert into public.loyalty_grants (user_id, task_key, event_key, coins) values (${historyUser}, 'signup', 'signup:history', 200)`;
  await sql`insert into public.fraud_scores (user_id, risk_score, flags, rewards_blocked, manual_review) values (${fraudUser}, 75, '["admin_manual_block"]'::jsonb, true, true)`;
  await sql`insert into public.site_settings (key, value) values ('coins_earning_enabled', 'true'::jsonb) on conflict (key) do update set value = excluded.value`;
  await sql`update public.loyalty_tasks set enabled = true where key in ('signup', 'daily_checkin', 'welcome_survey', 'email_verified')`;
  await sql`update public.site_settings set value = 'false'::jsonb where key = 'legacy_freeplay_claims_enabled'`;
  await sql`update public.site_settings set value = 'true'::jsonb where key = 'coins_checkin_enabled'`;

  const deleted = await asService((tx) => tx.unsafe(`select public.admin_delete_user_account($1::uuid) as outcome`, [emptyUser]));
  assert.equal(deleted[0].outcome, "deleted");
  const emptyLeft = await sql`select count(*)::int as n from public.profiles where id = ${emptyUser}`;
  assert.equal(emptyLeft[0].n, 0);
  const locks = await sql`select count(*)::int as n from public.loyalty_identity_locks`;
  assert.equal(locks[0].n, 6);

  await sql`insert into auth.users (id, email) values (${rejoinUser}, ' Empty@Example.com ')` ;
  await sql`insert into public.profiles (id, email, full_name, date_of_birth) values (${rejoinUser}, ' Empty@Example.com ', 'Again', '1990-01-01')`;
  const repeat = await asService((tx) => tx.unsafe(`select public.grant_loyalty_coins($1::uuid, 'signup', 'signup:again') as coins`, [rejoinUser]));
  assert.equal(Number(repeat[0].coins), 0);
  const repeatBalance = await sql`select coins_balance from public.profiles where id = ${rejoinUser}`;
  assert.equal(Number(repeatBalance[0].coins_balance), 0);

  const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  await sql`insert into auth.sessions (id, user_id) values (${sessionId}, ${historyUser})`;
  await sql`insert into auth.refresh_tokens (id, user_id, session_id) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', ${historyUser}, ${sessionId})`;
  await sql`insert into auth.identities (id, user_id, email) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', ${historyUser}, 'history@example.com')`;
  const closed = await asService((tx) => tx.unsafe(`select public.admin_delete_user_account($1::uuid) as outcome`, [historyUser]));
  assert.equal(closed[0].outcome, "anonymized");
  const kept = await sql`select email, is_suspended, wallet_balance, coins_balance from public.profiles where id = ${historyUser}`;
  assert.equal(kept[0].is_suspended, true);
  assert.equal(Number(kept[0].wallet_balance), 12.5);
  assert.equal(Number(kept[0].coins_balance), 0);
  assert.match(kept[0].email, /@users\.invalid$/);
  const grantKept = await sql`select count(*)::int as n, coalesce(sum(coins), 0)::int as coins from public.loyalty_grants where user_id = ${historyUser}`;
  assert.equal(grantKept[0].n, 1);
  assert.equal(grantKept[0].coins, 200);
  const sessions = await sql`select count(*)::int as n from auth.sessions where user_id = ${historyUser}`;
  const refreshes = await sql`select count(*)::int as n from auth.refresh_tokens where user_id = ${historyUser}`;
  const identities = await sql`select count(*)::int as n from auth.identities where user_id = ${historyUser}`;
  const banned = await sql`select banned_until from auth.users where id = ${historyUser}`;
  assert.equal(sessions[0].n, 0);
  assert.equal(refreshes[0].n, 0);
  assert.equal(identities[0].n, 0);
  assert.equal(banned[0].banned_until !== null, true);
  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [historyUser]);
      await tx.unsafe(`select set_config('request.jwt.claim.role', 'authenticated', true)`);
      await tx.unsafe(`set local role authenticated`);
      await tx.unsafe(`select public.claim_loyalty_checkin('daily')`);
    }),
    /account suspended/
  );
  await assert.rejects(
    () => sql`insert into public.payment_intents (user_id) values (${historyUser})`,
    /cannot move money/
  );

  const lockRows = await sql`select identity_hash from public.loyalty_identity_locks`;
  for (const row of lockRows) {
    assert.equal(String(row.identity_hash).includes("@"), false);
    assert.equal(String(row.identity_hash).length, 64);
  }
  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`set local role authenticated`);
      await tx.unsafe(`select * from public.loyalty_identity_locks`);
    }),
    /permission denied/i
  );
  const freshUser = "12121212-1212-4212-8212-121212121212";
  await sql`insert into auth.users (id, email) values (${freshUser}, 'fresh@example.com')`;
  await sql`insert into public.profiles (id, email, full_name, date_of_birth) values (${freshUser}, 'fresh@example.com', 'Fresh', '1990-01-01')`;
  const freshCoins = await asService((tx) => tx.unsafe(`select public.grant_loyalty_coins($1::uuid, 'signup', 'signup:fresh') as coins`, [freshUser]));
  assert.equal(Number(freshCoins[0].coins), 200);
  await sql`update public.loyalty_tasks set enabled = true where key = 'email_verified'`;
  await sql`update public.profiles set email = 'changed@example.com' where id = ${rejoinUser}`;
  const changedStillLocked = await asService((tx) => tx.unsafe(`select public.grant_loyalty_coins($1::uuid, 'email_verified', 'email:rejoin') as coins`, [rejoinUser]));
  assert.equal(Number(changedStillLocked[0].coins), 0);

  await sql`update public.profiles set date_of_birth = '1990-01-01' where id = ${testUser}`;
  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [testUser]);
      await tx.unsafe(`select public.assert_player_can_move_money('load')`);
    }),
    /Test accounts cannot move money/
  );
  await assert.rejects(
    () => sql`insert into public.game_load_requests (user_id) values (${testUser})`,
    /cannot move money/
  );
  await assert.rejects(
    () => sql`insert into public.paydora_payout_requests (user_id) values (${testUser})`,
    /cannot move money/
  );
  await assert.rejects(
    () => sql`insert into public.deposit_requests (user_id) values (${testUser})`,
    /cannot move money/
  );
  const testCoins = await asService((tx) => tx.unsafe(`select public.grant_loyalty_coins($1::uuid, 'signup', 'signup:test') as coins`, [testUser]));
  assert.equal(Number(testCoins[0].coins), 0);
  const fraudCoins = await asService((tx) => tx.unsafe(`select public.grant_loyalty_coins($1::uuid, 'signup', 'signup:fraud') as coins`, [fraudUser]));
  assert.equal(Number(fraudCoins[0].coins), 0);
  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [fraudUser]);
      await tx.unsafe(`select set_config('request.jwt.claim.role', 'authenticated', true)`);
      await tx.unsafe(`set local role authenticated`);
      await tx.unsafe(`select public.save_loyalty_survey('both', 'friend', 'support')`);
    }),
    /welcome reward budget is used up|Coins are not available/i
  );
  const fraudSurvey = await sql`select count(*)::int as n from public.loyalty_survey_responses where user_id = ${fraudUser}`;
  const fraudBalance = await sql`select coins_balance from public.profiles where id = ${fraudUser}`;
  assert.equal(fraudSurvey[0].n, 0);
  assert.equal(Number(fraudBalance[0].coins_balance), 0);
  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`set local role authenticated`);
      await tx.unsafe(`select public.grant_loyalty_coins($1::uuid, 'signup', 'signup:intruder')`, [fraudUser]);
    }),
    /permission denied/i
  );

  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [fraudUser]);
      await tx.unsafe(`select set_config('request.jwt.claim.role', 'authenticated', true)`);
      await tx.unsafe(`select public.claim_loyalty_checkin('daily')`);
    }),
    /Coins are not available on this account/
  );

  const roleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  await sql`insert into public.roles (id, key) values (${roleId}, 'super_admin')`;
  await sql`insert into public.user_roles (user_id, role_id) values (${ownerUser}, ${roleId})`;
  await assert.rejects(
    () => asService((tx) => tx.unsafe(`select public.admin_delete_user_account($1::uuid)`, [ownerUser])),
    /owner account cannot be deleted/
  );
  const ownerLeft = await sql`select count(*)::int as n from public.profiles where id = ${ownerUser}`;
  assert.equal(ownerLeft[0].n, 1);

  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`set local role authenticated`);
      await tx.unsafe(`select public.admin_delete_user_account($1::uuid)`, [testUser]);
    }),
    /permission denied|service role required/i
  );

  console.log(`account lifecycle checks passed on 127.0.0.1:${port}`);
} finally {
  if (sql) await sql.end({ timeout: 2 });
  try { await server.stop(); } catch { /* already stopped */ }
  rmSync(databaseDir, { recursive: true, force: true });
}
