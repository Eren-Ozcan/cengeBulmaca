// Bulut kaydının kullanıcıya dokunan tarafı: açılış senkronu, çakışma seçimi
// ve Ayarlar'daki "Hesabı bağla" satırı.
//
// Ayrı bir modül olmasının sebebi ui.ts'e (1800+ satır) mümkün olduğunca az
// dokunmak: ui.ts'ten tek çağrı yapılır, tüm mantık burada durur.
//
// GERİ YÜKLEMEDEN SONRA SAYFA YENİDEN YÜKLENİR. Çengel Bulmaca'nın durumu tek
// bir bellek içi nesnede değil, ~13 localStorage anahtarında ve onları TEMBEL
// okuyan sekiz ayrı modülde (stats/economy/theme/sound/music/story/tutorial/
// game) yaşıyor. Ekran çizildikten sonra bu anahtarları değiştirmek arayüzü
// eski değerlerle bırakırdı; yeniden yükleme her modülün kaydı baştan
// okumasını garanti eden tek ucuz yol. Yeniden yükleme sonrası kayıt bulutla
// aynı olduğu için döngüye girmez.
//
// Senkron açılışı BLOKLAMAZ: splash/oyun normal akışında ilerler, bulut cevabı
// geldiğinde gerekiyorsa araya girer. Kötü bir ağda oyuncu 7 saniye boş ekrana
// bakmasın diye bilinçli bir tercih.

import {
  isAccountLinkingAvailable,
  isFirebaseConfigured,
  linkWithGoogle,
  linkedAccountLabel,
} from "./firebase-app.ts";
import {
  conflictSummary,
  flushCloudSave,
  localSummary,
  maybeUploadCloudSave,
  resetForNewAccount,
  resolveKeepCloud,
  resolveKeepLocal,
  syncCloudSave,
  type CloudSummary,
  type CloudSyncResult,
} from "./cloud-save.ts";

/** Kirli kayıt kontrolü; gerçek yazma cloud-save.ts'teki kısıtlamaya tabidir. */
const UPLOAD_CHECK_MS = 30_000;

let autoUploadInstalled = false;

function el(tag: string, cls: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

let toastTimer: number | undefined;
function toast(root: HTMLElement, msg: string): void {
  root.querySelector(".toast")?.remove();
  const t = el("div", "toast", msg);
  root.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.remove(), 2600);
}

/**
 * Açılışta bir kez çağrılır (bkz. main.ts). Yapılandırma yoksa hiçbir şey
 * yapmaz; hata durumunda da sessizce yerel oyuna devam edilir.
 */
export async function initCloudSave(root: HTMLElement): Promise<void> {
  if (!isFirebaseConfigured()) return;
  installAutoUpload();
  handleSyncResult(root, await syncCloudSave());
}

function handleSyncResult(root: HTMLElement, result: CloudSyncResult): void {
  if (result === "conflict") {
    showConflict(root);
  } else if (result === "restored") {
    window.location.reload();
  } else if (result === "needs-update") {
    toast(root, "Bulut kaydın daha yeni bir sürümle oluşturulmuş. Uygulamayı güncelle.");
  }
}

/**
 * Yerel değişiklikleri buluta taşıyan iki tetikleyici:
 *  - düzenli kontrol: oyuncu uzun süre oynarken ilerleme bulutta da dursun
 *  - uygulama arka plana alınınca ZORUNLU yazma: mobilde WebView bundan sonra
 *    dondurulabilir ya da süreç öldürülebilir; kısıtlamayı atlamak şart.
 */
function installAutoUpload(): void {
  if (autoUploadInstalled) return;
  autoUploadInstalled = true;
  window.setInterval(() => maybeUploadCloudSave(), UPLOAD_CHECK_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushCloudSave();
  });
  // iOS/WebView'de sekme kapanışında visibilitychange her zaman gelmez.
  window.addEventListener("pagehide", () => flushCloudSave());
}

// ---------- çakışma ekranı ----------

function relativeTime(ms: number): string {
  if (!ms) return "zamanı bilinmiyor";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "az önce";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} dakika önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

function summaryLine(s: CloudSummary): string {
  return `${s.solved} bulmaca · ${s.streak} günlük seri · ${s.jokers} joker`;
}

/**
 * İki ilerleme arasında seçim yaptırır. Kod kendi karar VERMEZ ve otomatik
 * birleştirme yapmaz (bkz. cloud-save.ts başındaki gerekçe); seçilmeyen taraf
 * olduğu yerde durmaya devam eder, hiçbir şey silinmez.
 */
function showConflict(root: HTMLElement): void {
  const cloud = conflictSummary();
  if (!cloud) return;
  const local = localSummary();

  const overlay = el("div", "overlay");
  const modal = el("div", "modal");
  modal.appendChild(el("div", "modal-emoji", "☁️"));
  modal.appendChild(el("h2", "modal-title", "İki ilerleme bulundu"));
  modal.appendChild(
    el(
      "p",
      "modal-text",
      "Bu hesabın bulutta kayıtlı bir ilerlemesi var ve bu cihazdaki ilerlemeyle aynı değil. Hangisiyle devam etmek istersin?",
    ),
  );

  const cloudInfo = el("div", "modal-streak", `Bulut: ${summaryLine(cloud)}`);
  modal.appendChild(cloudInfo);
  modal.appendChild(el("div", "modal-cat-next", `Son güncelleme: ${relativeTime(cloud.updatedAtMs)}`));
  modal.appendChild(el("div", "modal-streak", `Bu cihaz: ${summaryLine(local)}`));

  const cloudBtn = el("button", "modal-btn", "Buluttaki ilerlemeyi getir");
  cloudBtn.addEventListener("click", () => {
    overlay.remove();
    if (resolveKeepCloud()) window.location.reload();
    else toast(root, "Bulut kaydı getirilemedi, bu cihazdaki ilerleme korundu.");
  });
  modal.appendChild(cloudBtn);

  const localBtn = el("button", "modal-btn modal-share", "Bu cihazdakiyle devam et");
  localBtn.addEventListener("click", () => {
    overlay.remove();
    void resolveKeepLocal().then(() => toast(root, "Bu cihazdaki ilerlemeyle devam ediliyor."));
  });
  modal.appendChild(localBtn);

  overlay.appendChild(modal);
  // Arka plana dokunarak kapatılamaz: seçim yapılmadan yazma serbest bırakılmaz.
  root.appendChild(overlay);
}

// ---------- ayarlar satırı ----------

/**
 * Ayarlar ekranına eklenen "Hesabı bağla" satırı. ui.ts'in tek yapması gereken
 * bunu listeye eklemek.
 */
export function cloudSettingsRow(root: HTMLElement): HTMLElement {
  const card = el("button", "puzzle-card");
  const info = el("div", "puzzle-info");
  const title = el("div", "puzzle-title", "Hesabı bağla");
  const sub = el("div", "puzzle-sub", "İlerlemen diğer cihazlarında da açılsın");
  info.appendChild(title);
  info.appendChild(sub);
  card.appendChild(el("div", "puzzle-num", "☁️"));
  card.appendChild(info);
  card.appendChild(el("div", "puzzle-badge", "›"));

  const refresh = () =>
    void linkedAccountLabel().then((label) => {
      if (!label) return;
      title.textContent = "Hesap bağlı";
      sub.textContent = label;
    });
  refresh();

  card.addEventListener("click", () => void onLinkClick(root, refresh));
  return card;
}

async function onLinkClick(root: HTMLElement, refresh: () => void): Promise<void> {
  if (await linkedAccountLabel()) {
    toast(root, "Hesabın zaten bağlı, ilerlemen buluta kaydediliyor.");
    return;
  }
  if (!isAccountLinkingAvailable()) {
    toast(root, "Hesap bağlama mobil sürümde kullanılabilir.");
    return;
  }

  toast(root, "Google hesabı seçiliyor…");
  const res = await linkWithGoogle();
  toast(root, res.msg);
  if (!res.ok) return;
  refresh();

  if (res.switched) {
    // Başka bir hesaba geçildi: cihazdaki rev sayacı ve parmak izi eski hesaba
    // aitti, artık anlamsız. Sıfırlayıp senkronu baştan çalıştırınca buluttaki
    // ilerleme ya doğrudan gelir ya da oyuncuya seçtirilir.
    resetForNewAccount();
  }
  handleSyncResult(root, await syncCloudSave());
}
