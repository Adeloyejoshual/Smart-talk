// utils/cloudinaryUpload.js
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

// Upload a single image buffer to Cloudinary
module.exports = function uploadToCloudinary(buffer, folder = "smarttalk") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (result) resolve(result.secure_url);
      else reject(error);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
};