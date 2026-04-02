import fs from "fs";
import path from "path";

const shapes = ["diamond", "squiggle", "oval"];
const colors = {
  red: "#e11d48",
  purple: "#7c3aed",
  green: "#22c55e",
};
const fills = ["solid", "striped", "open"];
const counts = [1, 2, 3];

const outDir = path.join(
  process.cwd(),
  "client",
  "src",
  "assets",
  "cards"
);

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function svgForGlyph(shape, color, fill) {
  const stroke = color;
  const fillColor = fill === "solid" ? color : "none";
  const stripe = fill === "striped";
  const open = fill === "open";

  let shapeElement = "";

  if (shape === "diamond") {
    shapeElement = `<polygon points="100,10 190,85 100,160 10,85" stroke="${stroke}" stroke-width="6" fill="${fillColor}"/>`;
  } else if (shape === "oval") {
    shapeElement = `<rect x="20" y="35" width="160" height="100" rx="50" ry="50" stroke="${stroke}" stroke-width="6" fill="${fillColor}"/>`;
  } else {
    // squiggle: simple bezier path
    shapeElement = `<path d="M20,110 C40,40 120,40 140,110 C160,180 220,180 240,110" stroke="${stroke}" stroke-width="10" fill="none"/>`;
    if (!open) {
      // approximate filled squiggle with thicker stroke and translucent fill
      shapeElement = `<path d="M20,110 C40,40 120,40 140,110 C160,180 220,180 240,110" stroke="${stroke}" stroke-width="14" fill="${fillColor === "none" ? "none" : color + "33"}"/>`;
    }
  }

  const stripeDefs = stripe
    ? `<defs>
  <pattern id="stripes-${color.replace("#", "")}" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
    <rect width="10" height="10" fill="none"/>
    <rect width="5" height="10" fill="${color}33"/>
  </pattern>
</defs>`
    : "";

  const fillRef =
    stripe && shape !== "squiggle"
      ? `fill="url(#stripes-${color.replace("#", "")})"`
      : "";

  let shapeWithStripe = shapeElement;
  if (stripe && shape !== "squiggle") {
    if (shape === "diamond") {
      shapeWithStripe = `<polygon points="100,10 190,85 100,160 10,85" stroke="${stroke}" stroke-width="6" ${fillRef}/>`;
    } else if (shape === "oval") {
      shapeWithStripe = `<rect x="20" y="35" width="160" height="100" rx="50" ry="50" stroke="${stroke}" stroke-width="6" ${fillRef}/>`;
    }
  }

  return `
<svg width="260" height="200" viewBox="0 0 260 200" xmlns="http://www.w3.org/2000/svg">
  ${stripeDefs}
  ${shapeWithStripe}
</svg>
`.trim();
}

function svgForCard(shape, colorKey, fill, count) {
  const color = colors[colorKey];
  const glyph = svgForGlyph(shape, color, fill);
  const glyphY = [0, -50, -90][count - 1];

  const transforms =
    count === 1
      ? [`translate(0,0)`]
      : count === 2
      ? [`translate(0,-30)`, `translate(0,40)`]
      : [`translate(0,-60)`, `translate(0,10)`, `translate(0,80)`];

  const pieces = transforms
    .map((t) => `<g transform="${t}">${glyph.replace("<svg", "<g").replace("</svg>", "</g>")}</g>`)
    .join("\n");

  return `
<svg width="260" height="260" viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="240" height="240" rx="32" ry="32" fill="#f9fafb" stroke="#e5e7eb" stroke-width="4"/>
  <g transform="translate(0,${glyphY})">
    ${pieces}
  </g>
</svg>
`.trim();
}

for (const shape of shapes) {
  for (const color of Object.keys(colors)) {
    for (const fill of fills) {
      for (const count of counts) {
        const svg = svgForCard(shape, color, fill, count);
        const fileName = `card-${shape}-${color}-${fill}-${count}.svg`;
        fs.writeFileSync(path.join(outDir, fileName), svg, "utf8");
      }
    }
  }
}

console.log("Generated card SVGs in", outDir);

