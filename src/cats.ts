// Cat theme: as the player solves puzzles, "guardian cats" join the
// collection. Story: Duman sets out from the streets of Istanbul in search
// of Anatolia's guardian cats. Each cat represents a region and carries a
// short bit of lore about it.
//
// Unlock model: each cat unlocks once the total number of (distinct)
// solved puzzles reaches its own threshold (unlockAt). The thresholds are
// spaced out to build a long journey: the last cat unlocks at puzzle 60 —
// roughly a two-month adventure for a player solving one puzzle a day.

export interface CatDef {
  /** Total number of solved puzzles required to unlock this cat */
  unlockAt: number;
  name: string;
  region: string;
  breed: string;
  /** Short lore/info note shown on the collection screen */
  lore: string;
}

/** The story's narrator and the player's guide; not part of the collection. */
export const DUMAN: CatDef = {
  unlockAt: 0,
  name: "Duman",
  region: "İstanbul",
  breed: "İstanbul sokak kedisi",
  lore:
    "İstanbul'un rıhtımlarında büyümüş, meraklı ve konuşkan bir sokak kedisi. " +
    "Koca Baba'nın anlattığı bekçi kedileri efsanesini duyunca çantasını (yok, patisini) toplayıp yola çıktı.",
};

export const CATS: CatDef[] = [
  {
    unlockAt: 2,
    name: "Pamuk",
    region: "Van",
    breed: "Van kedisi",
    lore:
      "Van Gölü kıyısında doğar doğmaz yüzmeyi öğrenmiş; biri gök mavisi biri " +
      "kehribar renginde gözleriyle tanınır. Duman'a gölün efsanelerini anlattı.",
  },
  {
    unlockAt: 6,
    name: "Bulut",
    region: "Ankara",
    breed: "Ankara kedisi",
    lore:
      "İpeksi beyaz tüyleri ve zarif duruşuyla başkentin en havalı kedisi. " +
      "Duman'a Anıtkabir'in nöbetçi kedisi olduğunu gururla söyledi.",
  },
  {
    unlockAt: 10,
    name: "Fıstık",
    region: "İzmir",
    breed: "Ege sokak kedisi",
    lore:
      "Kordon'da balıkçı teknelerinin arasında dolaşır, güneşte uzanmayı sever. " +
      "Duman'a zeytin ağaçlarının gölgesindeki en iyi uyku yerlerini gösterdi.",
  },
  {
    unlockAt: 14,
    name: "Yasemin",
    region: "Antalya",
    breed: "Akdeniz kedisi",
    lore:
      "Portakal bahçelerinde büyümüş, krem tüylü ve sakin bir kedi. " +
      "Duman'a turunç kokulu sokaklarda saklanan en tatlı gölgeleri gösterdi.",
  },
  {
    unlockAt: 18,
    name: "Fındık",
    region: "Trabzon",
    breed: "Karadeniz kedisi",
    lore:
      "Yağmurdan hiç kaçmaz, çay bahçelerinde dolaşmayı sever. " +
      "Duman'a bulutların arasından deniz nasıl görünür, onu öğretti.",
  },
  {
    unlockAt: 22,
    name: "Gri Dede",
    region: "Kapadokya",
    breed: "Peri bacası kedisi",
    lore:
      "Yeraltı şehirlerinin ve peri bacalarının arasında dolaşan gizemli, gri " +
      "tüylü bir kedi. Duman'a taşların içindeki eski hikayeleri fısıldadı.",
  },
  {
    unlockAt: 26,
    name: "Kum",
    region: "Şanlıurfa",
    breed: "Güneydoğu kedisi",
    lore:
      "Balıklıgöl'ün etrafında dolaşan, kum rengi ve sabırlı bir kedi. " +
      "Duman'a akşam ezanıyla birlikte şehrin nasıl sessizleştiğini gösterdi.",
  },
  {
    unlockAt: 30,
    name: "Zeytin",
    region: "Bursa",
    breed: "Marmara kedisi",
    lore:
      "İpek pazarının dar sokaklarında yaşayan, siyah-beyaz benekli bir kedi. " +
      "Duman'a dağın tepesindeki karı ilk kez ondan öğrendi.",
  },
  {
    unlockAt: 34,
    name: "Şeker",
    region: "Konya",
    breed: "İç Anadolu kedisi",
    lore:
      "Mevlana Türbesi'nin avlusunda ağır ağır dönen, huzurlu ve beyaz tüylü " +
      "bir kedi. Duman'a sabrın da bir hikaye olduğunu öğretti.",
  },
  {
    unlockAt: 38,
    name: "Yayla",
    region: "Rize",
    breed: "Doğu Karadeniz kedisi",
    lore:
      "Çay tarlalarının en yükseğinde yaşayan, kahverengi çizgili bir bekçi " +
      "kedi. Duman'a bulutların içinde yürümenin nasıl bir his olduğunu gösterdi.",
  },
  {
    unlockAt: 42,
    name: "Nar",
    region: "Mardin",
    breed: "Mezopotamya kedisi",
    lore:
      "Taş evlerin damından dama atlayan, altın sarısı çizgili bir kedi. " +
      "Duman'a Mardin'in yedi dilde birden selamlaştığını anlattı.",
  },
  {
    unlockAt: 46,
    name: "İnci",
    region: "Çanakkale",
    breed: "Boğaz kedisi",
    lore:
      "Boğaz'dan geçen gemileri sahilden izlemeyi seven, inci beyazı bir " +
      "kedi. Duman'a Troya'nın atının hâlâ orada durduğunu fısıldadı.",
  },
  {
    unlockAt: 50,
    name: "Baklava",
    region: "Gaziantep",
    breed: "Antep kedisi",
    lore:
      "Bakırcılar Çarşısı'nın kokularına âşık, karamel renkli benekli bir " +
      "kedi. Duman'a fıstığın toprağa nasıl teşekkür ettiğini anlattı.",
  },
  {
    unlockAt: 55,
    name: "Kar",
    region: "Erzurum",
    breed: "Doğu Anadolu kedisi",
    lore:
      "Palandöken'in eteklerinde karda oynamayı seven, bembeyaz bir kedi. " +
      "Duman'a soğuğun içinde bile sıcak bir dost bulunabileceğini öğretti.",
  },
  {
    unlockAt: 60,
    name: "Fener",
    region: "Sinop",
    breed: "Sinop kedisi",
    lore:
      "Anadolu'nun en kuzey ucundaki deniz fenerinin dibinde yaşayan, deniz " +
      "griyle beyazı karışık son bekçi kedi. Duman'ın yolculuğu onunla " +
      "tamamlanır — Anadolu artık uçtan uca bir aile.",
  },
];

/** Dative case of region names (for "toward -a/-e" sentences). Turkish vowel
 * harmony / helper consonant rules aren't produced by a general algorithm
 * — since the fixed region list is small, keeping a hand-written, error-free
 * table is safer. */
const REGION_DATIVE: Record<string, string> = {
  İstanbul: "İstanbul'a",
  Van: "Van'a",
  Ankara: "Ankara'ya",
  İzmir: "İzmir'e",
  Antalya: "Antalya'ya",
  Trabzon: "Trabzon'a",
  Kapadokya: "Kapadokya'ya",
  Şanlıurfa: "Şanlıurfa'ya",
  Bursa: "Bursa'ya",
  Konya: "Konya'ya",
  Rize: "Rize'ye",
  Mardin: "Mardin'e",
  Çanakkale: "Çanakkale'ye",
  Gaziantep: "Gaziantep'e",
  Erzurum: "Erzurum'a",
  Sinop: "Sinop'a",
};

export function regionDative(region: string): string {
  return REGION_DATIVE[region] ?? `${region}'a`;
}

/** Is this cat unlocked for a player who has solved `solved` puzzles? */
export function catUnlocked(cat: CatDef, solved: number): boolean {
  return solved >= cat.unlockAt;
}

/** The cat that unlocks at exactly this solve count (undefined if none). */
export function catUnlockedAt(solved: number): CatDef | undefined {
  return CATS.find((c) => c.unlockAt === solved);
}

/** The next locked cat (undefined if all are unlocked). */
export function nextLockedCat(solved: number): CatDef | undefined {
  return CATS.find((c) => c.unlockAt > solved);
}

/** Have all guardian cats been collected? */
export function allCatsUnlocked(solved: number): boolean {
  return CATS.every((c) => catUnlocked(c, solved));
}
