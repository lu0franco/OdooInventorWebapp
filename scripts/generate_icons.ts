import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

// Ensure directories exist in workspace
const iconsDir = path.join(process.cwd(), 'Icons');
const publicIconsDir = path.join(process.cwd(), 'public/icons');

if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
if (!fs.existsSync(publicIconsDir)) fs.mkdirSync(publicIconsDir, { recursive: true });

interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

const COLORS = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  orange: { r: 249, g: 115, b: 22, a: 255 },     // #f97316 (Autodesk / Inventor accent)
  darkOrange: { r: 194, g: 65, b: 12, a: 255 }, // #c2410c
  purple: { r: 147, g: 51, b: 234, a: 255 },    // #9333ea (Odoo primary)
  darkPurple: { r: 107, g: 33, b: 168, a: 255 },// #6b21a8
  lightPurple: { r: 216, g: 180, b: 254, a: 255 },
  white: { r: 255, g: 255, b: 255, a: 255 },
  slateDark: { r: 30, g: 41, b: 59, a: 255 },   // #1e293b
  slateLight: { r: 203, g: 213, b: 225, a: 255 },// #cbd5e1
  emerald: { r: 16, g: 185, b: 129, a: 255 },   // #10b981
  cyan: { r: 6, g: 182, b: 212, a: 255 },       // #06b6d4
  amber: { r: 245, g: 158, b: 11, a: 255 }
};

function createIcon(
  width: number,
  height: number,
  drawFn: (setPixel: (x: number, y: number, color: Color) => void) => void
): Buffer {
  const png = new PNG({ width, height });

  // Init transparent
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = 0;
      png.data[idx + 1] = 0;
      png.data[idx + 2] = 0;
      png.data[idx + 3] = 0;
    }
  }

  const setPixel = (x: number, y: number, color: Color) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (width * y + x) << 2;
    // Simple alpha blending
    if (color.a === 255) {
      png.data[idx] = color.r;
      png.data[idx + 1] = color.g;
      png.data[idx + 2] = color.b;
      png.data[idx + 3] = 255;
    } else if (color.a > 0) {
      const alpha = color.a / 255;
      png.data[idx] = Math.round(color.r * alpha + png.data[idx] * (1 - alpha));
      png.data[idx + 1] = Math.round(color.g * alpha + png.data[idx + 1] * (1 - alpha));
      png.data[idx + 2] = Math.round(color.b * alpha + png.data[idx + 2] * (1 - alpha));
      png.data[idx + 3] = Math.max(png.data[idx + 3], color.a);
    }
  };

  drawFn(setPixel);
  return PNG.sync.write(png);
}

// 1. icon_odoo_test_32x32.png: Lightning bolt connection test
function drawTest(setPixel: (x: number, y: number, c: Color) => void) {
  // Background badge: soft rounded squircle in dark purple
  for (let x = 2; x <= 29; x++) {
    for (let y = 2; y <= 29; y++) {
      if ((x <= 4 && y <= 4) || (x >= 27 && y <= 4) || (x <= 4 && y >= 27) || (x >= 27 && y >= 27)) continue;
      setPixel(x, y, COLORS.darkPurple);
    }
  }
  // Border ring
  for (let i = 4; i <= 27; i++) {
    setPixel(i, 2, COLORS.purple);
    setPixel(i, 29, COLORS.purple);
    setPixel(2, i, COLORS.purple);
    setPixel(29, i, COLORS.purple);
  }
  // Central bright lightning bolt (orange + yellow)
  const bolt = [
    [17, 6], [16, 7], [15, 8], [14, 9], [13, 10], [12, 11], [11, 12], [10, 13], [9, 14],
    [10, 14], [11, 14], [12, 14], [13, 14], [14, 14], [15, 14], [16, 14], [17, 14],
    [14, 15], [13, 16], [12, 17], [13, 18], [14, 19], [15, 20], [16, 21], [17, 22],
    [18, 23], [19, 24], [20, 25]
  ];
  for (let y = 6; y <= 25; y++) {
    for (let x = 8; x <= 23; x++) {
      // Shape of lightning bolt
      if (
        (y < 15 && x >= 14 - Math.floor((y - 6) * 0.7) && x <= 20 - Math.floor((y - 6) * 0.7)) ||
        (y >= 14 && y <= 16 && x >= 10 && x <= 22) ||
        (y > 15 && x >= 11 + Math.floor((y - 15) * 0.9) && x <= 16 + Math.floor((y - 15) * 0.9))
      ) {
        setPixel(x, y, COLORS.orange);
      }
    }
  }
  // Core highlight
  for (let y = 8; y <= 23; y++) {
    for (let x = 11; x <= 19; x++) {
      if (
        (y < 15 && x >= 16 - Math.floor((y - 6) * 0.7) && x <= 18 - Math.floor((y - 6) * 0.7)) ||
        (y > 15 && x >= 13 + Math.floor((y - 15) * 0.9) && x <= 14 + Math.floor((y - 15) * 0.9))
      ) {
        setPixel(x, y, COLORS.white);
      }
    }
  }
}

// 2. icon_odoo_bom_32x32.png: Bill of Materials hierarchical tree
function drawBOM(setPixel: (x: number, y: number, c: Color) => void) {
  // Top Root assembly box
  for (let x = 11; x <= 20; x++) {
    for (let y = 4; y <= 10; y++) {
      setPixel(x, y, COLORS.orange);
    }
  }
  for (let x = 12; x <= 19; x++) {
    setPixel(x, 5, COLORS.white);
  }
  // Tree stem
  for (let y = 11; y <= 16; y++) {
    setPixel(15, y, COLORS.slateLight);
    setPixel(16, y, COLORS.slateLight);
  }
  // Horizontal branching
  for (let x = 6; x <= 25; x++) {
    setPixel(x, 16, COLORS.slateLight);
    setPixel(x, 17, COLORS.slateLight);
  }
  // Vertical drops
  for (let y = 17; y <= 20; y++) {
    setPixel(6, y, COLORS.slateLight);
    setPixel(15, y, COLORS.slateLight);
    setPixel(16, y, COLORS.slateLight);
    setPixel(25, y, COLORS.slateLight);
  }
  // 3 Child component boxes
  // Child 1 (Left)
  for (let x = 3; x <= 9; x++) {
    for (let y = 21; y <= 27; y++) {
      setPixel(x, y, COLORS.purple);
    }
  }
  // Child 2 (Center)
  for (let x = 12; x <= 19; x++) {
    for (let y = 21; y <= 27; y++) {
      setPixel(x, y, COLORS.purple);
    }
  }
  // Child 3 (Right)
  for (let x = 22; x <= 28; x++) {
    for (let y = 21; y <= 27; y++) {
      setPixel(x, y, COLORS.purple);
    }
  }
}

// 3. icon_odoo_prop_32x32.png: Engineering iProperties tag
function drawProp(setPixel: (x: number, y: number, c: Color) => void) {
  // Angled tag shape
  for (let y = 5; y <= 26; y++) {
    for (let x = 6; x <= 25; x++) {
      if (y <= 12 && x <= 12 - (y - 5)) continue;
      setPixel(x, y, COLORS.slateDark);
    }
  }
  // Border
  for (let y = 5; y <= 26; y++) {
    for (let x = 6; x <= 25; x++) {
      if (y === 5 || y === 26 || x === 25 || (x === 6 && y >= 12)) {
        setPixel(x, y, COLORS.cyan);
      }
    }
  }
  // Hole in tag
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      setPixel(12 + dx, 9 + dy, COLORS.white);
    }
  }
  // Text lines on tag
  for (let y of [14, 18, 22]) {
    for (let x = 10; x <= 21; x++) {
      setPixel(x, y, COLORS.orange);
      setPixel(x, y + 1, COLORS.orange);
    }
  }
}

// 4. icon_odoo_stock_32x32.png: Warehouse Stock Box
function drawStock(setPixel: (x: number, y: number, c: Color) => void) {
  // Isometric crate
  // Top diamond face
  for (let dy = 0; dy <= 7; dy++) {
    const minX = 16 - dy * 1.6;
    const maxX = 16 + dy * 1.6;
    for (let x = Math.round(minX); x <= Math.round(maxX); x++) {
      setPixel(x, 4 + dy, COLORS.amber);
    }
  }
  for (let dy = 0; dy <= 7; dy++) {
    const minX = 5 + dy * 1.6;
    const maxX = 27 - dy * 1.6;
    for (let x = Math.round(minX); x <= Math.round(maxX); x++) {
      setPixel(x, 11 + dy, COLORS.amber);
    }
  }
  // Left side
  for (let y = 18; y <= 27; y++) {
    for (let x = 5; x <= 16; x++) {
      setPixel(x, y, COLORS.darkOrange);
    }
  }
  // Right side
  for (let y = 18; y <= 27; y++) {
    for (let x = 17; x <= 27; x++) {
      setPixel(x, y, COLORS.orange);
    }
  }
  // Center check mark (green badge)
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      if (Math.abs(dx) + Math.abs(dy) <= 4) {
        setPixel(24 + dx, 23 + dy, COLORS.emerald);
      }
    }
  }
  setPixel(23, 23, COLORS.white);
  setPixel(24, 24, COLORS.white);
  setPixel(25, 22, COLORS.white);
  setPixel(26, 21, COLORS.white);
}

// 5. icon_odoo_part_32x32.png: 3D CAD mechanical gear
function drawPart(setPixel: (x: number, y: number, c: Color) => void) {
  const cx = 16, cy = 16, rOuter = 11, rInner = 6, rHole = 3;
  // Gear teeth + body
  for (let y = 4; y <= 28; y++) {
    for (let x = 4; x <= 28; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const angle = Math.atan2(y - cy, x - cx);
      const teeth = Math.cos(angle * 6); // 6 gear teeth
      const effectiveROuter = rOuter + (teeth > 0.3 ? 2 : 0);

      if (d <= effectiveROuter && d >= rHole) {
        if (d > rInner) {
          setPixel(x, y, COLORS.orange);
        } else {
          setPixel(x, y, COLORS.slateLight);
        }
      }
    }
  }
  // Keyway slot in center hole
  for (let y = 14; y <= 18; y++) {
    for (let x = 15; x <= 17; x++) {
      setPixel(x, y, COLORS.transparent);
    }
  }
}

// 6. icon_odoo_link_32x32.png: Chain Link / ERP Integration
function drawLink(setPixel: (x: number, y: number, c: Color) => void) {
  // Ring 1 (Orange, Top Left)
  for (let y = 5; y <= 18; y++) {
    for (let x = 5; x <= 18; x++) {
      const d = Math.sqrt((x - 11.5) ** 2 + (y - 11.5) ** 2);
      if (d <= 6.5 && d >= 3.5) {
        setPixel(x, y, COLORS.orange);
      }
    }
  }
  // Ring 2 (Purple, Bottom Right)
  for (let y = 13; y <= 26; y++) {
    for (let x = 13; x <= 26; x++) {
      const d = Math.sqrt((x - 19.5) ** 2 + (y - 19.5) ** 2);
      if (d <= 6.5 && d >= 3.5) {
        setPixel(x, y, COLORS.purple);
      }
    }
  }
  // Connection sparks
  setPixel(15, 15, COLORS.white);
  setPixel(16, 16, COLORS.white);
}

// 7. icon_odoo_dwg_32x32.png: 2D Blueprint Drawing
function drawDwg(setPixel: (x: number, y: number, c: Color) => void) {
  // Blueprint background sheet
  for (let y = 4; y <= 27; y++) {
    for (let x = 5; x <= 26; x++) {
      setPixel(x, y, COLORS.slateDark);
    }
  }
  // White frame border
  for (let y = 4; y <= 27; y++) {
    for (let x = 5; x <= 26; x++) {
      if (y === 4 || y === 27 || x === 5 || x === 26) {
        setPixel(x, y, COLORS.cyan);
      }
    }
  }
  // Drawing geometry (circles & lines)
  // Center circle
  for (let y = 8; y <= 18; y++) {
    for (let x = 10; x <= 20; x++) {
      const d = Math.sqrt((x - 15) ** 2 + (y - 13) ** 2);
      if (Math.abs(d - 4) < 1) {
        setPixel(x, y, COLORS.white);
      }
    }
  }
  // Dimension lines
  for (let x = 8; x <= 22; x++) {
    setPixel(x, 21, COLORS.orange);
  }
  // Arrows
  setPixel(8, 20, COLORS.orange);
  setPixel(8, 22, COLORS.orange);
  setPixel(22, 20, COLORS.orange);
  setPixel(22, 22, COLORS.orange);

  // Titleblock box in bottom-right corner
  for (let y = 23; y <= 26; y++) {
    for (let x = 17; x <= 25; x++) {
      setPixel(x, y, COLORS.purple);
    }
  }
}

// 8. icon_odoo_config_32x32.png: Settings Gear with Odoo Logo accent
function drawConfig(setPixel: (x: number, y: number, c: Color) => void) {
  const cx = 16, cy = 16;
  // Outer gear teeth
  for (let y = 4; y <= 28; y++) {
    for (let x = 4; x <= 28; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const angle = Math.atan2(y - cy, x - cx);
      const teeth = Math.cos(angle * 8); // 8 gear teeth
      const rOuter = 11 + (teeth > 0.4 ? 2.5 : 0);
      if (d <= rOuter && d >= 4.5) {
        setPixel(x, y, COLORS.darkPurple);
      }
    }
  }
  // Gear inner body ring
  for (let y = 7; y <= 25; y++) {
    for (let x = 7; x <= 25; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d <= 9 && d >= 5) {
        setPixel(x, y, COLORS.purple);
      }
    }
  }
  // Inner center
  for (let y = 13; y <= 19; y++) {
    for (let x = 13; x <= 19; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d <= 3) {
        setPixel(x, y, COLORS.orange);
      }
    }
  }
}

// Icon definitions
const ICONS = [
  { name: 'icon_odoo_test_32x32.png', draw: drawTest },
  { name: 'icon_odoo_bom_32x32.png', draw: drawBOM },
  { name: 'icon_odoo_prop_32x32.png', draw: drawProp },
  { name: 'icon_odoo_stock_32x32.png', draw: drawStock },
  { name: 'icon_odoo_part_32x32.png', draw: drawPart },
  { name: 'icon_odoo_link_32x32.png', draw: drawLink },
  { name: 'icon_odoo_dwg_32x32.png', draw: drawDwg },
  { name: 'icon_odoo_config_32x32.png', draw: drawConfig },
];

console.log('Generating Autodesk Inventor AddIn 32x32 PNG icons...');

for (const icon of ICONS) {
  const buf32 = createIcon(32, 32, icon.draw);
  
  // Write to /Icons/ (for the AddIn build)
  fs.writeFileSync(path.join(iconsDir, icon.name), buf32);
  // Write to /public/icons/ (for Web app serving)
  fs.writeFileSync(path.join(publicIconsDir, icon.name), buf32);

  // Also generate 16x16 standard Inventor small icons
  const name16 = icon.name.replace('32x32', '16x16');
  const buf16 = createIcon(16, 16, (setPixel) => {
    // scaled down render
    icon.draw((x, y, c) => {
      if (x % 2 === 0 && y % 2 === 0) {
        setPixel(Math.floor(x / 2), Math.floor(y / 2), c);
      }
    });
  });
  fs.writeFileSync(path.join(iconsDir, name16), buf16);
  fs.writeFileSync(path.join(publicIconsDir, name16), buf16);

  console.log(`Generated: ${icon.name} & ${name16}`);
}

console.log('All icons generated successfully!');
