/** Isolated check for the unapplied Coins migration. Never connects to production. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
const port = 46000 + (process.pid % 1000);
const databaseDir = mkdtempSync(path.join(tmpdir(), "loyalty-pg-"));
const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const server = new EmbeddedPostgres({ databaseDir, user: "postgres", password: "postgres", port, persistent: true });
let sql;

try {
  await server.initialise();
  await server.start();
  await server.createDatabase("loyalty_test");
  sql = postgres({ host: "127.0.0.1", port, database: "loyalty_test", username: "postgres", password: "postgres", max: 4 });
  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY,
      is_suspended boolean NOT NULL DEFAULT false,
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
         OR to_jsonb(NEW)->>'bonus_wallet' IS DISTINCT FROM to_jsonb(OLD)->>'bonus_wallet'
         OR to_jsonb(NEW)->>'wallet_balance' IS DISTINCT FROM to_jsonb(OLD)->>'wallet_balance' THEN
        RAISE EXCEPTION 'column protected';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER trg_protect_profile_columns BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();
    CREATE OR REPLACE FUNCTION public.claim_reward(rule_key text, p_user_id uuid)
    RETURNS TABLE (coins_awarded integer, xp_awarded integer, multiplier numeric)
    LANGUAGE plpgsql AS $claim$
    BEGIN
      PERFORM set_config('app.wallet_update', 'true', true);
      UPDATE public.profiles
         SET bonus_wallet = coalesce(bonus_wallet, 0) + 1,
             vip_points = coalesce(vip_points, 0) + 50
       WHERE id = p_user_id;
      RETURN QUERY SELECT 0, 50, 1::numeric;
    END $claim$;
  `);
  await sql.unsafe(readFileSync(new URL("../supabase/migrations/20261022000100_loyalty_coins.sql", import.meta.url), "utf8"));
  await sql.unsafe(readFileSync(new URL("../supabase/migrations/20261022000100_loyalty_coins.sql", import.meta.url), "utf8"));
  await sql.unsafe(readFileSync(new URL("../supabase/migrations/20261022000200_loyalty_completion.sql", import.meta.url), "utf8"));
  await sql.unsafe(readFileSync(new URL("../supabase/migrations/20261022000200_loyalty_completion.sql", import.meta.url), "utf8"));
  const userC = "33333333-3333-4333-8333-333333333333";
  await sql`insert into public.profiles (id) values (${userA}), (${userB}), (${userC})`;

  async function asService(fn) {
    return sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.role', 'service_role', true)`);
      await tx.unsafe(`set local role service_role`);
      return fn(tx);
    });
  }

  const off = await asService((tx) => tx.unsafe(`select public.grant_loyalty_coins($1::uuid, 'signup', 'signup:a') as coins`, [userA]));
  assert.equal(Number(off[0].coins), 0);
  await sql`insert into public.site_settings (key, value) values ('coins_earning_enabled', 'true'::jsonb)`;
  const stillOff = await asService((tx) => tx.unsafe(`select public.grant_loyalty_coins($1::uuid, 'signup', 'signup:a') as coins`, [userA]));
  assert.equal(Number(stillOff[0].coins), 0);
  await sql`update public.loyalty_tasks set enabled = true where key = 'signup'`;

  const raced = await Promise.allSettled([
    asService((tx) => tx.unsafe(`select public.grant_loyalty_coins($1::uuid, 'signup', 'signup:a') as coins`, [userA])),
    asService((tx) => tx.unsafe(`select public.grant_loyalty_coins($1::uuid, 'signup', 'signup:a-again') as coins`, [userA])),
  ]);
  const paid = raced.filter((item) => item.status === "fulfilled").map((item) => Number(item.value[0].coins));
  assert.equal(paid.filter((coins) => coins === 200).length, 1);
  assert.equal(paid.filter((coins) => coins === 0).length, 1);
  const profile = await sql`select coins_balance, vip_points, wallet_balance, cashout_wallet, bonus_wallet, bonus_redeem_wallet from public.profiles where id = ${userA}`;
  assert.equal(Number(profile[0].coins_balance), 200);
  assert.equal(Number(profile[0].vip_points), 0);
  assert.equal(Number(profile[0].bonus_wallet), 0);
  assert.equal(Number(profile[0].wallet_balance), 0);
  assert.equal(Number(profile[0].cashout_wallet), 0);
  assert.equal(Number(profile[0].bonus_redeem_wallet), 0);

  await assert.rejects(
    () => asService((tx) => tx.unsafe(`select public.redeem_loyalty_coins($1::uuid, 1000)`, [userA])),
    /not available yet/i
  );
  const afterRedeem = await sql`select coins_balance, bonus_wallet from public.profiles where id = ${userA}`;
  assert.equal(Number(afterRedeem[0].coins_balance), 200);
  assert.equal(Number(afterRedeem[0].bonus_wallet), 0);

  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userB]);
      await tx.unsafe(`set local role authenticated`);
      await tx.unsafe(`select public.save_loyalty_survey('both', 'friend', 'support')`);
    }),
    /not turned on/i
  );
  await sql`update public.loyalty_tasks set enabled = true where key = 'welcome_survey'`;
  const saved = await sql.begin(async (tx) => {
    await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userB]);
    await tx.unsafe(`set local role authenticated`);
    return tx.unsafe(`select public.save_loyalty_survey('both', 'friend', 'support') as ok`);
  });
  assert.equal(saved[0].ok, true);
  const surveyed = await sql`select coins_balance, bonus_wallet from public.profiles where id = ${userB}`;
  assert.equal(Number(surveyed[0].coins_balance), 100);
  assert.equal(Number(surveyed[0].bonus_wallet), 0);
  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userB]);
      await tx.unsafe(`set local role authenticated`);
      await tx.unsafe(`select public.save_loyalty_survey('slots', 'telegram', 'rewards')`);
    }),
    /duplicate|unique/i
  );
  const once = await sql`select coins_balance from public.profiles where id = ${userB}`;
  assert.equal(Number(once[0].coins_balance), 100);

  const game = await sql`select first_deposit_bonus_percent, reload_bonus_percent, bonus_enabled, bonus_max_amount from public.games where slug = 'juwa'`;
  assert.equal(Number(game[0].first_deposit_bonus_percent), 50);
  assert.equal(Number(game[0].reload_bonus_percent), 10);
  assert.equal(game[0].bonus_enabled, true);
  assert.equal(game[0].bonus_max_amount, null);

  const depositOff = await asService((tx) => tx.unsafe(`select public.grant_deposit_loyalty_coins($1::uuid, 'dep-1', 10) as coins`, [userA]));
  assert.equal(Number(depositOff[0].coins), 0);
  await sql`insert into public.site_settings (key, value) values ('deposit_coins_enabled', 'true'::jsonb) on conflict (key) do update set value = excluded.value`;
  const deposit = await asService((tx) => tx.unsafe(`select public.grant_deposit_loyalty_coins($1::uuid, 'dep-1', 10) as coins`, [userA]));
  const depositAgain = await asService((tx) => tx.unsafe(`select public.grant_deposit_loyalty_coins($1::uuid, 'dep-1', 10) as coins`, [userA]));
  assert.equal(Number(deposit[0].coins), 50);
  assert.equal(Number(depositAgain[0].coins), 0);
  const partial = await asService((tx) => tx.unsafe(`select public.reverse_deposit_loyalty_coins('dep-1', 'partial-1', 4) as coins`));
  const partialAgain = await asService((tx) => tx.unsafe(`select public.reverse_deposit_loyalty_coins('dep-1', 'partial-1', 4) as coins`));
  assert.equal(Number(partial[0].coins), 20);
  assert.equal(Number(partialAgain[0].coins), 0);
  const full = await asService((tx) => tx.unsafe(`select public.reverse_deposit_loyalty_coins('dep-1', 'refund:dep-1', 10) as coins`));
  assert.equal(Number(full[0].coins), 30);
  const wallets = await sql`select coins_balance, bonus_wallet, wallet_balance, vip_points from public.profiles where id = ${userA}`;
  assert.equal(Number(wallets[0].coins_balance), 200);
  assert.equal(Number(wallets[0].bonus_wallet), 0);
  assert.equal(Number(wallets[0].wallet_balance), 0);
  assert.equal(Number(wallets[0].vip_points), 0);

  const legacyPaid = await asService((tx) => tx.unsafe(`select public.claim_legacy_freeplay('daily_login', $1::uuid) as ok`, [userC]));
  assert.equal(legacyPaid[0].ok, true);
  const legacyWallet = await sql`select bonus_wallet, vip_points, coins_balance from public.profiles where id = ${userC}`;
  assert.equal(Number(legacyWallet[0].bonus_wallet), 1);
  assert.equal(Number(legacyWallet[0].vip_points), 50);
  assert.equal(Number(legacyWallet[0].coins_balance), 0);
  await sql`update public.site_settings set value = 'true'::jsonb where key in ('legacy_freeplay_claims_enabled', 'coins_checkin_enabled')`;
  await assert.rejects(
    () => asService((tx) => tx.unsafe(`select public.claim_legacy_freeplay('daily_login', $1::uuid)`, [userC])),
    /cannot both pay/i
  );
  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userC]);
      await tx.unsafe(`set local role authenticated`);
      await tx.unsafe(`select public.claim_loyalty_checkin('daily')`);
    }),
    /cannot both pay/i
  );
  await sql`update public.site_settings set value = 'false'::jsonb where key in ('legacy_freeplay_claims_enabled', 'coins_checkin_enabled', 'coins_earning_enabled')`;
  await assert.rejects(
    () => asService((tx) => tx.unsafe(`select public.claim_legacy_freeplay('daily_login', $1::uuid)`, [userC])),
    /turned off/i
  );
  await sql`update public.site_settings set value = 'true'::jsonb where key = 'coins_earning_enabled'`;
  await sql`update public.site_settings set value = 'false'::jsonb where key = 'legacy_freeplay_claims_enabled'`;
  await sql`update public.site_settings set value = 'true'::jsonb where key = 'coins_checkin_enabled'`;
  const legacyFlag = await sql`select value from public.site_settings where key = 'legacy_freeplay_claims_enabled'`;
  assert.equal(legacyFlag[0].value, false);
  await assert.rejects(
    () => asService((tx) => tx.unsafe(`select public.claim_legacy_freeplay('weekly_chest', $1::uuid)`, [userC])),
    /turned off/i
  );
  await sql`update public.loyalty_tasks set enabled = true where key in ('daily_checkin', 'weekly_checkin', 'monthly_checkin', 'phone_otp')`;
  const daily = await sql.begin(async (tx) => {
    await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userB]);
    await tx.unsafe(`set local role authenticated`);
    return tx.unsafe(`select public.claim_loyalty_checkin('daily') as coins`);
  });
  const dailyAgain = await sql.begin(async (tx) => {
    await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userB]);
    await tx.unsafe(`set local role authenticated`);
    return tx.unsafe(`select public.claim_loyalty_checkin('daily') as coins`);
  });
  assert.equal(Number(daily[0].coins), 20);
  assert.equal(Number(dailyAgain[0].coins), 0);
  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userB]);
      await tx.unsafe(`set local role authenticated`);
      await tx.unsafe(`select public.claim_loyalty_checkin('weekly')`);
    }),
    /5 daily/i
  );
  await sql.unsafe(`
    insert into public.loyalty_checkins (user_id, kind, period_key, week_key, month_key, coins)
    select '${userB}', 'daily', 'seed-' || g, p.week_key, p.month_key, 20
    from generate_series(1, 4) g
    cross join public.loyalty_utc_periods() p
  `);
  const weekly = await sql.begin(async (tx) => {
    await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userB]);
    await tx.unsafe(`set local role authenticated`);
    return tx.unsafe(`select public.claim_loyalty_checkin('weekly') as coins`);
  });
  assert.equal(Number(weekly[0].coins), 100);
  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userB]);
      await tx.unsafe(`set local role authenticated`);
      await tx.unsafe(`select public.claim_loyalty_checkin('monthly')`);
    }),
    /20 daily/i
  );
  const afterCheckin = await sql`select coins_balance, bonus_wallet from public.profiles where id = ${userB}`;
  assert.equal(Number(afterCheckin[0].coins_balance), 220);
  assert.equal(Number(afterCheckin[0].bonus_wallet), 0);

  const racedDaily = await Promise.allSettled([
    sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userC]);
      await tx.unsafe(`set local role authenticated`);
      return tx.unsafe(`select public.claim_loyalty_checkin('daily') as coins`);
    }),
    sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userC]);
      await tx.unsafe(`set local role authenticated`);
      return tx.unsafe(`select public.claim_loyalty_checkin('daily') as coins`);
    }),
  ]);
  const dailyPaid = racedDaily.filter((item) => item.status === "fulfilled").map((item) => Number(item.value[0].coins));
  assert.equal(dailyPaid.filter((coins) => coins === 20).length, 1);
  assert.equal(dailyPaid.filter((coins) => coins === 0).length, 1);

  const phoneHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const wrongHash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  await asService((tx) => tx.unsafe(`select public.start_loyalty_phone_challenge($1::uuid, '+15555550123', $2)`, [userA, phoneHash]));
  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userA]);
      await tx.unsafe(`set local role authenticated`);
      await tx.unsafe(`select public.confirm_loyalty_phone($1)`, [wrongHash]);
    }),
    /does not match/i
  );
  const phone = await sql.begin(async (tx) => {
    await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userA]);
    await tx.unsafe(`set local role authenticated`);
    return tx.unsafe(`select public.confirm_loyalty_phone($1) as coins`, [phoneHash]);
  });
  assert.equal(Number(phone[0].coins), 150);
  await assert.rejects(
    () => asService((tx) => tx.unsafe(`select public.start_loyalty_phone_challenge($1::uuid, '+15555550123', $2)`, [userB, phoneHash])),
    /another account/i
  );
  const phoneWallet = await sql`select coins_balance, bonus_wallet from public.profiles where id = ${userA}`;
  assert.equal(Number(phoneWallet[0].coins_balance), 350);
  assert.equal(Number(phoneWallet[0].bonus_wallet), 0);
  const shortGrant = await asService((tx) => tx.unsafe(`select public.grant_deposit_loyalty_coins($1::uuid, 'dep-short', 10) as coins`, [userA]));
  assert.equal(Number(shortGrant[0].coins), 50);
  await sql.begin(async (tx) => {
    await tx.unsafe(`select set_config('app.wallet_update', 'true', true)`);
    await tx.unsafe(`update public.profiles set coins_balance = 10 where id = $1`, [userA]);
  });
  const short = await asService((tx) => tx.unsafe(`select public.reverse_deposit_loyalty_coins('dep-short', 'refund:dep-short', 10) as coins`));
  assert.equal(Number(short[0].coins), 10);
  const debt = await sql`select coins_balance, bonus_wallet, unrecovered_coins from public.profiles p join public.loyalty_deposit_grants g on g.user_id = p.id where g.deposit_key = 'dep-short'`;
  assert.equal(Number(debt[0].coins_balance), 0);
  assert.equal(Number(debt[0].bonus_wallet), 0);
  assert.equal(Number(debt[0].unrecovered_coins), 40);
  const shortRow = await sql`select coins, shortfall from public.loyalty_deposit_reversals where reversal_key = 'refund:dep-short'`;
  assert.equal(Number(shortRow[0].coins), 10);
  assert.equal(Number(shortRow[0].shortfall), 40);

  await sql`update public.loyalty_tasks set enabled = true where key = 'email_verified'`;
  const issued = Number((await sql`select public.loyalty_issued_coins() as coins`)[0].coins);
  await sql.unsafe(`
    insert into public.loyalty_checkins (user_id, kind, period_key, week_key, month_key, coins)
    select '${userC}', 'daily', 'budget-seed', p.week_key, p.month_key, ${30000 - issued}
    from public.loyalty_utc_periods() p
  `);
  const capped = await asService((tx) => tx.unsafe(`select public.grant_loyalty_coins($1::uuid, 'email_verified', 'email:cap') as coins`, [userC]));
  assert.equal(Number(capped[0].coins), 0);

  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userB]);
      await tx.unsafe(`set local role authenticated`);
      await tx.unsafe(`select public.grant_loyalty_coins($1::uuid, 'signup', 'signup:intruder')`, [userA]);
    }),
    /service role required|permission denied/i
  );
  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userB]);
      await tx.unsafe(`set local role authenticated`);
      await tx.unsafe(`update public.loyalty_tasks set coins = 9999 where key = 'kyc_approved'`);
    }),
    /permission denied|row-level security/i
  );
  const kycCoins = await sql`select coins from public.loyalty_tasks where key = 'kyc_approved'`;
  assert.equal(Number(kycCoins[0].coins), 300);
  const hidden = await sql.begin(async (tx) => {
    await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userB]);
    await tx.unsafe(`set local role authenticated`);
    return tx.unsafe(`select count(*)::int as n from public.loyalty_grants where user_id = $1`, [userA]);
  });
  assert.equal(Number(hidden[0].n), 0);

  await assert.rejects(
    () => asService((tx) => tx.unsafe(`select public.redeem_loyalty_coins($1::uuid, 1000)`, [userA])),
    /not available yet/i
  );
  const summary = await asService((tx) => tx.unsafe(`select public.loyalty_admin_summary() as summary`));
  assert.equal(Number(summary[0].summary.cap), 30000);
  assert.equal(Number(summary[0].summary.unrecovered), 40);
  assert.equal(summary[0].summary.redemption, false);
  await assert.rejects(
    () => sql.begin(async (tx) => {
      await tx.unsafe(`select set_config('request.jwt.claim.sub', $1, true)`, [userB]);
      await tx.unsafe(`set local role authenticated`);
      await tx.unsafe(`select public.loyalty_admin_summary()`);
    }),
    /service role required|permission denied/i
  );

  console.log(`loyalty coins postgres checks passed on 127.0.0.1:${port}`);
} finally {
  if (sql) await sql.end({ timeout: 2 });
  try { await server.stop(); } catch { /* already stopped */ }
  rmSync(databaseDir, { recursive: true, force: true });
}
