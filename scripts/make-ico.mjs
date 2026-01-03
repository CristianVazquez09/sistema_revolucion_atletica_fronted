import fs from "fs";
import pngToIco from "png-to-ico";

const src = [
  "assets/icon.png" // con este solo basta si es >=256x256; opcionalmente puedes pasar varias resoluciones
];

const outDir = "build/icons";
const outPath = `${outDir}/icon.ico`;
fs.mkdirSync(outDir, { recursive: true });

pngToIco(src)
  .then(buf => {
    fs.writeFileSync(outPath, buf);
    console.log("ICO generado:", outPath);
  })
  .catch(err => {
    console.error("Error generando ICO:", err);
    process.exit(1);
  });
