import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const src = "assets/icon.png";
const outDir = "build/icons";
const outPath = `${outDir}/icon.ico`;
fs.mkdirSync(outDir, { recursive: true });

// Tamaños estándar que NSIS y Windows requieren
const sizes = [16, 32, 48, 256];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ico-"));

async function run() {
  const pngPaths = [];
  for (const size of sizes) {
    const dest = path.join(tmp, `icon-${size}.png`);
    await sharp(src)
      .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(dest);
    pngPaths.push(dest);
  }

  const buf = await pngToIco(pngPaths);
  fs.writeFileSync(outPath, buf);

  // Limpiar temporales
  for (const p of pngPaths) fs.unlinkSync(p);
  fs.rmdirSync(tmp);

  console.log("ICO generado:", outPath);
}

run().catch(err => {
  console.error("Error generando ICO:", err);
  process.exit(1);
});
