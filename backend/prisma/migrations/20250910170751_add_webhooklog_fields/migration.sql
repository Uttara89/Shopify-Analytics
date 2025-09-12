-- AlterTable
ALTER TABLE "public"."Tenant" ALTER COLUMN "apiSecret" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."WebhookLog" ADD COLUMN     "deliveryId" TEXT,
ADD COLUMN     "payloadHash" TEXT;
