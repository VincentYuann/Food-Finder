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

// Whether the bucket is actually reachable with the configured credentials,
// plus when we last checked. Probing on every image request would double the
// latency of every photo on the page, so the verdict is held briefly and
// shared across them.
let healthProbe = null;
const HEALTH_TTL_MS = 60_000;

/**
 * True when S3 can serve bytes with the credentials we have.
 *
 * A presigned URL is signed locally and always *looks* valid, so the only way
 * to know the bucket will honour it is to ask. This range-GETs a single byte
 * of a real object and reads the status:
 *
 *   403/401 -> the credentials are rejected, so S3 is unusable
 *   404     -> that one object is missing, but auth worked fine
 *
 * Treating 404 as healthy matters: a single purged photo must not divert every
 * other image on the site to the fallback path.
 */
export async function isS3Usable(sampleKey) {
    const now = Date.now();
    if (healthProbe && now - healthProbe.at < HEALTH_TTL_MS) return healthProbe.ok;

    let ok = false;
    try {
        const url = await getPresignedUrl(sampleKey);
        if (url) {
            const response = await fetch(url, { headers: { Range: 'bytes=0-0' } });
            ok = response.status !== 403 && response.status !== 401;
        }
    } catch (error) {
        console.error('S3 health probe failed:', error.message);
    }

    if (!ok && (!healthProbe || healthProbe.ok)) {
        console.warn(
            'S3 photo cache is not serving (credentials rejected). ' +
            'Falling back to Google Places for photos — check S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY.'
        );
    }

    healthProbe = { at: now, ok };
    return ok;
}
