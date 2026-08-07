import "@fontsource-variable/nunito/index.css";
import "./style.css";
import { App } from "./ui.ts";
import { puzzles, warmPuzzles } from "./puzzles/index.ts";
import { dailyIndex } from "./stats.ts";
import { initTheme } from "./theme.ts";
import { initAds } from "./ads.ts";
import { initReferral } from "./referral.ts";
import { ensureMusicStarted } from "./music.ts";
import { restoreAdsRemoved } from "./billing.ts";
import { initCloudSave } from "./cloud-ui.ts";

initTheme();
void initAds();
void initReferral();
void restoreAdsRemoved();
// Tarayıcı/WebView autoplay politikası gereği müzik ancak gerçek bir
// kullanıcı jestinden sonra başlayabilir; ilk dokunuşta bir kez tetiklenir.
document.addEventListener("pointerdown", () => ensureMusicStarted(), { once: true });
// İlk ekran anlık açılsın diye ilk bulmacaları (+ günün bulmacasını) hemen
// yükler; geri kalanı arka planda (bkz. warmPuzzles) indirilir.
await warmPuzzles(dailyIndex(puzzles.length));
const root = document.querySelector<HTMLDivElement>("#app")!;
// Bulut kaydı senkronu açılışı BEKLETMEZ (kötü ağda 7 saniyeye kadar
// sürebilir); splash ve oyun normal akışında ilerler, cevap gelince gerekiyorsa
// araya girer (bkz. cloud-ui.ts).
void initCloudSave(root);
const app = new App(root, puzzles);
app.attachPhysicalKeyboard();
attachAndroidBackButton(app);
app.start();

/**
 * Android geri tuşunu uygulama içi gezinmeye bağlar.
 *
 * Bir dinleyici KAYDEDİLMEDİĞİ sürece Capacitor geri tuşunu doğrudan
 * uygulamayı kapatmaya çevirir — oyuncu bulmacanın ortasındayken bile.
 * Karar mantığı App.handleBack()'te; burada yalnızca eklentiye bağlanıyor.
 *
 * Eklenti yoksa (tarayıcıda çalışırken) import başarısız olur ve sessizce
 * geçilir — ads.ts/billing.ts'teki "eklenti yoksa no-op" deyiminin aynısı.
 */
function attachAndroidBackButton(instance: App): void {
  void import("@capacitor/app")
    .then(({ App: CapApp }) => {
      void CapApp.addListener("backButton", () => {
        if (instance.handleBack()) void CapApp.exitApp();
      });
    })
    .catch(() => {
      /* tarayıcıda geri tuşu diye bir şey yok */
    });
}
