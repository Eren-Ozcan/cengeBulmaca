// Açılış hikayesi: Duman'ın Anadolu yolculuğu. Bir kez gösterilir,
// istenirse koleksiyon ekranından tekrar okunabilir.

const KEY = "cengel-story-seen";
const EPILOGUE_KEY = "cengel-epilogue-seen";

export const STORY_TITLE = "Duman'ın Anadolu Yolculuğu";

export const STORY_PARAGRAPHS: string[] = [
  "Duman, İstanbul'un rıhtımlarında büyümüş meraklı bir sokak kedisiydi. " +
    "Bir gece limanda yaşlı Koca Baba'yla karşılaştı.",
  "Koca Baba, Anadolu'nun her köşesinde bir \"bekçi kedi\" yaşadığını " +
    "anlattı — her biri kendi bölgesinin dilini, tarihini ve sırlarını korurmuş.",
  "Duman, bu bekçi kedileri bulup dost olmaya karar verdi. Her bulmaca, " +
    "aslında onu bir sonraki şehre taşıyan bir iz.",
  "Ama şehirler arası yol uzun: sen bulmaca çözdükçe Duman yol alacak ve " +
    "yeterince iz toplandığında yeni bir bekçi kediyle karşılaşacak. " +
    "On beş kedinin hepsini bulmak sabır ister — hazırsan yola çıkalım.",
];

export const EPILOGUE_TITLE = "Anadolu Artık Bir Aile";

export const EPILOGUE_PARAGRAPHS: string[] = [
  "Sinop'un deniz fenerinin dibinde Fener'le tanıştığında Duman'ın patileri " +
    "artık yorgun ama yüreği doluydu: Van'dan Sinop'a, on beş bekçi kedinin " +
    "hepsini bulmuştu.",
  "Koca Baba'nın anlattığı efsane doğruymuş — her kedi kendi bölgesinin " +
    "dilini, tarihini ve sırrını taşıyormuş. Şimdi bu sırların hepsi Duman'da.",
  "Ama asıl armağan sır değildi. İstanbul'un yalnız sokak kedisi, artık " +
    "Anadolu'nun dört bir yanında ailesi olduğunu biliyordu.",
  "Bu senin de yolculuğundu; aylar süren, altmış bulmacalık koca bir yol. " +
    "Duman ve on beş bekçi kedi adına: teşekkürler.",
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

export function epilogueSeen(): boolean {
  try {
    return localStorage.getItem(EPILOGUE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markEpilogueSeen(): void {
  try {
    localStorage.setItem(EPILOGUE_KEY, "1");
  } catch {
    // depolama yoksa bir sonraki açılışta tekrar gösterilir
  }
}
