# taknot

App de notas em **Markdown** para o desktop — rápido, com visual glass no macOS, editor CodeMirror e vault local.

![Electron](https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-0.0.11-blue)

## Features

- **Editor Markdown** com CodeMirror (syntax highlight, headings grandes, split edit/preview)
- **Vim mode** opcional (Settings) + barra de status (NORMAL / INSERT / VISUAL / …)
- **Wiki-links** `[[Título da Nota]]` — autocomplete no editor e links clicáveis no preview
- **Slash commands** — digite `/` para inserir blocos comuns
- **Pin** — fixa notas no topo da lista
- **Notebooks** aninhados, ícones customizáveis, collapse na sidebar
- **Status** (active / on hold / completed / dropped) e **tags** coloridas
- **Templates** built-in + templates custom (criar / editar / apagar)
- **Focus mode**, translucidez ajustável, autosave no vault local
- **Liquid glass** nativo no macOS 26+ (`electron-liquid-glass`); Windows/Linux usam fundo sólido
- **MCP server** (stdio) — agentes de IA leem/criam/editam notas, tags e notebooks no mesmo vault
- **LaTeX** no preview (KaTeX), `/` LaTeX e autocomplete `\frac` em math

## Stack

| Camada | Tech |
|--------|------|
| Shell | Electron Forge + Vite |
| UI | React 19, lucide-react |
| Editor | CodeMirror 6, `@replit/codemirror-vim` |
| Preview | marked |
| Dados | Vault em JSON + `.md` no `userData` do Electron |

## Desenvolvimento

Requisitos: **Node.js 22+**, npm.

```bash
git clone https://github.com/ItaloCobains/taknot.git
cd taknot
npm install
npm start
```

Depois de mudar código do **main** / `vault.js` / `preload.js`, no terminal do Forge digite `rs` para reiniciar o processo main (o renderer hot-reloada sozinho).

### Scripts

| Comando | O que faz |
|---------|-----------|
| `npm start` | App em modo dev |
| `npm run package` | Empacota sem instaladores |
| `npm run make` | Gera instaladores locais em `out/` |
| `npm run publish` | Make + upload para GitHub Releases |
| `npm run mcp` | Sobe o servidor MCP (stdio) — use via cliente, não no terminal interativo |
| `npx taknot-mcp` / `bin/taknot-mcp` | Mesmo server (após clone + `npm i`) |

## Onde ficam as notas

O vault fica no `userData` do Electron, por exemplo no macOS:

```text
~/Library/Application Support/taknot/vault/
  meta.json
  notes/*.md
```


## Atualização automática

O app verifica releases no GitHub ao abrir. Se houver versão nova, aparece um popup para **atualizar agora** ou **depois**. Depois do download, outro popup oferece reiniciar.

Também dá para checar em **Settings → Verificar atualizações**.

> **macOS:** updates silenciosos/instalação automática funcionam melhor com app **assinado** (Apple Developer). Sem assinatura, o fallback abre o instalador da release.

Os arquivos `latest.yml` / `latest-mac.yml` / `latest-linux.yml` são gerados no `postMake` do Forge e publicados junto com os instaladores.


## MCP (AI agents)

O app **não** inicia o MCP sozinho. O Cursor (ou outro harness) sobe um processo stdio que fala com o mesmo vault.

```bash
npm install
npm run mcp
# ou: ./bin/taknot-mcp
```

Variável opcional:

```bash
export TAKNOT_VAULT="$HOME/Library/Application Support/taknot/vault"
```

### Cursor (`~/.cursor/mcp.json`)

Faça merge com servers existentes:

```json
{
  "mcpServers": {
    "taknot": {
      "command": "node",
      "args": ["/ABS/PATH/taknot/src/mcp/server.mjs"],
      "env": {
        "TAKNOT_VAULT": "/ABS/PATH/Library/Application Support/taknot/vault"
      }
    }
  }
}
```

No macOS o vault padrão é `~/Library/Application Support/taknot/vault`. Em **Settings → MCP** o app mostra o path e um botão para copiar o snippet.

Tools: notes (`list/get/create/update/delete/duplicate`), tags (`list/save/delete`), notebooks (`list/create/rename/icon/move/delete`). Inbox (`nb_inbox`) não pode ser apagado.

Com o app aberto, mudanças feitas pelo agente disparam refresh na UI (`fs.watch` no vault).

## Release

Builds multiplataforma (macOS / Windows / Linux) rodam no GitHub Actions ao publicar um tag `v*`.

1. Atualize `"version"` em `package.json` e faça merge em `main`.
2. Crie e envie o tag:

```bash
git checkout main && git pull
git tag v0.0.11
git push origin v0.0.9
```

3. Acompanhe: [Actions → Release](https://github.com/ItaloCobains/taknot/actions)
4. Downloads: [Releases](https://github.com/ItaloCobains/taknot/releases)

### Observações

- **macOS** ainda sem code signing — o Gatekeeper pode avisar na primeira abertura (botão direito → Abrir, ou `xattr -dr com.apple.quarantine` no `.app`).
- `electron-liquid-glass` é **optionalDependency** (só Darwin); CI em win/linux ignora o pacote.
- Artefatos típicos: `.dmg` / `.zip` (mac), Squirrel (Windows), `.deb` / `.rpm` (Linux).

## Estrutura

```text
src/
  main.js          # processo principal Electron (+ vault watch)
  preload.js       # bridge IPC
  vault.js         # notebooks, notes, tags, templates
  mcp/server.mjs   # MCP stdio (AI agents)
  renderer/        # React UI + CodeMirror
bin/
  taknot-mcp       # CLI entry → src/mcp/server.mjs
```

## License

MIT © Italo Brandão
