import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let s3 = null;

function getS3() {
  if (s3) return s3;
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.warn("[s3] AWS keys not set — using mock (no real upload)");
    return null;
  }
  s3 = new S3Client({
    region: process.env.AWS_REGION || "ap-south-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  return s3;
}

export async function uploadToS3(key, body, contentType = "application/pdf") {
  const client = getS3();
  if (!client) {
    // Mock: return a fake URL
    console.log(`[s3 mock] upload ${key} (${body.length} bytes)`);
    return `https://mock-s3.local/${key}`;
  }
  const bucket = process.env.AWS_S3_BUCKET;
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  // Return S3 URL (presigned if needed, for now direct)
  return `https://${bucket}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${key}`;
}
