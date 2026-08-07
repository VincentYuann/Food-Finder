-- Repairs the half-applied 20260731161537_removed_friendship migration.
-- That migration recreated messages.user_id as INTEGER[] and then failed when it
-- tried to add a foreign key from an array column to users(id), leaving the
-- table without its FK and with content incorrectly NOT NULL.

-- Restore user_id as a scalar FK column. Safe to drop: messages is empty.
ALTER TABLE "messages" DROP COLUMN "user_id",
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- An image-only message has no text body.
ALTER TABLE "messages" ALTER COLUMN "content" DROP NOT NULL;

-- AddForeignKey (the step that originally failed)
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
