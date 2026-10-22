# Open Sea (etapas de implementação)

Este é o plano de trabalho do jogo, etapa por etapa. As regras e a visão geral estão no `JOGO_SO_LONG_ARENA.md`. Leiam esse primeiro!

**Regras para seguirmos:**
- Cada etapa termina com algo **funcionando e testável**. Não começamos a próxima com a anterior quebrada.
- Cada tarefa vira uma **issue no GitHub**. Cada um trabalha na **sua branch** e abre um **Pull Request**, que outra pessoa revisa antes de entrar na `main`.
- Commits pequenos, com mensagens claras (o subject avalia o histórico do Git).
- Na avaliação, **cada um precisa explicar o próprio código** (podem pedir uma alteração ao vivo). Se usarem IA, entendam cada linha.
- Os valores marcados com 🔶 são o padrão inicial e podem mudar depois de testarmos.

---

## Equipe e responsabilidades (proposta)

| Pessoa | Papel | Foco principal |
|---|---|---|
| **Luiz** | Tech Lead + Dev | Motor do jogo (Etapa 1), jogo em rede (Etapa 4), modo local (5) |
| **Pedro** | Dev (+ PO ou PM?) | Autenticação no socket (Etapa 3), integração com o lobby, reconexão (6) |
| **Duarte** | Dev (+ PO ou PM?) | Renderização no navegador (Etapa 2) com o Luiz, depois banco/Prisma (7) |
| **Guilherme** | Dev | Parte obrigatória fora do jogo (Trilha B): HTTPS/nginx, .env, Tailwind, páginas legais |

PO e PM ainda precisam ser definidos. É só uma proposta.

## Ordem e dependências

```
Etapa 0 (todos)
   │
   ├──► Etapa 1: Motor (Luiz) ───────────┐
   ├──► Etapa 2: Renderização (Duarte) ──┤
   ├──► Etapa 3: Auth no socket (Pedro) ─┤
   │                                     ▼
   │                         Etapa 4: Jogo em rede (Luiz + Pedro)
   │                                     │
   │                ┌────────────────────┼─────────────────────┐
   │                ▼                    ▼                     ▼
   │        Etapa 5: Modo local   Etapa 6: Reconexão    Etapa 7: Banco/estatísticas
   │                └────────────────────┼─────────────────────┘
   │                                     ▼
   │                          Etapa 8: Extras (bot, espectador...)
   │                                     ▼
   └──► Trilha B (Guilherme) ───► Etapa 9: Polimento e entrega
```

As **Etapas 1, 2 e 3 podem ser feitas ao mesmo tempo**, porque não dependem umas das outras.

---

## Etapa 0: Preparação (todos, 1–2 dias)

### 0.1 Organização
- [ ] Reunião para apresentar o jogo (`JOGO_SO_LONG_ARENA.md`) e fechar as decisões pendentes (sessão, Prisma).
- [ ] Definir os papéis: PO, PM, Tech Lead (Luiz).
- [ ] Criar o board no GitHub Projects com uma issue por tarefa deste documento.
- [ ] Combinar o canal de comunicação (Discord) e uma reunião fixa por semana.
- [ ] Combinar o padrão de branches: `nome/assunto` (ex.: `luiz/game-engine`, `pedro/socket-auth`).

### 0.2 Limpeza do repositório
- [x] Apagar as sobras na raiz do `Transcendance/`: `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `index.html`. O README diz que não são usadas, mas confirmem rodando o projeto depois.
- [x] Apagar os arquivos `*Zone.Identifier` em `frontend/src/assets/`.
- [x] Remover a dependência `approve` do `backend/package.json` (não é usada).
- [x] Tirar o `backend/users.db` do Git: `git rm --cached backend/users.db` e adicionar `*.db` ao `.gitignore`.
- [x] Adicionar `.env` ao `.gitignore`.

### 0.3 Ambiente de cada um
- [x] Instalar o Node 22 **no WSL/Linux** (não só dentro do Docker), para rodar testes e ter o autocompletar no VS Code:
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  # fechar e abrir o terminal
  nvm install 22
  node -v   # deve mostrar v22.x
  ```
- [x] Rodar `npm install` dentro de `backend/` e de `frontend/` (fora do Docker), para o VS Code encontrar os tipos.
- [ ] Testar que `docker compose up --build` continua funcionando.

### 0.4 Recursos do jogo (Luiz)
- [x] Sprites próprias do Open Sea em `frontend/public/sprites/` (peixes, tubarões, itens, ícones, barras de diamantes).
- [x] Telas em `frontend/public/interface/` (em `.webp`; para converter: `convert arquivo.jpeg -quality 90 nome.webp`).
- [x] **Refazer os 6 mapas** no formato novo (só `1`, `0`, `E` e `A`–`D`), com a tartaruga no centro e os pontos iniciais nas extremidades. `A` e `B` em cantos opostos; médios e grandes simétricos nos 4 cantos. Salvar em `backend/maps/`: `small-1`, `small-2` (2 jogadores), `medium-1`, `medium-2` (2–3), `large-1`, `large-2` (2–4).
- [x] Gerar de novo as imagens-guia em blocos (`mapas-guia/`, fora do Git), com a tartaruga sempre entre duas paredes (só se entra por cima ou por baixo).
- [ ] Desenhar a imagem final de cada mapa em `frontend/public/maps/<mapa>.webp` (sem diamantes, tubarões, power-ups nem HUD).

**Pronto quando:** board criado, papéis definidos, repositório limpo, todos com o ambiente funcionando e com pelo menos um commit.

---

## Etapa 1: Motor do jogo sem rede (Luiz, 4–6 dias)

**Objetivo:** todas as regras do jogo em TypeScript puro, **sem Socket.IO, sem React e sem timers**. É o meu so_long reescrito, testável com testes automáticos e jogável no terminal.

**Por que sem timers?** A `GameRoom` não chama `setInterval` sozinha. Quem chama "move os tubarões agora" ou "passou um segundo" é o código de fora (os testes agora, o `gameManager` na Etapa 4). E **o horário (`now`) e o sorteio (`random`) entram como parâmetro**. Assim os testes controlam o tempo e o sorteio e conseguem testar tudo sem esperar segundos de verdade.

### 1.1 Preparar os testes ✅
- [x] No `backend/`: `npm install -D vitest`.
- [x] Em `backend/package.json`, trocar o script `test` por `"test": "vitest"`.
- [x] Criar `backend/src/game/__tests__/sanity.test.ts` com um teste bobo (`expect(1 + 1).toBe(2)`) e rodar `npm test` para confirmar.

### 1.2 Tipos e constantes
Atualizado para as regras do Open Sea ✅
- [x] `types.ts`: os tipos da seção 5 do documento do jogo (`Character`, `PowerUpType`, `Player` com `diamonds`, `character`, `powerUp`, `speedUntil`, `enchantedUntil`; `GameState` com `goal`, `diamonds`, `powerUps`, `monstersFrozenUntil`, `nextPowerUpAt`). Sai o tipo `Coin`.
- [x] `MapData` passa a ter só a parte fixa:
  ```ts
  type MapSize = "small" | "medium" | "large";
  type MapData = {
      width: number; height: number;
      walls: boolean[][];              // [y][x]
      exit: Position;
      spawns: Position[];              // índice = slot (A=0, B=1, ...)
  };
  ```
- [x] `config.ts`:
  ```ts
  export const MOVE_COOLDOWN_MS = 150;            // 🔶
  export const MONSTER_INTERVAL_MS = 500;         // 🔶
  export const RESPAWN_DELAY_MS = 3000;           // 🔶
  export const INVULNERABLE_MS = 1000;            // 🔶
  export const SPEED_DURATION_MS = 5000;          // 🔶
  export const FREEZE_DURATION_MS = 2000;         // 🔶
  export const ENCHANT_DURATION_MS = 5000;        // 🔶
  export const POWERUP_INTERVAL_MS = 5000;        // 🔶
  export const MAX_POWERUPS_ON_MAP = 3;           // 🔶
  export const MONSTER_MIN_SPAWN_DISTANCE = 4;    // 🔶 passos
  export const RECONNECT_TIMEOUT_MS = 30000;

  export const SIZE_RULES: Record<MapSize, {
      players: number[]; goal: number; monsters: number; timeLimitMs: number;
  }> = {
      small:  { players: [2],       goal: 5,  monsters: 4, timeLimitMs: 3 * 60_000 },  // 🔶 tempo
      medium: { players: [2, 3],    goal: 10, monsters: 6, timeLimitMs: 4 * 60_000 },  // 🔶 tempo
      large:  { players: [2, 3, 4], goal: 10, monsters: 8, timeLimitMs: 5 * 60_000 },  // 🔶 tempo
  };
  // diamantes no mapa = goal * jogadores + 1
  ```

### 1.3 Leitura dos mapas: `mapLoader.ts`
Atualizado ✅ (além disso: `mapSize(name)` devolve o tamanho de um mapa, e `diamondCount(size, players)` em `config.ts` faz a conta `goal × jogadores + 1`)
- [x] `parseMap(text)`: aceita só `1`, `0`, `E` e `A`–`D`. Os outros caracteres (`a`–`d`, `X`, `*`) passam a dar erro.
- [x] `MAPS` passa a ser uma lista com o tamanho de cada mapa: `{ name: "medium-1", size: "medium" }`...
- [x] `mapsFor(playerCount)`: os mapas que aceitam esse número de jogadores (o que a tela de escolha de mapa mostra). Ex.: 2 → os 6; 3 → médios e grandes; 4 → grandes.
- [x] `pickMap(playerCount, choice, random)`: com `"random"`, sorteia entre `mapsFor(playerCount)`; com um nome, recusa se o mapa não aceita esse número de jogadores.
- [x] `loadMap(name)`: sem mudanças.
- [x] **Teste `maps.test.ts`**. Para cada um dos 6 mapas:
  - borda toda de parede;
  - exatamente 1 tartaruga (`E`);
  - número de pontos iniciais = máximo de jogadores do tamanho (small = 2, medium = 3, large = 4);
  - todo o chão alcançável a partir da tartaruga (flood fill, uma função de poucas linhas);
  - todos os pontos iniciais **à mesma distância** da tartaruga (busca em largura);
  - casas livres suficientes para o pior caso: `goal × máximo de jogadores + 1` diamantes + os tubarões + os power-ups.

### 1.3b Sorteios: `placement.ts` ✅
Funções puras, que recebem o `random` como parâmetro (para os testes controlarem o sorteio):
- [x] `freeCells(map, occupied)`: casas de chão que não são parede, tartaruga, ponto inicial nem estão em `occupied`.
- [x] `placeMonsters(map, count, random)`: sorteia `count` casas livres a pelo menos `MONSTER_MIN_SPAWN_DISTANCE` passos de qualquer ponto inicial.
- [x] `placeDiamonds(map, count, occupied, random)`: sorteia `count` casas livres, sem repetir.
- [x] `placePowerUp(map, state, random)`: sorteia uma casa livre (sem diamante, power-up, jogador nem tubarão) e um tipo entre os 3.
- [x] Testes: o número certo de itens, nenhum em parede, tartaruga ou ponto inicial, nenhum repetido, tubarões longe dos pontos iniciais, e o mesmo `random` → o mesmo resultado.

### 1.4 A classe `GameRoom` (`GameRoom.ts`)

```ts
class GameRoom {
    state: GameState;
    dirty: boolean;                    // true = algo mudou e precisa ser enviado
    events: GameEvent[];               // fila de eventos para o cliente (morte, diamante...)
                                       // o servidor pega e esvazia com takeEvents()

    constructor(id: string, mapName: string, map: MapData, size: MapSize,
                players: PlayerInfo[],             // { userId, username, character }
                options: RoomOptions);             // { local, random? }

    start(now: number): void;                       // status = "running", endsAt = now + timeLimitMs
    move(slot: number, dir: Direction, now: number): void;
    usePowerUp(slot: number, now: number): void;
    tickMonsters(now: number): void;                // chamado a cada MONSTER_INTERVAL_MS
    tickSecond(now: number): void;                  // chamado a cada 1 s
    leave(slot: number): void;                      // desistência
    setConnected(slot: number, connected: boolean, now: number): void;
    takeEvents(): GameEvent[];                      // devolve os eventos e esvazia a fila
    snapshot(now: number): DynamicState;            // o que vai no game:state (tempos = ms restantes)
}
```

Regras de cada método, **nesta ordem de verificação**:

- [x] **`constructor`**: copia as paredes e a tartaruga do `MapData`. `goal` vem de `SIZE_RULES[size]`. Cria um `Player` por jogador, com `slot` = índice, `pos` = `spawn` = `map.spawns[slot]`, `diamonds = 0`, `powerUp = null`. Sorteia os tubarões (`placeMonsters`) e depois os diamantes (`placeDiamonds`, `goal × jogadores + 1`). `status = "countdown"`. Recusa (erro) um número de jogadores que o tamanho não aceita.
- [x] **`start(now)`**: só a partir de `"countdown"`. `status = "running"`, `endsAt = now + timeLimitMs`, `nextPowerUpAt = now + POWERUP_INTERVAL_MS`.
- [x] **`move(slot, dir, now)`**: (os eventos entram na parte 6)
  1. partida não está `"running"` → ignora;
  2. jogador não está `"playing"` (morto, desconectado, saiu) → ignora;
  3. `now < frozenUntil` → ignora;
  4. cooldown: `MOVE_COOLDOWN_MS`, ou a metade se `now < speedUntil`. Se `now - lastMoveAt` for menor → ignora;
  5. calcula o destino; é parede → ignora (mas atualiza `facing` se for esquerda/direita, como no original);
  6. há outro jogador **vivo** no destino → ignora;
  7. move: `pos = destino`, `lastMoveAt = now`, `moves++`, `facing`;
  8. há diamante no destino **e** `diamonds < goal` → remove o diamante, `diamonds++`, evento `diamond`;
  9. há power-up no destino **e** `powerUp === null` → guarda o tipo, remove do mapa, evento `powerUpPickup`;
  10. há tubarão no destino → `kill(player, now)`;
  11. destino é a tartaruga e `diamonds === goal` → `finish(slot, "exit")`;
  12. `dirty = true`.
- [x] **`usePowerUp(slot, now)`**: precisa estar `"running"`, o jogador `"playing"`, não congelado e com `powerUp`. Aplica o efeito e faz `powerUp = null`:
  - `speed`: `speedUntil = now + SPEED_DURATION_MS`;
  - `freeze`: para cada **outro** jogador vivo, `frozenUntil = now + FREEZE_DURATION_MS`, e `monstersFrozenUntil = now + FREEZE_DURATION_MS`;
  - `enchant`: `enchantedUntil = now + ENCHANT_DURATION_MS`.

  Evento `powerUpUsed`. `dirty = true`.
- [x] **`tickMonsters(now)`**: se `now < monstersFrozenUntil`, os tubarões não andam (mas continuam matando quem encostar). Senão, para cada tubarão, sorteia uma direção com `random()` (como o `rand() % 4` do so_long) e move se o destino **não** for parede, tartaruga nem outro tubarão. Diamantes e power-ups **não** bloqueiam (o tubarão passa por cima). Depois, para cada jogador `"playing"` na mesma casa de um tubarão → `kill` (feito mesmo com os tubarões congelados; desconectados não morrem).
- [x] **`kill(player, now)`** (privado): ignora se `now < invulnerableUntil` ou `now < enchantedUntil`. Senão: `status = "dead"`, `deaths++`, `respawnAt = now + RESPAWN_DELAY_MS`. Mantém os diamantes e perde o `powerUp` (`powerUp = null`) 🔶. Evento `death`.
- [x] **`tickSecond(now)`**:
  1. `now >= endsAt` → `finish(null, "timeout")` (vencedor = mais diamantes; empate no topo = sem vencedor);
  2. jogadores `"dead"` com `now >= respawnAt` **e** spawn livre (sem jogador vivo e sem tubarão em cima) → `status = "playing"`, `pos = spawn`, `invulnerableUntil = now + INVULNERABLE_MS`;
  3. jogadores `"disconnected"` há mais de `RECONNECT_TIMEOUT_MS` → `leave(slot)`;
  4. `now >= nextPowerUpAt` e menos de `MAX_POWERUPS_ON_MAP` no mapa → `placePowerUp`; `nextPowerUpAt = now + POWERUP_INTERVAL_MS`.
- [x] **`leave(slot)`**: `status = "left"`. Se sobrar só 1 jogador ativo (playing, dead ou disconnected) → `finish(esse, "forfeit")`. Vale também na contagem.
- [x] **`setConnected(slot, connected, now)`**: ao cair, guarda `disconnectedAt`; quem estava `"playing"` vira `"disconnected"` (fica parado, bloqueia, tubarão não mata). Quem estava morto continua `"dead"` e só renasce depois de voltar. Ao voltar, `disconnectedAt = null` e `"disconnected"` → `"playing"`.
- [x] **Eventos** (`GameEvent` em `types.ts`): `diamond`, `powerUpPickup`, `powerUpUsed`, `death`.
- [x] **`finish(winnerSlot, reason)`**: `status = "finished"`, guarda `winnerSlot` e `endReason`. Depois disso, todos os métodos ignoram chamadas.
- [x] **`snapshot(now)`**: devolve só o que o cliente precisa (`DynamicState` em `types.ts`; sem `walls` nem `userId`). Os tempos vão como **ms restantes** (`timeLeftMs`, `frozenMs`...), assim o relógio do navegador não precisa estar certo.

### 1.5 Testes do motor (`gameRoom.test.ts`) ✅
Usam os mapas reais `small-1` (e `medium-1` para 3 jogadores), um `now` controlado e um `random` fixo (`seeded`, ou `always(dir)` para mandar os tubarões para um lado). Para testar regras específicas, o teste pode colocar diamantes, tubarões e power-ups à mão no `state` depois do construtor. Casos mínimos:
- [x] o construtor sorteia `goal × jogadores + 1` diamantes e o número certo de tubarões;
- [x] não anda antes do `start`;
- [x] parede bloqueia;
- [x] cooldown: dois `move` com 100 ms de diferença → só o primeiro vale; com 150 ms → os dois valem;
- [x] jogador bloqueia jogador;
- [x] pega diamante; com a meta atingida, passa por cima **sem** pegar;
- [x] tartaruga sem a meta → não termina;
- [x] tartaruga com a meta → termina e esse jogador vence;
- [x] andar para cima de um tubarão → morre;
- [x] tubarão anda para cima do jogador → morre;
- [x] tubarão passa por cima de diamante e power-up sem removê-los, e não entra na tartaruga nem em outro tubarão;
- [x] morto renasce depois de 3 s, no spawn, e fica invulnerável 1 s;
- [x] renascimento espera se o spawn estiver ocupado;
- [x] morto não bloqueia ninguém e não pode se mover;
- [x] power-up aparece a cada 5 s, no máximo 3 no mapa;
- [x] não pega um segundo power-up se já tem um;
- [x] velocidade: com 75 ms de diferença, os dois movimentos valem, e depois de 5 s volta ao normal;
- [x] congelar: adversários e tubarões param 2 s, quem usou anda; encostar num tubarão congelado ainda mata;
- [x] encantar: encostar num tubarão não mata por 5 s, e depois volta a matar;
- [x] tempo acaba → vence quem tem mais diamantes; empate → `winnerSlot = null`;
- [x] `leave` com 2 jogadores → o outro vence;
- [x] desconectado há mais de 30 s → perde;
- [x] depois de `finished`, nada mais muda.

### 1.6 Jogar no terminal (`debug.ts`)
Um script para testar "na mão", o "so_long no terminal":
- [x] carrega um mapa com 2 jogadores (modo local); o padrão é `small-1`, e dá para escolher outro: `npm run debug medium-1`;
- [x] imprime o mapa em ASCII a cada mudança (`#` parede, `A`/`B` jogadores, `$` diamante, `M` tubarão, `E` tartaruga, `s`/`f`/`e` power-ups, mais tempo, diamantes e power-up guardado);
- [x] lê o teclado com `readline` (`process.stdin.setRawMode(true)`): WASD + R para o jogador 1 e setas + L para o jogador 2 (as mesmas teclas do modo local do jogo); Q ou Ctrl+C sai;
- [x] `setInterval` chamando `tickMonsters` e `tickSecond`;
- [x] rodar com `npm run debug` (dentro de `backend/`).

**Pronto quando:** `npm test` passa tudo e dá para jogar uma partida inteira no terminal.

---

## Etapa 2: Renderização no navegador (Duarte + Luiz, 4–5 dias)

**Objetivo:** desenhar o jogo num `<canvas>` a partir de um estado **falso**, sem precisar do backend. Pode ser feita ao mesmo tempo que a Etapa 1.

### 2.1 Tipos compartilhados
- [x] `frontend/src/game/protocol.ts`: os tipos que o navegador recebe (`Position`, `DynamicState`, `PlayerView`, `GameEvent`, `MapInfo`...). **Cópia** dos mesmos tipos de `backend/src/game/types.ts`: se mudar num, muda no outro. O teste `backend/src/game/__tests__/protocol.test.ts` falha se estiverem diferentes. (Os nomes das mensagens do socket ficam para a Etapa 3.)
- [x] `frontend/src/game/fixtureState.ts` (`fixtureMap` + `fixtureState`, no mapa `small-1`): um estado de exemplo escrito à mão (um mapa pequeno, 2 jogadores, alguns tubarões e diamantes, power-ups no chão, um jogador com power-up guardado, outro congelado).

### 2.2 Carregar as sprites (`sprites.ts`)
- [x] `loadSprites(): Promise<Sprites>` (`Sprites` = nome → imagem, ex.: `sprites["goldfish-right"]`; 45 imagens): cria um `Image` para cada `.webp` e espera todos carregarem (`img.onload`). Sprites: os 4 peixes (`-left`/`-right`), `portrait-*`, `shark-*` (normal, `frozen`, `enchanted`), `item-*`, `icon-*`, `exit-turtle`, `bubble`, `diamonds-5/*`, `diamonds-10/*`.
- [x] O jogo só começa a desenhar depois de carregar tudo (mostrar "Carregando..." enquanto isso).

### 2.3 Desenho (`renderer.ts`)
Funções puras que recebem `ctx`, o estado e o tamanho da casa (`tile`):
- [x] `drawBoard`: o mapa em blocos (parede escura, chão em xadrez de dois azuis).
- [x] **Fundo**: a imagem do mapa (`/maps/<mapa>.webp`, 64 px por casa) desenhada no lugar dos blocos. Só é pedida para os mapas da lista `MAPS_WITH_IMAGE` em `sprites.ts` (um 404 aparece como erro no console). Feito: `small-1`.
- [x] Modo de depuração (tecla F2): pinta as paredes do `.ber` de vermelho semitransparente por cima, para conferir se a arte bate com a grade.
- [x] Tartaruga: só nos mapas sem imagem (dentro do `drawBoard`); nas imagens, ela já está desenhada.
- [x] `drawDiamonds`: `item-diamond` em cada posição.
- [x] `drawPowerUps`: `item-speed`, `item-freeze` ou `item-enchant`.
- [x] `drawMonsters` (o lado para onde olha vem de como o tubarão se moveu, `trackSharks`): `shark-left`/`-right`; `shark-frozen-*` enquanto congelados; `shark-enchanted-*` na tela de quem está encantado 🔶.
- [x] `drawPlayers` (velocidade = rastro; congelado = bloco de gelo; encantado = corações girando):
  - sprite do peixe conforme `character` e `facing`;
  - nome em cima;
  - ícone do power-up guardado (`icon-*`) no canto da casa;
  - pisca se invulnerável; tom azulado se congelado; brilho/rastro se rápido; corações se encantado; não desenha se `dead`.
- [x] `drawHud` (no próprio canvas, sobre a borda do mapa, como no `interface/game-mockup.webp`): relógio no meio em cima (vermelho nos últimos 10 s) e, para cada jogador, retrato (`portrait-*`, apagado se morto/desconectado, com os segundos para renascer), barra de diamantes (`diamonds-5/<n>` ou `diamonds-10/<n>`), bolha com o power-up guardado (`bubble` + `icon-*`) e mortes. Jogadores 0 e 1 em cima, 2 e 3 embaixo (pares a partir da esquerda, ímpares da direita). Sem palavras, só números e ícones (não precisa de i18n).
- [x] `drawFrame(frame)`: chama tudo na ordem acima (recebe um objeto `Frame` com tudo o que precisa).

### 2.4 Componente `GameScreen.tsx`
- [x] Um `<canvas>` com `useRef`. Temporário: abrir em `http://localhost:5173/?game` (desvio em `main.tsx`).
- [x] Calcula o tamanho da casa: `tile = Math.floor(Math.min(largura / map.width, altura / map.height))`, **no máximo 64** (o tamanho em que as sprites e os mapas foram feitos: nunca esticar), a cada quadro. Usa o `devicePixelRatio` para ficar nítido em telas com zoom.
- [x] Laço com `requestAnimationFrame(drawFrame)`, cancelado no unmount (`cancelAnimationFrame` no retorno do `useEffect`).
- [x] Por enquanto usa o `fixtureState`.

### 2.5 Controles (`input.ts`)
- [x] `createInput(mode: "online" | "local", send: (command) => void)`: registra `keydown` e devolve a função que remove o listener (usada direto como limpeza do `useEffect`).
  - online: WASD ou setas → `{ type: "move", dir }`; R ou L → `{ type: "powerUp" }` (as duas mãos movem o seu peixe);
  - local: WASD/R → `slot: 0`; setas/L → `slot: 1`.
  - Ignora teclas com Ctrl/Alt/Cmd (atalhos do navegador) e teclas digitadas em campos de texto (o chat, depois).
- [x] Usar `event.code` (`"KeyW"`, `"ArrowUp"`...) em vez de `event.key`, para funcionar com qualquer layout de teclado.
- [x] `event.preventDefault()` nas teclas do jogo (as setas rolariam a página).
- [x] Botões de toque (`TouchControls.tsx`: 4 setas embaixo à esquerda + bolha de power-up embaixo à direita), só em celulares e tablets (`matchMedia("(pointer: coarse)")`) e só no modo online. Segurar uma seta repete o movimento a cada 50 ms (mais rápido que qualquer cooldown, inclusive os 75 ms com velocidade; o servidor ignora os extras, como quando se segura uma tecla).
- [x] Por enquanto, `send` só faz `console.log` (F12). Temporário: `/?game` = online, `/?game=local` = modo local.

**Pronto quando:** o estado falso aparece bem desenhado, se adapta ao tamanho da janela, as animações rodam e as teclas aparecem no console. O console precisa estar **sem warnings** (requisito do subject).

---

## Etapa 3: Autenticação no socket (Pedro, 3–4 dias)

**Objetivo:** o servidor saber **quem** é cada conexão sem confiar no que o navegador diz. É pré-requisito da Etapa 4 e também da parte obrigatória do subject.

- [ ] Decidir em equipe: **JWT em cookie httpOnly** ou **JWT em localStorage**.
- [ ] Adicionar **email** ao cadastro (obrigatório no subject) e validar o formato no frontend e no backend.
- [ ] `POST /login`: se a senha estiver certa, gera o JWT (`jsonwebtoken`) com `{ userId }`, assinado com uma chave do `.env` (`JWT_SECRET`).
- [ ] `GET /me`: devolve o usuário logado a partir do token, para o F5 não deslogar.
- [ ] `POST /logout`.
- [ ] Middleware do Express que lê o token e preenche `req.userId`. Rotas como `/game-result` passam a usar `req.userId` e **não** o `username` do corpo.
- [ ] Middleware do Socket.IO (`io.use(...)`): valida o token na conexão e guarda `socket.data.userId` e `socket.data.username`. Sem token válido → recusa a conexão.
- [ ] `lobby.ts`: parar de receber o `username` do cliente em `lobby:create` e `lobby:join`, e usar o `socket.data`.
- [ ] Impedir que o mesmo usuário esteja em dois lobbies ao mesmo tempo.

**Pronto quando:** dois navegadores com contas diferentes entram no mesmo lobby, o servidor sabe quem é quem pelo token, e o F5 mantém o login.

---

## Etapa 4: Jogo em rede (Luiz + Pedro, 4–6 dias)

**Depende de:** Etapas 1, 2 e 3.

### 4.1 Servidor
- [ ] `gameManager.ts`:
  - `games: Map<string, GameRoom>` e `userGame: Map<number, string>` (em que partida cada usuário está);
  - `createGame(lobby, options)`: escolhe o mapa (`pickMap`), cria a `GameRoom`, coloca os sockets na room `game:<id>`, envia `game:start` para cada um (com o seu `you`) e faz a contagem 3-2-1 (`game:countdown`) antes do `start(now)`;
  - **timers por partida**: `setInterval(tickMonsters, MONSTER_INTERVAL_MS)`, `setInterval(tickSecond, 1000)` e `setInterval(broadcast, 50)`, que **só envia se `dirty`**, junto com a fila de `events`;
  - quando a `GameRoom` fica `finished`: para todos os timers, envia `game:end`, chama a gravação no banco (a função fica vazia até a Etapa 7), remove dos `Map`s e devolve o lobby ao estado "ready".
- [ ] `gameSocket.ts`: registra `game:move`, `game:usePowerUp` e `game:leave`:
  - descobre a partida e o slot pelo `socket.data.userId` (nunca pelo que vem do cliente);
  - **valida** os dados: `dir` tem de ser uma das 4 strings; senão ignora.
- [ ] `lobby.ts`:
  - `MAX_PLAYERS` passa de 8 para **4**;
  - `startMatch` chama `gameManager.createGame`;
  - novo evento `lobby:settings` (só o host): número de jogadores (2, 3 ou 4) e mapa (`"random"` ou um de `mapsFor(n)`). O lobby passa a ter N vagas, e o Start só libera com as N preenchidas e todos *ready*;
  - novo evento `lobby:character`: cada jogador escolhe o peixe; o servidor recusa um peixe que já foi escolhido no lobby;
  - remover a lógica de cliques (`match:*`).

### 4.2 Cliente
- [ ] Telas do lobby (com as artes de `interface/`): número de jogadores → mapa (`mapsFor(n)` + "Aleatório") → escolha de personagem (peixes já escolhidos aparecem bloqueados).
- [ ] `GameScreen.tsx`: troca o `fixtureState` pelos eventos reais (`game:start`, `game:countdown`, `game:state`, `game:event`, `game:end`) e o `send` do `input.ts` passa a emitir `game:move` / `game:usePowerUp`.
- [ ] Contagem 3-2-1 na tela.
- [ ] Tela de fim: a tela `winner-<peixe>` com o nome do vencedor escrito pelo código, diamantes e mortes de cada um, botões "Voltar ao lobby" e "Sair".
- [ ] Remover o Clicky: `MultiplayerGame.tsx`, o `Game.tsx` antigo e a rota `/game-result`.

**Pronto quando:** partidas com 2, 3 e 4 jogadores em **computadores diferentes** (ou navegadores diferentes) do início ao fim, e **duas partidas ao mesmo tempo** sem se misturarem.

---

## Etapa 5: Modo local 1v1 (Luiz, 2 dias)

- [ ] Botão **"Play local"** no menu → escolha do mapa (qualquer um que aceite 2 jogadores, ou aleatório) → escolha dos dois peixes.
- [ ] Evento `local:start { map }` → o `gameManager` cria uma `GameRoom` com `local: true`: slot 0 = o usuário logado, slot 1 = `{ userId: null, username: "Convidado" }`.
- [ ] No modo local, `game:move` e `game:usePowerUp` recebem `{ slot, dir }`. O servidor só aceita `slot` 0 ou 1 e **só se** o socket for o dono da partida local.
- [ ] `input.ts` em modo `"local"`.
- [ ] Partidas locais **não gravam** estatísticas 🔶.

**Pronto quando:** dá para jogar 1v1 no mesmo teclado do início ao fim.

---

## Etapa 6: Reconexão e robustez (Pedro + Luiz, 3 dias)

- [ ] No `disconnect`: se o usuário está numa partida → `room.setConnected(slot, false, now)` e aviso `game:playerStatus` para os outros.
- [ ] Na conexão de um socket: se o `userId` está numa partida ativa → coloca o socket na room, `setConnected(slot, true)` e envia `game:resume` (mapa + estado + `you`).
- [ ] No cliente: ao reconectar (evento `connect` do socket) com uma partida em andamento → `game:rejoin`; mostrar "Reconectando..." enquanto `socket.connected === false`; ao abrir o app (F5), se o servidor mandar `game:resume`, abrir direto o `GameScreen`.
- [ ] O personagem desconectado aparece com um ícone de "sem conexão".
- [ ] No modo local: se cair, o mesmo vale (o dono tem 30 s para voltar).
- [ ] **Testar** e anotar os resultados:
  - fechar a aba e reabrir em menos de 30 s → volta para a partida;
  - ficar fora mais de 30 s → perde;
  - F5 no meio da partida;
  - desligar o Wi-Fi por 10 s;
  - o host sai no meio da partida;
  - todos saem;
  - Chrome DevTools → Network → "Slow 3G": continua jogável;
  - enviar eventos inválidos pelo console do navegador (`socket.emit("game:move", 123)`) → o servidor ignora sem quebrar.

**Pronto quando:** nenhum desses casos derruba o servidor, deixa uma partida "presa" ou mostra erro no console.

---

## Etapa 7: Banco, estatísticas e histórico (Duarte + Pedro, 4 dias)

- [ ] **Se formos usar o Prisma**: instalar e criar o `schema.prisma` com `User`, `Match` e `MatchPlayer`, migrando também o que hoje está no `database.ts`.
- [ ] Tabelas/modelos:
  - `Match`: `id`, `mapName`, `startedAt`, `endedAt`, `endReason` (`exit` | `timeout` | `forfeit`), `winnerId?`;
  - `MatchPlayer`: `matchId`, `userId`, `slot`, `character`, `result` (`win` | `loss` | `draw` | `forfeit`), `diamonds`, `moves`, `deaths`, `powerUpsUsed`, `finishMs?`.
- [ ] `persistence.ts`: `saveMatch(room)` grava tudo **numa transação** (ou grava tudo, ou nada).
- [ ] Rotas: `GET /api/users/:id/matches` (histórico paginado), `GET /api/users/:id/stats` (totais), `GET /api/leaderboard`.
- [ ] Telas: **Histórico** (data, mapa, personagem, adversários, resultado, diamantes, mortes), **Perfil** com os totais e % de vitórias, **Leaderboard**.
- [ ] Remover as colunas antigas `wins`/`losses`/`multiplayer_*` da tabela `users`. Os totais passam a ser calculados a partir de `MatchPlayer`.

**Pronto quando:** depois de algumas partidas, o histórico, o perfil e o leaderboard mostram os números certos.

> 🎯 **Neste ponto, o núcleo está completo:** jogo web (2) + remote players (2) + multiplayer 3+ (2) + estatísticas (1) = **7 pontos só do jogo**.

---

## Etapa 8: Extras (pela ordem que faltar pontos)

| Extra | Pts | Quem | Resumo |
|---|---|---|---|
| **Customização** | 1 | Luiz | O host escolhe o tempo, a velocidade dos tubarões (lenta/normal/rápida) e quais power-ups ligar. Como já temos mapas, personagens e power-ups, é pouco trabalho |
| **Bot (IA)** | 2 | Luiz | O "1 Player": você contra um jogador controlado pelo servidor. Busca em largura até o diamante mais próximo evitando tubarões, reação de 250–450 ms, 10% de movimentos aleatórios, usa os power-ups quando um humano está perto da tartaruga |
| **Espectador** | 1 | Pedro | Botão "Assistir" nos lobbies em partida; recebe `game:state` sem controlar nada |
| **Gamificação** | 1 | Duarte | Conquistas ("ganhou sem morrer", "menos de 60 movimentos", "10 vitórias") + XP/nível + o leaderboard |
| **Torneio** | 1 | ? | Chaveamento de partidas 1v1 usando as `GameRoom` |

---

## Trilha B: parte obrigatória fora do jogo (Guilherme + quem estiver livre)

Isso **reprova o projeto** se faltar, então precisa andar em paralelo desde o início:

- [ ] **nginx com HTTPS** (certificado self-signed) como porta de entrada: `/` → frontend, `/api` → backend, `/socket.io` → backend (WebSocket).
- [ ] Trocar todos os `http://localhost:3000` do frontend por **caminhos relativos** (`fetch("/api/login")`, `io()`).
- [ ] `.env` (ignorado pelo Git) + `.env.example`, com `JWT_SECRET`, `DATABASE_URL` etc.
- [ ] **Tailwind CSS** no frontend, substituindo aos poucos os estilos inline.
- [ ] Páginas **Privacy Policy** e **Terms of Service** com conteúdo real, com links no rodapé.
- [ ] Validação de todos os formulários no frontend e no backend.
- [ ] Docker "de entrega": build de produção do frontend servido pelo nginx.
- [ ] **User management** (módulo, 2 pts): editar perfil, upload de avatar (com avatar padrão), amigos com status online.
- [ ] **i18n** (módulo, 1 pt): `react-i18next` com 3 idiomas. Quanto antes, melhor: **todo** texto novo já deve passar pelo i18n, incluindo o HUD do jogo.

---

## Etapa 9: Polimento e entrega (todos, última semana + contínuo)

- [ ] Ajustar **jogando de verdade**: o cooldown, a quantidade e a velocidade dos tubarões, o tempo de renascimento, a duração e a frequência dos power-ups e o tempo de cada tamanho de mapa.
- [ ] Testar em Chrome, Firefox e Edge.
- [ ] Testar no celular (botões de toque).
- [ ] Console limpo, sem warnings, em todas as telas.
- [ ] README em inglês com todas as seções que o subject pede (incluindo as regras do jogo, as decisões técnicas, quem fez o quê e como usamos IA).
- [ ] Ensaiar a demonstração:
  - partida 1v1 em dois computadores até alguém chegar à tartaruga;
  - partida com 4 jogadores;
  - morrer, renascer, usar os 3 power-ups;
  - partida que acaba por tempo;
  - fechar a aba e reconectar; ficar fora mais de 30 s;
  - modo local 1v1;
  - histórico e leaderboard atualizando;
  - duas partidas ao mesmo tempo;
  - cada um explicar a sua parte.
