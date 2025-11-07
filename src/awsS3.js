// src/awsS3.js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// 🔐 AWS S3 client
export const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

// 📤 Upload file with progress callback
export const uploadFileWithProgress = async (file, folder = "", setProgress) => {
  const fileName = `${folder}/${Date.now()}_${file.name}`;

  const uploadParams = {
    Bucket: import.meta.env.VITE_AWS_BUCKET,
    Key: fileName,
    Body: file,
    ContentType: file.type,
  };

  // 👀 AWS SDK v3 does not support progress natively for PutObjectCommand,
  // so we can simulate progress for UX purposes
  if (setProgress) setProgress(0);
  await s3Client.send(new PutObjectCommand(uploadParams));
  if (setProgress) setProgress(1);

  // Return the object URL
  return `https://${import.meta.env.VITE_AWS_BUCKET}.s3.${import.meta.env.VITE_AWS_REGION}.amazonaws.com/${fileName}`;
};