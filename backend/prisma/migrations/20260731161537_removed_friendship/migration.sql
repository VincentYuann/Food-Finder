/*
  Warnings:

  - The `user_id` column on the `messages` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `friendships` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `content` on table `messages` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "friendships" DROP CONSTRAINT "friendships_receiver_id_fkey";

-- DropForeignKey
ALTER TABLE "friendships" DROP CONSTRAINT "friendships_sender_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_user_id_fkey";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "user_id",
ADD COLUMN     "user_id" INTEGER,
ALTER COLUMN "content" SET NOT NULL;

-- DropTable
DROP TABLE "friendships";

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
