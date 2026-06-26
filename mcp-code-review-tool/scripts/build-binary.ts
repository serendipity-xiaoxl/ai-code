// ============================================================
// mcp-code-review-tool - Binary Build Script
//
// Builds standalone native binaries using Bun and/or Node.js.
//
// Usage:
//   bun run scripts/build-binary.ts              # Build for current runtime
//   bun run scripts/build-binary.ts --target bun  # Build with Bun only
//   bun run scripts/build-binary.ts --target node # Build with Node.js/pkg only
//   bun run scripts/build-binary.ts --target all  # Build both
//   node --import tsx scripts/build-binary.ts     # Run with Node.js
// ============================================================

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { platform, arch } from 'node:os';

// Resolve paths
const ROOT_DIR = resolve(join(import.meta.dirname ?? dirname(new URL(import.meta.url).pathname), '..'));
const DIST_DIR = join(ROOT_DIR, 'dist');
const BUNDLE_DIR = join(ROOT_DIR, 'dist', 'bundle');
const BIN_DIR = join(ROOT_DIR, 'bin');
const ENTRY_FILE = join(ROOT_DIR, 'src', 'index.ts');
const BUNDLE_FILE = join(BUNDLE_DIR, 'index.js');
const PACKAGE_JSON = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf-8'));

const APP_NAME = 'mcp-review';
const APP_VERSION = PACKAGE_JSON.version ?? '0.1.0';

// Platform-specific settings
const isWindows = platform() === 'win32';
const binExt = isWindows ? '.exe' : '';
const platformName = platform() + '_' + arch();

type BuildTarget = 'bun' | 'node' | 'all';

function parseArgs(): BuildTarget {
  const args = process.argv.slice(2);
  const targetArg = args.find((a) => a.startsWith('--target='));
  if (targetArg) {
    const t = targetArg.split('=')[1];
    if (t === 'bun' || t === 'node' || t === 'all') return t;
  }
  for (const a of args) {
    if (a === 'bun' || a === 'node' || a === 'all') return a;
  }
  return 'all';
}

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`\x1b[90m${ts}\x1b[0m \x1b[36m[BUILD]\x1b[0m ${msg}`);
}

function checkCommand(cmd: string): boolean {
  try {
    const checkCmd = isWindows ? `where ${cmd}` : `command -v ${cmd}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Bundle TypeScript to a single JS file using esbuild.
 */
function bundleWithEsbuild(): boolean {
  log('Bundling TypeScript with esbuild...');

  if (!existsSync(BUNDLE_DIR)) {
    mkdirSync(BUNDLE_DIR, { recursive: true });
  }

  const esbuildBin = join(ROOT_DIR, 'node_modules', '.bin', isWindows ? 'esbuild.cmd' : 'esbuild');

  if (!existsSync(esbuildBin) && !existsSync(esbuildBin.replace('.cmd', ''))) {
    log('esbuild not found, trying npx...');
    try {
      execSync(`npx esbuild "${ENTRY_FILE}" --bundle --platform=node --target=node22 --format=esm --outfile="${BUNDLE_FILE}" --external:@langchain/* --external:langchain --external:@modelcontextprotocol/* --external:simple-git --external:zod --external:commander --external:picocolors --external:marked`, {
        cwd: ROOT_DIR,
        stdio: 'inherit',
      });
      return true;
    } catch {
      log('ERROR: Failed to bundle with esbuild');
      return false;
    }
  }

  try {
    execSync(
      `"${esbuildBin}" "${ENTRY_FILE}" --bundle --platform=node --target=node22 --format=esm --outfile="${BUNDLE_FILE}" --external:@langchain/* --external:langchain --external:@modelcontextprotocol/* --external:simple-git --external:zod --external:commander --external:picocolors --external:marked`,
      { cwd: ROOT_DIR, stdio: 'inherit' },
    );
    log('Bundle created: ' + BUNDLE_FILE);
    return true;
  } catch {
    log('ERROR: Failed to bundle with esbuild');
    return false;
  }
}

/**
 * Build standalone binary with Bun.
 */
function buildWithBun(): boolean {
  log('Building standalone binary with Bun...');

  if (!checkCommand('bun')) {
    log('SKIP: Bun is not installed or not in PATH');
    return false;
  }

  if (!existsSync(BIN_DIR)) {
    mkdirSync(BIN_DIR, { recursive: true });
  }

  const targetName = isWindows ? `${APP_NAME}-bun-win32${binExt}` : `${APP_NAME}-bun-${platformName}${binExt}`;
  const outPath = join(BIN_DIR, targetName);

  try {
    // Bun can compile TypeScript directly
    const result = spawnSync(
      'bun',
      ['build', '--compile', '--target=bun', `--outfile=${outPath}`, ENTRY_FILE],
      { cwd: ROOT_DIR, stdio: 'inherit' },
    );

    if (result.status === 0) {
      log(`Bun binary built: ${outPath}`);
      return true;
    }

    // Fallback: compile from bundle
    log('Direct compile failed, trying from bundle...');
    if (!existsSync(BUNDLE_FILE)) {
      if (!bundleWithEsbuild()) return false;
    }

    const result2 = spawnSync(
      'bun',
      ['build', '--compile', '--target=bun', `--outfile=${outPath}`, BUNDLE_FILE],
      { cwd: ROOT_DIR, stdio: 'inherit' },
    );

    if (result2.status === 0) {
      log(`Bun binary built (from bundle): ${outPath}`);
      return true;
    }

    log('ERROR: Bun build failed');
    return false;
  } catch (error) {
    log(`ERROR: Bun build failed: ${error}`);
    return false;
  }
}

/**
 * Build standalone binary with Node.js (pkg).
 */
function buildWithNode(): boolean {
  log('Building standalone binary with Node.js/pkg...');

  if (!existsSync(BUNDLE_FILE)) {
    if (!bundleWithEsbuild()) return false;
  }

  if (!existsSync(BIN_DIR)) {
    mkdirSync(BIN_DIR, { recursive: true });
  }

  const targetName = isWindows ? `${APP_NAME}-node-win32${binExt}` : `${APP_NAME}-node-${platformName}${binExt}`;
  const outPath = join(BIN_DIR, targetName);

  const pkgInstalled = existsSync(join(ROOT_DIR, 'node_modules', '.bin', isWindows ? 'pkg.cmd' : 'pkg'));

  if (pkgInstalled) {
    log('Using pkg for Node.js binary...');
    try {
      execSync(
        `npx pkg "${BUNDLE_FILE}" --targets=node22-${platform()}-${arch()} --output="${outPath}" --compress=GZip`,
        { cwd: ROOT_DIR, stdio: 'inherit' },
      );
      log(`Node.js binary built (pkg): ${outPath}`);
      return true;
    } catch (error) {
      log(`pkg build failed: ${error}`);
    }
  } else {
    log('pkg not installed. Install with: npm install pkg');
  }

  // Try Node.js SEA as fallback
  return buildWithNodeSEA(outPath);
}

function buildWithNodeSEA(outPath: string): boolean {
  log('Attempting Node.js SEA build...');

  const seaDir = join(BUNDLE_DIR, 'sea');
  if (!existsSync(seaDir)) {
    mkdirSync(seaDir, { recursive: true });
  }

  // Bundle as CJS for SEA compatibility (include ALL deps, no externals)
  const seaBundleFile = join(seaDir, 'index.cjs');
  log('Bundling as CJS for SEA (including all dependencies)...');
  try {
    execSync(
      `npx esbuild "${ENTRY_FILE}" --bundle --platform=node --target=node22 --format=cjs --outfile="${seaBundleFile}"`,
      { cwd: ROOT_DIR, stdio: 'inherit' },
    );
  } catch {
    log('ERROR: Failed to create CJS bundle for SEA');
    return false;
  }

  // Create the SEA config
  const seaConfig = {
    main: seaBundleFile.replace(/\\/g, '/'),
    output: join(seaDir, 'sea-prep.blob').replace(/\\/g, '/'),
    disableExperimentalSEAWarning: true,
  };

  const seaConfigPath = join(seaDir, 'sea-config.json');
  writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

  try {
    log('Creating SEA blob...');
    execSync(`node --experimental-sea-config "${seaConfigPath}"`, {
      cwd: seaDir,
      stdio: 'inherit',
    });

    log('Copying node binary...');
    const nodeBin = process.execPath;
    const seaBin = join(seaDir, isWindows ? 'app.exe' : 'app');
    execSync(`${isWindows ? 'copy /Y' : 'cp'} "${nodeBin}" "${seaBin}"`, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });

    log('Injecting SEA blob...');
    try {
      execSync(
        `npx postject "${seaBin}" NODE_SEA_BLOB "${join(seaDir, 'sea-prep.blob')}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
        { cwd: ROOT_DIR, stdio: 'inherit' },
      );
    } catch {
      log('postject not available. Install with: npm install -g postject');
      return false;
    }

    const finalDir = dirname(outPath);
    if (!existsSync(finalDir)) {
      mkdirSync(finalDir, { recursive: true });
    }
    execSync(`${isWindows ? 'move /Y' : 'mv'} "${seaBin}" "${outPath}"`, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });

    log(`Node.js binary built (SEA): ${outPath}`);
    return true;
  } catch (error) {
    log(`Node.js SEA build failed: ${error}`);
    return false;
  }
}

function verifyBinary(binPath: string): boolean {
  if (!existsSync(binPath)) {
    log(`VERIFY FAIL: Binary not found: ${binPath}`);
    return false;
  }

  try {
    const result = spawnSync(binPath, ['--version'], {
      cwd: ROOT_DIR,
      stdio: 'pipe',
      timeout: 10000,
    });

    const output = result.stdout?.toString().trim() ?? '';
    if (output.includes(APP_VERSION) || result.status === 0) {
      log(`VERIFY OK: ${binPath} --version → ${output || 'exit 0'}`);
      return true;
    }

    if (result.status === 0) {
      log(`VERIFY OK: ${binPath} runs successfully`);
      return true;
    }

    log(`VERIFY WARN: ${binPath} exited with code ${result.status}: ${result.stderr?.toString().trim()}`);
    return false;
  } catch (error) {
    log(`VERIFY ERROR: ${error}`);
    return false;
  }
}

// ============================================================
// Main
// ============================================================
async function main(): Promise<void> {
  const target = parseArgs();

  console.log('');
  console.log(`  mcp-code-review-tool Binary Builder v${APP_VERSION}`);
  console.log(`  Platform: ${platformName}`);
  console.log(`  Target: ${target}`);
  console.log('');

  const built: string[] = [];
  const results: Array<{ target: string; success: boolean }> = [];

  // Clean previous builds
  if (existsSync(BIN_DIR)) {
    rmSync(BIN_DIR, { recursive: true });
  }

  // Build with Bun
  if (target === 'bun' || target === 'all') {
    if (buildWithBun()) {
      const name = isWindows ? `${APP_NAME}-bun-win32${binExt}` : `${APP_NAME}-bun-${platformName}${binExt}`;
      built.push(join(BIN_DIR, name));
      results.push({ target: 'bun', success: true });
    } else {
      results.push({ target: 'bun', success: false });
    }
  }

  // Build with Node.js
  if (target === 'node' || target === 'all') {
    if (buildWithNode()) {
      const name = isWindows ? `${APP_NAME}-node-win32${binExt}` : `${APP_NAME}-node-${platformName}${binExt}`;
      built.push(join(BIN_DIR, name));
      results.push({ target: 'node', success: true });
    } else {
      results.push({ target: 'node', success: false });
    }
  }

  // Verify
  console.log('');
  log('--- Verification ---');
  let allOk = true;
  for (const bin of built) {
    if (!verifyBinary(bin)) {
      allOk = false;
    }
  }

  // Summary
  console.log('');
  log('--- Build Summary ---');
  for (const r of results) {
    const status = r.success ? '\x1b[32mOK\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  ${r.target}: ${status}`);
  }

  if (allOk && built.length > 0) {
    console.log('');
    log('All binaries verified successfully!');
    console.log('');
    for (const bin of built) {
      console.log(`    ${bin}`);
    }
    console.log('');
  } else if (built.length === 0) {
    console.log('');
    log('No binaries were built. Check that required tools are installed:');
    log('  - Bun: https://bun.sh');
    log('  - Node.js >= 22 + pkg: npm install pkg');
    log('  - esbuild: npm install esbuild');
    console.log('');
    process.exit(1);
  }
}

main().catch((error) => {
  log(`FATAL: ${error}`);
  process.exit(1);
});
