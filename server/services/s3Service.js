import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

// Lazy-initialized client (credentials aren't available at import time due to ESM hoisting)
let _s3Client = null;

function getClient() {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return _s3Client;
}

function getBucket() {
  return process.env.S3_BUCKET_NAME || 'niva-bupa-event';
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(filePath, s3Key, contentType) {
  const bucket = getBucket();
  const fileBuffer = fs.readFileSync(filePath);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: contentType,
  });
  await getClient().send(command);
  return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
}

/**
 * Upload from buffer to S3
 */
export async function uploadBufferToS3(buffer, s3Key, contentType) {
  const bucket = getBucket();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
  });
  await getClient().send(command);
  return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
}

/**
 * Generate a pre-signed URL for downloading
 */
export async function getPresignedUrl(s3Key, expiresInSeconds = 3600) {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: s3Key,
  });
  return await getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(s3Key) {
  const command = new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: s3Key,
  });
  await getClient().send(command);
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
  const bucket = getBucket();
  const photos = [];
  let continuationToken;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const response = await getClient().send(command);
    
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key === prefix) continue; // skip the folder itself
        photos.push({
          key: obj.Key,
          url: `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${obj.Key}`,
          filename: obj.Key.replace(prefix, ''),
          size: obj.Size,
        });
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return photos;
}

// Export getters for use in index.js rebuild functions
export { getClient as getS3Client, getBucket };
