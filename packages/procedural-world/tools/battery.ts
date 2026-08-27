import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawn, type SpawnOptions } from 'node:child_process';

const root = process.cwd();
const artifactRoot = join(root, 'artifacts', 'procedural-world');
const seedRoot = join(artifactRoot, 'seed-41729');
const performanceRoot = join(artifactRoot, 'performance');
const runPerformanceRoot = join(seedRoot, 'performance');
const npmCommand = 'npm';

async function main(): Promise<void> {
  await ensureServer();
  mkdirSync(runPerformanceRoot, { recursive: true });

  await shoot([
    '--seed', '41729', '--preset', 'high', '--shot', 'forest-ravine', '--variant', 'before',
    '--w', '1920', '--h', '1080', '--out', relative('forest-ravine/before.png'),
    '--gallery', relative('performance/before-gallery'), '--views', 'alpine-vista',
    '--stats', relative('performance/high-before.json'), '--console', relative('browser-console.log'),
    '--settle', '18', '--perf', '90', '--timeout', '600000',
  ]);
  copy(relative('performance/before-gallery/alpine-vista.png'), relative('alpine-vista/before.png'));

  await shoot([
    '--seed', '41729', '--preset', 'high', '--shot', 'forest-ravine', '--variant', 'after',
    '--w', '1920', '--h', '1080', '--out', relative('forest-ravine/after.png'),
    '--gallery', relative('gallery'),
    '--views', 'alpine-vista,forest-interior,wetland-lake,meadow,valley-aerial,lakeshore',
    '--stats', relative('performance/high-after.json'), '--console', relative('browser-console.log'),
    '--settle', '18', '--perf', '120', '--determinism', '--timeout', '600000',
  ]);
  copy(relative('gallery/alpine-vista.png'), relative('alpine-vista/after.png'));

  await shoot([
    '--seed', '41729', '--preset', 'high', '--shot', 'forest-ravine', '--variant', 'after',
    '--w', '1280', '--h', '720', '--out', relative('performance/determinism-repeat.png'),
    '--stats', relative('performance/determinism-repeat.json'), '--console', relative('browser-console.log'),
    '--settle', '8', '--perf', '60', '--determinism', '--timeout', '600000',
  ]);

  await shoot([
    '--seed', '41729', '--preset', 'ultra', '--shot', 'alpine-vista', '--variant', 'after',
    '--w', '1600', '--h', '900', '--out', relative('performance/ultra-alpine.png'),
    '--stats', relative('performance/ultra.json'), '--console', relative('browser-console.log'),
    '--settle', '18', '--perf', '90', '--timeout', '600000',
  ]);

  await run(npmCommand, ['run', 'world:compare']);
  writeReports();
  copy(relative('forest-ravine/after.png'), join(artifactRoot, 'final', 'forest-ravine.png'));
  copy(relative('alpine-vista/after.png'), join(artifactRoot, 'final', 'alpine-vista.png'));
  console.log(`[battery] complete: ${artifactRoot}`);
}

async function shoot(args: string[]): Promise<void> {
  await run(npmCommand, ['run', 'world:shoot', '--', ...args]);
}

async function ensureServer(): Promise<void> {
  const url = 'http://127.0.0.1:5001/procedural-world-verification.html';
  if (await isReachable(url)) return;
  const child = spawn(
    npmCommand,
    ['run', 'dev', '-w', '@blud/editor', '--', '--host', '127.0.0.1', '--port', '5001'],
    { cwd: root, detached: true, shell: process.platform === 'win32', stdio: 'ignore', windowsHide: true },
  );
  child.unref();
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    if (await isReachable(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Editor verification server did not become ready at ${url}.`);
}

async function isReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function run(command: string, args: string[], options: SpawnOptions = {}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      shell: process.platform === 'win32',
      stdio: 'inherit',
      windowsHide: true,
      ...options,
    });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`)));
  });
}

function writeReports(): void {
  const before = readJson(relative('performance/high-before.json'));
  const high = readJson(relative('performance/high-after.json'));
  const repeat = readJson(relative('performance/determinism-repeat.json'));
  const ultra = readJson(relative('performance/ultra.json'));
  const deterministic = JSON.stringify(high.determinism) === JSON.stringify(repeat.determinism);
  const determination = {
    first: high.determinism,
    passed: deterministic,
    repeat: repeat.determinism,
    seed: 41729,
  };
  writeFile(relative('performance/determinism.json'), determination);
  writeFile(relative('forest-ravine/metrics.json'), { after: high, before });
  writeFile(relative('alpine-vista/metrics.json'), { after: high, before });
  writeFile(join(performanceRoot, 'performance-report.md'), performanceReport(high, ultra));
  writeFile(relative('performance/verification-battery.json'), {
    browserConsoleCaptured: existsSync(relative('browser-console.log')),
    determinism: deterministic ? 'pass' : 'fail',
    gpuErrors: null,
    highPreset: 'captured',
    ultraPreset: 'captured',
    webGpu: high.diagnostic?.ok === true ? 'pass' : 'fail',
  });
}

function performanceReport(high: Json, ultra: Json): string {
  return `# Procedural World WebGPU Performance\n\n${performanceRow('High', high)}\n\n${performanceRow('Ultra', ultra)}\n\n## Measurement notes\n\n- Frame times are wall-clock requestAnimationFrame intervals measured after generation and temporal settling.\n- Draw calls and rendered triangles are reported as unavailable when Three WebGPU returns zero counters. No values are fabricated.\n- Per-pass GPU timings are unavailable when the renderer disables timestamp tracking, even if the adapter advertises timestamp-query.\n- GPU memory is a coarse allocation estimate from active heightfield and instance counts; browser WebGPU does not expose resident memory.\n- One initial 4096-grid High attempt closed Chromium during generation. Subsequent High and Ultra 4096-grid runs completed; the failure is retained as a stability warning.\n`;
}

function performanceRow(label: string, data: Json): string {
  const timing = data.frameTiming ?? {};
  const counters = data.stats?.counters ?? {};
  const config = data.runtime?.status?.effectiveRuntimeConfig ?? {};
  const counts = ['veg.trees', 'veg.under', 'veg.extras', 'veg.stones', 'veg.grass', 'particles']
    .map((key) => Number(counters[key] ?? 0));
  const resolution = Number(config.heightfieldResolution ?? 0);
  const memoryBytes = resolution * resolution * 20 + counts.reduce((sum, value) => sum + value * 32, 0);
  const adapter = data.runtime?.adapter ?? {};
  return `## ${label}\n\n| Metric | Measured value |\n| --- | --- |\n| Browser | Chromium ${data.browser?.version ?? 'unknown'} |\n| GPU adapter | ${adapter.description ?? adapter.device ?? adapter.vendor ?? 'not disclosed by browser'} |\n| Resolution | ${data.harness?.width ?? 0}x${data.harness?.height ?? 0} |\n| Preset | ${String(config.preset ?? label.toLowerCase())} |\n| Average frame time | ${fixed(timing.averageFrameMs)} ms |\n| P95 frame time | ${fixed(timing.p95FrameMs)} ms |\n| FPS | ${fixed(timing.fps)} |\n| Main-thread stalls over 50 ms | ${timing.mainThreadStallCount ?? 'unavailable'} (max ${fixed(timing.maxFrameMs)} ms) |\n| Draw calls | ${data.stats?.drawCalls ? data.stats.drawCalls : 'unavailable'} |\n| Rendered triangles | ${data.stats?.triangles ? data.stats.triangles : 'unavailable'} |\n| Instances | trees ${counts[0]}, understory ${counts[1]}, extras ${counts[2]}, stones ${counts[3]}, grass ${counts[4]}, particles ${counts[5]} |\n| Resident terrain tiles | ${counters['terrain.tiles'] ?? 'unavailable'} |\n| Culling statistics | ${counters['veg.cast'] ?? 'not exposed'} |\n| GPU memory estimate | ${(memoryBytes / 1024 / 1024).toFixed(1)} MiB |\n| GPU pass timings | ${Object.keys(data.stats?.gpuPasses ?? {}).length ? JSON.stringify(data.stats.gpuPasses) : 'unavailable'} |\n| Generation time | ${fixed(data.runtime?.status?.lastGenerationDurationMs)} ms |`;
}

function fixed(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'unavailable';
}

function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, 'utf8')) as Json;
}

function writeFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
}

function copy(source: string, destination: string): void {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

function relative(path: string): string {
  return join(seedRoot, path);
}

type Json = Record<string, any>;

main().catch((error: unknown) => {
  console.error('[battery] FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
