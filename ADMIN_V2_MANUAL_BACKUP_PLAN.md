# Manual backup plan

Date: 14 October 2026. Existing Supabase project, Free plan. Scheduled backups are unavailable.

This plan was written only. No backup was run. No SQL was executed. No production row was changed. Nothing was committed, pushed, or deployed.

## 1. Tools on this machine

`pg_dump`, `pg_restore`, and `psql` are not on `PATH`. They are not under `C:\Program Files\PostgreSQL` or `C:\Program Files (x86)\PostgreSQL`. `winget` is available.

Install a PostgreSQL client whose major version is the same as the database, or newer. The server version is shown in the Supabase dashboard under Project Settings → Database. Do not install it into the application repository.

After installation, open a new PowerShell window and confirm:

```powershell
pg_dump --version
pg_restore --version
```

Both commands must print a version before any backup.

## 2. How to connect

Use the existing project. Do not create another Supabase project for this backup.

The database password is the database password in Project Settings → Database. It is not the anon key and it is not the service-role key.

In the dashboard, open Project Settings → Database → Connection string. Two hosts are shown:

| Mode | When to use it |
| --- | --- |
| Direct connection, port 5432, user `postgres` | First choice for `pg_dump`. |
| Session pooler, port 5432, user `postgres.` plus the project reference | Use this if the direct host does not connect from this Windows machine. Free-plan direct hosts are often IPv6-only. |

Do not use the transaction pooler on port 6543. `pg_dump` needs a session, and that port will fail or produce an incomplete dump.

Require SSL. In a connection URI that ends with the database name, add `?sslmode=require` if it is not already there.

Do not put the password in the command line. PowerShell history and the process list would keep it. In the same window, before `pg_dump`:

```powershell
$env:PGPASSWORD = Read-Host "Database password"
```

Type the password at the prompt. After the backup finishes:

```powershell
Remove-Item Env:PGPASSWORD
```

Do not paste the host, URI, or password into chat, into a file in this repository, or into GitHub.

## 3. Create the backup

Save the file outside the repository, for example:

`C:\Users\Administrator\Backups\cashoutanytime\`

Create that folder if it is missing. Do not create it inside `final-file-main`. A dump placed in the project can be committed by accident. `.gitignore` ignores `.env` files. It does not ignore `.dump` files.

Use custom format so `pg_restore` can read the archive back without loading it into production.

Set the host, port, and user from the dashboard. The database name is `postgres`. Replace only the host and user. Leave the password in `PGPASSWORD`.

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$out = "C:\Users\Administrator\Backups\cashoutanytime\cashoutanytime-$stamp.dump"
pg_dump --format=custom --no-owner --no-privileges --verbose --host=HOST --port=5432 --username=USER --dbname=postgres --file=$out
```

`--no-owner` and `--no-privileges` keep the dump restorable. Supabase owns the platform roles, and a dump that tries to recreate them fails on restore.

Wait until `pg_dump` exits 0. Then clear `PGPASSWORD`. The file should be hundreds of kilobytes or larger. A file of a few kilobytes is not a complete data backup.

This dump is schema and data for the database. It includes the `public` tables the application uses, including profiles, wallets, deposits, game loads, and identity rows, when those tables are in the database.

## 4. What this backup does not fully capture

Authentication. Login users live in the `auth` schema. A full `pg_dump` of database `postgres` includes that schema. Restoring `auth` onto a Supabase project that already has its own Auth service can collide with platform objects. Keep the dump. Treat `auth` restore as a disaster step, not as something to try on the live project.

Storage files. Identity photos and other Storage objects are not inside PostgreSQL. `pg_dump` can include `storage.objects` metadata and still omit the file bytes. The `kyc-documents` bucket stays only in Storage. For a complete copy, download the bucket from the dashboard into the same backup folder, outside the repository. Do not open the files to review them, and do not copy them into the project.

Roles. `anon`, `authenticated`, `service_role`, and the Supabase admin roles belong to the platform. They are not recreated from this dump. Row-level security policies on `public` tables are part of the schema and are included.

Extensions. The dump may contain `CREATE EXTENSION`. A Supabase project already has its extensions. On restore, “already exists” for an extension is expected. A missing extension on a plain local Postgres install has to be installed before the restore, or that part of the restore stops.

Platform schemas. `realtime`, `supabase_migrations`, `vault`, `graphql`, `pgsodium`, and similar schemas are managed by Supabase. They may appear in a full dump. Restoring them onto another Supabase project is not required for the application data and often fails. The integrity check below only needs to see the application tables.

Free plan. There is no scheduled backup and no point-in-time recovery. This file is the only rollback copy until the next manual dump. Take a new dump before any future production deploy.

## 5. Verify the file without touching production

Run this against the file only. It does not connect to Supabase:

```powershell
pg_restore --list $out
```

Exit code 0 means the archive can be read. The list should include `public` tables the application uses, including `profiles` and `kyc_submissions`. An empty list or a non-zero exit means the file is not usable. Do not deploy if that happens.

To prove the rows restore, use a local empty PostgreSQL database on this computer. Do not point `pg_restore` at the Supabase host for this check.

```powershell
pg_restore --no-owner --no-privileges --exit-on-error --dbname=postgresql://postgres:LOCAL_PASSWORD@127.0.0.1:5432/backup_check $out
```

Use a database name that exists only on `127.0.0.1`. If the command exits 0, the archive is restorable. Drop that local database when the check is finished. Do not compare by printing customer emails, balances, or identity paths. A local count of tables is enough.

## 6. Emergency restore

1. Stop deploys and stop admin writes. Leave the live database unchanged until the file check in section 5 has passed.
2. Take another dump of the current database first, if the host is still reachable. The broken state is still evidence.
3. Restore into a local or replacement database. Do not run `pg_restore` against the live Supabase host as the first move. `--clean` on the live host would drop objects other players are using.
4. Confirm the local restore has the expected tables and that the application can read them with a local connection.
5. Only then decide whether to move the application to that restored database. Changing the Vercel project to a new database is a separate owner step. Do not change environment variables as part of taking the backup.
6. Storage files are restored only by putting the saved bucket objects back. A database restore does not upload those files.
7. After a restore, identity decisions still depend on `admin_decide_kyc` existing in the restored database. Confirm the function is in the `pg_restore --list` output before using the admin screen.

If the dump file itself is bad, there is no older Free-plan backup to fall back to. That is why section 5 happens before a deploy.

## 7. Before Admin 2.0 deploy

1. Install `pg_dump` and `pg_restore`.
2. Create one custom-format dump outside the repository.
3. `pg_restore --list` exits 0 and shows the application tables.
4. Record the backup file name and the time. Do not record the password or the connection string.
5. Ask for the deploy again.

Until that file exists and lists cleanly, the production deploy stays blocked.

## Safety check

- No backup command was run.
- No SQL was run.
- No production data was changed.
- No password, connection string, API key, or customer row was written into this file.
- No commit, push, or deploy was made.
