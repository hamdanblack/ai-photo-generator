# AI Photo Generator

Web app sederhana untuk:
1. Ganti pakaian dengan virtual try-on.
2. Hapus background.
3. Pasang background baru.
4. Swap wajah.
5. Menampilkan hasil dan tombol download.

Pipeline memakai Replicate:
- `prunaai/p-image-try-on` untuk pakaian.
- `851-labs/background-remover` untuk cutout.
- `codeplugtech/face-swap` untuk swap wajah.

## 1. Persiapan

Install Node.js 18+.

Lalu:

```bash
npm install
```

Salin `.env.example` menjadi `.env`:

```bash
copy .env.example .env
```

atau di Linux/macOS:

```bash
cp .env.example .env
```

Isi:

```env
REPLICATE_API_TOKEN=r8_xxxxxxxxx
DEFAULT_GARMENT_URL=https://domain-anda.com/baju.jpg
DEFAULT_BACKGROUND_URL=https://domain-anda.com/background.jpg
DEFAULT_FACE_URL=
PORT=3000
```

Jangan pernah menaruh `REPLICATE_API_TOKEN` di `index.html`, `script.js`, atau GitHub Pages.

## 2. Jalankan

```bash
npm start
```

Buka:

```text
http://localhost:3000
```

## 3. Cara membuat mode "tinggal upload foto"

Jika baju dan background sudah tetap, isi `DEFAULT_GARMENT_URL` dan
`DEFAULT_BACKGROUND_URL`.

Pengguna cukup upload:
- Foto utama.
- Foto wajah.

Kalau ingin wajah juga tetap, isi `DEFAULT_FACE_URL`, sehingga pengguna
cukup upload satu foto utama.

## 4. Deploy

Frontend + backend tidak boleh hanya di GitHub Pages karena GitHub Pages
hanya hosting statis dan token API tidak boleh dibuka ke browser.

Gunakan:
- GitHub untuk source code.
- Backend Node.js di Render, Railway, Fly.io, Vercel Functions,
  Cloud Run, atau server Node.js lainnya.

Set environment variable `REPLICATE_API_TOKEN` di hosting backend.

Jika frontend dan backend berada di domain berbeda, ubah URL fetch di
`public/script.js` dari `/api/generate` menjadi URL endpoint backend Anda.

## Catatan

Model `cuuupid/idm-vton` adalah alternatif untuk virtual try-on, tetapi
model tersebut menyatakan lisensinya non-commercial. Pipeline default
menggunakan `prunaai/p-image-try-on`.
