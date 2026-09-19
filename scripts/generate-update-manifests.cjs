/**
 * Forge postMake: write ONE electron-updater YAML per platform and attach it
 * to a single make result (avoids duplicate latest-*.yml uploads).
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

function platformSpec(platform) {
  if (platform === 'darwin') {
    return {
      yamlName: 'latest-mac.yml',
      predicates: [(n) => n.endsWith('.zip'), (n) => n.endsWith('.dmg')],
    };
  }
  if (platform === 'win32') {
    return {
      yamlName: 'latest.yml',
      predicates: [
        (n) => n.endsWith('.exe') && n.includes('setup'),
        (n) => n.endsWith('.exe'),
        (n) => n.endsWith('.nupkg'),
      ],
    };
  }
  if (platform === 'linux') {
    return {
      yamlName: 'latest-linux.yml',
      predicates: [
        (n) => n.endsWith('.appimage'),
        (n) => n.endsWith('.deb'),
        (n) => n.endsWith('.rpm'),
      ],
    };
  }
  return null;
}

function generateUpdateManifests(makeResults) {
  const version = require('../package.json').version;
  const releaseDate = new Date().toISOString();

  const allByPlatform = new Map();
  for (const result of makeResults) {
    const list = allByPlatform.get(result.platform) || [];
    list.push(...(result.artifacts || []));
    allByPlatform.set(result.platform, list);
  }

  const yamlPathByPlatform = new Map();
  for (const [platform, artifacts] of allByPlatform) {
    const spec = platformSpec(platform);
    if (!spec) continue;
    const file = pickArtifact(artifacts, spec.predicates);
    if (!file) continue;
    const yamlPath = path.join(path.dirname(file), spec.yamlName);
    fs.writeFileSync(
      yamlPath,
      manifestFor({ version, filePath: file, releaseDate }),
      'utf8',
    );
    yamlPathByPlatform.set(platform, yamlPath);
    console.log(
      `[update-manifest] ${platform}: ${spec.yamlName} <- ${path.basename(file)}`,
    );
  }

  const attached = new Set();
  return makeResults.map((result) => {
    const artifacts = [...(result.artifacts || [])];
    const yamlPath = yamlPathByPlatform.get(result.platform);
    if (yamlPath && !attached.has(result.platform)) {
      if (!artifacts.includes(yamlPath)) artifacts.push(yamlPath);
      attached.add(result.platform);
    }
    return { ...result, artifacts };
  });
}

module.exports = { generateUpdateManifests };
