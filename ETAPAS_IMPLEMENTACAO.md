# so_long: Arena (etapas de implementação)

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
- [ ] Reunião para apresentar o jogo (`JOGO_SO_LONG_ARENA.md`) e fechar as decisões pendentes (sessão, Prisma, nome).
- [ ] Definir os papéis: PO, PM, Tech Lead (Luiz).
- [ ] Criar o board no GitHub Projects com uma issue por tarefa deste documento.
- [ ] Combinar o canal de comunicação (Discord) e uma reunião fixa por semana.
- [ ] Combinar o padrão de branches: `nome/assunto` (ex.: `luiz/game-engine`, `pedro/socket-auth`).

### 0.2 Limpeza do repositório
- [ ] Apagar as sobras na raiz do `Transcendance/`: `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `index.html`. O README diz que não são usadas, mas confirmem rodando o projeto depois.
- [ ] Apagar os arquivos `*Zone.Identifier` em `frontend/src/assets/`.
- [ ] Remover a dependência `approve` do `backend/package.json` (não é usada).
- [ ] Tirar o `backend/users.db` do Git: `git rm --cached backend/users.db` e adicionar `*.db` ao `.gitignore`.
- [ ] Adicionar `.env` ao `.gitignore`.

### 0.3 Ambiente de cada um
- [ ] Instalar o Node 22 **no WSL/Linux** (não só dentro do Docker), para rodar testes e ter o autocompletar no VS Code:
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  # fechar e abrir o terminal
  nvm install 22
  node -v   # deve mostrar v22.x
  ```
- [ ] Rodar `npm install` dentro de `backend/` e de `frontend/` (fora do Docker), para o VS Code encontrar os tipos.
- [ ] Testar que `docker compose up --build` continua funcionando.

### 0.4 Recursos do jogo (Luiz)
- [ ] Converter as sprites do so_long para PNG:
  ```bash
  sudo apt install imagemagick
  mkdir -p frontend/public/sprites
  for f in ~/so_long/img/*.xpm; do convert "$f" "frontend/public/sprites/$(basename "${f%.xpm}").png"; done
  ```
- [ ] Desenhar uma sprite (ou escolher uma cor/ícone) para o **gelo** no chão e o **cubinho de gelo** ao lado do personagem.
- [ ] Desenhar os **6 mapas** (primeiro no papel, pensando na simetria): `small-1`, `small-2` (2 jogadores), `medium-1`, `medium-2` (3), `large-1`, `large-2` (4). Salvar em `backend/maps/`.

**Pronto quando:** board criado, papéis definidos, repositório limpo, todos com o ambiente funcionando e com pelo menos um commit.

---

## Etapa 1: Motor do jogo sem rede (Luiz, 4–6 dias)

**Objetivo:** todas as regras do jogo em TypeScript puro, **sem Socket.IO, sem React e sem timers**. É o meu so_long reescrito, testável com testes automáticos e jogável no terminal.

**Por que sem timers?** A `GameRoom` não chama `setInterval` sozinha. Quem chama "move os monstros agora" ou "passou um segundo" é o código de fora (os testes agora, o `gameManager` na Etapa 4). E **o horário (`now`) e o sorteio (`random`) entram como parâmetro**. Assim os testes controlam o tempo e o sorteio e conseguem testar tudo sem esperar segundos de verdade.

### 1.1 Preparar os testes
- [ ] No `backend/`: `npm install -D vitest`.
- [ ] Em `backend/package.json`, trocar o script `test` por `"test": "vitest"`.
- [ ] Criar `backend/src/game/__tests__/sanity.test.ts` com um teste bobo (`expect(1 + 1).toBe(2)`) e rodar `npm test` para confirmar.

### 1.2 Tipos e constantes
- [ ] `backend/src/game/types.ts`: os tipos `Position`, `Direction`, `Player`, `GameState` (seção 5 do documento do jogo).
- [ ] `backend/src/game/config.ts`:
  ```ts
  export const MOVE_COOLDOWN_MS = 150;          // 🔶
  export const MONSTER_INTERVAL_MS = 500;       // 🔶
  export const RESPAWN_DELAY_MS = 3000;         // 🔶
  export const INVULNERABLE_MS = 1000;          // 🔶
  export const FREEZE_DURATION_MS = 2000;       // 🔶
  export const FREEZE_SPAWN_INTERVAL_MS = 15000;// 🔶
  export const TIME_LIMIT_MS = 3 * 60 * 1000;
  export const RECONNECT_TIMEOUT_MS = 30000;
  ```

### 1.3 Leitura dos mapas: `mapLoader.ts`
- [ ] `parseMap(text: string): MapData`: percorre o texto caractere a caractere e monta:
  ```ts
  type MapData = {
      width: number; height: number;
      walls: boolean[][];              // [y][x]
      exit: Position;
      spawns: Position[];              // índice = slot (A=0, B=1, ...)
      coins: { owner: number; pos: Position }[];
      monsters: Position[];
      freezeSpots: Position[];
  };
  ```
  Tudo que não é `1` vira chão (`walls[y][x] = false`). Caracteres desconhecidos → `throw`.
- [ ] `loadMap(name: string): MapData`: lê `backend/maps/<name>.ber` com `fs.readFileSync` e chama `parseMap`.
- [ ] `pickMap(playerCount: 2 | 3 | 4, choice: string | "random", random: () => number): string`: devolve o nome do mapa. Com `"random"`, sorteia entre os dois do tamanho certo.
- [ ] **Teste `maps.test.ts`** (a "validação" mínima). Para cada um dos 6 mapas:
  - todas as linhas têm o mesmo tamanho;
  - borda toda de parede;
  - exatamente 1 porta;
  - número de spawns = número de jogadores do tamanho (small = 2, medium = 3, large = 4);
  - cada jogador tem ≥ 1 moeda;
  - não há moedas de jogadores que não existem nesse tamanho;
  - pelo menos 1 ponto `*` de gelo.

### 1.4 A classe `GameRoom` (`GameRoom.ts`)

```ts
class GameRoom {
    state: GameState;
    dirty: boolean;                    // true = algo mudou e precisa ser enviado
    events: GameEvent[];               // fila de eventos para o cliente (morte, moeda...)

    constructor(id: string, map: MapData,
                players: { userId: number | null; username: string }[],
                options: { local: boolean; now: number; random?: () => number });

    start(now: number): void;                       // status = "running", endsAt = now + TIME_LIMIT_MS
    move(slot: number, dir: Direction, now: number): void;
    useFreeze(slot: number, now: number): void;
    tickMonsters(now: number): void;                // chamado a cada MONSTER_INTERVAL_MS
    tickSecond(now: number): void;                  // chamado a cada 1 s
    leave(slot: number): void;                      // desistência
    setConnected(slot: number, connected: boolean, now: number): void;
    snapshot(): DynamicState;                       // o que vai no game:state
}
```

Regras de cada método, **nesta ordem de verificação**:

- [ ] **`constructor`**: copia as paredes, a porta, as moedas e os monstros do `MapData`. Cria um `Player` por jogador, com `slot` = índice, `pos` = `spawn` = `map.spawns[slot]` e `coinsLeft` = número de moedas com `owner === slot`. `status = "countdown"`.
- [ ] **`move(slot, dir, now)`**:
  1. partida não está `"running"` → ignora;
  2. jogador não está `"playing"` (morto, desconectado, saiu) → ignora;
  3. `now < frozenUntil` → ignora;
  4. `now - lastMoveAt < MOVE_COOLDOWN_MS` → ignora;
  5. calcula o destino; é parede → ignora (mas atualiza `facing` se for esquerda/direita, como no original);
  6. há outro jogador **vivo** no destino → ignora;
  7. move: `pos = destino`, `lastMoveAt = now`, `moves++`, `facing`;
  8. há moeda **minha** no destino → remove a moeda, `coinsLeft--`, evento `coin`;
  9. há gelo no destino e eu **não** tenho → `hasFreeze = true`, `freezeItem = null`, evento `freezePickup`;
  10. há monstro no destino → `kill(player, now)`;
  11. destino é a porta e `coinsLeft === 0` → `finish(slot, "exit")`;
  12. `dirty = true`.
- [ ] **`useFreeze(slot, now)`**: precisa estar `"running"`, o jogador `"playing"`, não congelado e com `hasFreeze`. Então `hasFreeze = false` e, para cada **outro** jogador vivo, `frozenUntil = now + FREEZE_DURATION_MS`. Evento `freezeUsed`. `dirty = true`.
- [ ] **`tickMonsters(now)`**: para cada monstro, sorteia uma direção com `random()` (como o `rand() % 4` do so_long). Move se o destino **não** for parede, porta, moeda, gelo nem outro monstro. Depois, para cada jogador vivo na mesma casa de um monstro → `kill`.
- [ ] **`kill(player, now)`** (privado): ignora se `now < invulnerableUntil`. Senão: `status = "dead"`, `deaths++`, `respawnAt = now + RESPAWN_DELAY_MS`, `hasFreeze` mantém 🔶, evento `death`.
- [ ] **`tickSecond(now)`**:
  1. `now >= endsAt` → `finish(null, "timeout")` (vencedor = mais moedas; empate no topo = sem vencedor);
  2. jogadores `"dead"` com `now >= respawnAt` **e** spawn livre (sem jogador vivo e sem monstro em cima) → `status = "playing"`, `pos = spawn`, `invulnerableUntil = now + INVULNERABLE_MS`;
  3. jogadores `"disconnected"` há mais de `RECONNECT_TIMEOUT_MS` → `leave(slot)`;
  4. não há gelo no mapa e já passou `FREEZE_SPAWN_INTERVAL_MS` desde o último → sorteia um `freezeSpot` livre e coloca o gelo.
- [ ] **`leave(slot)`**: `status = "left"`. Se sobrar só 1 jogador ativo (playing, dead ou disconnected) → `finish(esse, "forfeit")`.
- [ ] **`finish(winnerSlot, reason)`**: `status = "finished"`, guarda `winnerSlot` e `endReason`. Depois disso, todos os métodos ignoram chamadas.
- [ ] **`snapshot()`**: devolve só o que o cliente precisa (sem `walls`, que vão uma vez só no início).

### 1.5 Testes do motor (`gameRoom.test.ts`)
Usem um **mapa pequeno escrito dentro do teste** (string), um `now` controlado e um `random` fixo. Casos mínimos:
- [ ] não anda antes do `start`;
- [ ] parede bloqueia;
- [ ] cooldown: dois `move` com 100 ms de diferença → só o primeiro vale; com 150 ms → os dois valem;
- [ ] jogador bloqueia jogador;
- [ ] pega a própria moeda (`coinsLeft` diminui) e **não** pega a dos outros;
- [ ] porta com moedas faltando → não termina;
- [ ] porta com todas as moedas → termina e esse jogador vence;
- [ ] andar para cima de um monstro → morre;
- [ ] monstro anda para cima do jogador → morre;
- [ ] monstro não anda sobre moeda, porta nem outro monstro;
- [ ] morto renasce depois de 3 s, no spawn, e fica invulnerável 1 s;
- [ ] renascimento espera se o spawn estiver ocupado;
- [ ] morto não bloqueia ninguém e não pode se mover;
- [ ] pega o gelo, usa, e os adversários ficam congelados 2 s (não andam), mas quem usou anda;
- [ ] não pega um segundo gelo se já tem um;
- [ ] tempo acaba → vence quem tem mais moedas; empate → `winnerSlot = null`;
- [ ] `leave` com 2 jogadores → o outro vence;
- [ ] desconectado há mais de 30 s → perde;
- [ ] depois de `finished`, nada mais muda.

### 1.6 Jogar no terminal (`debug.ts`)
Um script para testar "na mão", o "so_long no terminal":
- [ ] carrega um mapa pequeno com 2 jogadores (modo local);
- [ ] imprime o mapa em ASCII a cada mudança (`#` parede, `A`/`B` jogadores, `a`/`b` moedas, `M` monstro, `E` porta, `*` gelo, mais tempo e moedas restantes);
- [ ] lê o teclado com `readline` (`process.stdin.setRawMode(true)`): WASD/E para o jogador 1 e IJKL/O para o jogador 2 (as setas no terminal são chatas de ler);
- [ ] `setInterval` chamando `tickMonsters` e `tickSecond`;
- [ ] rodar com `npx tsx src/game/debug.ts`.

**Pronto quando:** `npm test` passa tudo e dá para jogar uma partida inteira no terminal.

---

## Etapa 2: Renderização no navegador (Duarte + Luiz, 4–5 dias)

**Objetivo:** desenhar o jogo num `<canvas>` a partir de um estado **falso**, sem precisar do backend. Pode ser feita ao mesmo tempo que a Etapa 1.

### 2.1 Tipos compartilhados
- [ ] `frontend/src/game/protocol.ts`: os tipos `Position`, `Direction`, `DynamicState`, `MapInfo` (`width`, `height`, `walls`, `exit`) e os nomes dos eventos. **Cópia idêntica** do `backend/src/game/protocol.ts`. Se mudar num, muda no outro.
- [ ] `frontend/src/game/fixtureState.ts`: um estado de exemplo escrito à mão (um mapa pequeno, 2 jogadores, alguns monstros e moedas, um gelo no chão, um jogador com gelo guardado, outro congelado).

### 2.2 Carregar as sprites (`sprites.ts`)
- [ ] `loadSprites(): Promise<Sprites>`: cria um `Image` para cada PNG e espera todos carregarem (`img.onload`). Sprites: `wall`, `grass`, `cdoor`, `odoor`, `coin`, `enemy`..., `l1`–`l6`, `r1`–`r6`, `ice`.
- [ ] O jogo só começa a desenhar depois de carregar tudo (mostrar "Carregando..." enquanto isso).

### 2.3 Desenho (`renderer.ts`)
Funções puras que recebem `ctx`, o estado e o tamanho da casa (`tile`):
- [ ] `drawBoard`: chão + paredes. Dica: desenhar uma vez num canvas auxiliar e só copiar a cada frame.
- [ ] `drawExit`: porta aberta se **eu** (`you`) tenho `coinsLeft === 0`, senão fechada.
- [ ] `drawCoins`: moeda + um anel da cor do dono. As minhas com `ctx.globalAlpha = 1`, as dos outros com `0.35`.
- [ ] `drawFreezeItem`: o gelo no chão (se houver).
- [ ] `drawMonsters`: com animação.
- [ ] `drawPlayers`:
  - sprite `l1..l6` / `r1..r6` conforme `facing`, quadro = `Math.floor(performance.now() / 120) % 6`;
  - anel ou contorno da cor do slot (ex.: 0 = azul, 1 = vermelho, 2 = verde, 3 = amarelo);
  - nome em cima;
  - cubinho de gelo pequeno no canto da casa se `hasFreeze`;
  - pisca se invulnerável; tom azulado se congelado; não desenha se `dead`.
- [ ] `drawHud` (pode ser HTML por cima do canvas, que é mais fácil): tempo restante, e para cada jogador nome, cor, moedas restantes, mortes e o ícone de gelo.
- [ ] `drawFrame(...)`: chama tudo na ordem acima.

### 2.4 Componente `GameScreen.tsx`
- [ ] Um `<canvas>` com `useRef`.
- [ ] Calcula o tamanho da casa: `tile = Math.floor(Math.min(largura / map.width, altura / map.height))`, e recalcula no `resize` da janela.
- [ ] Laço com `requestAnimationFrame(drawFrame)`, cancelado no unmount (`cancelAnimationFrame` no retorno do `useEffect`).
- [ ] Por enquanto usa o `fixtureState`.

### 2.5 Controles (`input.ts`)
- [ ] `createInput(mode: "online" | "local", send: (cmd) => void)`: registra `keydown` e devolve uma função que remove o listener.
  - online: WASD/setas → `{ type: "move", dir }`; Espaço/E → `{ type: "freeze" }`;
  - local: WASD/E → slot 0; setas/Enter → slot 1.
- [ ] Usar `event.code` (`"KeyW"`, `"ArrowUp"`...) em vez de `event.key`, para funcionar com qualquer layout de teclado.
- [ ] `event.preventDefault()` nas setas e no Espaço (para a página não rolar).
- [ ] Botões de toque na tela (4 setas + gelo), que só aparecem em telas pequenas ou touch.
- [ ] Por enquanto, `send` só faz `console.log`.

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
- [ ] `gameSocket.ts`: registra `game:move`, `game:useFreeze` e `game:leave`:
  - descobre a partida e o slot pelo `socket.data.userId` (nunca pelo que vem do cliente);
  - **valida** os dados: `dir` tem de ser uma das 4 strings; senão ignora.
- [ ] `lobby.ts`:
  - `MAX_PLAYERS` passa de 8 para **4**;
  - `startMatch` chama `gameManager.createGame`;
  - novo evento `lobby:settings` (só o host): escolha do mapa (`"random"` ou um dos dois do tamanho atual);
  - remover a lógica de cliques (`match:*`).

### 4.2 Cliente
- [ ] `Lobby.tsx`: seletor de mapa para o host (lista conforme o número de jogadores + "Aleatório").
- [ ] `GameScreen.tsx`: troca o `fixtureState` pelos eventos reais (`game:start`, `game:countdown`, `game:state`, `game:event`, `game:end`) e o `send` do `input.ts` passa a emitir `game:move` / `game:useFreeze`.
- [ ] Contagem 3-2-1 na tela.
- [ ] Tela de fim: vencedor, moedas e mortes de cada um, botões "Voltar ao lobby" e "Sair".
- [ ] Remover o Clicky: `MultiplayerGame.tsx`, o `Game.tsx` antigo e a rota `/game-result`.

**Pronto quando:** partidas com 2, 3 e 4 jogadores em **computadores diferentes** (ou navegadores diferentes) do início ao fim, e **duas partidas ao mesmo tempo** sem se misturarem.

---

## Etapa 5: Modo local 1v1 (Luiz, 2 dias)

- [ ] Botão **"Jogar local (1v1)"** no dashboard → tela simples para escolher o mapa pequeno (ou aleatório).
- [ ] Evento `local:start { map }` → o `gameManager` cria uma `GameRoom` com `local: true`: slot 0 = o usuário logado, slot 1 = `{ userId: null, username: "Convidado" }`.
- [ ] No modo local, `game:move` e `game:useFreeze` recebem `{ slot, dir }`. O servidor só aceita `slot` 0 ou 1 e **só se** o socket for o dono da partida local.
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
  - `MatchPlayer`: `matchId`, `userId`, `slot`, `result` (`win` | `loss` | `draw` | `forfeit`), `coins`, `moves`, `deaths`, `finishMs?`.
- [ ] `persistence.ts`: `saveMatch(room)` grava tudo **numa transação** (ou grava tudo, ou nada).
- [ ] Rotas: `GET /api/users/:id/matches` (histórico paginado), `GET /api/users/:id/stats` (totais), `GET /api/leaderboard`.
- [ ] Telas: **Histórico** (data, mapa, adversários, resultado, moedas, mortes), **Perfil** com os totais e % de vitórias, **Leaderboard**.
- [ ] Remover as colunas antigas `wins`/`losses`/`multiplayer_*` da tabela `users`. Os totais passam a ser calculados a partir de `MatchPlayer`.

**Pronto quando:** depois de algumas partidas, o histórico, o perfil e o leaderboard mostram os números certos.

> 🎯 **Neste ponto, o núcleo está completo:** jogo web (2) + remote players (2) + multiplayer 3+ (2) + estatísticas (1) = **7 pontos só do jogo**.

---

## Etapa 8: Extras (pela ordem que faltar pontos)

| Extra | Pts | Quem | Resumo |
|---|---|---|---|
| **Customização** | 1 | Luiz | O host escolhe o tempo (1/3/5 min), a velocidade dos monstros (lenta/normal/rápida) e liga/desliga o gelo. Como já temos mapas e o freeze, é pouco trabalho |
| **Bot (IA)** | 2 | Luiz | Jogador controlado pelo servidor: busca em largura até a moeda mais próxima evitando monstros, reação de 250–450 ms, 10% de movimentos aleatórios, usa o gelo quando um humano está perto da porta |
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

- [ ] Ajustar o cooldown, a velocidade dos monstros e o tempo de renascimento **jogando de verdade**.
- [ ] Testar em Chrome, Firefox e Edge.
- [ ] Testar no celular (botões de toque).
- [ ] Console limpo, sem warnings, em todas as telas.
- [ ] README em inglês com todas as seções que o subject pede (incluindo as regras do jogo, as decisões técnicas, quem fez o quê e como usamos IA).
- [ ] Ensaiar a demonstração:
  - partida 1v1 em dois computadores até alguém sair pela porta;
  - partida com 4 jogadores;
  - morrer, renascer, usar o gelo;
  - partida que acaba por tempo;
  - fechar a aba e reconectar; ficar fora mais de 30 s;
  - modo local 1v1;
  - histórico e leaderboard atualizando;
  - duas partidas ao mesmo tempo;
  - cada um explicar a sua parte.
