import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// 🔧 Configure your AWS region and Identity Pool ID
const REGION = "eu-north-1";
const IDENTITY_POOL_ID = "eu-north-1:97d705ec-c1a7-4197-a075-bd18c9c1766f";
const BUCKET_NAME = "your-s3-bucket-name"; // change this

// Create S3 client
const s3 = new S3Client({
  region: REGION,
  credentials: fromCognitoIdentityPool({
    clientConfig: { region: REGION },
    identityPoolId: IDENTITY_POOL_ID,
  }),
});

// Upload function
export async function uploadPhotoToS3(file, userId) {
  const fileName = `chatImages/${userId}-${Date.now()}-${file.name}`;

  const uploadParams = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: file,
    ContentType: file.type,
  };

  try {
    await s3.send(new PutObjectCommand(uploadParams));

    // return the public S3 URL
    const fileUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${fileName}`;
    return fileUrl;
  } catch (error) {
    console.error("❌ Upload error:", error);
    throw error;
  }
}