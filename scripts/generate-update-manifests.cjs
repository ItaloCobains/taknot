/**
 * Forge postMake hook helper: write electron-updater YAML manifests
 * next to make artifacts and attach them so publisher-github uploads them.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function sha512File(filePath) {
  const buf = fs.readFileSync(filePath);
  return {
    sha512: crypto.createHash('sha512').update(buf).digest('base64'),
    size: buf.length,
  };
}

function pickArtifact(artifacts, predicates) {
  for (const pred of predicates) {
    const hit = artifacts.find((a) => pred(path.basename(a).toLowerCase()));
    if (hit) return hit;
  }
  return null;
}

function manifestFor({ version, filePath, releaseDate }) {
  const name = path.basename(filePath);
  const { sha512, size } = sha512File(filePath);
  return [
    `version: ${version}`,
    `files:`,
    `  - url: ${name}`,
    `    sha512: ${sha512}`,
    `    size: ${size}`,
    `path: ${name}`,
    `sha512: ${sha512}`,
    `releaseDate: '${releaseDate}'`,
    '',
  ].join('\n');
}

function generateUpdateManifests(makeResults) {
  const version = require('../package.json').version;
  const releaseDate = new Date().toISOString();

  return makeResults.map((result) => {
    const platform = result.platform;
    const artifacts = [...(result.artifacts || [])];
    let file = null;
    let yamlName = null;

    if (platform === 'darwin') {
      file = pickArtifact(artifacts, [
        (n) => n.endsWith('.zip'),
        (n) => n.endsWith('.dmg'),
      ]);
      yamlName = 'latest-mac.yml';
    } else if (platform === 'win32') {
      file = pickArtifact(artifacts, [
        (n) => n.endsWith('.exe') && n.toLowerCase().includes('setup'),
        (n) => n.endsWith('.exe'),
        (n) => n.endsWith('.nupkg'),
      ]);
      yamlName = 'latest.yml';
    } else if (platform === 'linux') {
      file = pickArtifact(artifacts, [
        (n) => n.endsWith('.AppImage'),
        (n) => n.endsWith('.deb'),
        (n) => n.endsWith('.rpm'),
      ]);
      yamlName = 'latest-linux.yml';
    }

    if (!file || !yamlName) {
      return { ...result, artifacts };
    }

    const outDir = path.dirname(file);
    const yamlPath = path.join(outDir, yamlName);
    fs.writeFileSync(
      yamlPath,
      manifestFor({ version, filePath: file, releaseDate }),
      'utf8',
    );
    if (!artifacts.includes(yamlPath)) artifacts.push(yamlPath);
    console.log(`[update-manifest] ${platform}: ${yamlName} <- ${path.basename(file)}`);
    return { ...result, artifacts };
  });
}

module.exports = { generateUpdateManifests };
