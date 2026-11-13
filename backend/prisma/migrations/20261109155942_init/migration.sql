-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('student', 'organization', 'admin');

-- CreateEnum
CREATE TYPE "locale" AS ENUM ('kk', 'ru');

-- CreateEnum
CREATE TYPE "org_status" AS ENUM ('pending', 'verified', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "student_status" AS ENUM ('unclaimed', 'claimed');

-- CreateEnum
CREATE TYPE "event_level" AS ENUM ('school', 'district', 'regional', 'national', 'international');

-- CreateEnum
CREATE TYPE "award_type" AS ENUM ('diploma', 'certificate');

-- CreateEnum
CREATE TYPE "award_status" AS ENUM ('active', 'corrected', 'revoked');

-- CreateEnum
CREATE TYPE "change_request_type" AS ENUM ('change_iin', 'revoke', 'merge_duplicates');

-- CreateEnum
CREATE TYPE "change_request_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "otp_status" AS ENUM ('issued', 'verified', 'expired', 'locked');

-- CreateEnum
CREATE TYPE "ai_flag_status" AS ENUM ('open', 'confirmed', 'dismissed');

-- CreateEnum
CREATE TYPE "ai_job_status" AS ENUM ('queued', 'running', 'done', 'failed');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" VARCHAR(255) NOT NULL,
    "bin" CHAR(12) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "status" "org_status" NOT NULL DEFAULT 'pending',
    "contact" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "role" "user_role" NOT NULL,
    "login" VARCHAR(255),
    "password_hash" VARCHAR(255) NOT NULL,
    "locale" "locale" NOT NULL DEFAULT 'ru',
    "organization_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID,
    "iin_hash" CHAR(64) NOT NULL,
    "iin_encrypted" BYTEA NOT NULL,
    "phone_hash" CHAR(64) NOT NULL,
    "phone_encrypted" BYTEA NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "status" "student_status" NOT NULL DEFAULT 'unclaimed',
    "guardian_consent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "event_date" DATE NOT NULL,
    "level" "event_level" NOT NULL,
    "subject" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awards" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "place" SMALLINT,
    "type" "award_type" NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "status" "award_status" NOT NULL DEFAULT 'active',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "award_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "type" "change_request_type" NOT NULL,
    "payload" JSONB,
    "reason" TEXT NOT NULL,
    "status" "change_request_status" NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "review_comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "student_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_link_awards" (
    "share_link_id" UUID NOT NULL,
    "award_id" UUID NOT NULL,

    CONSTRAINT "share_link_awards_pkey" PRIMARY KEY ("share_link_id","award_id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "phone_hash" CHAR(64) NOT NULL,
    "iin_hash" CHAR(64),
    "code_hash" VARCHAR(255) NOT NULL,
    "payload_encrypted" BYTEA,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "status" "otp_status" NOT NULL DEFAULT 'issued',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMPTZ(6),

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "actor_id" UUID,
    "entity" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_flags" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "award_id" UUID NOT NULL,
    "score" DECIMAL(4,3) NOT NULL,
    "reasons" JSONB NOT NULL,
    "model" VARCHAR(100),
    "status" "ai_flag_status" NOT NULL DEFAULT 'open',
    "reviewed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "award_id" UUID NOT NULL,
    "status" "ai_job_status" NOT NULL DEFAULT 'queued',
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "run_after" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_bin_key" ON "organizations"("bin");

-- CreateIndex
CREATE UNIQUE INDEX "users_login_key" ON "users"("login");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_iin_hash_key" ON "students"("iin_hash");

-- CreateIndex
CREATE INDEX "students_phone_hash_idx" ON "students"("phone_hash");

-- CreateIndex
CREATE INDEX "events_organization_id_idx" ON "events"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_organization_id_id_key" ON "events"("organization_id", "id");

-- CreateIndex
CREATE INDEX "awards_event_id_idx" ON "awards"("event_id");

-- CreateIndex
CREATE INDEX "awards_student_id_idx" ON "awards"("student_id");

-- CreateIndex
CREATE INDEX "awards_document_number_idx" ON "awards"("document_number");

-- CreateIndex
CREATE INDEX "awards_created_by_idx" ON "awards"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "awards_organization_id_document_number_key" ON "awards"("organization_id", "document_number");

-- CreateIndex
CREATE INDEX "change_requests_award_id_idx" ON "change_requests"("award_id");

-- CreateIndex
CREATE INDEX "change_requests_requested_by_idx" ON "change_requests"("requested_by");

-- CreateIndex
CREATE INDEX "change_requests_reviewed_by_idx" ON "change_requests"("reviewed_by");

-- CreateIndex
CREATE INDEX "change_requests_status_created_at_idx" ON "change_requests"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_hash_key" ON "share_links"("token_hash");

-- CreateIndex
CREATE INDEX "share_links_student_id_idx" ON "share_links"("student_id");

-- CreateIndex
CREATE INDEX "share_link_awards_award_id_idx" ON "share_link_awards"("award_id");

-- CreateIndex
CREATE INDEX "otp_codes_phone_hash_created_at_idx" ON "otp_codes"("phone_hash", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_created_at_idx" ON "audit_log"("entity", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log"("actor_id");

-- CreateIndex
CREATE INDEX "ai_flags_award_id_idx" ON "ai_flags"("award_id");

-- CreateIndex
CREATE INDEX "ai_flags_status_created_at_idx" ON "ai_flags"("status", "created_at");

-- CreateIndex
CREATE INDEX "ai_flags_reviewed_by_idx" ON "ai_flags"("reviewed_by");

-- CreateIndex
CREATE INDEX "ai_jobs_award_id_idx" ON "ai_jobs"("award_id");

-- CreateIndex
CREATE INDEX "ai_jobs_status_run_after_idx" ON "ai_jobs"("status", "run_after");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awards" ADD CONSTRAINT "awards_organization_id_event_id_fkey" FOREIGN KEY ("organization_id", "event_id") REFERENCES "events"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awards" ADD CONSTRAINT "awards_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awards" ADD CONSTRAINT "awards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_award_id_fkey" FOREIGN KEY ("award_id") REFERENCES "awards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_link_awards" ADD CONSTRAINT "share_link_awards_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_link_awards" ADD CONSTRAINT "share_link_awards_award_id_fkey" FOREIGN KEY ("award_id") REFERENCES "awards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_flags" ADD CONSTRAINT "ai_flags_award_id_fkey" FOREIGN KEY ("award_id") REFERENCES "awards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_flags" ADD CONSTRAINT "ai_flags_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_award_id_fkey" FOREIGN KEY ("award_id") REFERENCES "awards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================
-- Hand-written rules. Prisma cannot declare these, so they are added here.
-- See docs/database-schema.md, "CHECK constraints added by hand".
-- =====================================================================

-- CHECK constraints: data rules the database enforces on every write
ALTER TABLE "organizations"   ADD CONSTRAINT "organizations_bin_format"       CHECK (bin ~ '^[0-9]{12}$');
ALTER TABLE "users"           ADD CONSTRAINT "users_org_matches_role"         CHECK ((role = 'organization') = (organization_id IS NOT NULL));
ALTER TABLE "users"           ADD CONSTRAINT "users_login_required_for_staff" CHECK (role = 'student' OR login IS NOT NULL);
ALTER TABLE "awards"          ADD CONSTRAINT "awards_place_positive"          CHECK (place IS NULL OR place > 0);
ALTER TABLE "change_requests" ADD CONSTRAINT "cr_reason_not_blank"            CHECK (length(btrim(reason)) > 0);
ALTER TABLE "change_requests" ADD CONSTRAINT "cr_reject_needs_comment"        CHECK (status <> 'rejected' OR review_comment IS NOT NULL);
ALTER TABLE "share_links"     ADD CONSTRAINT "share_links_expiry_after"       CHECK (expires_at > created_at);
ALTER TABLE "otp_codes"       ADD CONSTRAINT "otp_attempts_range"             CHECK (attempts BETWEEN 0 AND 5);
ALTER TABLE "ai_flags"        ADD CONSTRAINT "ai_flags_score_range"           CHECK (score BETWEEN 0 AND 1);
ALTER TABLE "ai_jobs"         ADD CONSTRAINT "ai_jobs_attempts_nonnegative"   CHECK (attempts >= 0);

-- Students sign in with their phone, so one phone can belong to only one claimed account.
-- Unclaimed records (entered by organizations) may share a phone, e.g. siblings with a parent's number.
CREATE UNIQUE INDEX "students_phone_hash_claimed_key" ON "students" ("phone_hash") WHERE "user_id" IS NOT NULL;

-- Triggers: awards are never deleted (FR-19), the audit log is append-only (FR-18).
-- They stop a wrong DELETE/UPDATE even if application code has a bug.
CREATE FUNCTION "forbid_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on table % is not allowed', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "awards_no_delete"
  BEFORE DELETE ON "awards"
  FOR EACH ROW EXECUTE FUNCTION "forbid_change"();

CREATE TRIGGER "awards_no_truncate"
  BEFORE TRUNCATE ON "awards"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_change"();

CREATE TRIGGER "audit_log_append_only"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION "forbid_change"();

CREATE TRIGGER "audit_log_no_truncate"
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_change"();
