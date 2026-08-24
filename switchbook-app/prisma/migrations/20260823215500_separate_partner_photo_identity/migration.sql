ALTER TABLE "SwitchImage" ADD COLUMN "remoteUrl" TEXT;

ALTER TABLE "PartnerSubmissionPhoto" ADD COLUMN "remoteUrl" TEXT;
UPDATE "PartnerSubmissionPhoto" SET "remoteUrl" = "sourceUrl";
ALTER TABLE "PartnerSubmissionPhoto" ALTER COLUMN "remoteUrl" SET NOT NULL;

DROP INDEX "PartnerSubmissionPhoto_submissionId_sourceUrl_key";
DROP INDEX "PartnerSubmissionPhoto_switchImageId_key";
CREATE UNIQUE INDEX "PartnerSubmissionPhoto_submissionId_remoteUrl_key"
  ON "PartnerSubmissionPhoto"("submissionId", "remoteUrl");

CREATE INDEX "SwitchImage_masterSwitchId_remoteUrl_idx"
  ON "SwitchImage"("masterSwitchId", "remoteUrl");
CREATE INDEX "SwitchImage_masterSwitchId_checksumSha256_idx"
  ON "SwitchImage"("masterSwitchId", "checksumSha256");
