"use client";

import React, { useId } from "react";

export interface FilamentSpoolProps {
  color?: string;
  colorName?: string;
  material?: string;
  size?: number | string;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}

// Exact color dictionary for all 34 filaments in user's catalog
export const EXACT_FILAMENT_COLORS: Record<string, string> = {
  "Purple": "#8B5CF6",
  "Pine Green": "#22543D",
  "Lavender Purple": "#967BB6",
  "White": "#F8FAFC",
  "Orange": "#F97316",
  "Pink": "#EC4899",
  "Green": "#10B981",
  "Nebula Purple Sparkle": "#6B21A8",
  "Silver": "#94A3B8",
  "Black": "#18181B",
  "Avocado": "#65A30D",
  "Golden Coffee": "#855A36",
  "Blue": "#2563EB",
  "Yellow": "#EAB308",
  "Coral Orange": "#FF6F61",
  "RGB Green": "#22C55E",
  "Silk Mint Green": "#6EE7B7",
  "Silk Metallic Golden": "#D97706",
  "Silk Brass": "#B45309",
  "Silk Metallic Silver": "#CBD5E1",
  "Transparent": "#E2E8F0",
  "RGB Red": "#EF4444",
  "Magenta": "#D946EF",
  "Red": "#DC2626",
  "Apricot": "#FDBA74"
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let c = String(hex || "").replace("#", "").trim();
  if (c.length === 3) c = c.split("").map(x => x + x).join("");
  const num = parseInt(c, 16) || 0;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => {
    const h = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return h.length === 1 ? "0" + h : h;
  }).join("");
}

function adjustBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  return rgbToHex(
    rgb.r + (255 - rgb.r) * (percent / 100),
    rgb.g + (255 - rgb.g) * (percent / 100),
    rgb.b + (255 - rgb.b) * (percent / 100)
  );
}

function shadeColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  const factor = 1 - (percent / 100);
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

let spoolIdCounter = 0;

export function renderFilamentSpool({
  color,
  colorName,
  material = "PLA",
  size = 100,
  className = "",
  id
}: FilamentSpoolProps): string {
  spoolIdCounter++;
  const uid = id || ("spool_svg_" + spoolIdCounter + "_" + Math.random().toString(36).slice(2, 7));

  const resolvedColor = (colorName && EXACT_FILAMENT_COLORS[colorName]) || color || "#8B5CF6";
  const mat = (material || "").toUpperCase();
  const isTransparent = mat.includes("PETG") && (colorName === "Transparent" || (color && color.toLowerCase() === "#e2e8f0"));
  const isSilk = mat.includes("SILK");
  const isMatte = mat.includes("MATTE");
  const isBlack = resolvedColor.toLowerCase() === "#18181b" || resolvedColor.toLowerCase() === "#171717" || resolvedColor.toLowerCase() === "#09090b" || colorName === "Black";
  const isWhite = resolvedColor.toLowerCase() === "#ffffff" || resolvedColor.toLowerCase() === "#f8fafc" || resolvedColor.toLowerCase() === "#f1f5f9" || colorName === "White";

  // Lighting color calculations
  const baseColor = resolvedColor;
  const highlightColor = isWhite ? "#FFFFFF" : isBlack ? "#4E525E" : adjustBrightness(baseColor, isSilk ? 48 : 32);
  const shadowColor = isWhite ? "#94A3B8" : isBlack ? "#0B0C0E" : shadeColor(baseColor, 38);
  const deepShadowColor = isWhite ? "#64748B" : isBlack ? "#040506" : shadeColor(baseColor, 65);
  const specularColor = isSilk ? "rgba(255, 255, 255, 0.9)" : isMatte ? "rgba(255, 255, 255, 0.22)" : "rgba(255, 255, 255, 0.55)";

  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width="${size}"
      height="${size}"
      class="filament-spool-graphic ${className}"
      style="overflow:visible;display:block;"
      role="img"
      aria-label="3D Spool: ${colorName || ''} ${material || ''}"
    >
      <defs>
        <!-- Ground drop shadow -->
        <radialGradient id="${uid}_groundGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(0, 0, 0, 0.5)" />
          <stop offset="55%" stop-color="rgba(0, 0, 0, 0.22)" />
          <stop offset="100%" stop-color="rgba(0, 0, 0, 0)" />
        </radialGradient>

        <!-- Rear Flange Rim Material (Matte Charcoal with Molded Sheen) -->
        <linearGradient id="${uid}_rearFlangeRim" x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stop-color="#3A3D46" />
          <stop offset="35%" stop-color="#24272E" />
          <stop offset="75%" stop-color="#141519" />
          <stop offset="100%" stop-color="#0A0B0D" />
        </linearGradient>

        <linearGradient id="${uid}_rearFlangeFace" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stop-color="#282B33" />
          <stop offset="50%" stop-color="#1C1E23" />
          <stop offset="100%" stop-color="#121316" />
        </linearGradient>

        <!-- Filament Cylinder Coil Main Gradient -->
        <linearGradient id="${uid}_coilGrad" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stop-color="${shadowColor}" />
          <stop offset="18%" stop-color="${highlightColor}" />
          <stop offset="40%" stop-color="${baseColor}" />
          <stop offset="72%" stop-color="${shadowColor}" />
          <stop offset="100%" stop-color="${deepShadowColor}" />
        </linearGradient>

        <!-- Filament Strand Specular Sheen (Transverse cylindrical lighting) -->
        <linearGradient id="${uid}_coilSheen" x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.45)" />
          <stop offset="16%" stop-color="${specularColor}" />
          <stop offset="32%" stop-color="rgba(255,255,255,0)" />
          <stop offset="68%" stop-color="rgba(0,0,0,0.25)" />
          <stop offset="100%" stop-color="rgba(0,0,0,0.75)" />
        </linearGradient>

        <!-- Front Flange Outer 3D Rim -->
        <linearGradient id="${uid}_frontRimOuter" x1="10%" y1="5%" x2="90%" y2="95%">
          <stop offset="0%" stop-color="#555A67" />
          <stop offset="25%" stop-color="#2E323A" />
          <stop offset="75%" stop-color="#181A1E" />
          <stop offset="100%" stop-color="#0C0D10" />
        </linearGradient>

        <linearGradient id="${uid}_frontFacePlate" x1="15%" y1="5%" x2="85%" y2="95%">
          <stop offset="0%" stop-color="#343842" />
          <stop offset="35%" stop-color="#22252C" />
          <stop offset="80%" stop-color="#16171B" />
          <stop offset="100%" stop-color="#0E0F12" />
        </linearGradient>

        <!-- Inner Spindle Bore (Deep Center Hole) -->
        <linearGradient id="${uid}_boreWall" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#08090B" />
          <stop offset="50%" stop-color="#15171B" />
          <stop offset="100%" stop-color="#030304" />
        </linearGradient>

        <!-- Bevel Edge Highlights -->
        <linearGradient id="${uid}_bevelHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(255, 255, 255, 0.55)" />
          <stop offset="40%" stop-color="rgba(255, 255, 255, 0.18)" />
          <stop offset="80%" stop-color="rgba(255, 255, 255, 0)" />
        </linearGradient>

        ${isTransparent ? `
          <linearGradient id="${uid}_translucentRefract" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.75)" />
            <stop offset="25%" stop-color="rgba(226,232,240,0.35)" />
            <stop offset="60%" stop-color="rgba(148,163,184,0.18)" />
            <stop offset="85%" stop-color="rgba(255,255,255,0.6)" />
            <stop offset="100%" stop-color="rgba(30,41,59,0.75)" />
          </linearGradient>
        ` : ""}
      </defs>

      <!-- 1. Ambient Occlusion Ground Shadow -->
      <ellipse cx="102" cy="184" rx="74" ry="13" fill="url(#${uid}_groundGlow)" />
      <ellipse cx="96" cy="183" rx="56" ry="8" fill="rgba(0, 0, 0, 0.4)" filter="blur(2.5px)" />

      <!-- 2. REAR FLANGE (Extending Past the Coil for Authentic 3D Depth) -->
      <g id="${uid}_rearFlangeGroup">
        <!-- Rear outer rim lip for 3D extrusion thickness -->
        <path
          d="
            M 68 62
            C 84 32, 144 24, 172 56
            C 192 80, 190 128, 164 154
            L 156 142
            C 176 120, 178 82, 162 64
            C 138 38, 86 46, 76 70
            Z
          "
          fill="url(#${uid}_rearFlangeRim)"
        />
        <!-- Rear flange main face -->
        <ellipse
          cx="120"
          cy="90"
          rx="60"
          ry="72"
          fill="url(#${uid}_rearFlangeFace)"
          stroke="#363942"
          stroke-width="1.2"
        />
        <!-- Rear flange outer rim highlight -->
        <path
          d="M 88 42 C 112 30, 148 30, 170 54 C 184 72, 186 98, 180 120"
          fill="none"
          stroke="rgba(255, 255, 255, 0.22)"
          stroke-width="1"
        />
        <!-- Rear inner core drum shadow -->
        <ellipse cx="120" cy="90" rx="30" ry="36" fill="#0A0B0D" />
      </g>

      <!-- 3. FILAMENT COIL (The Tightly Wound 3D Cylinder) -->
      <g id="${uid}_filamentCoilGroup">
        <!-- Main cylindrical envelope spanning rear to front flange -->
        <path
          d="
            M 84 34
            C 106 24, 138 24, 158 46
            C 178 70, 178 116, 154 148
            L 122 174
            C 100 182, 72 178, 50 156
            C 26 132, 28 80, 54 48
            Z
          "
          fill="url(#${uid}_coilGrad)"
          ${isTransparent ? 'fill-opacity="0.65"' : ''}
        />

        <!-- Translucent core reflection for PETG Transparent -->
        ${isTransparent ? `
          <ellipse cx="102" cy="100" rx="36" ry="44" fill="#0F172A" opacity="0.8" />
          <path
            d="M 84 34 C 106 24, 138 24, 158 46 C 178 70, 178 116, 154 148 L 122 174 Z"
            fill="url(#${uid}_translucentRefract)"
          />
        ` : ""}

        <!-- Specular cylindrical lighting overlay -->
        <path
          d="
            M 84 34
            C 106 24, 138 24, 158 46
            C 178 70, 178 116, 154 148
            L 122 174
            C 100 182, 72 178, 50 156
            C 26 132, 28 80, 54 48
            Z
          "
          fill="url(#${uid}_coilSheen)"
          mix-blend-mode="overlay"
        />

        <!-- Realistic tightly wound filament striation tracks (Individual 1.75mm strands) -->
        <g opacity="${isTransparent ? '0.35' : isMatte ? '0.22' : '0.45'}" stroke-linecap="round">
          <path d="M 90 32 C 114 26, 142 32, 158 56 C 172 78, 170 120, 150 146" fill="none" stroke="${specularColor}" stroke-width="1.2" />
          <path d="M 91 33 C 115 27, 143 33, 159 57 C 173 79, 171 121, 151 147" fill="none" stroke="rgba(0,0,0,0.5)" stroke-width="1.2" />

          <path d="M 98 34 C 122 28, 148 36, 164 62 C 178 84, 175 124, 156 150" fill="none" stroke="${specularColor}" stroke-width="1.2" />
          <path d="M 99 35 C 123 29, 149 37, 165 63 C 179 85, 176 125, 157 151" fill="none" stroke="rgba(0,0,0,0.5)" stroke-width="1.2" />

          <path d="M 106 38 C 130 32, 154 42, 168 70 C 180 92, 177 128, 160 154" fill="none" stroke="${specularColor}" stroke-width="1.1" />
          <path d="M 107 39 C 131 33, 155 43, 169 71 C 181 93, 178 129, 161 155" fill="none" stroke="rgba(0,0,0,0.5)" stroke-width="1.1" />

          <path d="M 114 42 C 136 38, 158 50, 171 78 C 182 100, 178 132, 164 158" fill="none" stroke="${specularColor}" stroke-width="1.1" />
          <path d="M 115 43 C 137 39, 159 51, 172 79 C 183 101, 179 133, 165 159" fill="none" stroke="rgba(0,0,0,0.5)" stroke-width="1.1" />

          <path d="M 122 48 C 142 45, 162 60, 173 88 C 182 110, 178 136, 166 161" fill="none" stroke="${specularColor}" stroke-width="1.0" />

          <!-- Winding side texture lines -->
          <path d="M 88 40 L 126 24" stroke="${specularColor}" stroke-width="1.2" />
          <path d="M 96 46 L 134 29" stroke="${specularColor}" stroke-width="1.2" />
          <path d="M 104 53 L 142 35" stroke="${specularColor}" stroke-width="1.2" />
          <path d="M 112 61 L 150 43" stroke="${specularColor}" stroke-width="1.2" />
          <path d="M 120 70 L 158 52" stroke="${specularColor}" stroke-width="1.2" />
          <path d="M 128 80 L 164 63" stroke="${specularColor}" stroke-width="1.2" />
          <path d="M 134 92 L 168 76" stroke="${specularColor}" stroke-width="1.2" />
          <path d="M 138 106 L 170 91" stroke="${specularColor}" stroke-width="1.2" />
          <path d="M 139 120 L 168 108" stroke="${specularColor}" stroke-width="1.2" />
          <path d="M 136 136 L 164 126" stroke="${specularColor}" stroke-width="1.2" />
          <path d="M 130 150 L 154 144" stroke="${specularColor}" stroke-width="1.2" />
        </g>

        <!-- Top Crest Specular Highlight Line -->
        <path
          d="M 86 35 C 104 26, 132 23, 150 42 C 160 52, 166 68, 168 84"
          fill="none"
          stroke="${highlightColor}"
          stroke-width="2.5"
          stroke-linecap="round"
          opacity="${isSilk ? '0.92' : isMatte ? '0.35' : '0.65'}"
        />
        <path
          d="M 88 36 C 105 28, 131 25, 148 43"
          fill="none"
          stroke="#FFFFFF"
          stroke-width="1"
          stroke-linecap="round"
          opacity="${isSilk ? '0.95' : '0.65'}"
        />
      </g>

      <!-- 4. FRONT FLANGE (Matte Charcoal Structure with Authentic Spool Spokes) -->
      <g id="${uid}_frontFlangeGroup">
        <!-- Cast shadow from front flange onto the filament cylinder behind it -->
        <ellipse cx="80" cy="110" rx="63" ry="75" fill="rgba(0, 0, 0, 0.45)" filter="blur(3px)" />

        <!-- Outer 3D Rim Chamfer / Bevel Wall -->
        <ellipse
          cx="82"
          cy="108"
          rx="64"
          ry="76"
          fill="url(#${uid}_frontRimOuter)"
        />

        <!-- Bevel Top Edge Light -->
        <path
          d="M 30 76 C 42 42, 102 36, 132 64 C 144 76, 148 100, 142 122"
          fill="none"
          stroke="url(#${uid}_bevelHighlight)"
          stroke-width="1.5"
        />

        <!-- Front Flange Face Plate -->
        <ellipse
          cx="80"
          cy="106"
          rx="60"
          ry="72"
          fill="url(#${uid}_frontFacePlate)"
          stroke="#16181C"
          stroke-width="1.5"
        />

        <!-- Molded Outer Rim Ring Guide -->
        <ellipse
          cx="80"
          cy="106"
          rx="56"
          ry="67"
          fill="none"
          stroke="#2B2E37"
          stroke-width="1"
          opacity="0.6"
        />

        <!-- =============================================================
             Cutout Windows in Flange (Revealing Wound Filament Beneath)
             4 Curved Sector Windows with 3D Depth & Inner Wall Bevels
             ============================================================= -->
        <!-- Cutout Window 1: Top-Right -->
        <path
          d="
            M 84 56
            C 100 56, 116 66, 122 82
            L 106 90
            C 102 82, 94 76, 84 76
            Z
          "
          fill="${baseColor}"
          stroke="#121316"
          stroke-width="1.5"
        />
        <path
          d="
            M 84 56
            C 100 56, 116 66, 122 82
            L 106 90
            C 102 82, 94 76, 84 76
            Z
          "
          fill="url(#${uid}_coilSheen)"
          mix-blend-mode="multiply"
          opacity="0.85"
        />
        <path
          d="M 84 56 C 100 56, 116 66, 122 82"
          fill="none"
          stroke="#08080A"
          stroke-width="1.8"
        />
        <path
          d="M 84 76 C 94 76, 102 82, 106 90"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          stroke-width="0.8"
        />

        <!-- Cutout Window 2: Bottom-Right -->
        <path
          d="
            M 122 124
            C 118 140, 102 152, 84 154
            L 84 134
            C 94 133, 102 128, 106 120
            Z
          "
          fill="${shadeColor(baseColor, 30)}"
          stroke="#121316"
          stroke-width="1.5"
        />
        <path
          d="M 122 124 C 118 140, 102 152, 84 154"
          fill="none"
          stroke="#08080A"
          stroke-width="1.8"
        />

        <!-- Cutout Window 3: Bottom-Left -->
        <path
          d="
            M 74 154
            C 58 152, 44 140, 40 124
            L 54 120
            C 58 128, 64 133, 74 134
            Z
          "
          fill="${shadeColor(baseColor, 20)}"
          stroke="#121316"
          stroke-width="1.5"
        />
        <path
          d="M 74 154 C 58 152, 44 140, 40 124"
          fill="none"
          stroke="#08080A"
          stroke-width="1.8"
        />

        <!-- Cutout Window 4: Top-Left -->
        <path
          d="
            M 40 82
            C 44 66, 60 56, 74 56
            L 74 76
            C 64 76, 58 82, 54 90
            Z
          "
          fill="${adjustBrightness(baseColor, 10)}"
          stroke="#121316"
          stroke-width="1.5"
        />
        <path
          d="M 40 82 C 44 66, 60 56, 74 56"
          fill="none"
          stroke="#08080A"
          stroke-width="1.8"
        />
        <path
          d="M 54 90 C 58 82, 64 76, 74 76"
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          stroke-width="0.8"
        />

        <!-- Weight Gauge Markings around Top-Right Cutout (200g, 400g, 600g, 800g tick marks) -->
        <g stroke="#4B5263" stroke-width="1" opacity="0.6">
          <line x1="88" y1="52" x2="88" y2="55" />
          <line x1="98" y1="53" x2="97" y2="57" />
          <line x1="108" y1="57" x2="106" y2="61" />
          <line x1="117" y1="64" x2="114" y2="68" />
          <line x1="125" y1="73" x2="121" y2="76" />
        </g>

        <!-- 5. CENTER SPOOL HUB (Stepped Molded Core) -->
        <!-- Outer Hub Collar with Chamfer -->
        <ellipse
          cx="80"
          cy="106"
          rx="27"
          ry="33"
          fill="#1E2026"
          stroke="#2F333D"
          stroke-width="1.2"
        />
        <ellipse
          cx="80"
          cy="106"
          rx="23"
          ry="28"
          fill="#15171C"
          stroke="#0C0D10"
          stroke-width="1.2"
        />

        <!-- Recessed Spool Label Ring (Brand / Model Matte Inlay) -->
        <ellipse
          cx="80"
          cy="106"
          rx="19"
          ry="23"
          fill="#1A1C22"
          stroke="#2B2E37"
          stroke-width="0.8"
        />

        <!-- Subtle Circular Spindle Grooves -->
        <ellipse cx="80" cy="106" rx="16" ry="19.5" fill="none" stroke="#252830" stroke-width="0.6" />

        <!-- Center Spindle Hole / Bore with 3D Depth -->
        <path
          d="
            M 70 106
            C 70 98, 74 91, 80 91
            C 86 91, 90 98, 90 106
            L 98 100
            C 98 94, 94 88, 88 88
            C 82 88, 78 94, 78 100
            Z
          "
          fill="url(#${uid}_boreWall)"
        />
        <!-- Spindle Bore Lip Rim -->
        <ellipse
          cx="80"
          cy="106"
          rx="11"
          ry="14"
          fill="#060708"
          stroke="#262830"
          stroke-width="1"
        />
        <!-- Spindle Hole Bottom Darkness -->
        <ellipse
          cx="83"
          cy="104"
          rx="8.5"
          ry="11"
          fill="#020203"
        />
        <!-- Bore Lip Top Highlight -->
        <path
          d="M 72 102 C 74 96, 78 93, 83 93 C 86 93, 88 95, 89 98"
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          stroke-width="0.8"
        />

        <!-- 6. LOOSE FILAMENT LEADER TAIL (Physical Realism Detail) -->
        <!-- Outer notch on front flange edge -->
        <path d="M 129 60 L 133 65 L 131 66 L 127 61 Z" fill="#0E0F12" />
        <!-- The 1.75mm loose filament strand unspooling slightly -->
        <path
          d="M 124 74 C 128 66, 130 62, 131 63 C 134 66, 138 68, 144 65 C 148 62, 152 56, 150 50"
          fill="none"
          stroke="${baseColor}"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <path
          d="M 124 74 C 128 66, 130 62, 131 63 C 134 66, 138 68, 144 65"
          fill="none"
          stroke="${highlightColor}"
          stroke-width="0.7"
          stroke-linecap="round"
          opacity="0.8"
        />
      </g>
    </svg>
  `;
}

export function FilamentSpool({
  color,
  colorName,
  material = "PLA",
  size = 100,
  className = "",
  id,
  style
}: FilamentSpoolProps) {
  const reactId = useId();
  const html = renderFilamentSpool({
    color,
    colorName,
    material,
    size,
    className,
    id: id || reactId.replace(/:/g, "_")
  });

  return (
    <div
      className={`filament-spool-wrapper ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flexShrink: 0,
        ...style
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default FilamentSpool;
