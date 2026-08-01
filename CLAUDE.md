# Store / Marketing Assets

Marketing assets such as the store listing, feature graphic, icon and
screenshots are **never committed to this public repo**. They are saved in two
places instead:

1. Local, gitignored copy: `docs/store-assets-originals/` (this folder is in
   `.gitignore` and never enters git).
2. Private backup repo: `C:\Projects\pictures\cengeBulmaca\` — a local clone of
   a separate private GitHub repo named `Eren-Ozcan/pictures`. Whenever a new or
   updated asset is added, it must also be copied there and committed + pushed
   in that repo.

When adding/updating a store asset: put the file in both
`docs/store-assets-originals/` and `C:\Projects\pictures\cengeBulmaca\`, then
commit + push in the `pictures` repo. If you want to update the (tracked,
public) files under `docs/store-assets/`, do that separately and deliberately —
those are already public in the repo history.

## Studio-wide information

For studio-wide questions that are not specific to this game — Google account,
Play Console developer account, yilkgames.com/yilkgames_web status and the like
— `C:\Projects\pictures\STUDIO.md` is the single source of truth; it is not
duplicated here.
