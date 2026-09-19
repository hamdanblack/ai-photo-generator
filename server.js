import "dotenv/config";
import express from "express";
import multer from "multer";
import Replicate from "replicate";
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);
const maxFileMb = Number(process.env.MAX_FILE_MB || 15);

if (!process.env.REPLICATE_API_TOKEN) {
  console.warn("WARNING: REPLICATE_API_TOKEN belum diisi.");
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  useFileOutput: false
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("File harus berupa gambar."));
    }
    cb(null, true);
  }
});

app.use(express.static(path.join(__dirname, "public")));

function requiredConfig(name) {
  const value = process.env[name];
  if (!value || value.includes("example.com")) {
    throw new Error(`${name} belum dikonfigurasi.`);
  }
  return value;
}

function outputToUrl(output) {
  if (typeof output === "string") return output;
  if (output?.url) return typeof output.url === "function" ? output.url() : output.url;
  if (Array.isArray(output)) return outputToUrl(output[0]);
  throw new Error("Model tidak mengembalikan URL output.");
}

async function toBuffer(output) {
  const url = outputToUrl(output);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Gagal mengambil output AI: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function runTryOn(personBuffer, garmentBuffer) {
  // Official Replicate model for virtual try-on.
  // It keeps the person's face/pose/body while changing the garment.
  return replicate.run("prunaai/p-image-try-on", {
    input: {
      person_image: personBuffer,
      garment_images: [garmentBuffer],
      preserve_input_size: true,
      output_format: "jpg",
      output_quality: 95
    }
  });
}

async function removeBackground(imageBuffer) {
  return replicate.run("851-labs/background-remover", {
    input: { image: imageBuffer }
  });
}

async function faceSwap(targetBuffer, faceBuffer) {
  return replicate.run("codeplugtech/face-swap", {
    input: {
      input_image: targetBuffer,
      swap_image: faceBuffer
    }
  });
}

async function composeBackground(foregroundBuffer, backgroundUrl) {
  const bgResponse = await fetch(backgroundUrl);
  if (!bgResponse.ok) throw new Error("Background URL tidak bisa diakses.");
  const bgBuffer = Buffer.from(await bgResponse.arrayBuffer());

  const fgMeta = await sharp(foregroundBuffer).metadata();
  const width = fgMeta.width || 1024;
  const height = fgMeta.height || 1365;

  const background = await sharp(bgBuffer)
    .resize(width, height, { fit: "cover", position: "centre" })
    .jpeg({ quality: 95 })
    .toBuffer();

  return sharp(background)
    .composite([
      { input: foregroundBuffer, gravity: "centre" }
    ])
    .jpeg({ quality: 95 })
    .toBuffer();
}

app.post(
  "/api/generate",
  upload.fields([
    { name: "person", maxCount: 1 },
    { name: "face", maxCount: 1 },
    { name: "garment", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const person = req.files?.person?.[0];
      const face = req.files?.face?.[0];
      const garment = req.files?.garment?.[0];

      if (!person) {
        return res.status(400).json({ error: "Foto utama belum diupload." });
      }

      const garmentInput = garment?.buffer || requiredConfig("DEFAULT_GARMENT_URL");
      const backgroundUrl = requiredConfig("DEFAULT_BACKGROUND_URL");

      // 1) Ganti baju.
      const dressed = await runTryOn(person.buffer, garmentInput);
      const dressedBuffer = await toBuffer(dressed);

      // 2) Hapus background dari hasil ganti baju.
      const cutoutOutput = await removeBackground(dressedBuffer);
      const cutoutBuffer = await toBuffer(cutoutOutput);

      // 3) Pasang background baru.
      const composited = await composeBackground(cutoutBuffer, backgroundUrl);

      // 4) Swap wajah bila referensi wajah tersedia.
      const faceInput = face?.buffer || (
        process.env.DEFAULT_FACE_URL
          ? process.env.DEFAULT_FACE_URL
          : null
      );

      let finalBuffer = composited;
      if (faceInput) {
        const swapped = await faceSwap(composited, faceInput);
        finalBuffer = await toBuffer(swapped);
      }

      res.set("Content-Type", "image/jpeg");
      res.set("Cache-Control", "no-store");
      res.send(finalBuffer);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: error?.message || "Terjadi kesalahan saat memproses foto."
      });
    }
  }
);

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || "Upload tidak valid." });
});

app.listen(port, () => {
  console.log(`AI Photo Generator berjalan di http://localhost:${port}`);
});
