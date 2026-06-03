#!/usr/bin/env node

import { execFileSync, execSync } from 'child_process';
import { createHash } from 'crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const root = resolve(import.meta.dirname, '..');
const installDir = join(root, 'AI-Engineering-Coach-Flexera install');
const installDocPath = join(installDir, 'INSTALL_VSIX.txt');
const shaDocPath = join(installDir, 'SHA256.txt');
const packageJsonPath = join(root, 'package.json');
const skipPackage = process.argv.includes('--skip-package');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const vsixName = `${packageJson.name}-${packageJson.version}.vsix`;
const rootVsixPath = join(root, vsixName);
const installVsixPath = join(installDir, vsixName);
const installVsixDisplayPath = `path to folder\\${vsixName}`;

if (!skipPackage) {
  execSync('npm run package', {
    cwd: root,
    stdio: 'inherit'
  });
}

mkdirSync(installDir, { recursive: true });

const sourceVsixPath = resolveSourceVsix(rootVsixPath, installVsixPath);
if (sourceVsixPath !== installVsixPath) {
  copyFileSync(sourceVsixPath, installVsixPath);
}

const artifactBuffer = readFileSync(installVsixPath);
const artifactStats = statSync(installVsixPath);
const sha256 = createHash('sha256').update(artifactBuffer).digest('hex');
const sizeKiB = Math.round(artifactStats.size / 1024);
const repositoryInfo = getRepositoryInfo();

writeFileSync(
  shaDocPath,
  [
    `Name: ${vsixName}`,
    `Path: ${installVsixDisplayPath}`,
    `Size: ${artifactStats.size} bytes : ${sizeKiB} KiB`,
    `SHA256: ${sha256}`,
    '',
    `Repository: ${repositoryInfo.slug}`,
    repositoryInfo.repoUrl,
    '',
    `Build from commit: ${repositoryInfo.shortCommit}`,
    repositoryInfo.commitUrl
  ].join('\n')
);

writeFileSync(
  installDocPath,
  [
    'AI Engineer Coach - Flexera',
    'VSIX Installation Guide',
    '',
    'Package created:',
    installVsixDisplayPath,
    '',
    'Requirements:',
    '- VS Code 1.120.0 or newer',
    '',
    'Option 1: Install from VS Code UI',
    '1. Open VS Code.',
    '2. Press Ctrl+Shift+P.',
    '3. Run the command: Extensions: Install from VSIX...',
    '4. Select this file:',
    `   ${installVsixDisplayPath}`,
    '5. Reload VS Code if prompted.',
    '',
    'Option 2: Install from PowerShell',
    'Run this command:',
    '',
    `code --install-extension "${installVsixDisplayPath}"`,
    '',
    'Optional verification:',
    '- Open the Extensions view in VS Code.',
    '- Confirm that "AI Engineer Coach" is installed.',
    '- Open the Activity Bar and look for "AI Engineer Coach - Flexera".',
    '',
    'If the `code` command is not available:',
    '- In VS Code, open the Command Palette.',
    "- Run: Shell Command: Install 'code' command in PATH",
    '- Restart the terminal and run the install command again.'
  ].join('\n')
);

console.log(`Updated install artifacts for ${vsixName}`);
console.log(`VSIX: ${installVsixPath}`);
console.log(`SHA file: ${shaDocPath}`);
console.log(`Install guide: ${installDocPath}`);

/**
 * @param {string} rootArtifactPath
 * @param {string} installArtifactPath
 */
function resolveSourceVsix(rootArtifactPath, installArtifactPath) {
  if (existsSync(rootArtifactPath)) {
    return rootArtifactPath;
  }

  if (existsSync(installArtifactPath)) {
    return installArtifactPath;
  }

  throw new Error(`VSIX artifact not found at ${rootArtifactPath} or ${installArtifactPath}`);
}

function getRepositoryInfo() {
  const remoteUrl = getGitOutput(['remote', 'get-url', 'origin']) ?? packageJson.repository?.url ?? 'https://github.com/flexera-public/AI-Engineering-Coach';
  const normalizedRemoteUrl = normalizeGitHubUrl(remoteUrl);
  const slug = normalizedRemoteUrl.replace('https://github.com/', '');
  const fullCommit = getGitOutput(['rev-parse', 'HEAD']) ?? 'HEAD';
  const shortCommit = getGitOutput(['rev-parse', '--short', 'HEAD']) ?? fullCommit;

  return {
    slug,
    repoUrl: normalizedRemoteUrl,
    shortCommit,
    commitUrl: `${normalizedRemoteUrl}/commit/${fullCommit}`
  };
}

/**
 * @param {string[]} args
 */
function getGitOutput(args) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * @param {string} url
 */
function normalizeGitHubUrl(url) {
  const trimmedUrl = url.trim().replace(/\.git$/, '');
  const sshMatch = /^git@github\.com:(.+)$/i.exec(trimmedUrl);
  if (sshMatch) {
    return `https://github.com/${sshMatch[1]}`;
  }

  return trimmedUrl;
}

