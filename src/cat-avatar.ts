import type { CatDef } from "./cats.ts";

// Elle çizilmiş, tutarlı bir "kedi kafası" ikon sistemi: aynı kafa/kulak/göz
// iskeleti, kediye göre değişen tüy rengi + desen (solid/tabby/patch/tuxedo)
// + göz rengiyle (Van kedisinde heterokromik) her kedi birbirinden ayrışır.
// Kilitli (henüz açılmamış) kediler siluet + pati izi olarak gösterilir.
//
// catFullBodySvg, aynı baş çizimini (headMarkup) daha uzun bir tuval üstünde
// gövde + kuyruk + ön patilerle birleştirir; kod tekrarını önlemek için baş
// çizimi tek bir yerde tanımlı.

let uid = 0;

const EAR_L = `M18 38 L29 6 L46 34 Z`;
const EAR_R = `M82 38 L71 6 L54 34 Z`;
const EAR_L_INNER = `M25 31 L31 14 L41 30 Z`;
const EAR_R_INNER = `M75 31 L69 14 L59 30 Z`;
const HEAD_ELLIPSE = `<ellipse cx="50" cy="58" rx="33" ry="29"/>`;

function lockedHeadMarkup(): string {
  return `
  <path d="${EAR_L}" fill="currentColor" opacity="0.16"/>
  <path d="${EAR_R}" fill="currentColor" opacity="0.16"/>
  <ellipse cx="50" cy="58" rx="33" ry="29" fill="currentColor" opacity="0.16"/>
  <ellipse cx="50" cy="62" rx="9" ry="7" fill="currentColor" opacity="0.4"/>
  <ellipse cx="36" cy="50" rx="3.6" ry="4.6" fill="currentColor" opacity="0.4"/>
  <ellipse cx="44" cy="44" rx="3.6" ry="4.8" fill="currentColor" opacity="0.4"/>
  <ellipse cx="56" cy="44" rx="3.6" ry="4.8" fill="currentColor" opacity="0.4"/>
  <ellipse cx="64" cy="50" rx="3.6" ry="4.6" fill="currentColor" opacity="0.4"/>`;
}

function headMarkup(cat: CatDef, clipId: string): string {
  const eye2 = cat.eyeColor2 ?? cat.eyeColor;
  let pattern = "";
  if (cat.pattern === "tabby") {
    pattern = `
  <g clip-path="url(#${clipId})" stroke="${cat.patternColor}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.9">
    <path d="M38 32 Q41 41 38 50"/>
    <path d="M50 28 L50 50"/>
    <path d="M62 32 Q59 41 62 50"/>
    <path d="M21 46 L30 52"/>
    <path d="M79 46 L70 52"/>
  </g>`;
  } else if (cat.pattern === "patch") {
    pattern = `
  <g clip-path="url(#${clipId})" fill="${cat.patternColor}">
    <ellipse cx="30" cy="44" rx="15" ry="18" transform="rotate(-18 30 44)"/>
    <ellipse cx="69" cy="72" rx="12" ry="10" transform="rotate(12 69 72)"/>
  </g>`;
  } else if (cat.pattern === "tuxedo") {
    pattern = `
  <path d="M31 64 Q50 94 69 64 Q69 84 50 90 Q31 84 31 64 Z" fill="${cat.patternColor}"/>`;
  }

  return `
  <defs>
    <clipPath id="${clipId}">${HEAD_ELLIPSE}</clipPath>
  </defs>
  <path d="${EAR_L}" fill="${cat.furColor}"/>
  <path d="${EAR_R}" fill="${cat.furColor}"/>
  <path d="${EAR_L_INNER}" fill="#ffffff" opacity="0.5"/>
  <path d="${EAR_R_INNER}" fill="#ffffff" opacity="0.5"/>
  <ellipse cx="50" cy="58" rx="33" ry="29" fill="${cat.furColor}"/>
  ${pattern}
  <circle cx="38" cy="56" r="7" fill="${cat.eyeColor}"/>
  <circle cx="62" cy="56" r="7" fill="${eye2}"/>
  <ellipse cx="38" cy="56" rx="2.4" ry="6" fill="#1a1a1a"/>
  <ellipse cx="62" cy="56" rx="2.4" ry="6" fill="#1a1a1a"/>
  <circle cx="36" cy="53" r="1.3" fill="#ffffff" opacity="0.9"/>
  <circle cx="60" cy="53" r="1.3" fill="#ffffff" opacity="0.9"/>
  <path d="M47 66 L53 66 L50 70 Z" fill="#e8879a"/>
  <path d="M50 70 Q50 74 44 75" stroke="#33343a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M50 70 Q50 74 56 75" stroke="#33343a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <g stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity="0.32">
    <path d="M14 58 L26 56"/>
    <path d="M13 65 L26 62"/>
    <path d="M86 58 L74 56"/>
    <path d="M87 65 L74 62"/>
  </g>`;
}

export function catAvatarSvg(cat: CatDef, locked = false): string {
  const clipId = `cat-clip-${uid++}`;
  if (locked) {
    return `
<svg viewBox="0 0 100 100" class="cat-svg cat-locked" aria-hidden="true">${lockedHeadMarkup()}
</svg>`.trim();
  }
  return `
<svg viewBox="0 0 100 100" class="cat-svg" aria-hidden="true">${headMarkup(cat, clipId)}
</svg>`.trim();
}

/** Oturan pozda tam gövde illüstrasyonu: gövde + kuyruk + ön patiler,
 * üstte aynı baş çizimiyle. Hikaye ekranları ve kedi detayı için. */
export function catFullBodySvg(cat: CatDef, locked = false): string {
  const clipId = `cat-body-clip-${uid++}`;

  if (locked) {
    return `
<svg viewBox="0 0 100 150" class="cat-svg cat-full-body cat-locked" aria-hidden="true">
  <path d="M74 132 Q95 122 91 94 Q88 74 70 70" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" opacity="0.16"/>
  <ellipse cx="50" cy="118" rx="30" ry="34" fill="currentColor" opacity="0.16"/>
  <ellipse cx="37" cy="146" rx="10" ry="11" fill="currentColor" opacity="0.16"/>
  <ellipse cx="63" cy="146" rx="10" ry="11" fill="currentColor" opacity="0.16"/>${lockedHeadMarkup()}
</svg>`.trim();
  }

  let bodyPattern = "";
  let pawPattern = "";
  if (cat.pattern === "tuxedo") {
    bodyPattern = `<path d="M28 106 Q50 148 72 106 Q75 132 50 142 Q25 132 28 106 Z" fill="${cat.patternColor}"/>`;
    pawPattern = `<ellipse cx="37" cy="148" rx="6.5" ry="6" fill="${cat.patternColor}"/><ellipse cx="63" cy="148" rx="6.5" ry="6" fill="${cat.patternColor}"/>`;
  } else if (cat.pattern === "patch") {
    bodyPattern = `<ellipse cx="67" cy="110" rx="12" ry="17" transform="rotate(10 67 110)" fill="${cat.patternColor}"/>`;
  } else if (cat.pattern === "tabby") {
    bodyPattern = `
  <g stroke="${cat.patternColor}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.85">
    <path d="M36 94 Q34 108 37 122"/>
    <path d="M64 94 Q66 108 63 122"/>
  </g>`;
  }

  return `
<svg viewBox="0 0 100 150" class="cat-svg cat-full-body" aria-hidden="true">
  <path d="M74 132 Q95 122 91 94 Q88 74 70 70" fill="none" stroke="${cat.furColor}" stroke-width="9" stroke-linecap="round"/>
  <ellipse cx="50" cy="118" rx="30" ry="34" fill="${cat.furColor}"/>
  ${bodyPattern}
  <ellipse cx="37" cy="146" rx="10" ry="11" fill="${cat.furColor}"/>
  <ellipse cx="63" cy="146" rx="10" ry="11" fill="${cat.furColor}"/>
  ${pawPattern}${headMarkup(cat, clipId)}
</svg>`.trim();
}
