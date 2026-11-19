# Phase 0: Backup & Disaster Recovery Runbook

**System Name:** Print Studio Ledger (`print-studio-app`)  
**Document Identifier:** `PHASE_0_BACKUP_RESTORE_RUNBOOK.md`  
**Classification:** Operational Security & Disaster Recovery Procedure  
**Applies To:** Production Database (`neondb`), Production Branch (`br-noisy-haze-aziu7zel`)  
**Document Status:** Pending Verification (Awaiting manager review of empirical evidence)  
**Execution Date:** November 18, 2026  

---

## 1. Overview & Architectural Principles

This runbook defines the authoritative, tested procedures for backing up and restoring Print Studio Ledger's database.

### Core Safety Invariants:
1. **Never Perform Destructive Restores Against Live Production:** Live database restoration is strictly prohibited unless an authorized disaster recovery event has been declared. Verification testing must always execute against an isolated temporary database (e.g. `test_verify_isolated_restore_pg18`).
2. **Never Expose Secrets in Logs or Reports:** Database connection strings, API keys, and cloud tokens must be injected via environment variables. Scripts must never echo or log credentials.
3. **Keep Backups Outside Public Directories:** Backups must never be placed in Next.js's `./public/` directory, which would expose them to the public internet. Backups are stored in `./backups/` with `0700` directory permissions and `0600` file permissions.
4. **PostgreSQL Compatibility Mandate:** The Neon production database runs **PostgreSQL 18.7** (`18.7 a21afb5`). Standard PostgreSQL 16 clients fail `pg_dump` with `server version mismatch`, and PostgreSQL 16 restore targets reject PostgreSQL 18 dumps on `SET transaction_timeout = 0`. This runbook mandates the use of **PostgreSQL 18.7 client binaries** (`/opt/homebrew/opt/postgresql@18/bin/`).

---

## 2. PostgreSQL Server & Client Compatibility Requirements

### 2.1 Environmental Audit Matrix
| Component | Detected Version | Tool Location | Compatibility Status |
|---|---|---|---|
| **Neon Production Server** | `PostgreSQL 18.7 (a21afb5)` | Neon Cloud (`aws-ap-southeast-1`) | Source of Truth |
| **Default System `pg_dump`** | `PostgreSQL 16.15 (Homebrew)` | `/opt/homebrew/bin/pg_dump` | **INCOMPATIBLE** (Aborts with `server version mismatch`) |
| **PostgreSQL 18.7 Client** | `PostgreSQL 18.7 (Homebrew)` | `/opt/homebrew/opt/postgresql@18/bin/pg_dump` | **COMPATIBLE** (Matches server version 18.7) |
| **Local Verification Target**| `PostgreSQL 18.7 (Homebrew)` | `/opt/homebrew/opt/postgresql@18/bin/postgres` (port 5433) | **COMPATIBLE** (Accepts PG 18 syntax without error) |

### 2.2 Compatibility Warning
> [!WARNING]
> The database dump is **NOT version-independent**. Native `pg_dump 18.7` emits PostgreSQL 18-specific configuration directives (e.g., `SET transaction_timeout = 0;`). When executed against an older PostgreSQL 16 instance with `ON_ERROR_STOP=1`, the restore **fails immediately** with:
> `ERROR: unrecognized configuration parameter "transaction_timeout"`.
> Any restore target for this backup must run a PostgreSQL 18-compatible database engine.

---

## 3. Verified Backup Registry & Checksums

### 3.1 Local Backup Files
All files are stored in `./backups/` with `umask 077`, directory permissions `0700` (`drwx------`), and file permissions `0600` (`-rw-------`).

| File Name | File Size | SHA-256 Checksum | Backup Type | Verification Status |
|---|---|---|---|---|
| `backup_phase0_pgdump_18.sql` | 1,997,091 bytes | `ca3350318a0febff7037aa9eb4461ce1de1f4e5be8283c4bed800b8876f110f3` | Plain SQL Dump (PG 18.7) | `[PASS]` |
| `backup_phase0_pgdump_18.sql.gz` | 1,325,677 bytes | `0a9400672ba8b76f0f266c412ee97afc38839f0e24ba3a67404783973004c05c` | Gzip Compressed (PG 18.7) | `[PASS]` |
| `backup_phase0_baseline.json` | 2,035,178 bytes | `8bcdeecba7ae5c48b7884d4361536a7a0b3e6e87f828a25232938a16aa914f68` | Raw JSONB Master Export | `[PASS]` |

### 3.2 Neon Cloud Snapshot Branch
- **Project ID:** `curly-bonus-63102093` (`3d Printing`)
- **Branch Name:** `backup-phase0-baseline`
- **Branch ID:** `br-autumn-butterfly-azxmx3mp`
- **Parent Branch:** `production` (`br-noisy-haze-aziu7zel`)
- **Created At:** 2026-11-18 03:42:50 UTC
- **Current State:** `ready`
- **Direct Accessibility:** Verified via direct SQL connection query confirming 371 rows (`PASS`).

### 3.3 Offsite Cloudflare R2 Status
- **Status:** `[NOT_RUN / BLOCKED]`
- **Reason:** Cloudflare R2 credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`) are not yet provisioned in `.env.local` (scheduled for Phase 2). No offsite R2 upload has taken place. Offsite encrypted backup protection is currently **not active**.

---

## 4. Backup Execution Procedures

### 4.1 Procedure 1: Creating a Verified Neon Cloud Branch Snapshot
```bash
# 1. Verify project connection
neon projects list

# 2. Create instant branch snapshot from active production
neon branches create --name backup-phase0-manual-$(date +%Y%m%d-%H%M%S)

# 3. Verify state is 'ready'
neon branches list
```

### 4.2 Procedure 2: Creating a Native PostgreSQL 18.7 Logical Dump
```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077

mkdir -p ./backups
chmod 700 ./backups

# Extract direct URL from .env.local without exposing credentials
DIRECT_URL=$(grep "^DATABASE_URL=" .env.local | cut -d '=' -f2- | tr -d '"'"'" | sed 's/-pooler//')

OUTPUT_SQL="./backups/backup_$(date +%Y%m%d_%H%M%S).sql"
OUTPUT_GZ="${OUTPUT_SQL}.gz"

# Execute pg_dump using PostgreSQL 18 client
/opt/homebrew/opt/postgresql@18/bin/pg_dump \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --format=plain \
    "$DIRECT_URL" > "$OUTPUT_SQL"

chmod 600 "$OUTPUT_SQL"

# Compress with gzip
gzip -k -f "$OUTPUT_SQL"
chmod 600 "$OUTPUT_GZ"

# Calculate and record checksum
shasum -a 256 "$OUTPUT_GZ"
```

---

## 5. Strict Restore Verification Runbook

This procedure verifies the integrity of the backup using an isolated, temporary PostgreSQL 18 instance. It does **not** hide errors, enforces `ON_ERROR_STOP=1`, and checks exact constraints and row counts:

```bash
#!/usr/bin/env bash
set -euo pipefail

PG_BIN="/opt/homebrew/opt/postgresql@18/bin"
PORT="5433"
TEST_DB="test_verify_isolated_restore_pg18"
BACKUP_SQL="./backups/backup_phase0_pgdump_18.sql"

echo "=== STEP 1: VERIFYING BACKUP FILE INTEGRITY ==="
test -f "$BACKUP_SQL" || { echo "ERROR: Backup file missing"; exit 1; }
shasum -a 256 "$BACKUP_SQL"

echo "=== STEP 2: CREATING CLEAN ISOLATED TEST DATABASE ==="
# Fails immediately if database cannot be created; no || true
"$PG_BIN/createdb" -p "$PORT" "$TEST_DB"

echo "=== STEP 3: EXECUTING RESTORE WITH ON_ERROR_STOP ==="
# Fails immediately on any SQL error
"$PG_BIN/psql" -p "$PORT" -d "$TEST_DB" -v ON_ERROR_STOP=1 -q < "$BACKUP_SQL"

echo "=== STEP 4: VERIFYING TABLE ROW COUNTS ==="
TOTAL_ROWS=$("$PG_BIN/psql" -p "$PORT" -d "$TEST_DB" -t -A -c "SELECT COUNT(*) FROM public.ledger_collections;")
echo "Total rows restored: ${TOTAL_ROWS}"

if [ "$TOTAL_ROWS" -ne 371 ]; then
    echo "ERROR: Expected 371 rows, got ${TOTAL_ROWS}"
    "$PG_BIN/dropdb" -p "$PORT" "$TEST_DB"
    exit 1
fi

echo "=== STEP 5: VERIFYING CONSTRAINTS & STRUCTURE ==="
"$PG_BIN/psql" -p "$PORT" -d "$TEST_DB" -c "
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.ledger_collections'::regclass;
"

echo "=== STEP 6: VERIFYING DATA SAMPLE ==="
"$PG_BIN/psql" -p "$PORT" -d "$TEST_DB" -c "
SELECT collection_name, COUNT(*) as cnt 
FROM public.ledger_collections 
GROUP BY collection_name 
ORDER BY cnt DESC;
"

echo "=== STEP 7: CLEANING UP TEST DATABASE ==="
# Fails if dropdb encounters an error
"$PG_BIN/dropdb" -p "$PORT" "$TEST_DB"
echo "PASS: Test database dropped cleanly. Verification complete."
```

---

## 6. Disaster Recovery Procedures

### Scenario A: Instant Branch Rollback via Neon Cloud (RTO < 2 minutes)
1. Verify snapshot branch status:
   ```bash
   neon branches list
   ```
2. Confirm branch `backup-phase0-baseline` (`br-autumn-butterfly-azxmx3mp`) is `ready`.
3. Obtain connection URI for snapshot branch:
   ```bash
   neon cs backup-phase0-baseline
   ```
4. Update `DATABASE_URL` in `.env.local` to point to the snapshot branch endpoint.
5. Restart application dev server:
   ```bash
   npm run dev
   ```
*Note: Overwriting the primary production branch endpoint directly from a snapshot branch is a destructive operation that has not been executed during Phase 0.*

### Scenario B: Point-in-Time Restore from SQL Dump (RTO < 5 minutes)
```bash
# Target connection must be PostgreSQL 18-compatible
export TARGET_DB_URL="<target_database_connection_url>"

/opt/homebrew/opt/postgresql@18/bin/psql \
    "$TARGET_DB_URL" \
    -v ON_ERROR_STOP=1 \
    -f ./backups/backup_phase0_pgdump_18.sql
```

---

## 7. Acceptance Criteria & Evidence Matrix

| Criterion | Procedure / Command Executed | Actual Empirical Result | Evidence Location | Status |
|---|---|---|---|---|
| **Neon Server Version** | `SELECT version();` | PostgreSQL 18.7 (`server_version_num: 180007`) | Output log (Step 11142) | `PASS` |
| **PG18 Client Tools** | `brew info postgresql@18` & install | `/opt/homebrew/opt/postgresql@18/bin/pg_dump` 18.7 installed | `/opt/homebrew/opt/postgresql@18/` | `PASS` |
| **Native PG18 Dump** | `pg_dump 18.7` against Neon direct | Zero errors; 1,997,091 bytes generated | `./backups/backup_phase0_pgdump_18.sql` | `PASS` |
| **File Permissions** | `chmod 700 backups && chmod 600 backups/*` | Directory `0700`, files `0600` | Terminal output (Step 11234) | `PASS` |
| **Web Exclusion** | `curl http://localhost:3000/backups/...` | HTTP 404 Not Found | Terminal output (Step 11243) | `PASS` |
| **Strict Test Restore** | `psql -p 5433 -v ON_ERROR_STOP=1` | Zero errors; exact 371 rows; PK verified | Terminal output (Step 11219) | `PASS` |
| **Neon Snapshot Exists**| `neon branches list` | Branch `br-autumn-butterfly-azxmx3mp` ready | Neon Cloud Console / CLI | `PASS` |
| **Snapshot Data Query** | Direct SQL query to snapshot branch | Exact 371 rows verified | Terminal output (Step 11230) | `PASS` |
| **Offsite R2 Upload** | Check R2 credentials in `.env.local` | No R2 credentials configured | `.env.local` | `NOT_RUN / BLOCKED` |
| **Live Prod Rollback** | Restore snapshot over live production | Prohibited in Phase 0 | Operational Safeguard | `NOT_RUN` |
