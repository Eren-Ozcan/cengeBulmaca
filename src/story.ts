// Açılış hikayesi: Duman'ın Anadolu yolculuğu. Bir kez gösterilir,
// istenirse koleksiyon ekranından tekrar okunabilir.

const KEY = "cengel-story-seen";

export const STORY_TITLE = "Duman'ın Anadolu Yolculuğu";

export const STORY_PARAGRAPHS: string[] = [
  "Duman, İstanbul'un rıhtımlarında büyümüş meraklı bir sokak kedisiydi. " +
    "Bir gece limanda yaşlı Koca Baba'yla karşılaştı.",
  "Koca Baba, Anadolu'nun her köşesinde bir \"bekçi kedi\" yaşadığını " +
    "anlattı — her biri kendi bölgesinin dilini, tarihini ve sırlarını korurmuş.",
  "Duman, bu bekçi kedileri bulup dost olmaya karar verdi. Her bulmaca, " +
    "aslında onu bir sonraki şehre taşıyan bir iz.",
  "Sen de her bulmacayı çözdükçe Duman'a bir bekçi kedi daha katılacak. " +
    "Hazırsan yola çıkalım.",
];

export function storySeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function markStorySeen(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // depolama yoksa bir sonraki açılışta tekrar gösterilir
  }
}
