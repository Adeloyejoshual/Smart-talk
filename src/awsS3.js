// src/awsS3.js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Create S3 client
export const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

// Upload file with optional progress callback
export async function uploadFileWithProgress(file, chatId, onProgress) {
  const fileName = `${chatId}/${Date.now()}_${file.name}`;

  const command = new PutObjectCommand({
    Bucket: import.meta.env.VITE_AWS_BUCKET_NAME,
    Key: fileName,
    Body: file,
    ContentType: file.type,
    ACL: "public-read", // optional: makes the file publicly readable
  });

  // Fake progress for frontend (AWS SDK v3 in browser doesn't support upload progress natively)
  onProgress?.(0.5);
  await s3Client.send(command);
  onProgress?.(1);

  return `https://${import.meta.env.VITE_AWS_BUCKET_NAME}.s3.${import.meta.env.VITE_AWS_REGION}.amazonaws.com/${fileName}`;
}