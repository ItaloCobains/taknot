# taknot

A beautiful markdown notes app for the desktop, built with Electron, React, and CodeMirror.

## Develop

```bash
npm install
npm start
```

## Package locally

```bash
npm run make
```

Artifacts land in `out/`.

## Release (v0.0.1+)

Releases are built by GitHub Actions for **macOS**, **Windows**, and **Linux**, then uploaded to a [GitHub Release](https://github.com/ItaloCobains/taknot/releases).

1. Merge your changes to `main`.
2. Create and push a version tag matching `package.json` (example for this cut):

```bash
git checkout main
git pull
# ensure package.json "version" is 0.0.1
git tag v0.0.1
git push origin v0.0.1
```

3. Open the **Release** workflow on the Actions tab and wait for the three OS jobs.
4. Download installers from the release page: https://github.com/ItaloCobains/taknot/releases/tag/v0.0.1

### Notes

- **macOS builds are unsigned** for now. Gatekeeper may warn on first open — use right-click → Open, or `xattr -dr com.apple.quarantine /path/to/taknot.app`.
- Windows/Linux artifacts come from Squirrel / `.deb` / `.rpm` (plus macOS `.zip` / `.dmg`).
- To cut a later version: bump `version` in `package.json`, commit, tag `vX.Y.Z`, push the tag.

## License

MIT
