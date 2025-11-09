import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

export const s3Client = new S3Client({
  region: process.env.REACT_APP_AWS_REGION,
  credentials: {
    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  },
});

export const uploadFileWithProgress = async (file, chatId, onProgress) => {
  const fileName = `${chatId}/${Date.now()}_${file.name}`;
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.REACT_APP_AWS_BUCKET_NAME,
      Key: fileName,
      Body: file,
      ContentType: file.type,
    },
    leavePartsOnError: false,
  });

  upload.on("httpUploadProgress", (progress) => {
    if (onProgress && progress.total) {
      onProgress(progress.loaded / progress.total);
    }
  });

  await upload.done();
  return `https://${process.env.REACT_APP_AWS_BUCKET_NAME}.s3.${process.env.REACT_APP_AWS_REGION}.amazonaws.com/${fileName}`;
};