const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

// Cloudinary config
cloudinary.config({
  cloud_name: "di6zeyneq",
  api_key: "<your_api_key>",
  api_secret: "<your_api_secret>",
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /api/messages/group/image
router.post("/group/image", auth, upload.single("image"), async (req, res) => {
  try {
    const { groupId } = req.body;
    const file = req.file;

    const streamUpload = (req) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "smarttalk" },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    const result = await streamUpload(req);

    const message = new Message({
      sender: req.user._id,
      group: groupId,
      text: "", // text optional
      image: result.secure_url,
    });

    await message.save();
    await message.populate("sender", "username");

    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Image upload failed" });
  }
});