param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Fail($message) {
  Write-Host "ERROR: $message" -ForegroundColor Red
  exit 1
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "feat/auto-sync-matches") {
  Fail "You must be on feat/auto-sync-matches. Current branch: $branch"
}

$dirty = (git status --porcelain)
if ($dirty) {
  Fail "Working tree is not clean. Commit/stash changes first."
}

if (-not $env:DATABASE_URL) {
  Fail "DATABASE_URL is not set in this PowerShell session. Set it to local PostgreSQL only."
}

if ($env:DATABASE_URL -match "render\.com") {
  Fail "Refusing to continue because DATABASE_URL points to Render. Use local PostgreSQL only for validation."
}

$schemaPath = "prisma/schema.prisma"
if (-not (Test-Path $schemaPath)) {
  Fail "Cannot find $schemaPath"
}

$schema = Get-Content $schemaPath -Raw -Encoding UTF8

function Add-AfterLineOnce {
  param(
    [string]$Content,
    [string]$ExistingMarker,
    [string]$Pattern,
    [string]$Insertion
  )

  if ($Content.Contains($ExistingMarker)) {
    return $Content
  }

  $regex = [regex]$Pattern
  $result = $regex.Replace($Content, { param($m) $m.Value + "`n" + $Insertion }, 1)
  if ($result -eq $Content) {
    Fail "Could not apply schema insertion for marker: $ExistingMarker"
  }
  return $result
}

$schema = Add-AfterLineOnce `
  -Content $schema `
  -ExistingMarker "teamAliases   TeamAlias[]" `
  -Pattern '(?m)^  awayMatches\s+Match\[\]\s+@relation\("AwayTeam"\)$' `
  -Insertion '  teamAliases   TeamAlias[]'

$schema = Add-AfterLineOnce `
  -Content $schema `
  -ExistingMarker "externalIds" `
  -Pattern '(?m)^  animationMatchId\s+Int\?\s+@unique$' `
  -Insertion '  externalIds      Json?'

$schema = Add-AfterLineOnce `
  -Content $schema `
  -ExistingMarker "kickoffAt" `
  -Pattern '(?m)^  matchDate\s+DateTime$' `
  -Insertion "  kickoffAt        DateTime?`n  competition      String?`n  season           String?"

$schema = Add-AfterLineOnce `
  -Content $schema `
  -ExistingMarker "syncSource" `
  -Pattern '(?m)^  awayScore\s+Int\s+@default\(0\)$' `
  -Insertion "  minute           Int?`n  syncSource       String?`n  syncState        Json?`n  lastSyncedAt     DateTime?`n  nextSyncAt       DateTime?"

$schema = Add-AfterLineOnce `
  -Content $schema `
  -ExistingMarker "syncStats" `
  -Pattern '(?m)^  statsSnapshots\s+MatchStatsSnapshot\[\]$' `
  -Insertion "  syncStats        MatchStats?`n  snapshots        MatchSnapshot[]"

$schema = Add-AfterLineOnce `
  -Content $schema `
  -ExistingMarker "@@index([status, nextSyncAt])" `
  -Pattern '(?m)^  @@index\(\[animationMatchId\]\)$' `
  -Insertion "  @@index([status, nextSyncAt])`n  @@index([kickoffAt])"

$schema = Add-AfterLineOnce `
  -Content $schema `
  -ExistingMarker "fingerprint String?" `
  -Pattern '(?m)^  sourceUrl\s+String\?$' `
  -Insertion "  fingerprint String?  @unique`n  raw         Json?"

if (-not $schema.Contains("model MatchStats {")) {
  $schema = $schema.TrimEnd() + @"

model MatchStats {
  matchId   String   @id
  match     Match    @relation(fields: [matchId], references: [id], onDelete: Cascade)
  data      Json
  updatedAt DateTime @updatedAt
}

model MatchSnapshot {
  id        String   @id @default(cuid())
  matchId   String?
  match     Match?   @relation(fields: [matchId], references: [id], onDelete: SetNull)
  source    String
  endpoint  String
  payload   Json
  fetchedAt DateTime @default(now())

  @@index([matchId, source, fetchedAt])
}

model SyncJob {
  id         String    @id @default(cuid())
  type       String
  source     String
  status     String
  startedAt  DateTime?
  finishedAt DateTime?
  error      String?
  meta       Json?
  createdAt  DateTime  @default(now())

  @@index([type, status, createdAt])
}

model TeamAlias {
  id          String   @id @default(cuid())
  teamId      String?
  team        Asset?   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  source      String
  externalId  String
  name        String
  needsReview Boolean  @default(false)
  confidence  Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([source, externalId])
  @@index([name])
  @@index([teamId])
}
"@
}

Set-Content -Path $schemaPath -Value $schema -Encoding UTF8

$migrationDir = "prisma/migrations/20260627180000_auto_sync_system"
New-Item -ItemType Directory -Force -Path $migrationDir | Out-Null

$migrationSql = @'
-- Auto-sync additive schema.

ALTER TABLE "Match"
  ADD COLUMN IF NOT EXISTS "externalIds" JSONB,
  ADD COLUMN IF NOT EXISTS "kickoffAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "competition" TEXT,
  ADD COLUMN IF NOT EXISTS "season" TEXT,
  ADD COLUMN IF NOT EXISTS "minute" INTEGER,
  ADD COLUMN IF NOT EXISTS "syncSource" TEXT,
  ADD COLUMN IF NOT EXISTS "syncState" JSONB,
  ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextSyncAt" TIMESTAMP(3);

ALTER TABLE "MatchEvent"
  ADD COLUMN IF NOT EXISTS "fingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "raw" JSONB;

CREATE TABLE IF NOT EXISTS "MatchStats" (
  "matchId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MatchStats_pkey" PRIMARY KEY ("matchId")
);

CREATE TABLE IF NOT EXISTS "MatchSnapshot" (
  "id" TEXT NOT NULL,
  "matchId" TEXT,
  "source" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SyncJob" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "error" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamAlias" (
  "id" TEXT NOT NULL,
  "teamId" TEXT,
  "source" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "needsReview" BOOLEAN NOT NULL DEFAULT false,
  "confidence" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchEvent_fingerprint_key"
  ON "MatchEvent"("fingerprint");

CREATE INDEX IF NOT EXISTS "Match_status_nextSyncAt_idx"
  ON "Match"("status", "nextSyncAt");

CREATE INDEX IF NOT EXISTS "Match_kickoffAt_idx"
  ON "Match"("kickoffAt");

CREATE INDEX IF NOT EXISTS "MatchSnapshot_matchId_source_fetchedAt_idx"
  ON "MatchSnapshot"("matchId", "source", "fetchedAt");

CREATE INDEX IF NOT EXISTS "SyncJob_type_status_createdAt_idx"
  ON "SyncJob"("type", "status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "TeamAlias_source_externalId_key"
  ON "TeamAlias"("source", "externalId");

CREATE INDEX IF NOT EXISTS "TeamAlias_name_idx"
  ON "TeamAlias"("name");

CREATE INDEX IF NOT EXISTS "TeamAlias_teamId_idx"
  ON "TeamAlias"("teamId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MatchStats_matchId_fkey'
  ) THEN
    ALTER TABLE "MatchStats"
      ADD CONSTRAINT "MatchStats_matchId_fkey"
      FOREIGN KEY ("matchId") REFERENCES "Match"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MatchSnapshot_matchId_fkey'
  ) THEN
    ALTER TABLE "MatchSnapshot"
      ADD CONSTRAINT "MatchSnapshot_matchId_fkey"
      FOREIGN KEY ("matchId") REFERENCES "Match"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TeamAlias_teamId_fkey'
  ) THEN
    ALTER TABLE "TeamAlias"
      ADD CONSTRAINT "TeamAlias_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Asset"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
'@

Set-Content -Path (Join-Path $migrationDir "migration.sql") -Value $migrationSql -Encoding UTF8

Write-Host "Schema and migration files were updated locally." -ForegroundColor Green

npx prisma format
npx prisma validate
npx prisma generate
npx tsc --noEmit

if (-not $SkipBuild) {
  npm run build
}

git status --short
git add prisma/schema.prisma "$migrationDir/migration.sql"

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "No staged changes to commit." -ForegroundColor Yellow
  exit 0
}

git commit -m "feat: add auto sync prisma schema"
git push origin feat/auto-sync-matches

Write-Host "Done: auto-sync Prisma schema and migration committed and pushed." -ForegroundColor Green
