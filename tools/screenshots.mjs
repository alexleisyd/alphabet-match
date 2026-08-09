// Store screenshots, driven rather than posed.
//
// Both stores want the same handful of pictures at several exact pixel sizes,
// and they have to be retaken whenever the game's look changes. Cropping a
// simulator recording by hand is how listings end up with last year's artwork
// in them, so this drives the real game in a real browser at each store's
// required viewport and captures the states we want to show.
//
//   npm run screenshots        # everything, into store/
//   npm run screenshots -- iphone-6.9
//
// The device list below is what App Store Connect and Play Console actually
// ask for; see store/README.md, which this script writes as it goes.
import { chromium } from 'playwright';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'store');
const URL_BASE = process.env.GAME_URL || 'http://localhost:8000/index.html';

// Sizes are in device pixels, which is what the stores check. Playwright takes
// a CSS viewport plus a scale factor, so each entry states both.
const DEVICES = {
  // Required. 6.9" covers the current iPhone Pro Max sizes.
  'iphone-6.9':  { w: 440,  h: 956,  scale: 3, label: 'iPhone 6.9" (1320x2868)' },
  // Still accepted for older device families, and cheap to produce.
  'iphone-6.5':  { w: 414,  h: 896,  scale: 3, label: 'iPhone 6.5" (1242x2688)' },
  // Required whenever the app supports iPad, which this one does.
  'ipad-13':     { w: 1032, h: 1376, scale: 2, label: 'iPad 13" (2064x2752)' },
  // Play's phone slot: 9:16, anything from 320 to 3840 on a side.
  'android-phone':  { w: 412, h: 916, scale: 3, label: 'Play phone (1236x2748)' },
  'android-tablet': { w: 800, h: 1280, scale: 2, label: 'Play 10" tablet (1600x2560)' },
};

// A save file that makes the game look played-in rather than brand new. An
// empty sticker jar photographs badly and tells a browsing parent nothing.
const SAVE = {
  stars: 37,
  level: 3,
  name: '',
  letters: null,
  book: {
    A: ['ANT'], B: ['BEE'], C: ['COW'], D: ['DUCK'], E: ['EGG'],
    F: ['FROG'], H: ['HOUSE'], M: ['MILK'], P: ['PANDA'], R: ['ROCKET'],
    S: ['SUN'], T: ['TIGER'], W: ['WATERMELON'],
  },
};

// Each shot: a name, and what to do to the running game to reach that state.
// They run in order against one page so the sequence reads like a session.
const SHOTS = [
  {
    name: '1-start',
    caption: 'The start screen',
    async go(page) {
      await page.waitForTimeout(900);   // let the sky settle and the blocks bob
    },
  },
  {
    name: '2-round',
    caption: 'A round: the letter asks, the pictures answer',
    async go(page) {
      await page.click('#play-btn');
      await page.waitForTimeout(1400);  // cards finish popping in
    },
  },
  {
    name: '3-victory',
    caption: 'Getting it right',
    async go(page) {
      // A six-letter word so the tiles stay on one line on a phone. Longer
      // ones wrap, which is correct behaviour and a poor advertisement.
      await page.evaluate(() => window.ALPHABET_VICTORY('ROCKET'));
      // hold the screen: tapping the picture cancels the auto-advance
      await page.click('#victory-art');
      await page.waitForTimeout(3000);  // tiles and stars finish animating
    },
  },
  {
    name: '4-sticker-book',
    caption: 'The sticker book fills up as letters are found',
    async go(page) {
      await page.click('#jar-btn');
      await page.waitForTimeout(700);
    },
  },
  {
    name: '5-grown-ups',
    caption: 'Settings for grown-ups, behind a press-and-hold',
    async go(page) {
      // the panel opens on a 1.5s hold of the book title, so hold it properly
      // rather than reaching past the gesture and calling the function
      const title = await page.$('#book-title');
      const box = await title.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(1900);
      await page.mouse.up();
      await page.waitForTimeout(600);
    },
  },
];

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const chosen = only.length ? only : Object.keys(DEVICES);

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

// The system Chrome, not Playwright's own download: it is the same renderer
// tools/artwork.sh uses, so the icon and these agree, and it saves every
// checkout pulling a second 150MB browser it already has.
const browser = await chromium.launch({ channel: 'chrome' });
const written = [];

for (const key of chosen) {
  const d = DEVICES[key];
  if (!d) { console.error(`unknown device "${key}"`); process.exit(1); }

  const dir = join(OUT, key);
  await mkdir(dir, { recursive: true });
  console.log(`\n${d.label}`);

  const ctx = await browser.newContext({
    viewport: { width: d.w, height: d.h },
    deviceScaleFactor: d.scale,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();

  // Seed progress before the game's own script reads localStorage.
  await page.addInitScript((save) => {
    try { localStorage.setItem('alphabet-match.v1', JSON.stringify(save)); } catch (e) {}
  }, SAVE);

  await page.goto(URL_BASE, { waitUntil: 'load' });
  // The full-screen button only exists on the web; it is not part of the app
  // a shopper would install, so it has no business in a store screenshot.
  await page.addStyleTag({ content: '#full-btn{display:none !important}' });

  for (const shot of SHOTS) {
    await shot.go(page);
    const file = join(dir, `${shot.name}.png`);
    await page.screenshot({ path: file });
    written.push({ device: key, label: d.label, file: `store/${key}/${shot.name}.png`, caption: shot.caption });
    console.log(`  ${shot.name}.png  ${d.w * d.scale}x${d.h * d.scale}`);
  }

  await ctx.close();
}

await browser.close();

// A short note next to the images, so whoever fills in the store listing knows
// which folder answers which upload slot.
const readme = `# Store screenshots

Generated by \`npm run screenshots\` — do not edit these by hand. Rerun it
whenever the game's look changes; the captions below are suggested listing
text for each image.

Serve the game first (\`npm run serve\`), or point the script elsewhere with
\`GAME_URL=...\`.

${Object.entries(DEVICES).map(([key, d]) => `## ${d.label}\n\`store/${key}/\`\n\n${SHOTS.map((s, i) => `${i + 1}. **${s.name}.png** — ${s.caption}`).join('\n')}\n`).join('\n')}
## Where each one goes

- **App Store Connect** wants \`iphone-6.9\` and \`ipad-13\` at minimum;
  \`iphone-6.5\` is optional and accepted for older device families.
- **Play Console** wants at least two phone screenshots (\`android-phone\`) plus
  a 1024x500 feature graphic, which is not a screenshot and is not generated
  here. Tablet screenshots (\`android-tablet\`) are optional but expected for a
  Families listing.
`;
await writeFile(join(OUT, 'README.md'), readme);

console.log(`\n${written.length} images in store/`);
