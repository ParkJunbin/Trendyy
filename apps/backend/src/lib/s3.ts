import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";
dotenv.config();

export const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function uploadToS3(
  buffer: Buffer,
  key: string,
  mimeType: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );
  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION ?? "ap-southeast-2"}.amazonaws.com/${key}`;
}

export async function getPresignedUrl(key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
    }),
    { expiresIn: 300 } // 5 minutes
  );
}