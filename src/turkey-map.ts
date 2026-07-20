// Stilize edilmiş "Anadolu Haritası" ekranı için geometri.
//
// Gerçek sınır/coğrafya verisi kullanılmaz (harici veri kaynağı ya da telif
// riski yok) — sadece Duman'ın yolculuğuna yön hissi katan, elle çizilmiş
// yumuşak bir silüet ve bölgelerin yaklaşık göreli konumları. bkz. TASARIM.md.

type Point = [number, number];

const OUTLINE_POINTS: Point[] = [
  [8, 22],
  [18, 13],
  [45, 6],
  [75, 4],
  [105, 7],
  [132, 10],
  [153, 14],
  [178, 30],
  [186, 46],
  [182, 62],
  [172, 75],
  [153, 83],
  [124, 86],
  [95, 88],
  [66, 84],
  [42, 79],
  [24, 68],
  [14, 52],
  [9, 36],
];

function mid(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** Köşeleri yuvarlatılmış kapalı bir eğri (basit quadratic-through-midpoint). */
function smoothClosedPath(pts: Point[]): string {
  const n = pts.length;
  const start = mid(pts[n - 1], pts[0]);
  let d = `M ${start[0]} ${start[1]}`;
  for (let i = 0; i < n; i++) {
    const next = pts[(i + 1) % n];
    const m = mid(pts[i], next);
    d += ` Q ${pts[i][0]} ${pts[i][1]} ${m[0]} ${m[1]}`;
  }
  return d + " Z";
}

export const MAP_VIEWBOX = { width: 196, height: 92 };
export const OUTLINE_PATH = smoothClosedPath(OUTLINE_POINTS);

/** Duman'ın yolculuğa başladığı yer. */
export const ISTANBUL_POS: Point = [34, 15];

/** Bölge adına göre yaklaşık harita konumu (gerçek enlem/boylamdan
 * ölçeklenmiş, coğrafi olarak kesin değil — sadece yönü doğru). Birbirine
 * yakın iller (ör. Trabzon/Rize) pim çakışmasını önlemek için hafifçe
 * aralıklandırıldı. */
const REGION_POS: Record<string, Point> = {
  Van: [178, 50],
  Ankara: [75, 33],
  İzmir: [21, 53],
  Antalya: [55, 73],
  Trabzon: [133, 16],
  Kapadokya: [93, 51],
  Şanlıurfa: [130, 74],
  Bursa: [42, 33],
  Konya: [72, 60],
  Rize: [152, 12],
  Mardin: [155, 66],
  Çanakkale: [15, 30],
  Gaziantep: [108, 78],
  Erzurum: [158, 30],
  Sinop: [98, 5],
};

export function regionPos(region: string): Point {
  return REGION_POS[region] ?? [98, 46];
}

export function percentPos(p: Point): { left: string; top: string } {
  return {
    left: `${(p[0] / MAP_VIEWBOX.width) * 100}%`,
    top: `${(p[1] / MAP_VIEWBOX.height) * 100}%`,
  };
}
