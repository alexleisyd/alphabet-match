# Store listing

The text and the form answers for both stores, kept here rather than only in
the consoles so the wording is versioned alongside the app it describes. When
a claim below stops being true — an ad, a network call, a new age band — this
file, the Data Safety form, `AndroidManifest.xml` and the privacy policy all
have to change together.

Character limits are the stores'; the counts in brackets are what the text
below actually is.

Images come from `npm run screenshots` and `npm run artwork`, into `store/`:

| Upload slot | File | Required |
| --- | --- | --- |
| Play store icon | `store/play-icon-512.png` (512×512) | yes |
| Play feature graphic | `store/feature-graphic.png` (1024×500) | yes |
| Play phone screenshots | `store/android-phone/` (1236×2748) | yes, min 2 |
| Play tablet screenshots | `store/android-tablet/` (1600×2560) | no, but expected |
| App Store iPhone | `store/iphone-6.9/` (1320×2868) | yes |
| App Store iPad | `store/ipad-13/` (2064×2752) | yes |
| App Store app icon | — | reads it from the build |

---

## Both stores

**App name** — `Alphabet Match` [14; Play allows 30, Apple 30]

**Privacy policy** — https://www.lionforce.com.au/privacy/alphabet-match

**Category** — Education. (Not Games: both stores rank Education against other
learning apps, which is the shelf a parent searching "letters for toddlers" is
actually looking at.)

---

## Google Play

### Short description [80 max]

> Letters and pictures for preschoolers. No ads, no internet, a real voice.

[73]

### Full description [4000 max]

> Alphabet Match is a letter game for children who are still learning what the
> letters look like — roughly ages three to five.
>
> A letter appears, a friendly voice names it, and two to four hand-drawn
> pictures wait underneath. Tap the one that starts with it. That's the whole
> game. Get it right and the word is spelled out, a star drops into the jar,
> and the next round begins.
>
> **It listens to how it's going.** Rounds start with two cards and a small set
> of easy-to-tell-apart letters. As your child gets them right the choice
> widens; a run of misses narrows it again. Later on the rounds turn around —
> the picture asks and the letters answer. Letters that sound alike, like C and
> K or G and J, are never offered against each other.
>
> **A real voice, not a robot.** Every line in the game is recorded — 458 of
> them. Nothing is read out by the phone's text-to-speech.
>
> **26 letters, 99 pictures**, every one drawn by hand for this game.
>
> **A sticker book that fills up.** Each new word your child finds is kept, and
> the jar of stars and the book of stickers are there to look through between
> rounds. The sky above the game is worth poking too — the clouds, the sun, the
> kite and the plane all do something.
>
> **For grown-ups**, behind a press-and-hold on the sticker book's title, where
> small fingers won't find it: set your child's name so the game uses it, or
> narrow the game to the handful of letters you're working on this week.
>
> **What it doesn't do**
>
> No ads. No in-app purchases. No accounts, no sign-in, no email address. No
> videos, no links out, nothing to buy and nowhere to wander off to.
>
> It doesn't use the internet at all. The app asks for no network access — the
> permission isn't in it — so it works the same on a plane as it does at home.
> Nothing your child does is sent anywhere, because there is no "anywhere" for
> it to go: the stars and stickers are saved on the device and stay there.

[~1,890]

### Content rating (IARC questionnaire)

Category: **Utility, Productivity, Communication or Other** → the education
branch. Then, in order, the honest answers:

| Question | Answer |
| --- | --- |
| Violence (any kind, cartoon included) | No |
| Sexuality or nudity | No |
| Bad language | No |
| Controlled substances (drugs, alcohol, tobacco) | No |
| Gambling, real or simulated | No |
| Horror or fear themes | No |
| Users can interact / exchange content | No |
| Shares user's location | No |
| Allows purchase of digital goods | No |
| Contains ads | No |
| Shares personal information with third parties | No |

Expected result: **PEGI 3 / ESRB Everyone / ACB G / USK 0**.

### Data safety

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **No** |
| Is all data encrypted in transit? | n/a — nothing leaves the device |
| Do you provide a way to request data deletion? | n/a — nothing is collected |
| Does your app use an advertising ID? | **No** |

The one that looks like a trap and isn't: the game does store the child's name
if a parent types one in, plus the stars and sticker book. Play's definition of
"collected" is data **transmitted off the device**, and none of this is —
it lives in the app's own storage and goes when the app does. So the answer is
genuinely No, not a technicality. The empty `<uses-permission>` list in
`AndroidManifest.xml` is the evidence.

One thing that looks like a contradiction if you go looking: `aapt2 dump
permissions` on a release build reports a permission called
`au.com.lionforce.alphabetmatch.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`.
That is not a platform permission and grants nothing outside the app — it is
declared *by* the app, at `signature` protection level, by androidx.core, so
that a broadcast receiver it registers can't be reached by other apps. Every
androidx app has one. No `android.permission.*` is requested; INTERNET in
particular is absent, which is the claim that matters here.

### Target audience and content

- **Target age groups:** *Ages 5 and under* only. Adding a second band would
  put the listing in front of an audience the content doesn't suit and drags
  in extra declarations for no gain.
- **Appeals to children:** Yes. This puts the app under the Families policy —
  which it already meets: privacy policy published, no ads, no ad ID, no data
  collection, content rated for everyone.
- **Designed for Families:** opt in. It is the shelf parents browse, and the
  requirements are ones the app already satisfies.
- **Ads:** No, this app does not contain ads.
- **News app / COVID app / Government app:** No to each.

### Release

Signed bundle: `npm run aab` (see `android/keystore.properties.example` first).
Use **Play App Signing** — Google holds the key users' installs are verified
against and the keystore you keep is only the upload key, so losing it is a
support ticket rather than the end of the listing.

Start in **Internal testing**, install from the Play link on a real phone, then
promote the same bundle to Production. Families listings get a human review;
allow days, not hours.

---

## Apple App Store

Blocked until the Developer Program membership clears. Fields differ enough
from Play's that the copy is not simply reused.

**Subtitle** [30 max]

> Letters and pictures to match

[29]

**Promotional text** [170 max, editable without a new build]

> A letter, a voice, and a few hand-drawn pictures to choose from. No ads,
> nothing to buy, and it never touches the internet.

[123]

**Keywords** [100 max, comma-separated; don't repeat words already in the app
name — Apple indexes those separately and the space is wasted]

> `abc,letters,preschool,toddler,phonics,learning,kids,offline,literacy,spelling,reading,nursery`

[93]

**Description** — the Play full description above reads correctly here as well,
with one edit: the paragraph about Android permissions should say *"It doesn't
use the internet at all — there is no network code in it, so it works the same
on a plane as it does at home."*

**Age rating** — 4+. Every questionnaire answer is None/No.

**Kids Category** — *Ages 5 and under*. Worth taking: it is the section parents
browse, and its rules are ones the app already keeps (no behavioural ads, no
third-party analytics, and a parental gate before any link out — of which there
are none).

**App Privacy** — *Data Not Collected*, for the same reason as Play's.

**Sign-in required** — No. **Demo account** — not needed.

**Copyright** — `2026 Lion Force`

---

## Still open

- **Support URL.** Both stores require a reachable one and there isn't a page
  for it yet; `lionforce.com.au` on its own is accepted if it plausibly leads
  somewhere useful, but a page beside the privacy policy would be better.
- **Marketing URL** (Apple, optional) — same question.
- The App Store's own screenshots are already generated (`store/iphone-6.9`,
  `store/ipad-13`) and will keep until the membership clears.
