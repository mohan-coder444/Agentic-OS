import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(configDir, "temp");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

// Accepted MIME types keyed by file category. Anything outside this list is
// rejected at multipart parse time — saves us from having to reject later.
const ACCEPTED = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-powerpoint": "ppt", // legacy .ppt; extraction may fail but we accept the upload
};

const fileFilter = (req, file, cb) => {
  if (ACCEPTED[file.mimetype] || file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported type: ${file.mimetype}. Allowed: PDF, PPTX, image.`), false);
  }
};

export default multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
export { uploadDir };
