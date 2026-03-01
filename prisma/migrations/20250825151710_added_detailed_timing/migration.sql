/*
  Warnings:

  - You are about to drop the column `response_time_ms` on the `website_tick` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."website_tick" DROP COLUMN "response_time_ms",
ADD COLUMN     "connection_time_ms" INTEGER,
ADD COLUMN     "data_transfer_time_ms" INTEGER,
ADD COLUMN     "tls_handshake_time_ms" INTEGER,
ADD COLUMN     "total_response_time_ms" INTEGER;
