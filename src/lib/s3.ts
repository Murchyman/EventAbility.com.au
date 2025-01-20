import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: "us-east-1", // Required but ignored for R2
  endpoint: `https://${import.meta.env.ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: import.meta.env.MYAWS_ACCESS_KEY_ID || "",
    secretAccessKey: import.meta.env.MYAWS_SECRET_ACCESS_KEY || "",
  },
});

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const isImage = (buffer: Buffer): boolean => {
  // File signature/magic number checks
  const fileSignatures = {
    jpeg: ["FF", "D8", "FF"],
    png: ["89", "50", "4E", "47"],
    gif: ["47", "49", "46"],
    webp: ["52", "49", "46", "46"],
  };

  // Convert first 8 bytes to hex for checking
  const hex = Array.from(buffer.subarray(0, 8)).map((b) =>
    b.toString(16).toUpperCase().padStart(2, "0")
  );

  return (
    hex.slice(0, 3).join(" ").includes(fileSignatures.jpeg.join(" ")) || // JPEG
    hex.slice(0, 4).join(" ").includes(fileSignatures.png.join(" ")) || // PNG
    hex.slice(0, 3).join(" ").includes(fileSignatures.gif.join(" ")) || // GIF
    hex.slice(0, 4).join(" ").includes(fileSignatures.webp.join(" ")) // WEBP
  );
};

export const uploadFile = async (file: Buffer, key: string, bucket: string) => {
  if (!isImage(file)) {
    console.error("Invalid file type. Only images are allowed.");
    return false;
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file,
  });

  try {
    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error("Error uploading file:", error);
    return false;
  }
};

export const deleteFile = async (key: string, bucket: string) => {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  try {
    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error("Error deleting file:", error);
    return false;
  }
};

export const listFiles = async (bucket: string) => {
  const command = new ListObjectsCommand({
    Bucket: bucket,
  });

  try {
    const response = await s3Client.send(command);
    return response.Contents;
  } catch (error) {
    console.error("Error listing files:", error);
    return [];
  }
};

export const getSignedUrlForFile = async (key: string, bucket: string) => {
  const signedUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key + ".jpg",
    }),
    { expiresIn: 3600 }
  );
  return signedUrl;
};
