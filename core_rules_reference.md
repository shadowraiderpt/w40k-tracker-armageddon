# Warhammer 40.000 — Core Rules 11ª Edição — Referência para a App

Extraído do PDF oficial das Core Rules (válido desde 1 Jun 2026) e do documento
Universal Rules Updates (válido desde 22 Jul 2026). Isto é para o Claude Code
usar como fonte de verdade ao construir a lógica da app — não é para o jogador ler.

\---

## 1\. Estrutura do turno (fonte: secção 07, "The Battle Round")

Um **battle round** = 2 turnos (um por jogador). Cada turno tem 7 partes:

1. Start of Turn step
2. Command Phase
3. Movement Phase
4. Shooting Phase
5. Charge Phase
6. Fight Phase
7. End of Turn step

\---

## 2\. Command Phase (secção 08)

Passos, por ordem:

1. **Start of Command Phase** — resolver regras que disparam aqui
2. **Gain Core CP** — ambos os jogadores ganham 1 CP
3. **Battle-shock** — o jogador ativo faz um battle-shock roll (ver secção 5) para
cada unidade que esteja: (a) atualmente battle-shocked, OU (b) a metade força
ou menos. Se uma unidade já estava battle-shocked e passa o roll agora, deixa
de estar battle-shocked.
4. **Command Abilities** — resolver regras que disparam na Command Phase
5. **End of Command Phase**

## 3\. Movement Phase (secção 09)

1. Start of Movement Phase
2. **Move Units** — por unidade, escolher um tipo de movimento:

   * **Remain Stationary**: distância 0
   * **Normal Move**: até ao M da unidade; unidade tem de estar unengaged antes e depois
   * **Advance Move**: rola 1D6, soma ao M; unidade unengaged antes e depois; **não pode disparar nem carregar depois** (exceto armas \[ASSAULT])
   * **Fall-back Move**: só se estiver engaged; até ao M; escolhe Ordered Retreat (se não battle-shocked) ou Desperate Escape (obrigatório se battle-shocked — faz um hazard roll por modelo); depois **não pode disparar, carregar nem iniciar uma ação** nesse turno
3. End of Movement Phase

## 4\. Shooting Phase (secção 10)

Por unidade elegível, escolher um tipo de tiro:

* **Normal shooting**: unengaged e não avançou este turno
* **Assault shooting**: unengaged, avançou este turno, e tem arma \[ASSAULT] — só pode disparar com armas \[ASSAULT]
* **Close-quarters shooting**: engaged, não avançou, tem arma \[CLOSE-QUARTERS] (ou é MONSTER/VEHICLE) — só pode alvejar unidades com quem está engaged
* **Indirect shooting**: unengaged, não avançou, tem arma \[INDIRECT FIRE]

## 5\. Attack Sequence (secção 05) — o núcleo dos cálculos

### Passo 1 — Hit Rolls

Rola 1D6 por dado de ataque.

* Resultado não modificado de **1** → falha sempre
* Resultado não modificado igual ao BS/WS ou melhor → **critical hit** se for o valor máximo não modificado necessário (nota: um 6 não modificado é sempre crítico independentemente do BS)
* Resultado ≥ BS/WS → hit
* Outro resultado → falha

### Passo 2 — Wound Rolls

Rola 1D6 por hit. Tabela oficial Strength vs Toughness:

|Comparação S vs T|Resultado necessário|
|-|-|
|S é o DOBRO (ou mais) de T|2+|
|S é MAIOR que T (não o dobro)|3+|
|S é IGUAL a T|4+|
|S é MENOR que T|5+|
|S é METADE (ou menos) de T|6+|

Um 1 não modificado falha sempre. Um 6 não modificado é sempre critical wound.

### Modificadores e Cobertura (secção 13.08, 11ª edição)

* Hit rolls e wound rolls nunca podem ser modificados mais de -1/+1 no total, seja qual for o número de fontes a somar.
* Benefit of cover: piora o BS do ataque em 1 (i.e. -1 ao hit roll de quem dispara contra a unidade em cobertura). Não mexe no save — isto é diferente da 10ª edição, onde a cobertura dava +1 ao save.

### Passo 3 — Save Rolls

O jogador defensor:

1. **Cria allocation groups**: um grupo por modelo CHARACTER; um grupo para todos os outros modelos com o mesmo W, Sv e InSv
2. **Declara ordem de alocação**:

   * Um grupo não-CHARACTER que já perdeu feridas tem de vir primeiro
   * Nenhum grupo CHARACTER pode vir antes de um grupo não-CHARACTER
   * Entre grupos CHARACTER, os que já perderam feridas vêm primeiro
3. Rola 1D6 por wound

### Passo 4 — Inflict Damage

Para cada resultado de save, do mais baixo para o mais alto, dentro do grupo de alocação atual:

* Se tiver **Invulnerable Save**: falha (não inflige dano) se o resultado ≥ InSv. **O AP nunca modifica o Invulnerable Save.**
* Senão: o resultado, modificado pelo AP da arma, tem de ser ≥ Sv normal para falhar (não infligir dano)
* Se infligir dano, o modelo selecionado perde W = valor de Damage da arma; a 0 ou menos, é destruído
* Quando um grupo de alocação está todo destruído, passa para o próximo grupo da ordem declarada

**Regra chave para a app**: quando pedires ao utilizador "quantos saves falharam", a app não decide que modelo específico morre — isso seguirá sempre a ordem de allocation groups acima, que o próprio jogador aplica manualmente.

\---

## 6\. Charge Phase (secção 11)

* Elegível se: está no campo de batalha, a ≤12" de uma ou mais unidades inimigas, unengaged, e não avançou/recuou este turno
* Charge roll: 2D6 = distância máxima
* Tem de terminar mais perto do alvo, dentro de 1" se possível, ou pelo menos engaged
* **Um resultado de 2 (dois 1) nunca é suficiente** para completar um charge (não pode ficar a menos de 2" na declaração)
* Sucesso → unidade ganha **Fights First** até ao fim do turno

## 7\. Fight Phase (secção 12)

1. **Start of Fight Phase**
2. **Pile In** — até 3", cada unidade engaged ou que carregou este turno
3. **Fight**:

   * Primeiro resolvem-se todos os **Fights First** (unidades que carregaram, ou com a ability na datasheet), alternando entre jogadores começando pelo jogador ativo
   * Depois resolvem-se as restantes unidades elegíveis, alternando
4. **Consolidate** — até 3", modo obrigatório consoante a situação (Ongoing / Engaging / Objective Consolidation)
5. **End of Fight Phase**

\---

## 8\. Battle-shock Roll (secção 01.07)

Um battle-shock roll é um leadership roll: 2D6, compara com o LD da unidade.

* Passa → nada acontece / deixa de estar battle-shocked
* Falha → a unidade fica **battle-shocked**: OC passa a "-" (não controla objetivos), não pode receber stratagems, entre outros efeitos

\---

## 9\. Objective Control (secção 14)

* No início da partida, nenhum objetivo é controlado
* Ao fim de cada fase e turno: soma o OC de todos os modelos de cada jogador dentro do alcance do objetivo
* Quem tiver o total mais alto controla o objetivo
* Empate → ninguém controla (a menos que esteja "secured" por uma regra específica)
* Unidades battle-shocked contam OC como zero

\---

## 10\. Glossário de keywords de armas (secção 24) — usado nas datasheets do Armageddon

|Keyword|Efeito|
|-|-|
|**\[ANTI-X Y+]**|Contra alvo com keyword X, um wound roll não modificado de Y+ é sempre critical wound|
|**\[ASSAULT]**|Permite assault shooting mesmo depois de avançar|
|**\[BLAST]** / **\[BLAST X]**|+1 dado de ataque (ou +X) por cada 5 modelos no alvo (arredondado para baixo)|
|**\[CLEAVE X]**|Se só houver um alvo selecionado, +X dados de ataque por cada 5 modelos no alvo|
|**\[CLOSE-QUARTERS]**|Permite close-quarters shooting; idêntico a \[PISTOL]|
|**Deadly Demise X**|Ao morrer, rola 1D6; num 6, unidades a 6" sofrem X mortal wounds|
|**Deep Strike** (core, não arma)|Pode fazer ingress move fora de 8" de unidades inimigas|
|**\[DEVASTATING WOUNDS]**|Critical wound = X mortal wounds direto (X = Damage da arma), sem save, máx. 1 modelo morto por critical wound. Melta + Devastating Wounds: interação por confirmar na 11ª (nenhuma arma do roster atual tem as duas keywords em simultâneo, por isso a app não teve de decidir isto ainda)|
|**\[EXTRA ATTACKS]**|Ataques adicionais a somar aos da arma principal|
|**Feel No Pain X+**|Cada ferida perdida: rola 1D6, num X+ não é perdida|
|**Fights First**|A unidade luta antes das que não têm esta ability|
|**\[HAZARDOUS]**|Depois de disparar/lutar, rola 1D6 por cada arma HAZARDOUS usada. Num 1 não modificado: se o modelo for CHARACTER/MONSTER/VEHICLE, a unidade sofre 3 mortal wounds obrigatoriamente alocadas a esse modelo; caso contrário, 1 modelo da unidade equipado com essa arma é destruído diretamente (prioridade: já ferido > não-character > character)|
|**\[HEAVY]**|+1 ao hit roll se a unidade estiver unengaged, não foi posta em jogo este turno, e nenhum modelo moveu mais de 3"|
|**\[LETHAL HITS]**|Critical hit pode escolher ferir automaticamente (sem wound roll)|
|**\[MELTA X]**|Dentro de metade do alcance, +X ao Damage da arma|
|**\[PRECISION]**|Pode forçar o grupo de alocação a incluir um CHARACTER visível primeiro|
|**\[PSYCHIC]**|Pode ignorar modificadores ao BS/WS e ao hit roll|
|**\[RAPID FIRE X]**|Dentro de metade do alcance, +X dados de ataque|
|**\[SUSTAINED HITS X]**|Critical hit gera X hits adicionais|
|**\[TORRENT]**|Acerta automaticamente (sem hit roll)|
|**\[TWIN-LINKED]**|Pode re-rolar o wound roll|

\---

## 11\. Universal Rules Update (válido desde 22 Jul 2026)

Documento curto, atualiza regras de stratagems em geral (não específico do Armageddon,
mas relevante se algum stratagem futuro for adicionado à app):

* Stratagems que permitem alvejar uma unidade amiga por "0CP" sem nomear o stratagem
em si: reduz o custo em 1CP em vez de o tornar grátis
* Stratagems limitados a "uma vez por turno/ronda/batalha" só se aplicam a esse limite
se o nome do stratagem for especificado na regra
* Stratagems que impedem uma unidade de ser alvo a menos de 12" passam a 18"
* Stratagems que adicionam "uma nova unidade idêntica à destruída": só podem ser usados
uma vez por batalha

\---

## 12\. Core Stratagems (disponíveis a qualquer exército, sem precisar de Codex)

Todos custam 1CP, exceto onde indicado. "Fase" refere-se sempre a "any/your/opponent's phase" conforme especificado.

|Stratagem|Quando|Efeito|
|-|-|-|
|**Command Re-roll**|Qualquer fase, logo depois de rolares um advance/charge/damage/hazard/hit/save/wound roll (ou nº de ataques de uma arma) para uma unidade amiga|Rerolas esse resultado (se forem vários dados, escolhes um; charge rolls rerolam-se sempre por inteiro)|
|**Epic Challenge**|Fight phase, quando uma unidade CHARACTER amiga é escolhida para lutar|Um modelo CHARACTER dessa unidade ganha \[PRECISION] nas armas de combate até ao fim da fase|
|**Insane Bravery**|Battle-shock step da tua Command phase, mesmo antes de rolares o teste|Esse battle-shock roll passa automaticamente. **Só pode ser usado 1 vez por batalha.**|
|**Explosives**|A tua Shooting phase|Unidade amiga com keyword EXPLOSIVES/GRENADES, unengaged, elegível para disparar, que não avançou: escolhe um modelo com essa keyword, escolhe uma unidade inimiga unengaged a 8" e visível, rola 6D6 — cada 4+ causa 1 mortal wound|
|**Crushing Impact**|A tua Charge phase, logo depois de uma unidade MONSTER/VEHICLE terminar um charge|Escolhes a unidade inimiga engaged e um modelo teu engaged com ela; rolas dados = Toughness desse modelo — cada 1 causa 1 mortal wound à tua unidade, cada 5+ causa 1 mortal wound ao inimigo (máx. 6)|
|**Rapid Ingress**|Fim da Movement phase do adversário|Uma unidade amiga em strategic reserves (exceto AIRCRAFT) faz um ingress move. **Não pode ser usado na 1ª ronda.**|
|**Smokescreen**|Início da Shooting phase do adversário|Unidade amiga com keyword SMOKE: até ao fim da fase, ataques contra ela (ou contra unidades que ela bloqueia visualmente) têm benefício de cover|
|**Fire Overwatch**|Fim da Movement phase do adversário|Unidade amiga unengaged (exceto TITANIC) dispara em "snap shooting": só um alvo visível a 24", só acerta com 6 não modificado, sem reroll de hits; depois não pode iniciar ações nessa fase|
|**Heroic Intervention**|Fim da Charge phase do adversário|Unidade amiga unengaged a 12" de um inimigo (VEHICLE só se for CHARACTER/WALKER) faz uma carga. Modo "Leap to Defend": só pode alvejar quem carregou nesta fase. Modo "Into the Fray" (**+1CP**): resultado de carga acima de 6 passa a 6, e pode alvejar qualquer inimigo a 6"|
|**Counteroffensive**|**2CP.** Fight step da fase de combate do adversário, logo depois de uma unidade inimiga resolver os ataques dela|Uma unidade amiga elegível para lutar ganha Fights First e tem de ser a próxima a lutar|

**Nota:** o "Explosives" só se aplica a unidades com a keyword EXPLOSIVES ou GRENADES (o Captain, o Chaplain, o Ancient e o Intercessor Squad têm esta keyword nas tuas datasheets). O "Crushing Impact" só se aplica a unidades MONSTER/VEHICLE (o Big Mek Dakkarig, o Wartrakk e o Land Speeder qualificam-se).

\---

## Nota para o Claude Code

Esta referência serve para a app **verificar e mostrar corretamente** os passos e
cálculos — nunca para gerar texto de regras novo por conta própria. Se uma datasheet
tiver uma keyword não listada aqui (é possível, já que este documento cobre só as
keywords universais, não regras específicas de facção), a app deve pedir ao
utilizador para descrever o efeito manualmente em vez de adivinhar.

Os Core Stratagems da secção 12 podem ser oferecidos como lista de referência opcional
durante a Command Phase ou noutras fases relevantes (a app pode mostrar "tens acesso a
estes stratagems" com o texto acima), mas a decisão de usar ou não, e o cálculo de CP
disponível, continua a ser sempre confirmada pelo utilizador — a app nunca ativa um
stratagem sozinha.

