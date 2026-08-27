/**
 * Side-by-side comparison compositor for the reference-delta loop.
 * Ours goes LEFT, reference goes RIGHT, separated by a gutter, scaled to a
 * common height. Also supports pixel sampling for the shadow-color test.
 *
 * Usage:
 *   npx tsx tools/compare.ts --a shots/x.png --b reference/scene1.png --out shots/cmp_x.png
 *   npx tsx tools/compare.ts --sample shots/x.png --px "100,200;300,400"
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

interface Args {
  [k: string]: string | boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function str(v: string | boolean | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

const GUTTER = 12;
const TARGET_H = 1080;

async function sideBySide(aPath: string, bPath: string, outPath: string): Promise<void> {
  const a = sharp(aPath);
  const b = sharp(bPath);
  const [am, bm] = await Promise.all([a.metadata(), b.metadata()]);
  const aw = Math.round(((am.width ?? 1) * TARGET_H) / (am.height ?? 1));
  const bw = Math.round(((bm.width ?? 1) * TARGET_H) / (bm.height ?? 1));
  const [aBuf, bBuf] = await Promise.all([
    a.resize(aw, TARGET_H).png().toBuffer(),
    b.resize(bw, TARGET_H).png().toBuffer(),
  ]);
  const W = aw + GUTTER + bw;
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp({
    create: {
      width: W,
      height: TARGET_H,
      channels: 3,
      background: { r: 10, g: 12, b: 11 },
    },
  })
    .composite([
      { input: aBuf, left: 0, top: 0 },
      { input: bBuf, left: aw + GUTTER, top: 0 },
    ])
    .png()
    .toFile(outPath);
  console.log(`[compare] wrote ${outPath} (ours left, reference right)`);
}

async function differenceMetrics(aPath: string, bPath: string): Promise<Record<string, number>> {
  const width = 320;
  const height = 180;
  const [a, b] = await Promise.all([
    sharp(aPath).resize(width, height).removeAlpha().raw().toBuffer(),
    sharp(bPath).resize(width, height).removeAlpha().raw().toBuffer(),
  ]);
  let absolute = 0;
  let luminanceA = 0;
  let luminanceB = 0;
  for (let index = 0; index < a.length; index += 3) {
    absolute += Math.abs((a[index] ?? 0) - (b[index] ?? 0));
    absolute += Math.abs((a[index + 1] ?? 0) - (b[index + 1] ?? 0));
    absolute += Math.abs((a[index + 2] ?? 0) - (b[index + 2] ?? 0));
    luminanceA += (a[index] ?? 0) * 0.2126 + (a[index + 1] ?? 0) * 0.7152 + (a[index + 2] ?? 0) * 0.0722;
    luminanceB += (b[index] ?? 0) * 0.2126 + (b[index + 1] ?? 0) * 0.7152 + (b[index + 2] ?? 0) * 0.0722;
  }
  const pixels = width * height;
  return {
    beforeMeanLuminance: luminanceA / pixels,
    afterMeanLuminance: luminanceB / pixels,
    meanAbsoluteChannelDelta: absolute / (pixels * 3),
    normalizedDifference: absolute / (pixels * 3 * 255),
  };
}

async function contactSheet(paths: string[], outPath: string): Promise<void> {
  const available = paths.filter((path) => existsSync(path));
  if (available.length === 0) return;
  const cellWidth = 640;
  const cellHeight = 360;
  const columns = 2;
  const rows = Math.ceil(available.length / columns);
  const images = await Promise.all(available.map((path) => sharp(path).resize(cellWidth, cellHeight).png().toBuffer()));
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp({
    create: {
      width: cellWidth * columns,
      height: cellHeight * rows,
      channels: 3,
      background: { r: 10, g: 12, b: 11 },
    },
  }).composite(images.map((input, index) => ({
    input,
    left: (index % columns) * cellWidth,
    top: Math.floor(index / columns) * cellHeight,
  }))).png().toFile(outPath);
  console.log(`[compare] wrote ${outPath}`);
}

async function compareDefaultArtifacts(): Promise<void> {
  const root = 'artifacts/procedural-world/seed-41729';
  for (const view of ['forest-ravine', 'alpine-vista']) {
    const directory = join(root, view);
    const before = join(directory, 'before.png');
    const after = join(directory, 'after.png');
    if (!existsSync(before) || !existsSync(after)) throw new Error(`missing deterministic pair for ${view}`);
    await sideBySide(before, after, join(directory, 'comparison.png'));
    const metrics = await differenceMetrics(before, after);
    writeFileSync(join(directory, 'image-difference.json'), `${JSON.stringify(metrics, null, 2)}\n`);
  }
  await contactSheet([
    join(root, 'forest-ravine', 'after.png'),
    join(root, 'alpine-vista', 'after.png'),
    join(root, 'gallery', 'forest-interior.png'),
    join(root, 'gallery', 'wetland-lake.png'),
    join(root, 'gallery', 'meadow.png'),
    join(root, 'gallery', 'valley-aerial.png'),
  ], join(root, 'biome-contact-sheet', 'contact-sheet.png'));
}

async function samplePixels(imgPath: string, px: string): Promise<void> {
  const img = sharp(imgPath);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const pairs = px.split(';').map((s) => s.split(',').map(Number) as [number, number]);
  for (const [x, y] of pairs) {
    if (x < 0 || y < 0 || x >= info.width || y >= info.height) {
      console.log(`(${x},${y}) out of bounds`);
      continue;
    }
    const idx = (y * info.width + x) * info.channels;
    const r = data[idx] ?? 0;
    const g = data[idx + 1] ?? 0;
    const b = data[idx + 2] ?? 0;
    const maxc = Math.max(r, g, b);
    const minc = Math.min(r, g, b);
    const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
    console.log(
      `(${x},${y}) rgb(${r},${g},${b}) value=${(maxc / 255).toFixed(2)} sat=${sat.toFixed(2)}`,
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sample = str(args['sample']);
  if (sample) {
    await samplePixels(sample, str(args['px']) ?? '');
    return;
  }
  const a = str(args['a']);
  const b = str(args['b']);
  if (!a && !b) {
    await compareDefaultArtifacts();
    return;
  }
  const out = str(args['out']) ?? 'shots/cmp.png';
  if (!a || !b) throw new Error('need --a <ours> --b <reference> [--out path]');
  await sideBySide(a, b, out);
}

main().catch((e: unknown) => {
  console.error('[compare] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
