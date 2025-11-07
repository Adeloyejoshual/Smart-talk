// src/awsS3.js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

export const uploadFileToS3 = async (file, chatId) => {
  const fileName = `${chatId}/${Date.now()}_${file.name}`;
  const command = new PutObjectCommand({
    Bucket: import.meta.env.VITE_AWS_BUCKET_NAME,
    Key: fileName,
    Body: file,
    ContentType: file.type,
    ACL: "public-read", // optional, if you want it publicly readable
  });

  await s3Client.send(command);

  return `https://${import.meta.env.VITE_AWS_BUCKET_NAME}.s3.${import.meta.env.VITE_AWS_REGION}.amazonaws.com/${fileName}`;
};