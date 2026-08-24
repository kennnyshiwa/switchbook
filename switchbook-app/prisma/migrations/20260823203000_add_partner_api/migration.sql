CREATE TYPE "CatalogRecordStatus" AS ENUM ('ACTIVE', 'MERGED', 'REMOVED');
CREATE TYPE "PartnerSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED');
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

ALTER TABLE "SwitchImage" ADD COLUMN "altText" TEXT,
ADD COLUMN "sourceUrl" TEXT, ADD COLUMN "sourceName" TEXT, ADD COLUMN "license" TEXT,
ADD COLUMN "attribution" TEXT, ADD COLUMN "checksumSha256" TEXT,
ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "PartnerApplication" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "clientId" TEXT NOT NULL, "secretHash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL, "redirectUris" TEXT[] NOT NULL, "webhookUrl" TEXT, "webhookSecretHash" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true, "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 120,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerApplication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerApplication_clientId_key" ON "PartnerApplication"("clientId");

CREATE TABLE "PartnerCredential" (
  "id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "prefix" TEXT NOT NULL, "secretHash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL, "expiresAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PartnerCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerCredential_prefix_key" ON "PartnerCredential"("prefix");
CREATE INDEX "PartnerCredential_applicationId_revokedAt_idx" ON "PartnerCredential"("applicationId", "revokedAt");

CREATE TABLE "MasterSwitchLifecycle" (
  "masterSwitchId" TEXT NOT NULL, "status" "CatalogRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "mergedIntoId" TEXT, "removedAt" TIMESTAMP(3), "removalReason" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MasterSwitchLifecycle_pkey" PRIMARY KEY ("masterSwitchId")
);
CREATE INDEX "MasterSwitchLifecycle_status_idx" ON "MasterSwitchLifecycle"("status");
CREATE INDEX "MasterSwitchLifecycle_mergedIntoId_idx" ON "MasterSwitchLifecycle"("mergedIntoId");

CREATE TABLE "PartnerSubmission" (
  "id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "userId" TEXT NOT NULL, "masterSwitchId" TEXT,
  "status" "PartnerSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED', "payload" JSONB NOT NULL,
  "moderatorFeedback" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerSubmission_applicationId_userId_updatedAt_idx" ON "PartnerSubmission"("applicationId", "userId", "updatedAt");
CREATE INDEX "PartnerSubmission_masterSwitchId_idx" ON "PartnerSubmission"("masterSwitchId");

CREATE TABLE "PartnerCorrection" (
  "id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "userId" TEXT NOT NULL, "masterSwitchId" TEXT NOT NULL,
  "status" "PartnerSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED', "changes" JSONB NOT NULL, "reason" TEXT NOT NULL,
  "moderatorFeedback" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerCorrection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerCorrection_applicationId_userId_updatedAt_idx" ON "PartnerCorrection"("applicationId", "userId", "updatedAt");
CREATE INDEX "PartnerCorrection_masterSwitchId_idx" ON "PartnerCorrection"("masterSwitchId");

CREATE TABLE "PartnerIdempotencyKey" (
  "id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "key" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "responseStatus" INTEGER NOT NULL, "responseBody" JSONB NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PartnerIdempotencyKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerIdempotencyKey_applicationId_key_key" ON "PartnerIdempotencyKey"("applicationId", "key");
CREATE INDEX "PartnerIdempotencyKey_expiresAt_idx" ON "PartnerIdempotencyKey"("expiresAt");

CREATE TABLE "PartnerAuditEvent" (
  "id" TEXT NOT NULL, "applicationId" TEXT, "actorUserId" TEXT, "requestId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "resourceType" TEXT, "resourceId" TEXT, "statusCode" INTEGER NOT NULL, "ipHash" TEXT, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PartnerAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerAuditEvent_applicationId_createdAt_idx" ON "PartnerAuditEvent"("applicationId", "createdAt");
CREATE INDEX "PartnerAuditEvent_requestId_idx" ON "PartnerAuditEvent"("requestId");

CREATE TABLE "PartnerWebhookEvent" (
  "id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "type" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deliveredAt" TIMESTAMP(3), "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerWebhookEvent_status_nextAttemptAt_idx" ON "PartnerWebhookEvent"("status", "nextAttemptAt");

ALTER TABLE "PartnerCredential" ADD CONSTRAINT "PartnerCredential_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PartnerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MasterSwitchLifecycle" ADD CONSTRAINT "MasterSwitchLifecycle_masterSwitchId_fkey" FOREIGN KEY ("masterSwitchId") REFERENCES "MasterSwitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerSubmission" ADD CONSTRAINT "PartnerSubmission_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PartnerApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerSubmission" ADD CONSTRAINT "PartnerSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerSubmission" ADD CONSTRAINT "PartnerSubmission_masterSwitchId_fkey" FOREIGN KEY ("masterSwitchId") REFERENCES "MasterSwitch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerCorrection" ADD CONSTRAINT "PartnerCorrection_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PartnerApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerCorrection" ADD CONSTRAINT "PartnerCorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerCorrection" ADD CONSTRAINT "PartnerCorrection_masterSwitchId_fkey" FOREIGN KEY ("masterSwitchId") REFERENCES "MasterSwitch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerIdempotencyKey" ADD CONSTRAINT "PartnerIdempotencyKey_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PartnerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerAuditEvent" ADD CONSTRAINT "PartnerAuditEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PartnerApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartnerWebhookEvent" ADD CONSTRAINT "PartnerWebhookEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PartnerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
