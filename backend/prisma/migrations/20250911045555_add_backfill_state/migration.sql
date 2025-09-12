-- CreateTable
CREATE TABLE "public"."BackfillState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "cursor" TEXT,
    "lastBackfillAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "status" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackfillState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackfillState_tenantId_resource_idx" ON "public"."BackfillState"("tenantId", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "BackfillState_tenantId_resource_key" ON "public"."BackfillState"("tenantId", "resource");

-- AddForeignKey
ALTER TABLE "public"."BackfillState" ADD CONSTRAINT "BackfillState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
