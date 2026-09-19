const express = require('express');
const multer = require('multer');
const Replicate = require('replicate');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

app.use(express.static('public'));

// Helper untuk membaca file aset lokal (gambar pakaian & background)
function getLocalAssetBuffer(fileName) {
  const filePath = path.join(__dirname, 'public', 'assets', fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File aset tidak ditemukan: ${filePath}`);
  }
  return fs.readFileSync(filePath);
}

// 1. Try On (Ganti Pakaian)
async function runTryOn(personBuffer, garmentBuffer) {
  const output = await replicate.run("prunaai/p-image-try-on", {
    input: {
      person_image: personBuffer,
      garment_images: [garmentBuffer],
      preserve_input_size: true,
      output_format: "jpg",
      output_quality: 95
    }
  });
  return output;
}

// 2. Remove Background
async function removeBackground(imageBuffer) {
  const output = await replicate.run("851-labs/background-remover", {
    input: { image: imageBuffer }
  });
  return output;
}

// 3. Face Swap
async function faceSwap(targetBuffer, faceBuffer) {
  const output = await replicate.run("codeplugtech/face-swap", {
    input: {
      input_image: targetBuffer,
      swap_image: faceBuffer
    }
  });
  return output;
}

// Helper untuk mengunduh gambar dari URL Replicate
async function fetchImageBuffer(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// 4. Penggabungan Background Lokal
async function composeBackground(foregroundBuffer, bgBuffer) {
  const fgMetadata = await sharp(foregroundBuffer).metadata();
  
  const resizedBg = await sharp(bgBuffer)
    .resize(fgMetadata.width, fgMetadata.height, { fit: 'cover' })
    .toBuffer();

  return await sharp(resizedBg)
    .composite([{ input: foregroundBuffer, top: 0, left: 0 }])
    .jpeg({ quality: 95 })
    .toBuffer();
}

// Endpoint Utama
app.post('/api/generate', upload.fields([
  { name: 'person', maxCount: 1 },
  { name: 'face', maxCount: 1 },
  { name: 'garment', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files || !req.files.person) {
      return res.status(400).json({ error: 'Foto utama (person) wajib diunggah.' });
    }

    const personBuffer = req.files.person[0].buffer;
    
    // Gunakan garment unggahan user jika ada, jika tidak gunakan aset lokal (garment.png)
    const garmentBuffer = (req.files.garment && req.files.garment[0]) 
      ? req.files.garment[0].buffer 
      : getLocalAssetBuffer('garment.png');

    // Aset background lokal (background.png)
    const backgroundBuffer = getLocalAssetBuffer('background.png');

    // Step 1: Jalankan Try-On Pakaian
    const tryOnUrl = await runTryOn(personBuffer, garmentBuffer);
    let currentBuffer = await fetchImageBuffer(tryOnUrl);

    // Step 2: Hapus Background bawaan
    const noBgUrl = await removeBackground(currentBuffer);
    const noBgBuffer = await fetchImageBuffer(noBgUrl);

    // Step 3: Pasang Background Lokal Biru
    currentBuffer = await composeBackground(noBgBuffer, backgroundBuffer);

    // Step 4: Face Swap (Opsional jika user mengunggah foto wajah)
    if (req.files.face && req.files.face[0]) {
      const faceBuffer = req.files.face[0].buffer;
      const faceSwapUrl = await faceSwap(currentBuffer, faceBuffer);
      currentBuffer = await fetchImageBuffer(faceSwapUrl);
    }

    res.set('Content-Type', 'image/jpeg');
    res.send(currentBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Terjadi kesalahan pada server.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});
