import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import axios from "axios";
import { randomUUID } from "crypto";

export const s3Client = new S3Client({
    region: "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
});

/**
 * Downloads a photo from a URL and uploads it to S3.
 * Returns the S3 Key (filename).
 * @param {string} googlePhotoUrl - The Google Places photo URL
 * @returns {Promise<string|null>}
 */
export async function cachePhotoToS3(googlePhotoUrl) {
    if (!googlePhotoUrl) return null;

    try {
        const bucketName = process.env.S3_BUCKET;
        if (!bucketName) {
            console.warn("S3_BUCKET is not configured. Skipping photo cache.");
            return googlePhotoUrl;
        }

        const response = await axios.get(googlePhotoUrl, { responseType: 'arraybuffer' });
        const contentType = response.headers['content-type'] || 'image/jpeg';
        
        // We prefix with s3: so we know it's an S3 key when it hits our proxy
        const filename = `restaurants/${randomUUID()}.jpg`;

        await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: filename,
            Body: response.data,
            ContentType: contentType,
        }));

        // Return a special internal string to identify it as an S3 object
        return `s3:${filename}`;
        
    } catch (error) {
        console.error("Error caching photo to S3:", error.message);
        return googlePhotoUrl; 
    }
}

export async function getPresignedUrl(s3Key) {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: s3Key
        });
        // Generate a URL valid for 2 hours
        return await getSignedUrl(s3Client, command, { expiresIn: 7200 });
    } catch (error) {
        console.error("Error generating presigned URL:", error);
        return null;
    }
}
