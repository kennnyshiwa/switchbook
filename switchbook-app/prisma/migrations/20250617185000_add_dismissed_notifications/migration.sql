-- CreateTable
CREATE TABLE "DismissedNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMasterUpdateVersion" INTEGER,

    CONSTRAINT "DismissedNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DismissedNotification_userId_type_key" ON "DismissedNotification"("userId", "type");

-- AddForeignKey
ALTER TABLE "DismissedNotification" ADD CONSTRAINT "DismissedNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;