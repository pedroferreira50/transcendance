# so_long: Arena (proposta do jogo)

Proposta para o jogo principal do transcendence. A ideia é pegar o meu **so_long** (que fiz em C com a MiniLibX) e transformar num jogo multiplayer que roda no navegador. Escrevi aqui como imagino que ele funcione, para todos terem a mesma visão antes de começarmos.

> Nome provisório: **so_long: Arena**. Podemos decidir outro depois.

---

## 1. A ideia

De 2 a 4 jogadores no mesmo labirinto. Cada um tem a sua cor e as suas moedas. Para ganhar, é preciso:

1. pegar **todas as suas moedas**;
2. fugir dos **monstros**;
3. **sair pela porta** antes dos outros.

O primeiro a sair ganha. A partida dura no máximo **3 minutos**. Se o tempo acabar, ganha quem tiver mais moedas.

Por que acho que é uma boa escolha:
- é um jogo em grade (uma casa por movimento), então sincronizar pela rede é bem mais simples do que, por exemplo, um Pong com física;
- as regras e a condição de vitória são claras (o subject pede isso);
- eu já conheço a lógica, então portar para TypeScript é rápido;
- encaixa no sistema de lobby que o Pedro já fez;
- destrava vários módulos: jogo web, remote players, multiplayer 3+, estatísticas, customização, e mais tarde IA e espectador.

---

## 2. Regras

**Movimento**
- Uma casa por tecla (WASD ou setas).
- Há um **cooldown de 150 ms** entre movimentos, para não ganhar quem aperta mais rápido. Vamos testar e ajustar (pode subir, descer ou até ir a zero).
- Paredes bloqueiam.
- **Jogadores bloqueiam uns aos outros**: não dá para entrar na casa onde está outro jogador.

**Moedas e porta**
- Cada jogador só pode pegar as moedas da **sua cor**. As dos outros aparecem **semitransparentes** e você passa por cima sem pegar.
- Há **uma porta só**, compartilhada. Ela só deixa sair quem já pegou todas as suas moedas.

**Monstros**
- Andam uma casa aleatória a cada 500 ms (igual ao `choose_a_move` do so_long, mas no servidor).
- Não andam sobre moedas, paredes, a porta nem outros monstros (como no original).
- Encostou num monstro: **morreu**.

**Morte**
- Quem morre **some do mapa por 3 segundos** e depois renasce no seu ponto inicial.
- **Não perde as moedas** já coletadas. A punição é perder tempo.
- Ao renascer, fica 1 segundo invulnerável. Se o ponto inicial estiver ocupado por outro jogador, espera até ele sair.

**Power-up: Freeze ❄️** (o único, por enquanto)
- De vez em quando aparece um **gelo** num dos pontos marcados no mapa.
- Quem passar por cima **guarda** o gelo. Aparece um **cubinho de gelo pequeno ao lado do personagem** mostrando que está disponível.
- Ao apertar a **tecla de usar**, todos os adversários ficam **congelados por 2 segundos**.
- Cada um só pode guardar **um** gelo de cada vez.

**Fim da partida**
| Situação | Resultado |
|---|---|
| Alguém sai pela porta com todas as moedas | Essa pessoa ganha e os outros perdem |
| Acabam os 3 minutos | Ganha quem tem mais moedas. Empate no topo = empate |
| Alguém sai do jogo ou fica mais de 30 s desconectado | Essa pessoa perde (desistência) |
| Só sobra 1 jogador | Esse jogador ganha |

---

## 3. Mapas

Vamos ter **6 mapas feitos à mão**:

| Tamanho | Jogadores | Mapas |
|---|---|---|
| Pequeno | 2 | `small-1.ber`, `small-2.ber` |
| Médio | 3 | `medium-1.ber`, `medium-2.ber` |
| Grande | 4 | `large-1.ber`, `large-2.ber` |

O tamanho do mapa depende do número de jogadores na partida. O host do lobby escolhe um dos dois mapas daquele tamanho, ou deixa em **"Aleatório"** (o padrão).

### Formato
É o mesmo `.ber` do so_long, com alguns caracteres novos:

| Caractere | Significado |
|---|---|
| `1` | Parede |
| `0` | Chão |
| `E` | Porta (só uma) |
| `X` | Monstro |
| `A` `B` `C` `D` | Ponto inicial dos jogadores 1, 2, 3, 4 |
| `a` `b` `c` `d` | Moedas dos jogadores 1, 2, 3, 4 |
| `*` | Lugar onde o gelo pode aparecer |

> Atenção: no so_long original `C` era moeda. Aqui o `C` maiúsculo é o **jogador 3** e as moedas são minúsculas.

Exemplo (pequeno, 2 jogadores):
```
1111111111111111111
1A000a0001000b000B1
1011110101010111101
10a0X000*E*000X0b01
1011110101010111101
1000000a010b0000001
1111111111111111111
```

### Sem validação de mapa
Como nós mesmos vamos desenhar os mapas, **não vamos implementar a validação completa** (flood fill etc.). Vou só ter um **teste automático** simples que abre os 6 mapas e confere o básico: todas as linhas do mesmo tamanho, número certo de jogadores, pelo menos uma moeda por jogador e uma porta. São poucas linhas e evitam que um erro de digitação quebre uma partida. Os mapas precisam ser **simétricos ou equilibrados**, para ninguém começar em vantagem.

---

## 4. Como funciona: o servidor manda em tudo

O navegador **não decide nada**. Ele só:
- envia o que o jogador quer fazer ("mover para cima", "usar gelo");
- desenha o estado que recebe do servidor.

O servidor (backend) guarda o mapa, as posições, as moedas, os monstros e o relógio. Ele valida cada movimento, move os monstros e decide quem ganhou.

```
 Navegador 1                       Servidor                          Navegador 2
 tecla ↑ ── game:move "up" ──►  valida e atualiza
           ◄── game:state ────  envia o estado novo ── game:state ──►  desenha
 desenha                        a cada 500 ms: move os monstros
           ◄── game:state ────                    ── game:state ──►
```

Vantagens:
- ninguém consegue trapacear pelo navegador;
- todos veem exatamente a mesma coisa (o sorteio dos monstros acontece num lugar só);
- não há conflito entre jogadores, porque o Node trata um evento de cada vez.

O lobby que o Pedro fez (criar, entrar, ready, start, kick) continua igual. Muda só o que acontece quando o host aperta **Start**: em vez da partida de cliques, cria uma partida de so_long.

---

## 5. Estado do jogo

Principais tipos em TypeScript (`backend/src/game/types.ts`):

```ts
type Position = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";

type Player = {
    userId: number | null;   // null = convidado (modo local)
    username: string;
    slot: number;            // 0..3 → A..D (define a cor)
    pos: Position;
    spawn: Position;
    coinsLeft: number;
    moves: number;
    deaths: number;
    facing: "left" | "right";
    status: "playing" | "dead" | "disconnected" | "left" | "finished";
    lastMoveAt: number;
    respawnAt: number;       // quando morto
    invulnerableUntil: number;
    frozenUntil: number;
    hasFreeze: boolean;      // está segurando um gelo?
    disconnectedAt: number | null;
};

type GameState = {
    id: string;
    mapName: string;
    width: number;
    height: number;
    walls: boolean[][];      // parte fixa: [y][x] true = parede
    exit: Position;
    players: Player[];
    monsters: Position[];
    coins: { owner: number; pos: Position }[];
    freezeSpots: Position[];
    freezeItem: Position | null;   // gelo no chão (no máximo 1)
    endsAt: number;
    status: "countdown" | "running" | "finished";
    winnerSlot: number | null;
    local: boolean;          // partida local 1v1
};
```

Uma diferença em relação ao meu so_long em C: lá eu escrevia tudo dentro de `char **map` ('P', 'X', 'C'...), e precisava de truques como o `in_door`. Aqui o **mapa fixo** (paredes e porta) fica **separado** das coisas que se mexem (jogadores, monstros, moedas). Fica bem mais simples.

---

## 6. O que o servidor faz

**Início:** o host aperta Start → o servidor escolhe o mapa, monta o estado inicial, envia o mapa para todos e faz a contagem 3, 2, 1.

**Durante a partida:**
- **Movimento** (`game:move`): verifica se o jogador está vivo, não congelado e respeitou o cooldown, se o destino não é parede nem outro jogador. Se estiver tudo bem, move e verifica moeda, gelo, monstro e porta.
- **Usar gelo** (`game:useFreeze`): se o jogador tem gelo, congela todos os adversários vivos por 2 s.
- **A cada 500 ms:** move os monstros e verifica se algum encostou em alguém.
- **A cada 1 s:** verifica o tempo da partida, quem precisa renascer, quem está desconectado há mais de 30 s e se é hora de aparecer um gelo novo.
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
| `game:useFreeze` | jogador → servidor | Tecla de usar o gelo |
| `game:state` | servidor → jogadores | O estado mudou |
| `game:event` | servidor → jogadores | Algo aconteceu (morte, moeda, gelo usado), para efeitos visuais |
| `game:end` | servidor → jogadores | Fim: quem ganhou, estatísticas |
| `game:leave` | jogador → servidor | Saiu da partida (= desistência) |
| `game:rejoin` / `game:resume` | ida e volta | Reconexão |

No modo local, `game:move` e `game:useFreeze` levam também o slot: `{ slot: 0 | 1, dir }`.

O servidor **sempre valida** o que recebe e ignora qualquer valor estranho.

**Importante:** hoje o servidor confia no `username` que o navegador envia. Antes de ligar o jogo à rede, precisamos da **autenticação no socket** (o servidor saber quem é o jogador pelo login).

---

## 8. No navegador

**Desenho:** um `<canvas>` HTML, sem biblioteca. É muito parecido com a MiniLibX:

| MiniLibX | Canvas |
|---|---|
| `mlx_xpm_file_to_image` | `img.src = "/sprites/wall.png"` |
| `mlx_put_image_to_window` | `ctx.drawImage(img, x, y, size, size)` |
| `mlx_loop_hook` | `requestAnimationFrame` |
| `mlx_key_hook` | `addEventListener("keydown")` |

A cada frame, desenho tudo nesta ordem: chão e paredes → porta → moedas (as dos outros com transparência) → gelo → monstros → jogadores (com um anel da cor de cada um e o cubinho de gelo ao lado, se tiver) → HUD com tempo, moedas restantes e mortes.

- As sprites vêm do meu so_long (convertidas de `.xpm` para `.png`).
- O tamanho de cada casa se adapta ao tamanho da tela (o subject pede uma interface responsiva).
- A animação dos personagens (6 quadros) é só visual e roda no navegador.

**Controles (online)**
| Ação | Tecla |
|---|---|
| Mover | WASD ou setas |
| Usar gelo | Espaço ou E |

No celular, aparecem botões na tela (setas + gelo).

---

## 9. Modo local (1v1 no mesmo computador)

Dois jogadores no mesmo teclado. **Só 1v1**, porque com mais gente ficaria desconfortável.

| | Mover | Usar gelo |
|---|---|---|
| Jogador 1 | W A S D | E |
| Jogador 2 | Setas | Enter |

- Usa sempre um **mapa pequeno**.
- O jogador 2 é um "convidado" (não precisa de conta).
- Funciona igual ao online: o servidor continua mandando, só que **uma conexão controla os dois jogadores**.
- 🔶 Partidas locais **não contam** para as estatísticas (não dá para saber quem é o convidado).

---

## 10. Desconexão e reconexão

O módulo *Remote players* exige isso.

- Se alguém cair, o personagem **fica parado no mapa** (os monstros ainda podem pegá-lo) e os outros veem "Fulano desconectado".
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
                 (resultado, moedas, movimentos, mortes, tempo)
```

`match_players` liga `users` e `matches` (relação N:N). Com isso dá para montar o **histórico**, o **perfil** com os totais e um **leaderboard**.

Se adotarmos o **Prisma** (ORM), essas tabelas devem ser criadas já com ele.

---

## 12. Para depois (se der tempo)

- **Bot (IA)**: um jogador controlado pelo servidor que usa busca em largura para achar as moedas e fugir dos monstros, com reação mais lenta e alguns "erros" de propósito. Vale 2 pontos.
- **Modo espectador**: assistir a uma partida em andamento.
- **Mais power-ups**: velocidade, fantasma...
- **Torneio** e **conquistas**.

---

## 13. Organização dos arquivos

```
backend/
  maps/                    ← os 6 mapas .ber
  src/game/
    types.ts               ← tipos (seção 5)
    protocol.ts            ← tipos dos eventos (cópia igual no frontend)
    mapLoader.ts           ← lê o .ber e monta o estado inicial
    GameRoom.ts            ← as regras do jogo (seção 6)
    gameManager.ts         ← lista de partidas ativas, rejoin
    gameSocket.ts          ← liga os eventos do socket à GameRoom
    __tests__/             ← testes do motor e dos mapas

frontend/
  public/sprites/          ← PNGs convertidos do so_long
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
| Jogadores bloqueiam uns aos outros? | Sim |
| Ao morrer perde as moedas? | Não. Some por 3 s e renasce |
| Monstros andam sobre moedas? | Não |
| Cooldown de movimento | 150 ms (vamos ajustar testando) |
| Tempo limite | 3 min |
| Tempo para reconectar | 30 s |
| Moedas dos outros | Visíveis, semitransparentes |
| Porta | Uma, compartilhada |
| Power-ups | Só o Freeze (guarda e usa com uma tecla) |
| Mapas | 6 feitos à mão (2 por tamanho), escolhidos ou aleatórios |
| Modo local | Só 1v1 |
| Sessão (login) | **A decidir**: JWT em cookie httpOnly × JWT em localStorage |
| ORM | Prisma (a confirmar) |
| Nome | so_long: Arena (provisório) |


