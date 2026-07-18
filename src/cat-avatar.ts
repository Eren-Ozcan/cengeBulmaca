import type { CatDef } from "./cats.ts";

// Elle çizilmiş, tutarlı bir "kedi kafası" ikon sistemi: aynı kafa/kulak/göz
// iskeleti, kediye göre değişen tüy rengi + desen (solid/tabby/patch/tuxedo)
// + göz rengiyle (Van kedisinde heterokromik) her kedi birbirinden ayrışır.
// Kilitli (henüz açılmamış) kediler siluet + pati izi olarak gösterilir.

let uid = 0;

export function catAvatarSvg(cat: CatDef, locked = false): string {
  const clipId = `cat-clip-${uid++}`;
  const earL = `M18 38 L29 6 L46 34 Z`;
  const earR = `M82 38 L71 6 L54 34 Z`;
  const earLInner = `M25 31 L31 14 L41 30 Z`;
  const earRInner = `M75 31 L69 14 L59 30 Z`;
  const headEllipse = `<ellipse cx="50" cy="58" rx="33" ry="29"/>`;

  if (locked) {
    return `
<svg viewBox="0 0 100 100" class="cat-svg cat-locked" aria-hidden="true">
  <path d="${earL}" fill="currentColor" opacity="0.16"/>
  <path d="${earR}" fill="currentColor" opacity="0.16"/>
  <ellipse cx="50" cy="58" rx="33" ry="29" fill="currentColor" opacity="0.16"/>
  <ellipse cx="50" cy="62" rx="9" ry="7" fill="currentColor" opacity="0.4"/>
  <ellipse cx="36" cy="50" rx="3.6" ry="4.6" fill="currentColor" opacity="0.4"/>
  <ellipse cx="44" cy="44" rx="3.6" ry="4.8" fill="currentColor" opacity="0.4"/>
  <ellipse cx="56" cy="44" rx="3.6" ry="4.8" fill="currentColor" opacity="0.4"/>
  <ellipse cx="64" cy="50" rx="3.6" ry="4.6" fill="currentColor" opacity="0.4"/>
</svg>`.trim();
  }

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
<svg viewBox="0 0 100 100" class="cat-svg" aria-hidden="true">
  <defs>
    <clipPath id="${clipId}">${headEllipse}</clipPath>
  </defs>
  <path d="${earL}" fill="${cat.furColor}"/>
  <path d="${earR}" fill="${cat.furColor}"/>
  <path d="${earLInner}" fill="#ffffff" opacity="0.5"/>
  <path d="${earRInner}" fill="#ffffff" opacity="0.5"/>
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
  </g>
</svg>`.trim();
}
