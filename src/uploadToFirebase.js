import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "./firebaseConfig";

/**
 * Upload file to Firebase Storage with progress
 * @param {File} file - the file to upload
 * @param {string} chatId - chat folder name
 * @param {function} onProgress - callback(progress)
 * @returns {Promise<string>} file download URL
 */
export async function uploadToFirebase(file, chatId, onProgress) {
  if (!file) throw new Error("No file provided");

  const filePath = `chats/${chatId}/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, filePath);
  const uploadTask = uploadBytesResumable(fileRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          snapshot.totalBytes > 0
            ? snapshot.bytesTransferred / snapshot.totalBytes
            : 0;
        if (onProgress) onProgress(progress);
      },
      (error) => {
        console.error("Upload error:", error);
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
}