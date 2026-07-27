# Store / Marketing Görselleri

Store listing, feature graphic, ikon, ekran görüntüsü gibi pazarlama görselleri
**asla bu public repo'ya commit edilmez**. Bunun yerine iki yere kaydedilir:

1. Yerel, gitignore'lu kopya: `docs/store-assets-originals/` (bu klasör `.gitignore`'da,
   asla git'e girmez).
2. Private yedek repo: `C:\Projects\pictures\cengeBulmaca\` — bu, `Eren-Ozcan/pictures`
   adlı ayrı bir private GitHub reposunun yerel clone'u. Yeni/güncel bir görsel eklenince
   oraya da kopyalanıp o repoda commit + push edilmeli.

Yeni bir store görseli eklenirken/güncellenirken: dosyayı hem
`docs/store-assets-originals/` hem `C:\Projects\pictures\cengeBulmaca\` içine koy,
sonra `pictures` reposunda commit+push yap. `docs/store-assets/` klasöründeki
(tracked, public) dosyaları güncellemek istersen bunu ayrıca ve bilinçli olarak yap —
onlar zaten repo geçmişinde public.

## Stüdyo geneli bilgiler

Google hesabı, Play Console geliştirici hesabı, yilkgames.com/yilkgames_web durumu
gibi stüdyo geneli (bu oyuna özel olmayan) sorular için `C:\Projects\pictures\STUDIO.md`
tek kaynak — burada tekrarlanmaz.
