import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME || 'niva-bupa-event';

/**
 * Upload a file to S3
 */
export async function uploadToS3(filePath, s3Key, contentType) {
  const fileBuffer = fs.readFileSync(filePath);
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: contentType,
  });
  await s3Client.send(command);
  return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
}

/**
 * Upload from buffer to S3
 */
export async function uploadBufferToS3(buffer, s3Key, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
  });
  await s3Client.send(command);
  return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
}

/**
 * Generate a pre-signed URL for downloading
 */
export async function getPresignedUrl(s3Key, expiresInSeconds = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(s3Key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  });
  await s3Client.send(command);
}

/**
 * Check if S3 is configured
 */
export function isS3Configured() {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME);
}

/**
 * List all photos in the S3 bucket
 */
export async function listS3Photos(prefix = 'photos/') {
  const photos = [];
  let continuationToken;

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const response = await s3Client.send(command);
    
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key === prefix) continue; // skip the folder itself
        photos.push({
          key: obj.Key,
          url: `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${obj.Key}`,
          filename: obj.Key.replace(prefix, ''),
          size: obj.Size,
        });
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return photos;
}

export { s3Client, BUCKET };
