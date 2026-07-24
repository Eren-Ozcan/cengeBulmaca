import type { CatDef } from "./cats.ts";

// Kilitli (henüz açılmamış) kediler ortak, jenerik bir siluet + pati izi
// ikonuyla gösterilir (kimlik ifşa etmez). Açılan kediler public/cats/
// altındaki gerçek portre görselleriyle (bkz. tools/process-cat-images.mjs)
// gösterilir.

const EAR_L = `M18 38 L29 6 L46 34 Z`;
const EAR_R = `M82 38 L71 6 L54 34 Z`;

const CAT_IMAGE_SLUGS: Record<string, string> = {
  Duman: "duman",
  Pamuk: "pamuk",
  Bulut: "bulut",
  Fıstık: "fistik",
  Yasemin: "yasemin",
  Fındık: "findik",
  "Gri Dede": "gri-dede",
  Kum: "kum",
  Zeytin: "zeytin",
  Şeker: "seker",
  Yayla: "yayla",
  Nar: "nar",
  İnci: "inci",
  Baklava: "baklava",
  Kar: "kar",
  Fener: "fener",
};

function catImgTag(cat: CatDef): string {
  const slug = CAT_IMAGE_SLUGS[cat.name];
  return `<img class="cat-img" src="/cats/${slug}.png" alt="${cat.name}" loading="lazy">`;
}

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

/** Küçük/orta kedi ikonu: açıksa gerçek portre görseli, kilitliyse jenerik siluet. */
export function catAvatar(cat: CatDef, locked = false): string {
  if (locked) {
    return `
<svg viewBox="0 0 100 100" class="cat-svg cat-locked" aria-hidden="true">${lockedHeadMarkup()}
</svg>`.trim();
  }
  return catImgTag(cat);
}

/** Büyük/detay görünümü için kedi görseli; açıksa gerçek portre, kilitliyse siluet. */
export function catFullBody(cat: CatDef, locked = false): string {
  if (locked) {
    return `
<svg viewBox="0 0 100 150" class="cat-svg cat-full-body cat-locked" aria-hidden="true">
  <path d="M74 132 Q95 122 91 94 Q88 74 70 70" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" opacity="0.16"/>
  <ellipse cx="50" cy="118" rx="30" ry="34" fill="currentColor" opacity="0.16"/>
  <ellipse cx="37" cy="146" rx="10" ry="11" fill="currentColor" opacity="0.16"/>
  <ellipse cx="63" cy="146" rx="10" ry="11" fill="currentColor" opacity="0.16"/>${lockedHeadMarkup()}
</svg>`.trim();
  }
  return catImgTag(cat);
}
