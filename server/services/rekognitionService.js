import {
  RekognitionClient,
  CreateCollectionCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  ListCollectionsCommand,
} from '@aws-sdk/client-rekognition';
import fs from 'fs';

// Lazy-initialized client (credentials aren't available at import time)
let _client = null;

function getClient() {
  if (!_client) {
    _client = new RekognitionClient({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

function getCollectionId() {
  return process.env.REKOGNITION_COLLECTION_ID || 'niva-bupa-faces';
}

/**
 * Create a Rekognition face collection (run once)
 */
export async function createCollection() {
  try {
    const command = new CreateCollectionCommand({ CollectionId: getCollectionId() });
    const response = await getClient().send(command);
    console.log('✅ Rekognition collection created:', response.CollectionArn);
    return response;
  } catch (err) {
    if (err.name === 'ResourceAlreadyExistsException') {
      console.log('ℹ️  Rekognition collection already exists');
      return { CollectionArn: `existing:${getCollectionId()}` };
    }
    throw err;
  }
}

/**
 * Check if our collection exists
 */
export async function collectionExists() {
  try {
    const command = new ListCollectionsCommand({});
    const response = await getClient().send(command);
    return response.CollectionIds?.includes(getCollectionId()) || false;
  } catch (err) {
    console.error('Error checking collection:', err.message);
    return false;
  }
}

/**
 * Index a face from an image file into the collection
 */
export async function indexFace(imagePath, externalImageId) {
  const imageBytes = fs.readFileSync(imagePath);

  const command = new IndexFacesCommand({
    CollectionId: getCollectionId(),
    Image: { Bytes: imageBytes },
    ExternalImageId: externalImageId,
    DetectionAttributes: ['DEFAULT'],
    QualityFilter: 'AUTO',
  });

  const response = await getClient().send(command);
  const faceIds = response.FaceRecords?.map((r) => r.Face.FaceId) || [];
  console.log(`  Indexed ${faceIds.length} face(s) for ${externalImageId}`);
  return faceIds;
}

/**
 * Index a face from a buffer
 */
export async function indexFaceFromBuffer(imageBuffer, externalImageId) {
  const command = new IndexFacesCommand({
    CollectionId: getCollectionId(),
    Image: { Bytes: imageBuffer },
    ExternalImageId: externalImageId,
    DetectionAttributes: ['DEFAULT'],
    QualityFilter: 'AUTO',
  });

  const response = await getClient().send(command);
  const faceIds = response.FaceRecords?.map((r) => r.Face.FaceId) || [];
  return faceIds;
}

/**
 * Search for matching faces given an uploaded selfie
 */
export async function searchFaces(imageBuffer, threshold = 80, maxFaces = 50) {
  const command = new SearchFacesByImageCommand({
    CollectionId: getCollectionId(),
    Image: { Bytes: imageBuffer },
    FaceMatchThreshold: threshold,
    MaxFaces: maxFaces,
  });

  const response = await getClient().send(command);

  return (
    response.FaceMatches?.map((match) => ({
      faceId: match.Face.FaceId,
      externalImageId: match.Face.ExternalImageId,
      confidence: match.Similarity,
    })) || []
  );
}

/**
 * Check if Rekognition is configured
 */
export function isRekognitionConfigured() {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}
