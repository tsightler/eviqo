#!/usr/bin/env node

/**
 * Release script for eviqo monorepo
 *
 * Usage:
 *   npm run release <version>    - Set specific version (e.g., 1.2.0)
 *   npm run release patch        - Bump patch version (1.0.4 -> 1.0.5)
 *   npm run release minor        - Bump minor version (1.0.4 -> 1.1.0)
 *   npm run release major        - Bump major version (1.0.4 -> 2.0.0)
 *
 * Options:
 *   --no-git     Skip git commit and tag
 *   --push       Push commits and tags to origin
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

// Files to update
const PACKAGE_FILES = [
  'package.json',
  'packages/eviqo-client-api/package.json',
  'packages/eviqo-mqtt/package.json',
];
const CONFIG_FILE = 'config.yaml';

// Parse command line arguments
const args = process.argv.slice(2);
const versionArg = args.find(arg => !arg.startsWith('--'));
const noGit = args.includes('--no-git');
const push = args.includes('--push');

if (!versionArg) {
  console.error('Usage: npm run release <version|patch|minor|major> [--no-git] [--push]');
  console.error('');
  console.error('Examples:');
  console.error('  npm run release 1.2.0      # Set specific version');
  console.error('  npm run release patch      # Bump patch (1.0.4 -> 1.0.5)');
  console.error('  npm run release minor      # Bump minor (1.0.4 -> 1.1.0)');
  console.error('  npm run release major      # Bump major (1.0.4 -> 2.0.0)');
  console.error('  npm run release patch --push  # Bump and push to origin');
  process.exit(1);
}

/**
 * Parse semver string into components
 */
function parseSemver(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid semver: ${version}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Get current version from root package.json
 */
function getCurrentVersion() {
  const pkgPath = path.join(ROOT_DIR, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

/**
 * Calculate new version based on bump type or explicit version
 */
function getNewVersion(versionArg) {
  const bumpTypes = ['major', 'minor', 'patch'];

  if (bumpTypes.includes(versionArg)) {
    const current = parseSemver(getCurrentVersion());

    switch (versionArg) {
      case 'major':
        return `${current.major + 1}.0.0`;
      case 'minor':
        return `${current.major}.${current.minor + 1}.0`;
      case 'patch':
        return `${current.major}.${current.minor}.${current.patch + 1}`;
    }
  }

  // Validate explicit version
  parseSemver(versionArg);
  return versionArg;
}

/**
 * Update version in a package.json file
 */
function updatePackageJson(filePath, newVersion) {
  const fullPath = path.join(ROOT_DIR, filePath);
  const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const oldVersion = pkg.version;
  pkg.version = newVersion;
  fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`  ${filePath}: ${oldVersion} -> ${newVersion}`);
}

/**
 * Update version in config.yaml
 */
function updateConfigYaml(newVersion) {
  const fullPath = path.join(ROOT_DIR, CONFIG_FILE);
  let content = fs.readFileSync(fullPath, 'utf8');
  const oldMatch = content.match(/^version:\s*["']?([^"'\n]+)["']?/m);
  const oldVersion = oldMatch ? oldMatch[1] : 'unknown';
  content = content.replace(
    /^version:\s*["']?[^"'\n]+["']?/m,
    `version: "${newVersion}"`
  );
  fs.writeFileSync(fullPath, content);
  console.log(`  ${CONFIG_FILE}: ${oldVersion} -> ${newVersion}`);
}

/**
 * Execute git command
 */
function git(command) {
  try {
    return execSync(`git ${command}`, { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`Git command failed: git ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Check if working directory is clean
 */
function checkCleanWorkingDir() {
  const status = git('status --porcelain');
  if (status) {
    console.error('Error: Working directory is not clean. Please commit or stash changes first.');
    console.error(status);
    process.exit(1);
  }
}

// Main execution
try {
  const currentVersion = getCurrentVersion();
  const newVersion = getNewVersion(versionArg);

  console.log(`\nReleasing version ${newVersion} (current: ${currentVersion})\n`);

  if (!noGit) {
    checkCleanWorkingDir();
  }

  // Update all files
  console.log('Updating version in files:');
  PACKAGE_FILES.forEach(file => updatePackageJson(file, newVersion));
  updateConfigYaml(newVersion);

  if (!noGit) {
    console.log('\nCreating git commit and tag...');

    // Stage all changes
    PACKAGE_FILES.forEach(file => git(`add ${file}`));
    git(`add ${CONFIG_FILE}`);

    // Commit
    git(`commit -m "chore: bump version to ${newVersion}"`);
    console.log(`  Created commit: chore: bump version to ${newVersion}`);

    // Tag
    git(`tag -a v${newVersion} -m "Release v${newVersion}"`);
    console.log(`  Created tag: v${newVersion}`);

    if (push) {
      console.log('\nPushing to origin...');
      git('push origin');
      git('push origin --tags');
      console.log('  Pushed commits and tags to origin');
    } else {
      console.log('\nTo push the release:');
      console.log('  git push origin && git push origin --tags');
    }
  }

  console.log(`\n✓ Release ${newVersion} complete!\n`);

} catch (error) {
  console.error(`\nError: ${error.message}\n`);
  process.exit(1);
}
