import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

// Prisma Accelerate natively handles connection pooling and edge caching.
// Ensure your DATABASE_URL in .env is set to the generated prisma://... string.
const prisma = new PrismaClient({
    accelerateUrl: process.env.DATABASE_URL
}).$extends(withAccelerate());

export default prisma;
