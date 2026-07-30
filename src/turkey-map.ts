// "Anadolu Haritası" ekranı için geometri.
//
// Silüet, kamu malı (CC0 1.0) lisanslı ülke sınırı verisinden üretildi:
// https://github.com/uyasarkocal/borders-of-turkey (lvl0-TR.geojson).
// Anakara + Trakya poligonları Douglas-Peucker ile sadeleştirilip (~200
// nokta) basit bir equirectangular projeksiyonla (enlem düzeltmeli) bu
// dosyadaki sabit SVG path'ine önceden dönüştürüldü — çalışma zamanında
// hiçbir harici veri çekilmiyor. Bölge pimleri de gerçek şehir enlem/
// boylamlarından aynı projeksiyonla hesaplandı, bu yüzden yaklaşık olarak
// coğrafi açıdan doğru konumdadır. bkz. TASARIM.md.

type Point = [number, number];

export const MAP_VIEWBOX = { width: 196, height: 89 };

export const OUTLINE_PATH =
  "M 93.13 4.11 L 95.61 4.86 L 94.58 6.38 L 96.45 9.04 L 99.33 10.12 L 104.24 9.4 L 104.99 12.29 L 107.65 15.01 L 110.21 13.31 L 118.77 17.88 L 120.53 16.48 L 122.53 18.43 L 127.3 19.42 L 137.9 16.86 L 145.58 19.34 L 154.37 15.43 L 159.22 11.47 L 168.95 12.58 L 169.77 10.73 L 172.04 10.68 L 171.84 11.9 L 175.74 14.34 L 174.99 14.97 L 176.02 15.98 L 178.13 15.94 L 178.48 17.89 L 180.52 19.18 L 181.26 22.36 L 179.21 24.98 L 180.9 28.9 L 180.31 29.69 L 186.96 30.61 L 191.89 35.28 L 189.83 34.04 L 188 38.72 L 184.23 39.15 L 186.92 46.13 L 186.94 51.9 L 188.86 52.64 L 186.15 58.32 L 190.11 60.39 L 189.79 64.02 L 192 65.78 L 191.82 67.83 L 190.14 67.33 L 186.96 70.16 L 185.78 68.47 L 186.55 66.7 L 185.18 65.67 L 180.42 66.76 L 171.78 64.87 L 169.66 67.84 L 167.38 68.33 L 165.99 65.63 L 159.32 68.64 L 151.55 68.18 L 142.14 72.89 L 135.99 74.05 L 131.02 73.5 L 126.23 70.85 L 118.42 74.4 L 114.6 74.58 L 113.58 72.8 L 110.45 71.72 L 109.22 76.21 L 110.74 79.39 L 107.66 79.74 L 107.47 82.6 L 105.81 83.23 L 105.38 84.99 L 102.87 83.48 L 103.47 82.36 L 101.49 78.76 L 105.63 74.94 L 105.74 72.52 L 103.85 70.64 L 99.32 73.43 L 100.92 73.44 L 99.36 75.33 L 97.08 75.68 L 96.19 73.88 L 95.31 73.91 L 96.92 75.42 L 90.21 72.21 L 86.27 75.25 L 83.29 79.63 L 82.36 78.54 L 80.56 80.88 L 75.12 80.83 L 71.68 82.41 L 67.54 80.51 L 63.94 75.68 L 53.7 71.56 L 49.7 71.82 L 48.93 78.31 L 47.69 79.92 L 45.63 78.55 L 40.46 80.93 L 34.63 77.63 L 34.87 75.61 L 33.7 75.61 L 34.54 73.87 L 32.9 72.89 L 32.07 75.04 L 28.17 71.29 L 27.59 72.51 L 26.2 71.72 L 26.64 73.21 L 23.86 75.39 L 23.17 74.87 L 24.56 74.29 L 23.24 73.8 L 24.81 72.27 L 20.91 72.78 L 20.39 74.14 L 17.22 73.77 L 20.01 72.17 L 23.93 72.47 L 23.81 70.69 L 25.29 70.94 L 26.88 69.1 L 16.15 70.04 L 16.15 68.05 L 18.33 68.69 L 19.77 66.21 L 18.17 66.51 L 17.77 64.38 L 15.52 65.19 L 15.77 62.13 L 13.63 61.25 L 16.02 60.33 L 16.13 57.15 L 12.24 56.5 L 11.17 54.01 L 9.51 55.54 L 5.91 53.44 L 8.75 51.35 L 7.52 51.12 L 7.75 48.1 L 9.85 50.03 L 10.33 52.85 L 10.67 51.27 L 11.68 52.29 L 15.31 51.1 L 13.08 51.31 L 10.82 48.47 L 14.26 45.57 L 11.61 44.63 L 12.37 42.7 L 9.68 40.47 L 13.02 36.65 L 4.22 37.82 L 5.36 31.26 L 6.92 30.76 L 7.62 28.59 L 11.12 25.93 L 16.46 25 L 17.9 26.94 L 21.21 27.18 L 22.4 26.29 L 20.47 25.04 L 21.13 24.32 L 23.93 24.92 L 23.15 26.58 L 34.15 26.45 L 35.13 25.51 L 31.42 24.22 L 38.77 21.58 L 43.04 21.74 L 36.19 20.79 L 33.68 18.12 L 35.27 15.35 L 55.81 16.99 L 57.47 15.92 L 57.64 14.18 L 69.45 7.6 L 77.04 5.11 L 90.91 6.09 L 93.12 4.11 Z M 16.14 4.02 L 19.12 6.67 L 23.92 5.54 L 23.45 7.72 L 25.8 11.51 L 34.78 15.23 L 33.95 17.6 L 31.94 18.82 L 25.31 17.3 L 23.16 18.71 L 18.71 18.58 L 17.3 21 L 5.25 30.46 L 6.38 28.34 L 5.77 27 L 11.99 23.56 L 4.2 22.91 L 4 21.52 L 7.12 18.83 L 6.91 14.98 L 9.96 13.66 L 9.56 10.32 L 7.08 8.16 L 9.83 5.67 L 16.08 4 Z";

/** Duman'ın yolculuğa başladığı yer. */
export const ISTANBUL_POS: Point = [33.42, 18.12];

/** Bölge adına göre harita konumu (gerçek şehir enlem/boylamından, harita
 * silüetiyle aynı projeksiyonla hesaplandı). */
const REGION_POS: Record<string, Point> = {
  Van: [177.75, 50.43],
  Ankara: [72.15, 32.02],
  İzmir: [15, 51.46],
  Antalya: [50.63, 71.02],
  Trabzon: [140.92, 18.25],
  Kapadokya: [92.17, 48.5],
  Şanlıurfa: [131.71, 67.81],
  Bursa: [34.22, 28.8],
  Konya: [68.65, 58.54],
  Rize: [148.93, 17.99],
  Mardin: [151.13, 65.75],
  Çanakkale: [7.59, 29.19],
  Gaziantep: [117.5, 68.96],
  Erzurum: [156.53, 32.41],
  Sinop: [95.18, 4.99],
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
