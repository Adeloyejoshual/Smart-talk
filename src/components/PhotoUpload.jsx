import React, { useState } from "react";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../awsConfig"; // path updated (next step)

export default function PhotoUpload() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");

  const uploadFile = async () => {
    if (!file) return alert("Please select a file first");

    setStatus("Uploading...");

    try {
      const uploadParams = {
        Bucket: "your-s3-bucket-name", // 👈 replace this with your real S3 bucket
        Key: `uploads/${Date.now()}_${file.name}`,
        Body: file,
        ContentType: file.type,
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      setStatus("✅ Upload successful!");
    } catch (err) {
      console.error(err);
      setStatus("❌ Upload failed!");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Upload a Photo</h2>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={uploadFile}>Upload</button>
      <p>{status}</p>
    </div>
  );
}