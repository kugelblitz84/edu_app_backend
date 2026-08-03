CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "platform_role" AS ENUM (
  'GUEST',
  'GLOBAL_ADMIN'
);

CREATE TYPE "user_status" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'BANNED',
  'DELETED'
);

CREATE TYPE "institution_status" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED'
);

CREATE TYPE "membership_status" AS ENUM (
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'REJECTED',
  'LEFT',
  'REMOVED'
);

CREATE TYPE "institution_role" AS ENUM (
  'STUDENT',
  'TEACHER',
  'INSTITUTION_ADMIN'
);

CREATE TYPE "invitation_status" AS ENUM (
  'ACTIVE',
  'ACCEPTED',
  'REVOKED',
  'EXPIRED'
);

CREATE TYPE "application_status" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN'
);

CREATE TYPE "content_type" AS ENUM (
  'STUDY_MATERIAL',
  'EXAM'
);

CREATE TYPE "content_scope" AS ENUM (
  'PUBLIC',
  'INSTITUTIONAL'
);

CREATE TYPE "content_visibility" AS ENUM (
  'PUBLIC',
  'INSTITUTION_WIDE',
  'RESTRICTED',
  'UNLISTED'
);

CREATE TYPE "content_status" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'HIDDEN',
  'ARCHIVED'
);

CREATE TYPE "material_type" AS ENUM (
  'ARTICLE',
  'DOCUMENT',
  'VIDEO',
  'AUDIO',
  'IMAGE',
  'EXTERNAL_LINK',
  'PRESENTATION',
  'OTHER'
);

CREATE TYPE "exam_type" AS ENUM (
  'PRACTICE',
  'MOCK',
  'ASSESSMENT',
  'QUIZ'
);

CREATE TYPE "exam_attempt_status" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'SUBMITTED',
  'AUTO_SUBMITTED',
  'EVALUATED',
  'CANCELLED'
);

CREATE TYPE "question_type" AS ENUM (
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'LONG_ANSWER',
  'NUMERIC',
  'FILE_UPLOAD'
);

CREATE TYPE "question_status" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'ARCHIVED'
);

CREATE TYPE "ban_status" AS ENUM (
  'ACTIVE',
  'EXPIRED',
  'REVOKED'
);

CREATE TYPE "moderation_action" AS ENUM (
  'PUBLISH',
  'HIDE',
  'ARCHIVE',
  'RESTORE',
  'CHANGE_VISIBILITY'
);

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "email" varchar(320) UNIQUE NOT NULL,
  "username" varchar(30) UNIQUE NOT NULL,
  "password_hash" text NOT NULL,
  "full_name" varchar(160) NOT NULL,
  "avatar_url" text,
  "platform_role" platform_role NOT NULL DEFAULT 'GUEST',
  "status" user_status NOT NULL DEFAULT 'ACTIVE',
  "email_verified_at" timestamptz,
  "last_login_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "deleted_at" timestamptz
);

CREATE TABLE "institutions" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "name" varchar(200) NOT NULL,
  "slug" varchar(120) UNIQUE NOT NULL,
  "institution_code" varchar(80) UNIQUE,
  "logo_url" text,
  "description" text,
  "status" institution_status NOT NULL DEFAULT 'ACTIVE',
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "archived_at" timestamptz
);

CREATE TABLE "institution_settings" (
  "institution_id" uuid PRIMARY KEY,
  "allow_student_applications" boolean NOT NULL DEFAULT true,
  "allow_teacher_applications" boolean NOT NULL DEFAULT true,
  "require_student_approval" boolean NOT NULL DEFAULT true,
  "require_teacher_approval" boolean NOT NULL DEFAULT true,
  "settings" jsonb NOT NULL DEFAULT ('{}'::jsonb),
  "updated_by_user_id" uuid,
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "institution_memberships" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "institution_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "status" membership_status NOT NULL DEFAULT 'PENDING',
  "joined_at" timestamptz,
  "approved_at" timestamptz,
  "approved_by_user_id" uuid,
  "approved_by_membership_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "removed_at" timestamptz
);

CREATE TABLE "institution_membership_roles" (
  "membership_id" uuid NOT NULL,
  "role_name" institution_role NOT NULL,
  "assigned_by_user_id" uuid NOT NULL,
  "assigned_by_membership_id" uuid,
  "assigned_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("membership_id", "role_name")
);

CREATE TABLE "students" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "membership_id" uuid UNIQUE NOT NULL,
  "student_id_number" varchar(100),
  "roll_number" varchar(100),
  "class_name" varchar(100),
  "section_name" varchar(100),
  "batch_name" varchar(100),
  "is_class_representative" boolean NOT NULL DEFAULT false,
  "admission_date" date,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "teachers" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "membership_id" uuid UNIQUE NOT NULL,
  "employee_id" varchar(100),
  "designation" varchar(120),
  "department_name" varchar(160),
  "joining_date" date,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "institution_invitations" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "institution_id" uuid NOT NULL,
  "intended_role" institution_role NOT NULL,
  "target_email" varchar(320),
  "token_hash" varchar(255) UNIQUE NOT NULL,
  "max_uses" int NOT NULL DEFAULT 1,
  "used_count" int NOT NULL DEFAULT 0,
  "status" invitation_status NOT NULL DEFAULT 'ACTIVE',
  "invited_by_user_id" uuid NOT NULL,
  "invited_by_membership_id" uuid,
  "expires_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "revoked_at" timestamptz
);

CREATE TABLE "institution_invitation_uses" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "invitation_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "membership_id" uuid NOT NULL,
  "used_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "institution_applications" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "institution_id" uuid NOT NULL,
  "applicant_user_id" uuid NOT NULL,
  "requested_role" institution_role NOT NULL,
  "message" text,
  "application_data" jsonb NOT NULL DEFAULT ('{}'::jsonb),
  "status" application_status NOT NULL DEFAULT 'PENDING',
  "reviewed_by_user_id" uuid,
  "reviewed_by_membership_id" uuid,
  "reviewed_at" timestamptz,
  "review_note" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "subjects" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "institution_id" uuid,
  "scope" content_scope NOT NULL,
  "name" varchar(160) NOT NULL,
  "code" varchar(80),
  "description" text,
  "created_by_user_id" uuid NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "contents" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "content_type" content_type NOT NULL,
  "scope" content_scope NOT NULL,
  "institution_id" uuid,
  "subject_id" uuid,
  "title" varchar(250) NOT NULL,
  "description" text,
  "thumbnail_url" text,
  "visibility" content_visibility NOT NULL,
  "status" content_status NOT NULL DEFAULT 'DRAFT',
  "registration_required" boolean NOT NULL DEFAULT false,
  "created_by_user_id" uuid NOT NULL,
  "created_by_membership_id" uuid,
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "archived_at" timestamptz
);

CREATE TABLE "content_role_access" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "content_id" uuid NOT NULL,
  "role_name" institution_role NOT NULL,
  "granted_by_user_id" uuid NOT NULL,
  "granted_by_membership_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "revoked_at" timestamptz
);

CREATE TABLE "content_membership_access" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "content_id" uuid NOT NULL,
  "membership_id" uuid NOT NULL,
  "granted_by_user_id" uuid NOT NULL,
  "granted_by_membership_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "revoked_at" timestamptz
);

CREATE TABLE "content_invitations" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "content_id" uuid NOT NULL,
  "invited_membership_id" uuid,
  "invited_email" varchar(320),
  "token_hash" varchar(255) UNIQUE NOT NULL,
  "invited_by_user_id" uuid NOT NULL,
  "invited_by_membership_id" uuid,
  "status" invitation_status NOT NULL DEFAULT 'ACTIVE',
  "expires_at" timestamptz,
  "accepted_by_membership_id" uuid,
  "accepted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "revoked_at" timestamptz
);

CREATE TABLE "study_materials" (
  "content_id" uuid PRIMARY KEY,
  "material_type" material_type NOT NULL,
  "body_markdown" text,
  "external_url" text,
  "allow_download" boolean NOT NULL DEFAULT true,
  "estimated_reading_minutes" int,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "study_material_assets" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "content_id" uuid NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "storage_key" text,
  "external_url" text,
  "mime_type" varchar(150),
  "file_size_bytes" bigint,
  "display_order" int NOT NULL DEFAULT 0,
  "uploaded_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "exams" (
  "content_id" uuid PRIMARY KEY,
  "exam_type" exam_type NOT NULL,
  "duration_minutes" int,
  "max_attempts" int NOT NULL DEFAULT 1,
  "pass_mark_percentage" decimal(5,2),
  "shuffle_questions" boolean NOT NULL DEFAULT false,
  "shuffle_options" boolean NOT NULL DEFAULT false,
  "show_result_after_submit" boolean NOT NULL DEFAULT true,
  "show_correct_answers" boolean NOT NULL DEFAULT false,
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "instructions" text,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "questions" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "scope" content_scope NOT NULL,
  "institution_id" uuid,
  "subject_id" uuid,
  "question_type" question_type NOT NULL,
  "status" question_status NOT NULL DEFAULT 'DRAFT',
  "question_text" text NOT NULL,
  "explanation" text,
  "answer_key" jsonb,
  "default_marks" decimal(8,2) NOT NULL DEFAULT 1,
  "default_negative_marks" decimal(8,2) NOT NULL DEFAULT 0,
  "created_by_user_id" uuid NOT NULL,
  "created_by_membership_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "archived_at" timestamptz
);

CREATE TABLE "question_options" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "question_id" uuid NOT NULL,
  "option_text" text NOT NULL,
  "is_correct" boolean NOT NULL DEFAULT false,
  "display_order" int NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "exam_questions" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "exam_id" uuid NOT NULL,
  "question_id" uuid NOT NULL,
  "marks" decimal(8,2) NOT NULL DEFAULT 1,
  "negative_marks" decimal(8,2) NOT NULL DEFAULT 0,
  "display_order" int NOT NULL,
  "is_required" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "exam_attempts" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "exam_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "institution_membership_id" uuid,
  "attempt_number" int NOT NULL,
  "status" exam_attempt_status NOT NULL DEFAULT 'NOT_STARTED',
  "started_at" timestamptz,
  "submitted_at" timestamptz,
  "evaluated_at" timestamptz,
  "score" decimal(10,2),
  "maximum_score" decimal(10,2),
  "percentage" decimal(5,2),
  "passed" boolean,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "exam_attempt_answers" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "attempt_id" uuid NOT NULL,
  "exam_question_id" uuid NOT NULL,
  "answer_text" text,
  "answer_data" jsonb,
  "uploaded_file_url" text,
  "is_correct" boolean,
  "awarded_marks" decimal(8,2),
  "answered_at" timestamptz,
  "evaluated_at" timestamptz,
  "evaluated_by_user_id" uuid,
  "evaluated_by_membership_id" uuid
);

CREATE TABLE "exam_attempt_selected_options" (
  "attempt_answer_id" uuid NOT NULL,
  "option_id" uuid NOT NULL,
  PRIMARY KEY ("attempt_answer_id", "option_id")
);

CREATE TABLE "platform_user_bans" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "banned_by_user_id" uuid NOT NULL,
  "status" ban_status NOT NULL DEFAULT 'ACTIVE',
  "reason" text NOT NULL,
  "starts_at" timestamptz NOT NULL DEFAULT (now()),
  "ends_at" timestamptz,
  "revoked_by_user_id" uuid,
  "revoked_at" timestamptz,
  "revocation_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "institution_user_bans" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "institution_id" uuid NOT NULL,
  "membership_id" uuid NOT NULL,
  "banned_by_user_id" uuid NOT NULL,
  "banned_by_membership_id" uuid,
  "status" ban_status NOT NULL DEFAULT 'ACTIVE',
  "reason" text NOT NULL,
  "starts_at" timestamptz NOT NULL DEFAULT (now()),
  "ends_at" timestamptz,
  "revoked_by_user_id" uuid,
  "revoked_by_membership_id" uuid,
  "revoked_at" timestamptz,
  "revocation_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "content_moderation_history" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "content_id" uuid NOT NULL,
  "action" moderation_action NOT NULL,
  "previous_visibility" content_visibility,
  "new_visibility" content_visibility,
  "previous_status" content_status,
  "new_status" content_status,
  "performed_by_user_id" uuid NOT NULL,
  "performed_by_membership_id" uuid,
  "reason" text,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT (gen_random_uuid()),
  "actor_user_id" uuid,
  "actor_membership_id" uuid,
  "institution_id" uuid,
  "action" varchar(120) NOT NULL,
  "entity_type" varchar(120) NOT NULL,
  "entity_id" uuid,
  "ip_address" inet,
  "user_agent" text,
  "metadata" jsonb NOT NULL DEFAULT ('{}'::jsonb),
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE INDEX ON "users" ("platform_role");

CREATE INDEX ON "users" ("status");

CREATE INDEX ON "users" ("username");

CREATE INDEX ON "users" ("created_at");

CREATE INDEX ON "institutions" ("status");

CREATE INDEX ON "institutions" ("name");

CREATE UNIQUE INDEX ON "institution_memberships" ("institution_id", "user_id");

CREATE INDEX ON "institution_memberships" ("institution_id");

CREATE INDEX ON "institution_memberships" ("user_id");

CREATE INDEX ON "institution_memberships" ("status");

CREATE INDEX ON "institution_membership_roles" ("role_name");

CREATE INDEX ON "students" ("student_id_number");

CREATE INDEX ON "students" ("roll_number");

CREATE INDEX ON "students" ("class_name");

CREATE INDEX ON "students" ("section_name");

CREATE INDEX ON "students" ("batch_name");

CREATE INDEX ON "students" ("is_class_representative");

CREATE INDEX ON "teachers" ("employee_id");

CREATE INDEX ON "teachers" ("department_name");

CREATE INDEX ON "institution_invitations" ("institution_id");

CREATE INDEX ON "institution_invitations" ("target_email");

CREATE INDEX ON "institution_invitations" ("status");

CREATE INDEX ON "institution_invitations" ("expires_at");

CREATE UNIQUE INDEX ON "institution_invitation_uses" ("invitation_id", "user_id");

CREATE INDEX ON "institution_invitation_uses" ("membership_id");

CREATE INDEX ON "institution_applications" ("institution_id");

CREATE INDEX ON "institution_applications" ("applicant_user_id");

CREATE INDEX ON "institution_applications" ("requested_role");

CREATE INDEX ON "institution_applications" ("status");

CREATE UNIQUE INDEX ON "subjects" ("institution_id", "code");

CREATE INDEX ON "subjects" ("institution_id");

CREATE INDEX ON "subjects" ("scope");

CREATE INDEX ON "subjects" ("name");

CREATE INDEX ON "contents" ("content_type");

CREATE INDEX ON "contents" ("scope");

CREATE INDEX ON "contents" ("institution_id");

CREATE INDEX ON "contents" ("subject_id");

CREATE INDEX ON "contents" ("visibility");

CREATE INDEX ON "contents" ("status");

CREATE INDEX ON "contents" ("created_by_user_id");

CREATE INDEX ON "contents" ("published_at");

CREATE UNIQUE INDEX ON "content_role_access" ("content_id", "role_name");

CREATE INDEX ON "content_role_access" ("role_name");

CREATE UNIQUE INDEX ON "content_membership_access" ("content_id", "membership_id");

CREATE INDEX ON "content_membership_access" ("membership_id");

CREATE INDEX ON "content_invitations" ("content_id");

CREATE INDEX ON "content_invitations" ("invited_membership_id");

CREATE INDEX ON "content_invitations" ("invited_email");

CREATE INDEX ON "content_invitations" ("status");

CREATE INDEX ON "study_material_assets" ("content_id");

CREATE INDEX ON "study_material_assets" ("storage_key");

CREATE INDEX ON "questions" ("scope");

CREATE INDEX ON "questions" ("institution_id");

CREATE INDEX ON "questions" ("subject_id");

CREATE INDEX ON "questions" ("question_type");

CREATE INDEX ON "questions" ("status");

CREATE INDEX ON "question_options" ("question_id");

CREATE UNIQUE INDEX ON "question_options" ("question_id", "display_order");

CREATE UNIQUE INDEX ON "exam_questions" ("exam_id", "question_id");

CREATE UNIQUE INDEX ON "exam_questions" ("exam_id", "display_order");

CREATE INDEX ON "exam_questions" ("question_id");

CREATE UNIQUE INDEX ON "exam_attempts" ("exam_id", "user_id", "attempt_number");

CREATE INDEX ON "exam_attempts" ("exam_id");

CREATE INDEX ON "exam_attempts" ("user_id");

CREATE INDEX ON "exam_attempts" ("institution_membership_id");

CREATE INDEX ON "exam_attempts" ("status");

CREATE INDEX ON "exam_attempts" ("submitted_at");

CREATE UNIQUE INDEX ON "exam_attempt_answers" ("attempt_id", "exam_question_id");

CREATE INDEX ON "exam_attempt_answers" ("exam_question_id");

CREATE INDEX ON "exam_attempt_selected_options" ("option_id");

CREATE INDEX ON "platform_user_bans" ("user_id");

CREATE INDEX ON "platform_user_bans" ("status");

CREATE INDEX ON "platform_user_bans" ("ends_at");

CREATE INDEX ON "institution_user_bans" ("institution_id");

CREATE INDEX ON "institution_user_bans" ("membership_id");

CREATE INDEX ON "institution_user_bans" ("status");

CREATE INDEX ON "institution_user_bans" ("ends_at");

CREATE INDEX ON "content_moderation_history" ("content_id");

CREATE INDEX ON "content_moderation_history" ("performed_by_user_id");

CREATE INDEX ON "content_moderation_history" ("performed_by_membership_id");

CREATE INDEX ON "content_moderation_history" ("created_at");

CREATE INDEX ON "audit_logs" ("actor_user_id");

CREATE INDEX ON "audit_logs" ("actor_membership_id");

CREATE INDEX ON "audit_logs" ("institution_id");

CREATE INDEX ON "audit_logs" ("entity_type");

CREATE INDEX ON "audit_logs" ("entity_id");

CREATE INDEX ON "audit_logs" ("created_at");

ALTER TABLE "institutions" ADD FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_settings" ADD FOREIGN KEY ("institution_id") REFERENCES "institutions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_settings" ADD FOREIGN KEY ("updated_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_memberships" ADD FOREIGN KEY ("institution_id") REFERENCES "institutions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_memberships" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_memberships" ADD FOREIGN KEY ("approved_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_memberships" ADD FOREIGN KEY ("approved_by_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_membership_roles" ADD FOREIGN KEY ("membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_membership_roles" ADD FOREIGN KEY ("assigned_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_membership_roles" ADD FOREIGN KEY ("assigned_by_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "students" ADD FOREIGN KEY ("membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "teachers" ADD FOREIGN KEY ("membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_invitations" ADD FOREIGN KEY ("institution_id") REFERENCES "institutions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_invitations" ADD FOREIGN KEY ("invited_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_invitations" ADD FOREIGN KEY ("invited_by_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_invitation_uses" ADD FOREIGN KEY ("invitation_id") REFERENCES "institution_invitations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_invitation_uses" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_invitation_uses" ADD FOREIGN KEY ("membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_applications" ADD FOREIGN KEY ("institution_id") REFERENCES "institutions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_applications" ADD FOREIGN KEY ("applicant_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_applications" ADD FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_applications" ADD FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "subjects" ADD FOREIGN KEY ("institution_id") REFERENCES "institutions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "subjects" ADD FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "contents" ADD FOREIGN KEY ("institution_id") REFERENCES "institutions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "contents" ADD FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "contents" ADD FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "contents" ADD FOREIGN KEY ("created_by_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_role_access" ADD FOREIGN KEY ("content_id") REFERENCES "contents" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_role_access" ADD FOREIGN KEY ("granted_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_role_access" ADD FOREIGN KEY ("granted_by_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_membership_access" ADD FOREIGN KEY ("content_id") REFERENCES "contents" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_membership_access" ADD FOREIGN KEY ("membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_membership_access" ADD FOREIGN KEY ("granted_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_membership_access" ADD FOREIGN KEY ("granted_by_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_invitations" ADD FOREIGN KEY ("content_id") REFERENCES "contents" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_invitations" ADD FOREIGN KEY ("invited_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_invitations" ADD FOREIGN KEY ("invited_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_invitations" ADD FOREIGN KEY ("invited_by_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_invitations" ADD FOREIGN KEY ("accepted_by_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "study_materials" ADD FOREIGN KEY ("content_id") REFERENCES "contents" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "study_material_assets" ADD FOREIGN KEY ("content_id") REFERENCES "study_materials" ("content_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "study_material_assets" ADD FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "exams" ADD FOREIGN KEY ("content_id") REFERENCES "contents" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "questions" ADD FOREIGN KEY ("institution_id") REFERENCES "institutions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "questions" ADD FOREIGN KEY ("subject_id") REFERENCES "subjects" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "questions" ADD FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "questions" ADD FOREIGN KEY ("created_by_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "question_options" ADD FOREIGN KEY ("question_id") REFERENCES "questions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "exam_questions" ADD FOREIGN KEY ("exam_id") REFERENCES "exams" ("content_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "exam_questions" ADD FOREIGN KEY ("question_id") REFERENCES "questions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "exam_attempts" ADD FOREIGN KEY ("exam_id") REFERENCES "exams" ("content_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "exam_attempts" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "exam_attempts" ADD FOREIGN KEY ("institution_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "exam_attempt_answers" ADD FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "exam_attempt_answers" ADD FOREIGN KEY ("exam_question_id") REFERENCES "exam_questions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "exam_attempt_answers" ADD FOREIGN KEY ("evaluated_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "exam_attempt_answers" ADD FOREIGN KEY ("evaluated_by_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "exam_attempt_selected_options" ADD FOREIGN KEY ("attempt_answer_id") REFERENCES "exam_attempt_answers" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "exam_attempt_selected_options" ADD FOREIGN KEY ("option_id") REFERENCES "question_options" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "platform_user_bans" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "platform_user_bans" ADD FOREIGN KEY ("banned_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "platform_user_bans" ADD FOREIGN KEY ("revoked_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_user_bans" ADD FOREIGN KEY ("institution_id") REFERENCES "institutions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_user_bans" ADD FOREIGN KEY ("membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_user_bans" ADD FOREIGN KEY ("banned_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_user_bans" ADD FOREIGN KEY ("banned_by_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_user_bans" ADD FOREIGN KEY ("revoked_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "institution_user_bans" ADD FOREIGN KEY ("revoked_by_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_moderation_history" ADD FOREIGN KEY ("content_id") REFERENCES "contents" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_moderation_history" ADD FOREIGN KEY ("performed_by_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "content_moderation_history" ADD FOREIGN KEY ("performed_by_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit_logs" ADD FOREIGN KEY ("actor_user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit_logs" ADD FOREIGN KEY ("actor_membership_id") REFERENCES "institution_memberships" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit_logs" ADD FOREIGN KEY ("institution_id") REFERENCES "institutions" ("id") DEFERRABLE INITIALLY IMMEDIATE;
