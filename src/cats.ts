// Kedi teması: her bulmacayı çözünce bir "bekçi kedi" koleksiyona katılır.
// Hikaye: Duman, İstanbul sokaklarından çıkıp Anadolu'nun bekçi kedilerini
// arıyor. Her kedi bir bölgeyi ve o bölgenin kısa bir bilgisini taşıyor.

export type CatPattern = "solid" | "tabby" | "patch" | "tuxedo";

export interface CatDef {
  /** Bu kediyi açan bulmacanın id'si */
  puzzleId: string;
  name: string;
  region: string;
  breed: string;
  /** Koleksiyon ekranında görünen kısa hikaye/bilgi notu */
  lore: string;
  furColor: string;
  /** Desene göre ikincil renk (patch/tuxedo alanları) */
  patternColor: string;
  pattern: CatPattern;
  eyeColor: string;
  /** Van kedisi gibi heterokromik gözler için ikinci göz rengi */
  eyeColor2?: string;
}

/** Hikayenin anlatıcısı ve oyuncunun rehberi; koleksiyona dahil değil. */
export const DUMAN: CatDef = {
  puzzleId: "",
  name: "Duman",
  region: "İstanbul",
  breed: "İstanbul sokak kedisi",
  lore:
    "İstanbul'un rıhtımlarında büyümüş, meraklı ve konuşkan bir sokak kedisi. " +
    "Koca Baba'nın anlattığı bekçi kedileri efsanesini duyunca çantasını (yok, patisini) toplayıp yola çıktı.",
  furColor: "#5b5f68",
  patternColor: "#ffffff",
  pattern: "tuxedo",
  eyeColor: "#3fae6a",
};

export const CATS: CatDef[] = [
  {
    puzzleId: "bulmaca-1",
    name: "Pamuk",
    region: "Van",
    breed: "Van kedisi",
    lore:
      "Van Gölü kıyısında doğar doğmaz yüzmeyi öğrenmiş; biri gök mavisi biri " +
      "kehribar renginde gözleriyle tanınır. Duman'a gölün efsanelerini anlattı.",
    furColor: "#f4f1ea",
    patternColor: "#e08a3c",
    pattern: "patch",
    eyeColor: "#4f9fe0",
    eyeColor2: "#e0a63c",
  },
  {
    puzzleId: "bulmaca-2",
    name: "Bulut",
    region: "Ankara",
    breed: "Ankara kedisi",
    lore:
      "İpeksi beyaz tüyleri ve zarif duruşuyla başkentin en havalı kedisi. " +
      "Duman'a Anıtkabir'in nöbetçi kedisi olduğunu gururla söyledi.",
    furColor: "#f7f6f2",
    patternColor: "#dcd8cc",
    pattern: "solid",
    eyeColor: "#6bbf8a",
  },
  {
    puzzleId: "bulmaca-3",
    name: "Fıstık",
    region: "İzmir",
    breed: "Ege sokak kedisi",
    lore:
      "Kordon'da balıkçı teknelerinin arasında dolaşır, güneşte uzanmayı sever. " +
      "Duman'a zeytin ağaçlarının gölgesindeki en iyi uyku yerlerini gösterdi.",
    furColor: "#e8a355",
    patternColor: "#c97b2e",
    pattern: "tabby",
    eyeColor: "#e0b23c",
  },
  {
    puzzleId: "bulmaca-4",
    name: "Yasemin",
    region: "Antalya",
    breed: "Akdeniz kedisi",
    lore:
      "Portakal bahçelerinde büyümüş, krem tüylü ve sakin bir kedi. " +
      "Duman'a turunç kokulu sokaklarda saklanan en tatlı gölgeleri gösterdi.",
    furColor: "#f1e4c8",
    patternColor: "#e3d2a8",
    pattern: "solid",
    eyeColor: "#4f9fe0",
  },
  {
    puzzleId: "bulmaca-5",
    name: "Fındık",
    region: "Trabzon",
    breed: "Karadeniz kedisi",
    lore:
      "Yağmurdan hiç kaçmaz, çay bahçelerinde dolaşmayı sever. " +
      "Duman'a bulutların arasından deniz nasıl görünür, onu öğretti.",
    furColor: "#2b2d33",
    patternColor: "#f7f6f2",
    pattern: "tuxedo",
    eyeColor: "#4fae6b",
  },
  {
    puzzleId: "bulmaca-6",
    name: "Gri Dede",
    region: "Kapadokya",
    breed: "Peri bacası kedisi",
    lore:
      "Yeraltı şehirlerinin ve peri bacalarının arasında dolaşan gizemli, gri " +
      "tüylü bir kedi. Duman'a taşların içindeki eski hikayeleri fısıldadı.",
    furColor: "#8b93a1",
    patternColor: "#6b727e",
    pattern: "solid",
    eyeColor: "#e0b23c",
  },
  {
    puzzleId: "bulmaca-7",
    name: "Kum",
    region: "Şanlıurfa",
    breed: "Güneydoğu kedisi",
    lore:
      "Balıklıgöl'ün etrafında dolaşan, kum rengi ve sabırlı bir kedi. " +
      "Duman'a akşam ezanıyla birlikte şehrin nasıl sessizleştiğini gösterdi.",
    furColor: "#d9bd8f",
    patternColor: "#c4a06a",
    pattern: "tabby",
    eyeColor: "#c4813c",
  },
  {
    puzzleId: "bulmaca-8",
    name: "Zeytin",
    region: "Bursa",
    breed: "Marmara kedisi",
    lore:
      "İpek pazarının dar sokaklarında yaşayan, siyah-beyaz benekli bir kedi. " +
      "Duman'a dağın tepesindeki karı ilk kez ondan öğrendi.",
    furColor: "#232428",
    patternColor: "#f7f6f2",
    pattern: "patch",
    eyeColor: "#e0b23c",
  },
  {
    puzzleId: "bulmaca-9",
    name: "Şeker",
    region: "Konya",
    breed: "İç Anadolu kedisi",
    lore:
      "Mevlana Türbesi'nin avlusunda ağır ağır dönen, huzurlu ve beyaz tüylü " +
      "bir kedi. Duman'a sabrın da bir hikaye olduğunu öğretti.",
    furColor: "#f7f3ea",
    patternColor: "#e6ddc8",
    pattern: "solid",
    eyeColor: "#4f9fe0",
  },
  {
    puzzleId: "bulmaca-10",
    name: "Yayla",
    region: "Rize",
    breed: "Doğu Karadeniz kedisi",
    lore:
      "Çay tarlalarının en yükseğinde yaşayan, kahverengi çizgili bir bekçi " +
      "kedi. Duman'a bulutların içinde yürümenin nasıl bir his olduğunu gösterdi.",
    furColor: "#8a5a35",
    patternColor: "#5e3c22",
    pattern: "tabby",
    eyeColor: "#4fae6b",
  },
  {
    puzzleId: "bulmaca-11",
    name: "Nar",
    region: "Mardin",
    breed: "Mezopotamya kedisi",
    lore:
      "Taş evlerin damından dama atlayan, altın sarısı çizgili bir kedi. " +
      "Duman'a Mardin'in yedi dilde birden selamlaştığını anlattı.",
    furColor: "#d9b26a",
    patternColor: "#a97a3c",
    pattern: "tabby",
    eyeColor: "#c4813c",
  },
  {
    puzzleId: "bulmaca-12",
    name: "İnci",
    region: "Çanakkale",
    breed: "Boğaz kedisi",
    lore:
      "Boğaz'dan geçen gemileri sahilden izlemeyi seven, inci beyazı bir " +
      "kedi. Duman'a Troya'nın atının hâlâ orada durduğunu fısıldadı.",
    furColor: "#f2efe6",
    patternColor: "#dcd8cc",
    pattern: "solid",
    eyeColor: "#4f9fe0",
  },
  {
    puzzleId: "bulmaca-13",
    name: "Baklava",
    region: "Gaziantep",
    breed: "Antep kedisi",
    lore:
      "Bakırcılar Çarşısı'nın kokularına âşık, karamel renkli benekli bir " +
      "kedi. Duman'a fıstığın toprağa nasıl teşekkür ettiğini anlattı.",
    furColor: "#c9903f",
    patternColor: "#8a5a24",
    pattern: "patch",
    eyeColor: "#e0b23c",
  },
  {
    puzzleId: "bulmaca-14",
    name: "Kar",
    region: "Erzurum",
    breed: "Doğu Anadolu kedisi",
    lore:
      "Palandöken'in eteklerinde karda oynamayı seven, bembeyaz bir kedi. " +
      "Duman'a soğuğun içinde bile sıcak bir dost bulunabileceğini öğretti.",
    furColor: "#f5f6f8",
    patternColor: "#dfe3e8",
    pattern: "solid",
    eyeColor: "#7fb8e0",
  },
  {
    puzzleId: "bulmaca-15",
    name: "Fener",
    region: "Sinop",
    breed: "Sinop kedisi",
    lore:
      "Anadolu'nun en kuzey ucundaki deniz fenerinin dibinde yaşayan, deniz " +
      "griyle beyazı karışık son bekçi kedi. Duman'ın yolculuğu onunla " +
      "tamamlanır — Anadolu artık uçtan uca bir aile.",
    furColor: "#7c8a94",
    patternColor: "#f2f1eb",
    pattern: "tuxedo",
    eyeColor: "#3f8fae",
  },
];

const byPuzzleId = new Map(CATS.map((c) => [c.puzzleId, c]));

export function catForPuzzle(puzzleId: string): CatDef | undefined {
  return byPuzzleId.get(puzzleId);
}
