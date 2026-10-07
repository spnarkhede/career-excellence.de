-- CreateTable
CREATE TABLE "oauth_pending_identities" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "displayName" TEXT,
    "pendingEmail" TEXT,
    "lookupTokenHash" TEXT NOT NULL,
    "verifyCodeHash" TEXT,
    "verifyAttempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_pending_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_pending_identities_lookupTokenHash_key" ON "oauth_pending_identities"("lookupTokenHash");

-- CreateIndex
CREATE INDEX "oauth_pending_identities_provider_providerAccountId_idx" ON "oauth_pending_identities"("provider", "providerAccountId");

