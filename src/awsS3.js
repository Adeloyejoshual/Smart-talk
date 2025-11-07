// src/awsS3.js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// ✅ AWS S3 client
export const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

// ✅ Upload file with "progress" callback
export async function uploadFileWithProgress(file, chatId, onProgress) {
  const fileName = `${chatId}/${Date.now()}_${file.name}`;

  const command = new PutObjectCommand({
    Bucket: import.meta.env.VITE_AWS_BUCKET_NAME,
    Key: fileName,
    Body: file,
    ContentType: file.type,
    ACL: "public-read", // make public or use pre-signed URLs if needed
  });

  // Simulated progress (v3 browser SDK doesn’t support native progress)
  onProgress?.(0.3);
  await s3Client.send(command);
  onProgress?.(1);

  return `https://${import.meta.env.VITE_AWS_BUCKET_NAME}.s3.${import.meta.env.VITE_AWS_REGION}.amazonaws.com/${fileName}`;
}