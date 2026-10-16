# Open Sea (proposta do jogo)

Proposta para o jogo principal do transcendence. A ideia nasceu do meu **so_long** (que fiz em C com a MiniLibX): transformar ele num jogo multiplayer que roda no navegador. Escrevi aqui como imagino que ele funcione, para todos terem a mesma visão antes de começarmos.

> Nome: **Open Sea** (por enquanto). As artes estão em `frontend/public/interface/` e `frontend/public/map-ideas/`.

**A história:** chegou a estação fria e o recife está ficando sem comida. Só uma criatura conhece o caminho para o Mar Aberto, onde a água é calma e há comida de sobra: uma velha tartaruga que espera no fim do recife. Ela só leva **um peixe** nas costas, e o preço são diamantes.

---

## 1. A ideia

De 2 a 4 jogadores no mesmo labirinto, cada um com o seu peixe. Para ganhar, é preciso:

1. pegar a **quantidade de diamantes** que o mapa exige;
2. fugir dos **tubarões**;
3. **chegar à tartaruga** antes dos outros.

O primeiro a chegar à tartaruga com os diamantes ganha. Se o tempo acabar, ganha quem tiver mais diamantes.

Por que acho que é uma boa escolha:
- é um jogo em grade (uma casa por movimento), então sincronizar pela rede é bem mais simples do que, por exemplo, um Pong com física;
- as regras e a condição de vitória são claras (o subject pede isso);
- eu já conheço a lógica do so_long, então portar para TypeScript é rápido;
- encaixa no sistema de lobby que o Pedro já fez;
- destrava vários módulos: jogo web, remote players, multiplayer 3+, estatísticas, customização, e mais tarde IA e espectador.

---

## 2. Regras

**Personagens**
- Quatro peixes: **goldfish**, **betta**, **angler** e **puffer**.
- Cada jogador escolhe o seu antes da partida. **Dois jogadores não podem escolher o mesmo peixe** no mesmo lobby.

**Movimento**
- Uma casa por tecla.
- Há um **cooldown de 150 ms** 🔶 entre movimentos, para não ganhar quem aperta mais rápido.
- Paredes bloqueiam.
- **Jogadores bloqueiam uns aos outros**: não dá para entrar na casa onde está outro jogador.

**Diamantes**
- Os diamantes **não têm dono**: são de quem pegar primeiro.
- Cada mapa exige uma **meta**: 5 diamantes no mapa pequeno, 10 nos médios e grandes.
- Quantidade no mapa = **meta × número de jogadores + 1**. Exemplo: médio com 3 jogadores → 10 × 3 + 1 = **31 diamantes**.
- Ao atingir a meta, o jogador **não pega mais nenhum**: passa por cima e o diamante fica lá.
- Por que essa regra garante que a partida nunca trava: como ninguém passa da meta, os outros juntos pegam no máximo `meta × (jogadores − 1)`. Sempre sobram pelo menos `meta + 1` para o último. O "+1" deixa uma pequena folga.
- As posições são **sorteadas a cada partida**: tem um pouco de sorte, e cada partida é diferente.

**Tartaruga (saída)**
- **Uma só**, no centro do mapa, compartilhada.
- Só leva quem já tem a meta de diamantes.

**Tubarões (monstros)**
- A quantidade depende do tamanho do mapa: **4** no pequeno, **6** no médio, **8** no grande 🔶 (vamos ajustar conforme a dificuldade).
- Começam em **posições sorteadas**, longe dos pontos iniciais dos jogadores.
- Andam uma casa aleatória a cada 500 ms 🔶 (igual ao `choose_a_move` do so_long, mas no servidor).
- **Passam por cima dos diamantes e dos power-ups** (não pegam nada). Assim um tubarão nunca fica "preso" atrás de um diamante nem bloqueia um diamante para sempre.
- Não entram na tartaruga nem na casa de outro tubarão.
- Encostou num tubarão: **morreu**.

**Morte**
- Quem morre **some do mapa por 3 segundos** 🔶 e renasce no seu ponto inicial.
- **Não perde os diamantes** já coletados, mas **perde o power-up** que estava guardando 🔶. A punição é perder tempo (e o power-up).
- Ao renascer, fica 1 segundo invulnerável. Se o ponto inicial estiver ocupado, espera liberar.

**Power-ups**
- A cada **5 segundos** 🔶 aparece **um** power-up num lugar livre sorteado, de um tipo sorteado. No máximo **3 no mapa ao mesmo tempo** 🔶.
- Aparecem dentro de uma bolha. Quem passa por cima **guarda** o power-up, e um ícone pequeno aparece ao lado do personagem.
- Cada jogador guarda **um de cada vez**. Quem já tem um passa por cima sem pegar.
- Usa-se com a **tecla de power-up**.

| Power-up | Efeito |
|---|---|
| ⚡ **Velocidade** | Por 5 s 🔶, o seu cooldown de movimento cai pela metade |
| 🧪 **Congelar** (poção azul) | Por 2 s 🔶, **todos os adversários e todos os tubarões** ficam parados. Encostar num tubarão congelado ainda mata |
| 🧪 **Encantar** (poção vermelha) | Por 5 s 🔶, os tubarões **não te machucam**. Você pode passar por eles |

A poção verde fica guardada para um quarto power-up, se tivermos ideia e tempo.

**Fim da partida**
| Situação | Resultado |
|---|---|
| Alguém chega à tartaruga com a meta de diamantes | Essa pessoa ganha e os outros perdem |
| Acaba o tempo | Ganha quem tem mais diamantes. Empate no topo = empate |
| Alguém sai do jogo ou fica mais de 30 s desconectado | Essa pessoa perde (desistência) |
| Só sobra 1 jogador | Esse jogador ganha |

O **tempo da partida** ainda não está definido. Vou estipular por tamanho de mapa depois de testar a dificuldade (o relógio nas telas é só demonstrativo).

---

## 3. Mapas

Três tamanhos, com **2 mapas feitos à mão** em cada:

| Tamanho | Jogadores | Meta | Diamantes no mapa | Tubarões 🔶 | Mapas |
|---|---|---|---|---|---|
| Pequeno | 2 | 5 | 11 | 4 | `small-1`, `small-2` |
| Médio | 2 ou 3 | 10 | 21 ou 31 | 6 | `medium-1`, `medium-2` |
| Grande | 2, 3 ou 4 | 10 | 21, 31 ou 41 | 8 | `large-1`, `large-2` |

**No lobby:** primeiro escolhe-se **quantos jogadores** (2, 3 ou 4). Depois aparecem só os mapas que aceitam esse número, mais a opção **"Aleatório"**. Com 2 jogadores dá para jogar em qualquer tamanho; com 4, só nos grandes.

### O que o arquivo `.ber` tem
Como diamantes, tubarões e power-ups são sorteados, o arquivo só guarda a parte fixa:

| Caractere | Significado |
|---|---|
| `1` | Parede |
| `0` | Chão |
| `E` | Tartaruga (só uma, no centro) |
| `A` `B` `C` `D` | Pontos iniciais, nas extremidades do mapa |

**Ordem dos pontos iniciais:** os jogadores usam os pontos **na ordem das letras**. Com 2 jogadores, só `A` e `B`; com 3, `A`, `B` e `C`. Por isso **`A` e `B` ficam em cantos opostos** (na diagonal), e os mapas médios e grandes são **simétricos nos 4 cantos**. Assim, qualquer combinação de cantos fica à mesma distância da tartaruga.

Exemplo (pequeno, 2 jogadores; `A` e `B` em cantos opostos, ambos a 11 passos da tartaruga):
```
1111111111111111111
1A00000001000000001
1011101100011011101
1000000000000000001
100101001E100101001
1000000000000000001
1011101100011011101
10000000010000000B1
1111111111111111111
```

### Sorteio no início da partida
Feito pelo servidor, a partir das casas de chão livres:
- **tubarões**: longe dos pontos iniciais (pelo menos 4 passos 🔶), para ninguém morrer no primeiro segundo;
- **diamantes**: em qualquer casa livre que não seja ponto inicial nem a tartaruga;
- ninguém fica em cima de ninguém: um diamante por casa e um tubarão por casa.

### Sem validação de mapa
Como nós mesmos desenhamos os mapas, **não vamos implementar a validação completa**. Um **teste automático** abre os 6 mapas e confere:
- borda de parede;
- uma tartaruga;
- os pontos iniciais certos;
- todo o chão alcançável;
- todos os pontos iniciais à mesma distância da tartaruga;
- espaço livre suficiente para o máximo de diamantes e tubarões.

### Visual
O jogador vê **uma imagem desenhada à mão** para cada mapa (`frontend/public/maps/<mapa>.webp`), feita a partir das imagens-guia em blocos. O `.ber` continua sendo a verdade: é ele que diz ao servidor onde estão as paredes. A imagem tem só o que nunca muda (chão, rochas, corais, moldura). Diamantes, tubarões, power-ups e jogadores são desenhados pelo código por cima.

---

## 4. Como funciona: o servidor manda em tudo

O navegador **não decide nada**. Ele só:
- envia o que o jogador quer fazer ("mover para cima", "usar power-up");
- desenha o estado que recebe do servidor.

O servidor (backend) guarda o mapa, as posições, os diamantes, os tubarões, os power-ups e o relógio. Ele faz os sorteios, valida cada movimento, move os tubarões e decide quem ganhou.

```
 Navegador 1                       Servidor                          Navegador 2
 tecla ↑ ── game:move "up" ──►  valida e atualiza
           ◄── game:state ────  envia o estado novo ── game:state ──►  desenha
 desenha                        a cada 500 ms: move os tubarões
           ◄── game:state ────                    ── game:state ──►
```

Vantagens:
- ninguém consegue trapacear pelo navegador;
- todos veem exatamente a mesma coisa (os sorteios acontecem num lugar só);
- não há conflito entre jogadores, porque o Node trata um evento de cada vez.

O lobby que o Pedro fez (criar, entrar, ready, start, kick) continua. Muda o que acontece quando o host aperta **Start**: em vez da partida de cliques, cria uma partida de Open Sea. O lobby ganha: número de jogadores, escolha do mapa e escolha de personagem.

---

## 5. Estado do jogo

Principais tipos em TypeScript (`backend/src/game/types.ts`):

```ts
type Position = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";
type Character = "goldfish" | "betta" | "angler" | "puffer";
type PowerUpType = "speed" | "freeze" | "enchant";

type Player = {
    userId: number | null;   // null = convidado (modo local)
    username: string;
    slot: number;            // 0..3 → ponto inicial A..D
    character: Character;
    pos: Position;
    spawn: Position;
    diamonds: number;        // quantos já pegou (para em goal)
    moves: number;
    deaths: number;
    facing: "left" | "right";
    status: "playing" | "dead" | "disconnected" | "left" | "finished";
    lastMoveAt: number;
    respawnAt: number;       // quando morto
    invulnerableUntil: number;
    frozenUntil: number;
    speedUntil: number;
    enchantedUntil: number;
    powerUp: PowerUpType | null;   // o que está guardando
    disconnectedAt: number | null;
};

type GameState = {
    id: string;
    mapName: string;
    width: number;
    height: number;
    walls: boolean[][];      // parte fixa: [y][x] true = parede
    exit: Position;
    goal: number;            // diamantes necessários (5 ou 10)
    players: Player[];
    monsters: Position[];
    monstersFrozenUntil: number;
    diamonds: Position[];    // os que ainda estão no mapa
    powerUps: { type: PowerUpType; pos: Position }[];
    nextPowerUpAt: number;
    endsAt: number;
    status: "countdown" | "running" | "finished";
    winnerSlot: number | null;
    local: boolean;          // partida local 1v1
};
```

Uma diferença em relação ao meu so_long em C: lá eu escrevia tudo dentro de `char **map` ('P', 'X', 'C'...), e precisava de truques como o `in_door`. Aqui o **mapa fixo** (paredes e tartaruga) fica **separado** das coisas que se mexem ou somem (jogadores, tubarões, diamantes, power-ups). Fica bem mais simples.

---

## 6. O que o servidor faz

**Início:** o host aperta Start → o servidor carrega o mapa, **sorteia** tubarões e diamantes, monta o estado inicial, envia para todos e faz a contagem 3, 2, 1.

**Durante a partida:**
- **Movimento** (`game:move`): verifica se o jogador está vivo, não congelado e respeitou o cooldown (metade com velocidade), e se o destino não é parede nem outro jogador. Se estiver tudo bem, move e verifica diamante, power-up, tubarão e tartaruga.
- **Usar power-up** (`game:usePowerUp`): se o jogador tem um, aplica o efeito.
- **A cada 500 ms:** move os tubarões (se não estiverem congelados) e verifica se algum encostou em alguém.
- **A cada 1 s:** verifica o tempo da partida, quem precisa renascer, quem está desconectado há mais de 30 s e se é hora de aparecer um power-up novo.
- Depois de qualquer mudança, envia o estado para todos (no máximo a cada 50 ms, para não inundar a rede).

**Fim:** para todos os timers, grava o resultado no banco, avisa todos com `game:end` e o lobby volta para a tela de "ready".

O servidor pode ter **várias partidas ao mesmo tempo**: cada uma é um objeto `GameRoom` separado, com os seus timers.

---

## 7. Eventos do Socket.IO

| Evento | Direção | Quando |
|---|---|---|
| `game:start` | servidor → jogadores | Começou: envia o mapa, o estado e qual slot é você |
| `game:countdown` | servidor → jogadores | 3, 2, 1, já |
| `game:move` | jogador → servidor | Tecla de movimento (`"up"`, `"down"`, `"left"`, `"right"`) |
| `game:usePowerUp` | jogador → servidor | Tecla de power-up |
| `game:state` | servidor → jogadores | O estado mudou |
| `game:event` | servidor → jogadores | Algo aconteceu (morte, diamante, power-up pego ou usado), para efeitos visuais |
| `game:end` | servidor → jogadores | Fim: quem ganhou, estatísticas |
| `game:leave` | jogador → servidor | Saiu da partida (= desistência) |
| `game:rejoin` / `game:resume` | ida e volta | Reconexão |

No modo local, `game:move` e `game:usePowerUp` levam também o slot: `{ slot: 0 | 1, dir }`.

O servidor **sempre valida** o que recebe e ignora qualquer valor estranho.

**Importante:** hoje o servidor confia no `username` que o navegador envia. Antes de ligar o jogo à rede, precisamos da **autenticação no socket** (o servidor saber quem é o jogador pelo login).

---

## 8. No navegador

**Desenho:** a imagem do mapa num `<img>` e, por cima, um `<canvas>` transparente do mesmo tamanho, onde o código desenha o que se mexe. O `<canvas>` é muito parecido com a MiniLibX:

| MiniLibX | Canvas |
|---|---|
| `mlx_xpm_file_to_image` | `img.src = "/sprites/shark-left.png"` |
| `mlx_put_image_to_window` | `ctx.drawImage(img, x, y, size, size)` |
| `mlx_loop_hook` | `requestAnimationFrame` |
| `mlx_key_hook` | `addEventListener("keydown")` |

A cada frame, desenho nesta ordem: diamantes → power-ups → tubarões (normal, congelado ou encantado) → jogadores (com o ícone do power-up guardado ao lado) → HUD (retrato, barra de diamantes, tempo).

- Sprites em `frontend/public/sprites/`, telas em `frontend/public/interface/`.
- O jogo é escalado para caber na tela mantendo a proporção do mapa (o subject pede uma interface responsiva). No celular, pedimos para girar a tela na horizontal.
- Enquanto a imagem de um mapa não estiver pronta, o código desenha o mapa em blocos.

**Controles (online)**
| Ação | Tecla |
|---|---|
| Mover | W A S D |
| Usar power-up | R |

No celular, aparecem botões na tela (setas + power-up).

---

## 9. Modo local (1v1 no mesmo computador)

Dois jogadores no mesmo teclado. **Só 1v1**, porque com mais gente ficaria desconfortável.

| | Mover | Usar power-up |
|---|---|---|
| Jogador 1 | W A S D | R |
| Jogador 2 | Setas | L |

- Pode usar qualquer mapa que aceite 2 jogadores.
- O jogador 2 é um "convidado" (não precisa de conta).
- Funciona igual ao online: o servidor continua mandando, só que **uma conexão controla os dois jogadores**.
- 🔶 Partidas locais **não contam** para as estatísticas (não dá para saber quem é o convidado).

---

## 10. Desconexão e reconexão

O módulo *Remote players* exige isso.

- Se alguém cair, o personagem **fica parado no mapa** (os tubarões ainda podem pegá-lo) e os outros veem "Fulano desconectado".
- Se ele voltar em até **30 segundos** (até com F5), entra de novo na partida onde estava.
- Depois de 30 s, perde por desistência.
- Para isso funcionar, o servidor tem de reconhecer o jogador pelo **login** (`userId`) e não pela conexão (`socket.id`), que muda cada vez que alguém reconecta. Por isso a autenticação no socket é pré-requisito.

---

## 11. Banco de dados

Para o módulo de estatísticas e histórico (e para o schema "com relações" que o subject exige), vamos ter:

```
users          → já existe
matches        → uma linha por partida (mapa, início, fim, motivo do fim, vencedor)
match_players  → uma linha por jogador em cada partida
                 (personagem, resultado, diamantes, movimentos, mortes, tempo)
```

`match_players` liga `users` e `matches` (relação N:N). Com isso dá para montar o **histórico**, o **perfil** com os totais e um **leaderboard**.

Se adotarmos o **Prisma** (ORM), essas tabelas devem ser criadas já com ele.

---

## 12. Para depois (se der tempo)

- **1 jogador contra o bot (IA)**: um jogador controlado pelo servidor que usa busca em largura para achar diamantes e fugir dos tubarões, com reação mais lenta e alguns "erros" de propósito. Vale 2 pontos. É o botão "1 Player" da tela de jogadores.
- **Modo espectador**: assistir a uma partida em andamento.
- **Quarto power-up** (poção verde).
- **Torneio** e **conquistas**.

---

## 13. Organização dos arquivos

```
backend/
  maps/                    ← os 6 mapas .ber
  src/game/
    types.ts               ← tipos (seção 5)
    config.ts              ← constantes e regras por tamanho de mapa
    protocol.ts            ← tipos dos eventos (cópia igual no frontend)
    mapLoader.ts           ← lê o .ber e escolhe o mapa
    placement.ts           ← sorteio de tubarões, diamantes e power-ups
    GameRoom.ts            ← as regras do jogo (seção 6)
    gameManager.ts         ← lista de partidas ativas, rejoin
    gameSocket.ts          ← liga os eventos do socket à GameRoom
    __tests__/             ← testes do motor e dos mapas

frontend/
  public/
    sprites/               ← peixes, tubarões, itens, ícones, barras de diamantes
    interface/             ← telas (início, menu, jogadores, personagens, instruções, vencedor)
    maps/                  ← imagem final de cada mapa
    map-ideas/             ← rascunhos de mapas, para referência
  src/game/
    protocol.ts
    renderer.ts            ← desenho no canvas
    sprites.ts             ← carregar imagens
    input.ts               ← teclado (online e local) + botões de toque
  src/components/
    GameScreen.tsx         ← tela do jogo
```

---

## 14. Decisões já tomadas

| Pergunta | Decisão |
|---|---|
| Nome | **Open Sea** (por enquanto) |
| Personagens | 4 peixes, escolhidos no lobby, sem repetir |
| Jogadores bloqueiam uns aos outros? | Sim |
| Diamantes | Sem dono, posições sorteadas. Meta 5 (pequeno) ou 10 (médio e grande). No mapa: meta × jogadores + 1. Ao atingir a meta, não pega mais |
| Ao morrer perde diamantes? | Não. Perde só o power-up guardado. Some por 3 s e renasce |
| Tubarões andam sobre diamantes? | Sim (e sobre power-ups), sem pegar nada |
| Tubarões por mapa | 4 / 6 / 8, posições sorteadas (vamos ajustar) |
| Pontos iniciais | Nas extremidades do mapa |
| Cooldown de movimento | 150 ms (vamos ajustar testando) |
| Tempo limite | A definir, por tamanho de mapa, depois de testar |
| Tempo para reconectar | 30 s |
| Saída | Uma tartaruga, no centro, compartilhada |
| Power-ups | Velocidade, Congelar e Encantar. Um novo a cada 5 s, no máximo 3 no mapa, guarda 1 de cada vez |
| Mapas | 6 feitos à mão: 2 pequenos (2 jogadores), 2 médios (2–3), 2 grandes (2–4). Escolhidos ou aleatórios |
| Teclas | Online: WASD + R. Local: WASD + R / setas + L |
| Modo local | Só 1v1 |
| 1 jogador | Depois, contra o bot |
| Sessão (login) | **A decidir**: JWT em cookie httpOnly × JWT em localStorage |
| ORM | Prisma (a confirmar) |
