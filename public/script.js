const form = document.querySelector("#form");
const button = document.querySelector("#generate");
const statusBox = document.querySelector("#status");
const resultBox = document.querySelector("#resultBox");
const result = document.querySelector("#result");
const download = document.querySelector("#download");

const inputs = [
  ["person", "personPreview"],
  ["face", "facePreview"],
  ["garment", "garmentPreview"]
];

inputs.forEach(([inputId, previewId]) => {
  document.getElementById(inputId).addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    const preview = document.getElementById(previewId);
    preview.innerHTML = "";
    if (!file) return;
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
  });
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const person = document.querySelector("#person").files[0];
  const face = document.querySelector("#face").files[0];
  const garment = document.querySelector("#garment").files[0];

  if (!person) return;

  const data = new FormData();
  data.append("person", person);
  if (face) data.append("face", face);
  if (garment) data.append("garment", garment);

  button.disabled = true;
  resultBox.classList.add("hidden");
  statusBox.classList.remove("hidden");

  const stages = [
    "Mengupload foto...",
    "Mengganti pakaian...",
    "Menghapus background...",
    "Memasang background baru...",
    "Menyesuaikan wajah...",
    "Finishing..."
  ];

  let stage = 0;
  statusBox.textContent = stages[stage];

  const timer = setInterval(() => {
    stage = Math.min(stage + 1, stages.length - 1);
    statusBox.textContent = stages[stage];
  }, 4500);

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      body: data
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Gagal membuat foto.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    result.src = url;
    download.href = url;
    resultBox.classList.remove("hidden");
    statusBox.textContent = "✅ Foto selesai dibuat.";
  } catch (error) {
    statusBox.textContent = "❌ " + error.message;
  } finally {
    clearInterval(timer);
    button.disabled = false;
  }
});
