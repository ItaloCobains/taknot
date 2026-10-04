# PRD: Suíte de testes unitários e e2e da base atual

**Date:** 2026-10-03
**Status:** Draft

## Problem

O taknot guarda as notas de uma pessoa no disco da máquina. Hoje não existe nenhum teste automatizado que falhe se uma nota sumir, um notebook for para o lugar errado, ou o editor deixar de gravar. A única checagem, `npm run mcp:smoke`, aponta para arquivos `.js` que o projeto já não tem. Quem sente isso é quem usa o app todo dia e quem mexe no código: um delete, um rename ou um autosave quebrado só aparece com o app aberto, e em geral só no `console`.

## Background

O taknot (v0.0.12) é um app de notas em Markdown no desktop. As notas ficam num vault local (`meta.json` + `notes/*.md`). A interface é uma sidebar, a lista de notas e o editor. Em volta disso: notebooks aninhados, tags coloridas, status, templates, wiki-links `[[Título]]`, grafo, busca, atalhos, modo Vim, e um servidor MCP em localhost para agentes de IA escreverem no mesmo vault enquanto o app está aberto.

A base atual tem cerca de 11 mil linhas em `src/`, sem runner de teste e sem cobertura. O CI só publica release quando sai uma tag `v*`. Não roda typecheck nem teste.

O pedido é cobrir 100% dessa base com testes de unidade e ponta a ponta. "100%" aqui significa o produto que existe hoje: cada fluxo que a pessoa consegue fazer na tela, e cada regra que grava, move, renomeia ou apaga nota, notebook, tag ou template.

## Requirements

### Must Have

- Uma suíte que roda na máquina de quem desenvolve com um comando, e falha com mensagem clara quando um comportamento atual quebra.
- A mesma suíte roda no CI antes de um release. Uma release com teste vermelho não publica.
- Testes de unidade para as regras que decidem o que acontece com os dados, sem abrir a janela do app:
  - Criar, abrir, gravar, fixar, duplicar e apagar nota.
  - Título derivado da primeira linha do corpo.
  - Inbox não pode ser apagado nem movido.
  - Apagar notebook manda as notas dele para o Inbox e sobe os notebooks filhos.
  - Mover notebook recusa ciclo e recusa mover para si mesmo.
  - Renomear tag reescreve o nome em todas as notas. Apagar tag tira o nome das notas. Nome duplicado é recusado.
  - Templates built-in não são editáveis. Templates custom são criados, editados e apagados.
  - Wiki-link, slash commands, LaTeX, atalhos e formatação de data/status, no que muda o que a pessoa vê.
  - Gravação que não mudou nada não altera o arquivo. Nota cujo `.md` sumiu aparece com corpo vazio na lista.
- Testes ponta a ponta do app como a pessoa usa, cobrindo cada fluxo atual:
  - Primeira abertura: Inbox, tag `taknot` e nota Welcome.
  - Nova nota, escolher template, editar, ver "Saving…" e depois "Saved", fechar e reabrir com o texto no disco.
  - Lista: fixadas no topo, busca por título, estado vazio "No notes".
  - Sidebar: All Notes, filtro por notebook, por status e por tag. Tags com "Filtrar tags…" quando há mais de seis.
  - Notebook: criar, criar sub-notebook, renomear, trocar ícone, mover, apagar. Inbox sem mover e sem apagar.
  - Tag: criar na nota, renomear com cor, filtrar, apagar.
  - Status Active, On Hold, Completed, Dropped.
  - Editor: Edit, Split e Preview. Tarefa clicável no preview. Wiki-link que abre a nota. Slash `/`. Modo foco.
  - Duplicar nota com "(copy)", copiar id, exportar `.md`.
  - Apagar nota, tag, notebook e template custom na hora, sem diálogo de confirmação, como o app faz hoje.
  - Templates: buscar, pré-visualizar, criar nota, criar e apagar template custom.
  - Busca rápida (⌘K) só dentro da lista já filtrada. Vazio: "No matching notes".
  - Grafo: notas ligadas por `[[Título]]`, clique abre a nota, vazio "No notes yet".
  - Settings: Vim liga e mostra NORMAL/INSERT/VISUAL. Atalho gravado, conflito e reset. MCP mostra caminho do vault, online/offline e copia o snippet. "Verificar atualizações" dispara a checagem.
- Contrato MCP coberto de ponta a ponta no mesmo vault: listar, ler, criar, atualizar, apagar e duplicar nota. Tags e notebooks, inclusive a recusa de apagar o Inbox. Uma escrita do agente aparece na interface quando a nota aberta não tem edição local pendente. Se a nota aberta tem edição não salva, o texto dela fica. A lista e a sidebar atualizam.
- Meta de cobertura: 100% dos fluxos acima e 100% das regras de persistência da base atual. O relatório de cobertura faz parte da suíte, para "100%" ser um número e não uma impressão.

### Should Have

- CI em pull request, não só na tag de release, com a suíte e o typecheck.
- O `mcp:smoke` atual entra na suíte ou sai. Um comando que não roda contra o código de hoje não conta como teste.
- Casos de borda que hoje só logam no console: nome de tag duplicado, rename em branco cancelado na tela, PDF cancelado, vault externo alterado com o editor sujo.

### Out of Scope

- Funcionalidade nova. Os testes descrevem o taknot como ele é, inclusive deletes sem confirmação e busca que não olha o corpo da nota.
- Cobertura de linha de CSS, dicionários de ortografia e scripts de empacotamento. Isso não muda o que a pessoa consegue fazer com uma nota.
- Pixel a pixel do liquid glass, do diálogo nativo de salvar PDF e do popup nativo de atualização. O teste verifica o efeito (arquivo gravado, checagem disparada), não a janela do sistema operacional.
- Sincronização, multiusuário, nuvem, ou um botão na interface para mover nota de notebook. Mover nota entre notebooks hoje só existe via MCP, e o teste do MCP cobre isso.
- Reescrever a arquitetura para ficar "mais testável" além do mínimo para a suíte rodar.

## Constraints

- A base parte do zero: não há Vitest, Jest, Playwright nem pasta de testes.
- Quem desenvolve precisa rodar a suíte sem publicar release e sem depender do vault real em `~/Library/Application Support/taknot`.
- Parte do comportamento é do sistema, não da tela React: diálogo de PDF, popup de update, menu nativo de ortografia, vidro no macOS 26+. Esses pontos entram pelo efeito observável.
- O CI atual é só `npm ci` + `npm run publish` em macOS, Windows e Linux, disparado por tag. A suíte tem que caber nesse pipeline sem transformar o release num fluxo manual.
- Ortografia (Hunspell en e pt-BR) e preferências de tela (translucidez, Vim, atalhos) ficam fora do vault. Um teste não pode depender do `localStorage` da máquina de alguém.
- Agentes MCP e a janela compartilham o mesmo vault. Um teste de um lado não pode escrever no vault de desenvolvimento de quem está com o app aberto.

## Acceptance Criteria

### Suíte e CI

- Given o repositório limpo depois de `npm install`, when a pessoa roda o comando da suíte, then os testes de unidade e os ponta a ponta executam sem o app de desenvolvimento aberto e sem usar o vault pessoal.
- Given um comportamento atual coberto que foi quebrado, when a suíte roda, then o comando termina com falha e aponta o fluxo ou a regra.
- Given uma tag `v*` com a suíte vermelha, when o CI de release roda, then o publish não acontece.
- Given a suíte verde na base atual, when o relatório de cobertura é gerado, then as regras de persistência e os fluxos listados em Must Have estão cobertos.

### Notas e gravação

- Given o vault vazio de primeira abertura, when o app abre, then existem o Inbox, a tag `taknot` e a nota Welcome.
- Given um template selecionado e nenhum notebook filtrado, when a pessoa cria uma nota, then a nota nasce no Inbox, com status Active e sem tags.
- Given um notebook filtrado na sidebar e nenhuma nota aberta, when a pessoa cria uma nota, then a nota nasce nesse notebook.
- Given uma nota aberta, when a pessoa pede uma nota nova, then o editor volta ao seletor de templates em vez de gravar outra nota na hora.
- Given texto digitado, when passa o tempo de autosave, then a pessoa vê "Saving…" e depois "Saved", e o `.md` no vault contém o texto.
- Given uma nota já salva sem mudança, when o save dispara de novo, then o arquivo não é reescrito.
- Given a primeira linha do corpo preenchida, when a nota salva, then a lista mostra essa linha como título, sem as marcas de heading.
- Given uma nota fixada e outra não, when a lista renderiza, then a fixada aparece primeiro.
- Given o menu da nota, when a pessoa duplica, then surge uma nota com "(copy)" no título.
- Given o menu da nota, when a pessoa apaga, then a nota some da lista e do vault na hora, sem pedido de confirmação.
- Given uma nota cujo arquivo `.md` não existe, when a lista carrega, then o corpo aparece vazio. When alguém abre essa nota pelo id, then a operação falha de forma explícita.

### Notebooks, tags e status

- Given o Inbox, when a pessoa tenta mover ou apagar, then as duas ações ficam indisponíveis e o vault recusa se forem chamadas mesmo assim.
- Given um notebook com notas e notebooks filhos, when a pessoa apaga esse notebook, then as notas dele vão para o Inbox, os filhos sobem para o pai, e o filtro volta para All Notes se esse notebook estava selecionado.
- Given um notebook, when a pessoa tenta movê-lo para dentro de um descendente ou para ele mesmo, then a árvore não muda.
- Given uma tag usada em várias notas, when a pessoa renomeia a tag, then todas essas notas passam a mostrar o nome novo.
- Given uma tag, when a pessoa apaga, then o nome sai das notas e a tag some, sem confirmação.
- Given uma tag com o mesmo nome de outra já existente, when o save é tentado, then a tag nova não é criada.
- Given o nome em branco no rename, when a pessoa confirma na tela, then o rename é cancelado e o nome anterior permanece.
- Given uma nota, when a pessoa escolhe On Hold, Completed ou Dropped, then a lista e o filtro de status refletem esse estado.

### Editor, busca, templates e grafo

- Given uma nota com tarefa Markdown, when a pessoa clica na tarefa no preview, then o checkbox muda no corpo.
- Given duas notas e um `[[Título]]` apontando para a segunda, when a pessoa clica no link no preview ou no nó no grafo, then a segunda nota abre.
- Given o filtro da sidebar em um notebook, when a pessoa abre a busca rápida, then só notas dessa lista filtrada aparecem. A busca da lista continua olhando só o título, não o corpo.
- Given nenhuma nota, when a pessoa abre o grafo, then vê "No notes yet".
- Given os templates built-in, when a pessoa tenta editar um deles, then o template não muda. Given um template custom, when cria, edita ou apaga, then o vault acompanha.
- Given o modo Vim ligado em Settings, when a pessoa volta ao editor, then a barra mostra o modo (NORMAL, INSERT ou VISUAL).
- Given um atalho em conflito com outro, when a pessoa grava o novo, then o conflito aparece e o reset devolve os atalhos padrão.

### MCP e vault compartilhado

- Given o app aberto com o MCP no ar, when um agente cria, atualiza, duplica ou apaga uma nota, tag ou notebook, then o mesmo resultado aparece no vault e a interface atualiza se a nota aberta não tiver edição pendente.
- Given a nota aberta com texto ainda não salvo, when o agente grava essa mesma nota por fora, then o texto local da pessoa permanece e o restante da interface atualiza.
- Given o id do Inbox, when um agente pede para apagar ou mover o Inbox, then a operação é recusada e o Inbox continua lá.
- Given a suíte de MCP, when ela roda, then usa um vault temporário, nunca o vault pessoal.
