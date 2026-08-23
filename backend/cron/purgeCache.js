import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function purgeStaleCache() {
    console.log('Starting 30-day cache purge...');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
        const result = await prisma.restaurant.updateMany({
            where: {
                cached_at: {
                    lt: thirtyDaysAgo
                }
            },
            data: {
                name: null,
                address: null,
                latitude: null,
                longitude: null,
                rating: null,
                price_level: null,
                photo_url: null,
                primary_type: null,
                user_rating_count: null,
                phone_number: null,
                website_url: null,
                google_maps_url: null,
                opening_hours: null
            }
        });

        console.log("Successfully purged stale restaurant records.");
    } catch (error) {
        console.error('? Failed to purge cache:', error);
    } finally {
        await prisma.$disconnect();
    }
}

purgeStaleCache();

