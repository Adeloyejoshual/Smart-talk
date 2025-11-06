import { S3Client } from "@aws-sdk/client-s3";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";

export const s3Client = new S3Client({
  region: "eu-north-1", // your AWS region
  credentials: fromCognitoIdentityPool({
    identityPoolId: "eu-north-1:97d705ec-c1a7-4197-a075-bd18c9c1766f", 
  }),
});