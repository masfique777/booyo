# Booyo (v3.3.1)

Booyo (say "BOO-yoh") is the app, and Booyo the owl is its guide.

A small, offline, ad-free learning app for ages 2–6, built so a child who **can't read yet** can play on their own.
It's meant for learning at home (vacations, homeschooling, a quiet half hour).

## What's new in v3.3.1: privacy page and permanent web address
- **Privacy page** (`privacy.html`): plain-words privacy promise for parents (no accounts, ads, analytics or tracking; everything stays on
  the device; how to delete data; children's privacy/COPPA in plain words; contact). Linked from Parent corner → 💡 Help and the
  Parent corner footer, and saved for offline use by the service worker (cache `booyo-v3.3.1`).
- **Hosted on GitHub Pages** at https://masfique777.github.io/booyo/ (repo `masfique777/booyo`, app files only). All paths are
  relative (`./index.html`, `sw.js`, `icons/...`) and the manifest uses `start_url`/`scope` `./`, so the app works under `/booyo/`
  and at a domain root.

### Custom domain booyo.app (CNAME-ready)
Nothing in the app needs to change: every path is relative, so the same files work at https://booyo.app/ (root) and at
https://masfique777.github.io/booyo/ (which GitHub redirects to booyo.app once the domain is set). The domain was bought on Porkbun on
October 4, 2026. Steps (`/workspace/booyo-launch/switch-to-booyo-app.sh` does 2 automatically once DNS is right):
1. At Porkbun, **delete the default parking records** (an `ALIAS`/`A` for the apex and a `CNAME` for `www` to `pixie.porkbun.com`), then add DNS records for the apex `booyo.app`: four `A` records to `185.199.108.153`, `185.199.109.153`,
   `185.199.110.153`, `185.199.111.153` (and optionally `AAAA` records `2606:50c0:8000::153`, `…8001::153`, `…8002::153`, `…8003::153`),
   plus a `CNAME` record for `www` pointing to `masfique777.github.io`.
2. In the repo: Settings → Pages → Custom domain → `booyo.app` (GitHub adds a `CNAME` file containing `booyo.app`), wait for the
   DNS check, then tick **Enforce HTTPS**. Optionally verify the domain under GitHub account Settings → Pages.
3. Installed copies keep working. A site on a new address counts as a new app to the browser, so families re-install from
   https://booyo.app/ (the old github.io address redirects there). Recordings and stories saved under the old address stay
   with the old address, so ask beta families to export voice packs/stories first.

## What's new in v3.3: a softer voice, every line recordable, a calmer and simpler app
- **Softer voice (new default).** Booyo's built-in voice now speaks at 75% volume, a little slower and a little lower, and
  prefers a warmer system voice when the device has one (female or "natural"/"neural" en-US/en-GB voices; it falls back to any
  English voice). Sound effects are about half as loud. Parent corner → 🎮 **Play settings → 🔊 Booyo's voice**: **Soft (gentle)** or
  **Normal** (the v3.2 voice), a ▶ Test voice button, and under *More options* a voice picker, the speaking speed and full screen.
- **Family Voices can record every line Booyo says.** One master list of lines (`D.say`, `D.praise`, `D.tryAgain` and
  `D.voiceSections` in `data.js`, plus the letters, numbers, colors, shapes and stories already in `data.js`) drives both what
  Booyo says and what can be recorded, so a new line added to `data.js` is recordable automatically. That's **627 lines in 19 sections**:

  | Section | Lines | | Section | Lines |
  |---|---|---|---|---|
  | ⭐ Start here: most-heard lines | 14 | | 🎨 Colors & shapes | 30 |
  | 👋 Hello, goodbye & breaks | 20 | | 🃏 Matching game | 22 |
  | 🎉 Praise & try again | 9 | | 📖 Story time | 15 |
  | 🦉 Guided play: demos & help | 19 | | 🐶🌙🦆🍎🦸🌱 6 stories (pages + question) | 7+6+6+6+6+6 = 37 |
  | 🏠 Menus & games | 7 | | ✨ Make a Story (questions, choices, read-back) | 46 |
  | 🔤 Letters A–Z | 104 | | 🎵 Sing My Story | 25 |
  | 🔍 Letter games | 156 | | | |
  | 🔢 Numbers & counting | 123 | | **Total** | **627** |

  Lines that include the child's name, a letter, number, colour, word or story pick are recorded **in pieces** (the part
  before, the name/word, the part after) and joined when played, the same way the name was spliced in v3. Every piece is a line
  in the list. **Anything not recorded still uses the built-in voice.**
- **A simple recording screen despite hundreds of lines:** collapsible sections with "12 of 40 recorded" progress (the most-heard
  lines come first and stay open), a **search box**, an **"Only show lines not recorded yet"** switch, **"Record all of this section"**,
  and a big **⏺ Record next unrecorded** button. It walks through the missing lines one at a time with big **Record / ▶ Play / Next ➜**
  buttons and a 🔈 "Hear Booyo say it" button, and it remembers where you are.
- **Voice packs:** `.booyovoice` files from v3–v3.2 still import. New packs carry every line. Clips are recorded at 32 kbps
  Opus/AAC: a pack measures about 4 KB per recorded second (base64 included), so a full 627-line set is roughly 5–8 MB and the 14 most-heard lines are well under 100 KB.
  Import accepts up to 3,000 clips (200 MB).
- **Simpler kid home:** a big teal **"Play with Booyo"** button (guided mode), at most 4 big picture tiles (ABC, 123, Shapes, and a
  **More** tile that holds Stories, Matching and Make a Story), more white space and a calmer teal/yellow palette from the icon. The stars
  badge and title text are gone from kid screens (stars are still counted and shown in Reports and on the celebration screen).
  The guided start screen now fits small/landscape tablets (1024×712) without scrolling.
- **Parent corner is a short menu:** 👶 Child · 🎮 Play settings · 🎙️ Family Voices · 📚 My Stories · 🌙 Calm & Accessible ·
  📈 Reports · 💡 Help. Each opens its own page with a ⬅ Menu button, and advanced options sit behind **More options**.

## What's new in v3.2.1: the official Booyo icon
- Savir picked the app icon: a winking, waving yellow owl on a teal rounded square. It's used for the home-screen and install icons
  (full-bleed teal for iOS and Android "maskable", with the owl inside the safe zone), the favicons (`favicon.ico`, 16 and 32 px),
  the start screen (menu mode) and the top of the guided start screen and Parent corner. The app's theme and splash colour is the icon's teal (`#00bec0`).
- Icons are regenerated from the source art with `/workspace/booyo-brand/make_booyo_icons.py` (PIL, supersampled).

## What's new in v3.2: Sing My Story
- **A 🎵 "Sing it!" button** turns a story into a short song. It's on the cover page at the end of every ✨ Make a Story story,
  and on each story in Parent corner → 📚 My Stories.
- **The child picks the tune** from 3 big picture buttons: 🌙 **Lullaby** (slow and soft), 🥁 **March** (steady, with claps) or
  🤪 **Silly Bounce** (fast and playful).
- **The words come from the story's picks:** a verse for *who*, a repeated chorus for *where* ("Off we go to the moon, the moon, the
  moon, / Up, up, up in a silver balloon!"), then verses for *what happens* and *how it ends*, the chorus again, and "Hooray!". They're short,
  rhyming and repetitive, written for toddlers, and all in English. The child's name comes from the Parent corner (or "our friend"). It's never built in.
- **All music is made on the device** with the Web Audio API: a melody, bass, and a light beat (soft ticks for Lullaby, a kick and clap for
  March, a bouncy beat for Silly Bounce). There are no samples, downloads or network. The melodies are original. They're generated from a simple major
  scale over nursery-style I–IV–V chords, seeded per story so each story keeps its own tune. No existing (copyrighted) melody is used.
- **Honest note about the voice:** the browser's built-in voice **can't really sing**. Booyo chants or speaks each line in time
  with the music, one line per bar group, with the speech speed and pitch tuned per style. The Parent corner says this too. For real
  singing, record the song in 🎙️ **Family Voices → "Sing My Story"**:
  - **The whole song** (up to 90 s, to any tune you like). It plays instead of the chanting, starting when the words start.
  - **Or line by line** (up to 15 s each): one recording per *who* verse, chorus, *what* verse and *ending* verse, plus "Hooray!".
    Each recording plays at the start of its own bars. Any line without a recording falls back to the built-in voice.
- **While it plays:** the lyrics are highlighted line by line, karaoke-style. They're on by default in song mode, follow the captions
  setting, and can be switched off in My Stories. Beat dots and the owl bob to the beat. There's a big 👏 **clap-along** button that
  sparkles and counts claps, plus ⏸ **Pause** and ⏹ **Stop**. The song pauses by itself when the grown-up check opens or the app goes
  to the background. Afterwards: **Sing it again**, **Another tune**, or back to the story.
- **Optional 🎤 "Sing along!"** (on by default, switch in My Stories): hold the mic and sing with the song, for up to 30 s. With a keyboard
  or switch, press once to start and again to stop. It uses the same MediaRecorder approach as Family Voices, and the mic is on only
  while pressed. The clip is saved and layered over the music when the song is replayed. If the mic is denied or unavailable, the button
  just disappears and the song carries on. Note that the mic also hears the music (echo cancellation helps on most devices).
- **Calm mode / Reduce motion:** no bobbing or pulsing, and the music is about 40% quieter.
- **Volume:** **Soft** by default (Soft / Medium / Loud in My Stories), behind a limiter so it never clips.
- **Saved with the story:** the tune choice, the clap count and any sing-along clip are stored with the story in IndexedDB. On the
  My Stories shelf, songs show a 🎵 badge, with **▶ Play song** and **🎵 Sing it!** (pick a new tune) buttons.
- **Export:** the offline storybook (.html) now has a 🎵 song page with the backing track rendered on the device (OfflineAudioContext
  → WAV, embedded as data, mixed with the child's sing-along clip and any Family Voices song recordings), the lyrics highlighted in
  time, and an optional "chant the words" checkbox that uses that device's voice. The export dialog also offers **Song (.wav)** on its own.
  The .booyostory backup includes the lyrics, tune choice and sung clip. The rendered WAV can't contain the built-in voice's chanting,
  because browsers can't record speech synthesis.
- **Accessible:** everything works with a keyboard and switch scanning, and every button has an ARIA label. The current lyric line is
  announced through the live captions.
- (`?tlsong=N` in the URL speeds songs up N× and exists only for the automated tests.)

## What's new in v3.1: Make a Story
- **A new ✨ Make a Story activity** for ages 2–6, built for children who can't read yet. It's on the picture menu, and it's in the
  guided playlist (it takes the read-aloud story's place every other session; Parent corner → 📚 My Stories → switch, on by default).
- **Booyo asks one question at a time, by voice, with 3–4 big pictures** (3 for ages 2–3): *Who is in the story?* (cat, dinosaur,
  Biscuit the dog, or the child: their name, or "friend" if no name is set) → *Where do they go?* (park, moon, beach, forest,
  Grandma's house) → *What happens?* (finds a treasure, makes a friend, has a picnic, sees a rainbow) → *How does it end?*
  (dance party, nap, big hug, home for dinner).
- **After every pick Booyo reads the whole story so far**, with the picks in it ("Once upon a time, there was a puppy called Biscuit.
  Biscuit flew all the way to the moon…"), and a picture strip shows it on screen. Then the child hears that they built it.
- **Optional "Say it!" step:** a big 🎤 button. Hold it and talk (up to 10 s, with a countdown ring). With a keyboard or switch, press once to start
  and again to stop. Booyo plays the line back with a 🧒 badge. There's a skip arrow. If the mic is denied or the browser can't record, Booyo says
  "That's okay!" and goes on. Switch it off in My Stories. It uses the same MediaRecorder approach as Family Voices, with the same device notes.
- **The ending:** a cover, "*Biscuit on the Moon*, A story by Maya" (or "by a little author"), a short celebration (no confetti in Calm
  mode), and a 📖 **Read it again** button. The child's name is never built in. It always comes from the Parent corner.
- **Saved on this device:** finished stories (and the child's clip) are stored in IndexedDB next to Family Voices (`booyo-voices`, store
  `stories`). The newest **30** are kept. The parent is warned at 27+, and when older stories are removed to make room.
- **Parent corner → 📚 My Stories** (behind the grown-up check): the shelf with cover, title, author and date. **Open** shows it as a
  page-by-page picture book with Read aloud and Print, plus **Play**, **Delete** and **Export**. Export makes a **self-contained offline
  storybook (.html)**: pictures, the child's voice embedded as data, a "Read to me" button and print layout, with its own strict CSP and
  no network. It also makes a small **.booyostory** (JSON) backup file and a printable view. Files are shared with the Web Share API
  where the device supports sharing files (most phones and tablets). Otherwise they download.
- **Family Voices:** Booyo's Make a Story lines (the questions, "Once upon a time", "What a wonderful story!", "The end!") can be
  recorded in the 🎙️ Family Voices list under "Make a Story". Recorded lines play in the family voice. Everything else, including the
  story sentences, uses the built-in voice.

## What's new in v3.1: Calm & Accessible settings (Parent corner, all off by default)
- **🌙 Calm mode:** softer, quieter sounds; no confetti, bouncing or sudden animations; slower speech (0.15 slower than the speed
  slider, never below 0.6). Booyo also follows the device's **Reduce motion** setting automatically.
  Helpful for kids who like calm, predictable play, including many autistic kids.
- **🗓️ Picture schedule:** a "First / Next / Then" strip of activity pictures at the top of guided sessions (current one highlighted).
- **⏳ Extra time:** *Longer waits* (about 20 s before a repeat, and the sleepy pause much later) or *No reminders* (Booyo never repeats,
  moves on or falls asleep by himself; the daily time limit still applies).
- **👆 Easier tapping:** *Bigger buttons*; and *How a tap counts*: **Forgiving** (counts the moment a finger touches, even if it slides)
  or **Press and hold** (about half a second, with a ring, to avoid accidental taps).
- **🔲 High contrast:** plain white background, black outlines, bold text.
- **💬 Captions:** everything Booyo says appears as large text at the bottom (for kids who are deaf or hard of hearing, and for grown-ups).
- **⌨️ Keyboard helper:** Tab or the arrow keys move between pictures, and Enter or Space chooses, with big focus rings. Each new screen focuses the main picture.
- **🔘 Switch scanning:** Booyo highlights each choice in turn (1, 1.5, 2 or 3 seconds). A single switch (set up to send Space or Enter),
  Space, or Enter chooses the highlighted one.
- Kid mode and Make a Story have ARIA labels and roles (choice groups, step labels, a focusable owl, a status region for captions),
  checked with axe-core in the test suite. These settings are about comfort and access. Booyo is a learning game, not a therapy or medical tool.

**v3.1 caveats:** the *Say it!* mic needs https:// (or localhost / the installed app) and MediaRecorder (Safari 14.5+). iPhone/iPad
record MP4/AAC, and exported storybooks with that audio play in Safari and most modern browsers. Web Share with files works on most phones
and tablets and in Safari/Edge on desktop. Desktop Chrome on Linux downloads instead. Stories live only in this browser: clearing site
data or uninstalling removes them, so export the ones to keep. Captions are timed from an estimate, not from the voice itself.
Switch access relies on the switch interface sending a key (Space/Enter). Pinch-zoom is still disabled in kid mode (to stop accidental zooming),
so for low vision use Bigger buttons, High contrast or the device's own zoom setting.

## What's new in v3: Family Voices (optional, off by default)
- **Booyo can speak in your family's voices.** In the Parent corner → **🎙️ Family Voices**, add one or more voices
  (e.g. Grandma, Dad, Nanu), each with a language (English, Bangla, Other) and a picture for the badge.
- **What to record:** Booyo's guide lines (greeting, the child's name, 3–5 praise lines like "Great job!" / "Shabash!",
  2–3 gentle try-agains, "Let's start", break time, all done, goodbye) and **custom lines** (played at the start, mixed in with
  praise, or at goodbye). Optionally also **lesson content**: letters ("A is for Apple!"), numbers 1–20, colors, shapes, and every
  story page by page. Each lesson has a **"Record all for this lesson"** flow. Each line: record (up to 10 s, with countdown and a
  level meter), play back, re-record, delete. Progress meters show how much is recorded.
- **In kid mode:** when Booyo says a recorded line, the family clip plays (Booyo's beak and bounce animate, and a badge like
  "👵 Grandma" appears). The child's name clip is spliced in wherever Booyo says the name. **Anything not recorded uses the
  built-in voice**, so nothing breaks if only a few lines are recorded. Choose one voice, or **Mix** (praise takes turns between voices).
  A switch can turn lesson recordings off and keep only the guide lines.
- **Off by default.** With the switch off (or nothing recorded) the app behaves exactly as in v2.
- **Private:** the mic turns on only when a grown-up taps Record. Clips are stored as Blobs in this browser's IndexedDB
  (database `booyo-voices`) and are never uploaded. **Export** makes one `.booyovoice` file (JSON with base64 audio) to send
  by WhatsApp, email, AirDrop or USB. Grandma can record on her own phone in Booyo and send the file, and the parent taps **Import**.
  About 40–80 KB per line, so a full set of guide lines is under 1 MB.
- **Formats:** Chrome, Edge, Firefox and Android record WebM/Opus; Safari records MP4/AAC. Recording needs https:// (or localhost /
  the installed app) and a browser with MediaRecorder (Safari 14.5+). Denied or missing microphones get a friendly message.

## What's new in v2: Guided mode with Booyo the owl (on by default)
- **One big ▶ tap starts everything.** Booyo, an animated owl, greets the child by name ("friend" if no name is set)
  and walks them through a short **daily playlist** of 4–6 activities (Letters, Counting, Shapes, Colors, Matching, a Story).
  He announces each one ("Let's count apples!"), moves on by himself, and ends with a celebration and a calm goodbye screen.
- **No reading needed.** Everything is spoken, shown with pictures, a **pointing hand 👆**, glowing answers, and a
  progress path of picture icons along the top. Text labels are still there, but the child doesn't need them.
- **"Watch me!" demos.** The first question of each activity is done by Booyo's hand, then "Now you try!"
  (demos stop once a child has done that activity 3 times).
- **Idle help.** No tap for about 8 s: Booyo repeats the question and shows the hand. After 3 repeats he offers a big
  ➡️ "try something new" arrow, then moves on gently. If nobody taps for about 2 minutes, Booyo falls asleep 😴 and the
  **screen-time timer pauses** until the child taps the sun.
- **Adaptive help.** After 2 wrong taps (or 1, when there are only 2 choices) the right answer glows. Three right-first-try
  answers in a row make that skill a little harder, and two struggles make it a little easier. It always stays inside the age band.
- **Unattended-safe.** No links, menus, exits or typing in guided mode. The session ends by itself at the daily limit.
  The 🔒 grown-up button needs a 3-second hold plus a multiplication question (6 choices). A wrong answer closes it for 30 s.
- **Parent corner additions:** Guided mode on/off, session length, a **Session report** (what was played, stars,
  right-first-try, wrong taps, where Booyo had to help, difficulty changes), and printable **Setup tips for unsupervised use**
  (Guided Access, Screen/App Pinning, Kids Space, Fire tablets, volume, headphones, charging).
- **Voice:** prefers a natural, warm, on-device (offline) English voice at a slower speed (0.85). On devices with no voice,
  Booyo still guides with big picture bubbles, the pointing hand and glowing answers.

Turn Guided mode off in the Parent corner to get the picture-tile menu (child chooses games; best with a grown-up nearby).

## How to open
- Easiest: double-click `index.html` (works offline from the file, no internet needed).
- Or serve it: `python3 -m http.server 8000` in this folder, then open http://localhost:8000
- Tablet: copy the folder to the device, or host it on any static web server on your home network, then "Add to Home Screen".
  **Before leaving a child alone with it**, lock the device to the app. See "Setup tips for unsupervised use" in the
  Parent corner (Guided Access on iPad, Screen Pinning on Android, App Pinning on Fire).

## First run
The app opens in the **Parent corner** menu: open 👶 **Child** to set a name (optional) and age band, and 🎮 **Play settings** for activities,
the daily time limit, session length and Booyo's voice, then tap **Start kid mode**. After that it opens straight to Booyo's big ▶ button. A tap is needed to start, because browsers
only allow sound after a tap. To get back to the Parent corner, tap the small 🔒 (top-left) and pass the grown-up check.

## What's inside
- Letters: ABC with pictures (A is for Apple 🍎), "find the letter", "starts with", lowercase (by age)
- Numbers: tap-to-count, find the number, simple addition for 5–6
- Shapes & colors: "tap the red circle" games (SVG shapes)
- 6 original read-aloud stories with word highlighting and a question at the end
  (one story uses the child's name; if no name is set it uses a character called Sam)
- Matching / memory game
- Make a Story (v3.1): build a story by tapping pictures; saved stories shelf and offline storybook export
- Sing My Story (v3.2): turn a story into a song in 3 styles, with karaoke words, clap-along and sing-along
- Screen-time limit with a gentle break screen, progress stats, session reports, offline activity ideas (printable)

## Files
- `index.html`: entry point
- `app.js`: logic (v2 guided mode is in the "v2 GUIDED MODE" section, Family Voices in "v3 FAMILY VOICES", Make a Story and Calm & Accessible in the "v3.1" sections, Sing My Story in "v3.2 SING MY STORY"); `sw.js`: offline cache (`booyo-v3.3.1`); `privacy.html`: privacy page; `data.js`: letters, stories, ideas (easy to edit); `style.css`: styles

All data stays in this browser: localStorage (keys `tl_settings`, `tl_progress`, `tl_usage`, `tl_sessions`, `tl_voices`, `tl_sm_trimmed`) and, for Family Voices recordings and saved stories, IndexedDB (`booyo-voices`, stores `clips` and `stories`; a story's song is saved in its `song` field). There are no accounts
and no network calls (a Content-Security-Policy blocks outside connections). No AI or cloud services are used. Note that some
browsers' "online" voices send spoken text to the browser maker's speech service, so the app prefers on-device voices.

Made by Savir and his dad.
