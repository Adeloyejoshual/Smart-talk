import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  region: process.env.REACT_APP_AWS_REGION,
  credentials: {
    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  },
});

// Upload file (simple version)
export const uploadFileWithProgress = async (file, chatId, onProgress) => {
  const fileName = `${chatId}/${Date.now()}_${file.name}`;

  const params = {
    Bucket: process.env.REACT_APP_AWS_BUCKET_NAME,
    Key: fileName,
    Body: file,
    ContentType: file.type,
  };

  // We can’t track progress with this simple client directly,
  // so call onProgress(1) when complete.
  await s3Client.send(new PutObjectCommand(params));

  if (onProgress) onProgress(1);

  return `https://${process.env.REACT_APP_AWS_BUCKET_NAME}.s3.${process.env.REACT_APP_AWS_REGION}.amazonaws.com/${fileName}`;
};