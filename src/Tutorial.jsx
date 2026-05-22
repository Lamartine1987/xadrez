import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Chessboard } from 'react-chessboard';
import { useBoardTheme } from './hooks/useBoardTheme';
import { Chess } from 'chess.js';
import { BookOpen, ChevronRight, ChevronLeft, Play, Star, Swords, Crown, Target, Compass, Hourglass, Flag, Shield, Lightbulb, Brain, Rocket } from 'lucide-react';

const basicLessons = [
  {
    title: 'O Movimento do Peão',
    description: 'Peões se movem uma casa para frente, mas no primeiro movimento podem pular duas casas. Eles capturam na diagonal!',
    moves: ['e4', 'e5', 'd4', 'exd4']
  },
  {
    title: 'A Força da Rainha',
    description: 'A Rainha é a peça mais poderosa! Ela se move em qualquer direção: vertical, horizontal ou diagonal.',
    moves: ['e4', 'e5', 'Qh5', 'Nf6', 'Qxe5+', 'Be7']
  },
  {
    title: 'O Salto do Cavalo',
    description: 'O Cavalo é a única peça que pode pular as outras! Ele se move no formato de um "L".',
    moves: ['Nf3', 'Nf6', 'Nc3', 'Nc6', 'Nd5', 'Nxd5']
  },
  {
    title: 'Controle do Centro',
    description: 'Ocupar o centro do tabuleiro (d4, e4, d5, e5) dá mais espaço para suas peças e restringe o adversário.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4']
  },
  {
    title: 'Desenvolvimento das Peças',
    description: 'Tire seus cavalos e bispos da linha de fundo logo no início. Peças ativas são mais fortes e ajudam a dominar o jogo!',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Nc3', 'Bc5']
  },
  {
    title: 'Roque Pequeno',
    description: 'O Rei move duas casas para a direita e a Torre pula para o lado dele. O Rei fica seguro e a Torre entra no jogo.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']
  },
  {
    title: 'Roque Grande',
    description: 'Semelhante ao Roque Pequeno, mas na ala da Dama. O Rei move duas casas para a esquerda e a Torre pula para o seu lado.',
    moves: ['d4', 'd5', 'Nc3', 'Nf6', 'Bf4', 'e6', 'Qd2', 'Be7', 'O-O-O']
  },
  {
    title: 'Promoção de Peão',
    description: 'Quando um peão chega do outro lado do tabuleiro, ele pode se transformar em qualquer peça (geralmente uma Rainha)!',
    moves: ['e4', 'f5', 'exf5', 'g6', 'fxg6', 'h6', 'g7', 'Rh7', 'gxf8=Q+']
  },
  {
    title: 'Captura En Passant',
    description: 'Se um peão adversário pular duas casas e parar ao lado do seu, você pode capturá-lo como se ele tivesse andado apenas uma casa.',
    moves: ['e4', 'Nf6', 'e5', 'd5', 'exd6']
  },
  {
    title: 'Defesa do Rei',
    description: 'Sempre que o seu Rei for atacado (Xeque), você deve defendê-lo movendo-o, bloqueando o ataque ou capturando a peça atacante.',
    moves: ['e4', 'e5', 'Qh5', 'g6', 'Qxe5+', 'Qe7', 'Qxh8', 'Nf6', 'd3', 'd6', 'Bg5', 'Nbd7']
  },
  {
    title: 'Coordenação de Peças',
    description: 'Peças trabalhando juntas são muito perigosas! Veja como Cavalo e Bispo podem atacar a mesma casa em conjunto.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5', 'Nxf7', 'Kxf7', 'Qf3+']
  },
  {
    title: 'Conectar as Torres',
    description: 'Ao tirar as peças menores e fazer o roque, suas Torres ficam na mesma fileira. Isso fortalece sua defesa e ataque.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3', 'Nf6', 'O-O', 'O-O', 'Be3', 'Bxe3', 'fxe3', 'd6', 'Qe1', 'a6', 'Nc3']
  },
  {
    title: 'Mate do Pastor (A Armadilha)',
    description: 'Um dos xeques-mates mais rápidos do xadrez! A Rainha e o Bispo atacam juntos o peão mais fraco do adversário (f7).',
    moves: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']
  }
];

const advancedLessons = [
  {
    title: 'Ataques Duplos',
    description: 'Um ataque duplo é quando uma única peça ataca duas peças inimigas ao mesmo tempo. Aqui a Dama ataca o peão b7 e o ponto f7 junto com o Bispo!',
    moves: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'Bg4', 'dxe5', 'Bxf3', 'Qxf3', 'dxe5', 'Bc4', 'Nf6', 'Qb3']
  },
  {
    title: 'Garfo de Cavalo',
    description: 'O Cavalo é o rei dos garfos por pular sobre outras peças. Neste exemplo, ele ataca a Dama e a Torre adversárias simultaneamente!',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'Bc5', 'Nxf7']
  },
  {
    title: 'Garfo de Peão',
    description: 'Até os humildes peões podem dar garfos! Ao avançar para d5, o peão ataca o Cavalo em e4 e o Bispo em c4 ao mesmo tempo.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6', 'Bc4', 'Nxe4', 'Nxe4', 'd5']
  },
  {
    title: 'Garfo de Dama',
    description: 'A Dama, sendo tão poderosa, frequentemente ataca várias peças ao mesmo tempo. Aqui ela ataca o Rei (xeque) e o peão solto em h7.',
    moves: ['e4', 'e5', 'Nf3', 'f5', 'Nxe5', 'fxe4', 'Qh5+', 'g6', 'Nxg6', 'hxg6', 'Qxh8']
  },
  {
    title: 'Cravada Absoluta',
    description: 'Uma peça cravada absolutamente não pode se mover, pois exporia o Rei a um xeque. Aqui, o Bispo branco crava o Cavalo negro ao Rei!',
    moves: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'exd4', 'Qxd4', 'Nc6', 'Bb5', 'a6', 'Bxc6+']
  },
  {
    title: 'Cravada Relativa',
    description: 'Diferente da absoluta, a peça pode se mover, mas não deve, pois exporia uma peça de maior valor. Aqui, o Cavalo está cravado à Dama.',
    moves: ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Nc6', 'Nc3', 'Bg4', 'h3', 'Bh5']
  },
  {
    title: 'Espeto (Skewer)',
    description: 'O inverso da cravada! Uma peça valiosa é atacada, forçada a se mover e expõe uma peça menos valiosa atrás dela.',
    moves: ['e4', 'c5', 'd4', 'cxd4', 'Qxd4', 'Nc6', 'Qc3', 'e5', 'a3', 'Nf6', 'Bg5', 'Be7', 'Nd2', 'd5', 'Bxf6', 'Bxf6', 'O-O-O', 'd4', 'Qg3', 'O-O', 'h4', 'Be6', 'Nh3', 'Rc8', 'Ng5', 'Qc7', 'Nxe6', 'fxe6', 'Bc4', 'Na5', 'Bxe6+']
  },
  {
    title: 'Ataque em Raio X',
    description: 'Quando uma peça ataca (ou defende) algo *através* de outra peça. Veja como a Torre protege e ataca peças através das fileiras no tabuleiro.',
    moves: ['e4', 'e5', 'Nf3', 'd6', 'd4', 'exd4', 'Qxd4', 'Nc6', 'Bb5', 'Bd7', 'Bxc6', 'Bxc6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'O-O-O', 'O-O', 'Rhe1', 'h6', 'Bh4', 'Nd7', 'Bxe7', 'Qxe7', 'Nd5', 'Bxd5', 'exd5', 'Qf6', 'Qxf6', 'Nxf6', 'Re7', 'Rfc8']
  },
  {
    title: 'Ataque Descoberto',
    description: 'Ocorre quando você move uma de suas peças para abrir caminho e revelar um ataque de outra peça sua que estava logo atrás.',
    moves: ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'd6', 'Nf3', 'Nxe4', 'd3', 'Nf6', 'd4', 'd5', 'Bd3', 'Bd6', 'O-O', 'O-O', 'Re1', 'Bg4', 'Bg5', 'Nbd7', 'Nbd2', 'c6', 'c3', 'Qc7', 'Qc2', 'Rfe8', 'h3', 'Bh5', 'b4', 'a6', 'a4', 'b5', 'a5', 'Bf4', 'Bxf4', 'Qxf4']
  },
  {
    title: 'Xeque Descoberto',
    description: 'Uma versão letal do ataque descoberto, onde a peça revelada ataca diretamente o Rei adversário. Neste caso, o Cavalo se move descobrindo a Dama, que dá xeque!',
    moves: ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'Nxe4', 'Qe2', 'Nf6', 'Nc6+']
  },
  {
    title: 'Ataque Oculto',
    description: 'Semelhante a um raio-x ou descoberto, é uma ameaça difícil de prever. Um posicionamento tático que prepara um golpe surpresa e inesperado no futuro.',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Bg5', 'e6', 'f4', 'Be7', 'Qf3', 'Qc7', 'O-O-O', 'Nbd7', 'g4', 'b5', 'Bxf6', 'Nxf6', 'g5', 'Nd7', 'f5', 'Nc5', 'f6', 'gxf6', 'gxf6', 'Bf8', 'Rg1', 'b4']
  },
  {
    title: 'Desvio (Deflection)',
    description: 'Forçar uma peça inimiga a se mover para longe de uma casa, linha ou peça que ela estava defendendo.',
    moves: ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'Nf6', 'd3', 'Nc6', 'h3', 'Bh5', 'g4', 'Bg6', 'Bg5', 'Be7', 'Bxf6', 'Bxf6', 'Nd5', 'O-O', 'h4', 'h5', 'g5', 'Be7', 'Qd2', 'Kh7', 'O-O-O']
  },
  {
    title: 'Atração (Decoy)',
    description: 'Atrair (geralmente através de um sacrifício) uma peça inimiga para uma casa desvantajosa. Muito comum para preparar garfos ou xeques.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Bc4', 'Bc5', 'Ng5', 'Nh6', 'Nxf7', 'Nxf7', 'Bxf7+', 'Kxf7', 'Qh5+', 'g6', 'Qxc5']
  },
  {
    title: 'Sobrecarga',
    description: 'Quando uma única peça adversária tem mais tarefas de defesa do que consegue aguentar. Ao atacar um dos pontos defendidos, a peça sobrecarregada cede.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O', 'h3', 'Na5', 'Bc2', 'c5', 'd4', 'Qc7']
  },
  {
    title: 'Interferência',
    description: 'Colocar uma de suas peças entre duas peças inimigas para cortar a linha de comunicação ou defesa entre elas.',
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5', 'O-O', 'Nc6', 'd5', 'Ne7']
  },
  {
    title: 'Bloqueio',
    description: 'Forçar uma peça inimiga a se mover para uma casa onde ela bloqueia a rota de fuga do próprio Rei ou de outra peça importante.',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Bg5', 'e6', 'f4', 'Be7']
  },
  {
    title: 'Remoção do Defensor',
    description: 'Capturar ou afugentar uma peça que está defendendo um objetivo crítico, deixando-o vulnerável a um ataque subsequente.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'd6', 'd4', 'Bd7', 'Nc3', 'Nf6', 'O-O', 'Be7', 'Re1', 'exd4', 'Nxd4', 'O-O', 'Bxc6', 'bxc6']
  },
  {
    title: 'Sacrifício de Peça',
    description: 'Entregar uma peça de valor em troca de vantagens posicionais, ataques fulminantes ou ganho de iniciativa. Muito comum em aberturas agressivas.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Ba5', 'd4', 'exd4', 'O-O', 'dxc3', 'Qb3', 'Qf6']
  },
  {
    title: 'Sacrifício de Qualidade',
    description: 'Sacrificar uma Torre por um Bispo ou Cavalo (uma peça de menor valor) para destruir a defesa adversária ou arruinar sua estrutura de peões.',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6', 'Be3', 'Bg7', 'f3', 'O-O', 'Qd2', 'Nc6', 'Bc4', 'Bd7', 'O-O-O', 'Rc8', 'Bb3', 'Ne5', 'h4', 'h5', 'Bg5', 'Rc5', 'Kb1', 'b5', 'g4', 'a5', 'Bxf6', 'Bxf6', 'gxh5', 'Rxc3', 'bxc3', 'a4', 'hxg6', 'axb3', 'Qh6', 'fxg6']
  },
  {
    title: 'Sacrifício de Dama',
    description: 'O sacrifício mais espetacular do xadrez! Entregar a peça mais forte do tabuleiro para forçar um xeque-mate inevitável logo em seguida.',
    moves: ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'h6', 'Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5']
  }
];

const importantLessons = [
  {
    title: 'Zugzwang',
    description: 'Palavra alemã para "obrigação de mover". É uma situação (comum em finais) onde qualquer lance que o jogador fizer irá piorar sua posição. É como se fosse a vez dele, mas ele preferisse passar a vez!',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6', 'g3', 'Bb7', 'Bg2', 'Be7', 'Nc3', 'O-O', 'O-O', 'd5', 'Ne5', 'c6', 'cxd5', 'cxd5', 'Bf4', 'a6', 'Rc1', 'b5', 'Qb3', 'Nc6', 'Nxc6', 'Bxc6', 'h3', 'Qd7', 'Kh2', 'Nh5', 'Bd2', 'f5', 'Qd1', 'b4', 'Nb1', 'Bb5', 'Rg1', 'Bd6', 'e4', 'fxe4', 'Qxh5', 'Rxf2', 'Qg5', 'Raf8', 'Kh1', 'R8f5', 'Qe3', 'Bd3', 'Rce1', 'h6']
  },
  {
    title: 'Zwischenzug (Lance Intermediário)',
    description: 'Em vez de jogar a jogada esperada (como recapturar uma peça), o jogador insere uma jogada intermediária surpreendente (geralmente um xeque ou ameaça maior) antes de completar a ação.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Nxe4', 'd4', 'b5', 'Bb3', 'd5', 'dxe5', 'Be6', 'c3', 'Bc5', 'Nbd2', 'O-O', 'Bc2', 'f5', 'exf6', 'Nxf2', 'Rxf2', 'Bxf2+', 'Kxf2', 'Qxf6']
  },
  {
    title: 'Perseguição do Rei (King Hunt)',
    description: 'Uma caçada implacável onde o Rei adversário é forçado a sair de seu esconderijo e caminhar pelo tabuleiro enquanto é atacado até o mate ou perda de material crítico.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5', 'Nxf7', 'Kxf7', 'Qf3+', 'Ke6', 'Nc3', 'Nce7', 'd4', 'c6', 'Bg5', 'h6', 'Bxe7', 'Bxe7', 'O-O-O', 'Rf8', 'Qe4', 'Rxf2', 'Rhf1', 'Rxf1', 'Rxf1', 'Kd6', 'Qxe5+', 'Kd7']
  },
  {
    title: 'Rede de Mate',
    description: 'Um padrão de ataque onde as peças do atacante controlam todas as casas de fuga ao redor do Rei inimigo, criando uma "rede" da qual ele não consegue escapar.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Bc4', 'Bc5', 'c3', 'd3', 'b4', 'Bb6', 'a4', 'a6', 'Qb3', 'Qf6', 'Bg5', 'Qg6', 'O-O', 'd6', 'Nbd2', 'Nge7', 'b5', 'Na5', 'Qb4', 'Nxc4', 'Nxc4', 'Bc5', 'Qb3', 'Be6', 'Bxe7', 'Kxe7', 'b6', 'c6', 'e5', 'd5', 'Nd6', 'Bxd6', 'exd6+', 'Kxd6', 'Qb4+', 'c5', 'Qf4+', 'Kc6', 'Qc7#']
  },
  {
    title: 'Ataque Perpétuo / Repetição',
    description: 'Geralmente usado para salvar um jogo perdido, um jogador dá uma série ininterrupta de xeques (ou ameaças) forçando a mesma posição a se repetir três vezes, resultando em empate.',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Bg5', 'e6', 'f4', 'Qb6', 'Qd2', 'Qxb2', 'Rb1', 'Qa3', 'f5', 'Nc6', 'fxe6', 'fxe6', 'Nxc6', 'bxc6', 'e5', 'dxe5', 'Bxf6', 'gxf6', 'Ne4', 'Be7', 'Be2', 'O-O', 'Rb3', 'Qa4', 'Rg3+', 'Kh8', 'Qh6', 'Rf7', 'Qh5', 'Qb4+', 'c3', 'Qb1+', 'Bd1', 'Qxe4+', 'Be2', 'Qb1+', 'Bd1', 'Qe4+', 'Be2']
  },
  {
    title: 'Afogamento (Stalemate)',
    description: 'Um tipo de empate surpreendente! Ocorre quando o jogador que tem a vez não está em xeque, mas não tem NENHUM movimento legal possível. O jogo termina imediatamente em empate.',
    moves: ['e3', 'a5', 'Qh5', 'Ra6', 'Qxa5', 'h5', 'h4', 'Rah6', 'Qxc7', 'f6', 'Qxd7+', 'Kf7', 'Qxb7', 'Qd3', 'Qxb8', 'Qh7', 'Qxc8', 'Kg6', 'Qe6']
  }
];

const matingPatterns = [
  {
    title: 'Mate do Corredor',
    description: 'Um dos mates mais comuns. Ocorre quando a torre ou dama dá mate na última fileira, e o rei adversário está preso atrás de seus próprios peões.',
    startFen: '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1',
    moves: ['Re8#']
  },
  {
    title: 'Mate Sufocado',
    description: 'Um mate belíssimo onde o rei é sufocado pelas próprias peças e recebe xeque-mate por um Cavalo. Um sacrifício de Dama prepara a armadilha final.',
    startFen: '5rk1/6pp/8/5N2/2Q5/8/8/7K w - - 0 1',
    moves: ['Nh6+', 'Kh8', 'Nf7+', 'Kg8', 'Nh6+', 'Kh8', 'Qg8+', 'Rxg8', 'Nf7#']
  },
  {
    title: 'Mate Árabe',
    description: 'Um padrão antigo onde o Cavalo e a Torre trabalham juntos no canto do tabuleiro. O cavalo protege a torre e também bloqueia a fuga do rei.',
    startFen: '7k/7p/5N2/8/8/8/8/6RK w - - 0 1',
    moves: ['Rg8#']
  },
  {
    title: 'Mate de Anastasia',
    description: 'O cavalo e a torre atacam juntos a lateral do roque adversário, com o cavalo fechando a rota de fuga.',
    startFen: 'r4q1k/pp2N1pp/3p4/2p1b3/2Q5/8/PPPP2PP/R1B3K1 w - - 0 1',
    moves: ['Ng6+', 'hxg6', 'Qh4#']
  },
  {
    title: 'Mate de Boden',
    description: 'Os dois bispos cruzam o tabuleiro em diagonais formando um "X" mortal que corta todas as saídas do rei inimigo.',
    startFen: '2kr1bnr/pp2pppp/2p5/8/2Q2B2/2N2P2/PPP2P1P/2KR3R w - - 0 1',
    moves: ['Qxc6+', 'bxc6', 'Ba6#']
  },
  {
    title: 'Mate de Blackburne',
    description: 'Uma armadilha brilhante de abertura que, assim como o mate sufocado, atrai as peças inimigas resultando em um mate implacável de cavalo.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5', 'Qg5', 'Nxf7', 'Qxg2', 'Rf1', 'Qxe4+', 'Be2', 'Nf3#']
  },
  {
    title: 'Mate da Escada',
    description: 'O mate básico usando duas torres (ou dama e torre). Elas se alternam cortando as fileiras do tabuleiro até empurrar o rei para a borda.',
    startFen: '7k/8/8/8/8/8/1R6/R3K3 w - - 0 1',
    moves: ['Ra3', 'Kg7', 'Rb4', 'Kf6', 'Ra5', 'Ke6', 'Rb6+', 'Kd7', 'Ra7+', 'Kc8', 'Rh6', 'Kb8', 'Rg7', 'Kc8', 'Rh8#']
  },
  {
    title: 'Mate com Dama e Rei',
    description: 'A Dama empurra o rei adversário para a borda do tabuleiro e o Rei aliado aproxima-se para dar o suporte final para o mate.',
    startFen: '8/8/8/8/8/4k3/8/4KQ2 w - - 0 1',
    moves: ['Qf2+', 'Kd3', 'Qf3+', 'Kc4', 'Qd5', 'Kb4', 'Kd2', 'Ka4', 'Kc2', 'Kb4', 'Qc6', 'Ka5', 'Qb7', 'Ka4', 'Qb6', 'Ka3', 'Qb3#']
  },
  {
    title: 'Mate com Torre e Rei',
    description: 'Usando a "oposição" de reis, a Torre empurra pacientemente o Rei inimigo até a última fileira.',
    startFen: '8/8/8/8/4k3/8/8/4KR2 w - - 0 1',
    moves: ['Kd2', 'Kd4', 'Re1+', 'Kc4', 'Re3', 'Kb4', 'Kc2', 'Kc4', 'Rd3', 'Kb4', 'Rc3', 'Kb5', 'Kd3', 'Kb4', 'Kd4', 'Kb5', 'Rc4', 'Kb6', 'Rc5', 'Kb7', 'Kd5', 'Kb6', 'Kd6', 'Kb7', 'Rc6', 'Kb8', 'Rc7', 'Ka8', 'Kc6', 'Kb8', 'Kb6', 'Ka8', 'Rc8#']
  },
  {
    title: 'Mate com Dois Bispos',
    description: 'Dois bispos controlam diagonais adjacentes, criando uma parede invisível que encurrala o Rei.',
    startFen: '8/8/8/8/8/5K2/4BB2/7k w - - 0 1',
    moves: ['Kg3', 'Kg1', 'Bc4', 'Kh1', 'Bd5+', 'Kg1', 'Bc5#']
  },
  {
    title: 'Mate com Bispo e Cavalo',
    description: 'Um dos mates mais difíceis de executar na prática! O Bispo e Cavalo trabalham em harmonia para forçar o rei ao canto da cor do bispo.',
    startFen: '8/8/8/8/8/5K2/4BN2/7k w - - 0 1',
    moves: ['Kg3', 'Kg1', 'Bc4', 'Kh1', 'Ng4', 'Kg1', 'Nf6+', 'Kh1', 'Bd5#']
  },
  {
    title: 'Mate Pastor',
    description: 'O xeque-mate mais famoso entre os iniciantes! A Dama e o Bispo atacam juntos o peão fraco em f7.',
    moves: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']
  },
  {
    title: 'Mate de Légal',
    description: 'Uma armadilha brilhante de abertura onde um aparente "erro" (deixar a Dama ser capturada) resulta em um mate impressionante com três peças menores.',
    moves: ['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'h6', 'Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#']
  }
];

const positionalLessons = [
  {
    title: 'Peão Isolado',
    description: 'Um peão que não tem peões amigos nas colunas adjacentes. Ele pode ser uma fraqueza pois precisa ser defendido por peças, e a casa à sua frente se torna um excelente posto para o adversário (bloqueio).',
    startFen: 'r1bq1rk1/pp2bppp/2n2n2/8/3P4/2N2N2/PP2BPPP/R1BQ1RK1 b - - 0 1',
    moves: ['Nd5']
  },
  {
    title: 'Peões Dobrados',
    description: 'Dois peões da mesma cor na mesma coluna. Geralmente são uma fraqueza, pois não podem defender um ao outro e perdem mobilidade.',
    startFen: 'r1bqk2r/pppp1ppp/2n2n2/1B2p3/1b2P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1',
    moves: ['Bxc6', 'dxc6']
  },
  {
    title: 'Peão Atrasado',
    description: 'Um peão que ficou para trás de seus companheiros e não pode avançar sem ser capturado. A casa à sua frente frequentemente se torna uma grande fraqueza.',
    startFen: 'r1bq1rk1/pp3ppp/3p1n2/4p1B1/4P3/2N5/PPP2PPP/R2Q1RK1 w - - 0 1',
    moves: ['Nd5', 'Be6', 'Bxf6', 'gxf6']
  },
  {
    title: 'Peão Passado',
    description: 'Um peão que não tem peões inimigos em sua coluna ou nas colunas adjacentes para impedir seu avanço. Um peão passado é um criminoso que deve ser mantido sob vigilância!',
    startFen: '8/8/3P4/8/8/4k3/8/4K3 w - - 0 1',
    moves: ['d7', 'Kd3', 'd8=Q+']
  },
  {
    title: 'Cadeia de Peões',
    description: 'Uma formação diagonal de peões onde cada um defende o outro. Para atacar uma cadeia de peões, você deve golpear a sua base.',
    startFen: 'rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 1',
    moves: ['c5', 'c3', 'Nc6', 'Nf3', 'Qb6']
  },
  {
    title: 'Coluna Aberta',
    description: 'Uma coluna sem peões de nenhuma cor. Dominar colunas abertas com suas Torres é uma das estratégias mais cruciais no xadrez.',
    startFen: '3r2k1/pp3ppp/8/8/8/8/PP3PPP/3R2K1 w - - 0 1',
    moves: ['Rxd8#']
  },
  {
    title: 'Coluna Semiaberta',
    description: 'Uma coluna que contém apenas peões do seu adversário. Você pode usar suas Torres nela para pressionar o peão inimigo.',
    startFen: 'r1bq1rk1/pp2bppp/2n2n2/3p4/8/2N2N2/PP2BPPP/R1BQR1K1 w - - 0 1',
    moves: ['Bf1', 'Re8']
  },
  {
    title: 'Sétima Fileira',
    description: 'A fileira onde ficam os peões adversários. Uma Torre na sétima fileira é chamada de "Porco Cego", pois devora tudo o que encontra pela frente.',
    startFen: '3r2k1/ppp2ppp/8/8/8/8/R4PPP/6K1 w - - 0 1',
    moves: ['Ra7', 'Rb8', 'Rxb7', 'Rxb7']
  },
  {
    title: 'Casa Fraca',
    description: 'Uma casa no território inimigo que não pode mais ser defendida por peões. Ocupar essas casas com peças (especialmente cavalos) cria posições dominantes.',
    startFen: 'r1bq1rk1/pp3p1p/2np1bp1/2p1p3/4P3/2NP1NP1/PPP2PBP/R2Q1RK1 w - - 0 1',
    moves: ['Nd5', 'Bg7']
  },
  {
    title: 'Posto Avançado',
    description: 'Uma casa fraca do adversário que é sustentada por um peão seu. Um Cavalo bem ancorado num posto avançado pode valer tanto quanto uma Torre.',
    startFen: 'r1q2rk1/pp1b1p1p/2np1bp1/2pNp3/4P3/2PP1NP1/PP3PBP/R2Q1RK1 w - - 0 1',
    moves: ['Nxf6+', 'Kg7', 'Nxd7']
  },
  {
    title: 'Minoria de Ataque',
    description: 'Avançar seus peões em uma ala onde você tem menos peões que o adversário. O objetivo é forçar trocas e criar fraquezas na estrutura dele.',
    startFen: 'r1q2rk1/pp1b1ppp/2n1pb2/2pp4/3P4/2P1PNP1/PP1N1PBP/R2Q1RK1 w - - 0 1',
    moves: ['b4', 'cxb4', 'cxb4']
  },
  {
    title: 'Maioria de Peões',
    description: 'Possuir mais peões em uma área do tabuleiro. A vantagem de longo prazo é usar essa maioria para criar um poderoso peão passado.',
    startFen: '8/1pp5/8/8/8/5K2/6PP/4k3 w - - 0 1',
    moves: ['h4', 'Kd2', 'g4', 'Ke2', 'h5', 'Kf2', 'g5', 'Kg3', 'h6']
  },
  {
    title: 'Profilaxia',
    description: 'O pensamento preventivo no xadrez. Jogar um lance calmo com a intenção específica de evitar um plano ou ameaça posicional do seu oponente.',
    startFen: 'r1bq1rk1/ppp1bppp/2n2n2/3p4/3P4/2NB1N2/PPP2PPP/R1BQ1RK1 w - - 0 1',
    moves: ['h3']
  },
  {
    title: 'Restrição',
    description: 'Posicionar seus peões e peças de forma a roubar as melhores casas das peças adversárias, asfixiando a posição inimiga.',
    startFen: '4k3/8/8/2n5/3P4/8/4K3/8 w - - 0 1',
    moves: ['d5']
  },
  {
    title: 'Domínio de Diagonais',
    description: 'Posicionar bispos (especialmente em fianchetto) em longas diagonais abertas, exercendo tremenda influência desde a retaguarda.',
    startFen: 'r1q2rk1/pp1bppbp/2np1np1/2p5/2P5/1PN1P1P1/PB1PNPBP/R2Q1RK1 w - - 0 1',
    moves: ['d4', 'cxd4', 'Nxd4']
  },
  {
    title: 'Controle de Casas Centrais',
    description: 'O conceito clássico do xadrez posicional. Controlar o centro (e4, d4, e5, d5) significa mais espaço e mobilidade para suas peças manobrarem.',
    startFen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1',
    moves: ['d3', 'd6', 'h3']
  },
  {
    title: 'Troca Favorável',
    description: 'Trocar uma peça passiva sua por uma peça ativa inimiga, ou trocar o bom bispo do oponente. No xadrez, saber QUANDO trocar é uma arte.',
    startFen: 'r1b1k2r/pp1p1ppp/2n1pn2/q7/1b1NP3/2N5/PPPB1PPP/R2QKB1R w KQkq - 0 1',
    moves: ['Nxc6', 'bxc6', 'a3', 'Bxc3', 'Bxc3']
  },
  {
    title: 'Simplificação',
    description: 'A técnica de trocar peças implacavelmente quando se tem vantagem material, transpondo o jogo para um final fácil de ganhar.',
    startFen: '8/pp3ppp/3r1k2/3R4/8/8/PP3PPP/3R2K1 w - - 0 1',
    moves: ['Rxd6+', 'Ke7', 'Rd7+', 'Ke6', 'Rxb7']
  },
  {
    title: 'Iniciativa',
    description: 'A vantagem de ditar o ritmo da partida. Quem tem a iniciativa cria ameaças consecutivas, forçando o adversário a se defender e impedindo-o de realizar seus planos.',
    startFen: 'rnbqkb1r/pppp1ppp/8/4p3/2B1n3/2N5/PPPP1PPP/R1BQK1NR w KQkq - 0 1',
    moves: ['Nxe4', 'd5', 'Bd3', 'dxe4', 'Bxe4']
  },
  {
    title: 'Compensação Posicional',
    description: 'Sacrificar material (geralmente um peão) não para dar mate, mas para obter enormes vantagens estratégicas, linhas abertas e iniciativa a longo prazo.',
    startFen: 'rnbqkb1r/p2ppppp/5n2/1ppP4/2P5/8/PP2PPPP/RNBQKBNR w KQkq - 0 1',
    moves: ['cxb5', 'a6', 'bxa6', 'Bxa6']
  }
];

const endgameLessons = [
  {
    title: 'Oposição',
    description: 'A técnica de colocar seu Rei de frente para o Rei adversário, com uma casa ímpar de distância, obrigando o oponente a ceder espaço ("quem joga, perde a oposição").',
    startFen: '8/8/8/4k3/8/8/4K3/8 w - - 0 1',
    moves: ['Ke3', 'Kd5', 'Kd3', 'Kc5', 'Kc3']
  },
  {
    title: 'Triangulação',
    description: 'Um método para perder um tempo com o Rei, formando um "triângulo" com seus movimentos, para devolver o turno ao adversário e ganhar a Oposição.',
    startFen: '8/8/8/4k3/3p4/4K3/8/8 w - - 0 1',
    moves: ['Kf3', 'Kd5', 'Kf4', 'Kc5', 'Ke4']
  },
  {
    title: 'Regra do Quadrado',
    description: 'Crie um quadrado imaginário a partir do peão passado até a casa de promoção. Se o Rei inimigo puder entrar nesse quadrado no seu turno, ele alcança o peão. Senão, o peão coroa.',
    startFen: '8/8/8/P7/8/8/8/5k1K b - - 0 1',
    moves: ['Kf2', 'a6', 'Ke3', 'a7', 'Kd4', 'a8=Q+']
  },
  {
    title: 'Rei Ativo',
    description: 'No final do jogo, o Rei se transforma em uma poderosa peça de ataque. Um Rei ativo centralizado muitas vezes vale mais que um peão extra.',
    startFen: '8/4k3/8/2K5/8/8/1P6/8 w - - 0 1',
    moves: ['Kc6', 'Ke6', 'b4', 'Ke7', 'b5', 'Kd8', 'Kb7']
  },
  {
    title: 'Posição de Lucena',
    description: 'A posição de vitória mais fundamental nos finais de Torre e Peão. O Rei defensor está cortado e a Torre aliada prepara uma ponte para o próprio Rei sair da frente do peão.',
    startFen: '3K4/3P2k1/8/8/8/8/5R2/2r5 w - - 0 1',
    moves: ['Re2', 'Kf7', 'Re4', 'Rd1', 'Kc7', 'Rc1+', 'Kd6', 'Rd1+', 'Kc5', 'Rc1+', 'Kb5']
  },
  {
    title: 'Posição de Philidor',
    description: 'A posição de empate mais importante! A Torre defensora fica na terceira fileira impedindo o Rei inimigo de avançar, até que o peão avance, permitindo xeques por trás.',
    startFen: '8/8/8/5k2/5p2/8/5R2/2K5 w - - 0 1',
    moves: ['Rf3', 'Ke4', 'Rh3', 'f3', 'Rh8', 'Ke3', 'Re8+', 'Kd3', 'Rd8+']
  },
  {
    title: 'Promoção Forçada',
    description: 'Um sacrifício ou manobra tática onde o único objetivo é garantir que o peão chegue à última casa. Nada mais importa a não ser a promoção.',
    startFen: '8/p7/1P6/8/8/8/8/4K2k w - - 0 1',
    moves: ['b7', 'a6', 'b8=Q']
  },
  {
    title: 'Rei e Peão contra Rei',
    description: 'O final mais elementar do xadrez. O conceito de manter o seu Rei SEMPRE à frente do seu peão, abrindo caminho e utilizando a Oposição para forçar a coroação.',
    startFen: '8/8/8/8/8/4k3/4P3/4K3 w - - 0 1',
    moves: ['Kd1', 'Kd4', 'Kd2', 'Ke4', 'e3+', 'Kf5', 'Kd3']
  },
  {
    title: 'Torre atrás do Peão Passado',
    description: 'A "Regra de Tarrasch". As Torres sempre devem ser colocadas atrás dos peões passados (sejam os seus para apoiá-los, sejam os do inimigo para atacá-los).',
    startFen: '8/P7/8/8/8/8/R4k2/1K6 w - - 0 1',
    moves: ['Kb2', 'Ke3', 'Kb3', 'Kd3', 'Kb4', 'Kd4', 'Ka5']
  },
  {
    title: 'Corte do Rei',
    description: 'Usar a Torre para confinar o Rei adversário a uma determinada borda ou ala do tabuleiro, impedindo que ele participe da defesa do peão.',
    startFen: '8/8/8/4k3/8/8/8/2K2R2 w - - 0 1',
    moves: ['Re1+', 'Kd4', 'Re2', 'Kc3', 'Re3+', 'Kd4', 'Kd2']
  },
  {
    title: 'Ponte de Lucena',
    description: 'A etapa final do método de Lucena: a Torre avança até a quarta fileira para se interpor aos xeques inimigos, criando uma ponte protetora para o Rei.',
    startFen: '8/1P6/2K5/8/3R4/8/5k2/1r6 w - - 0 1',
    moves: ['Kc7', 'Rc1+', 'Kd6', 'Rd1+', 'Kc5', 'Rc1+', 'Kb5', 'Rb1+', 'Ka5', 'Ra1+', 'Ra4']
  },
  {
    title: 'Fortaleza',
    description: 'Uma posição onde o lado com desvantagem material cria um bloqueio impenetrável. Mesmo tendo menos peças, o adversário não tem como progredir, resultando em empate.',
    startFen: '8/8/8/5k2/5r2/6K1/8/7Q b - - 0 1',
    moves: ['Rg4+', 'Kf3', 'Rf4+', 'Ke3', 'Re4+']
  },
  {
    title: 'Zugzwang em Finais',
    description: 'Situação mortal onde qualquer lance que o jogador fizer piorará sua posição. Ele seria feliz se pudesse "passar a vez", mas no xadrez isso não existe.',
    startFen: '8/8/8/4p3/4P3/4k3/8/4K3 w - - 0 1',
    moves: ['Kd1', 'Kd4', 'Kd2', 'Kxe4', 'Ke2', 'Kd4', 'Kd2', 'e4', 'Ke2', 'e3', 'Ke1', 'Kd3', 'Kd1', 'e2+', 'Ke1', 'Ke3']
  }
];

const openingLessons = [
  {
    title: 'Abertura Italiana',
    description: 'Uma das aberturas mais antigas e clássicas. As brancas controlam o centro e rapidamente desenvolvem o bispo atacando a casa fraca f7 do adversário.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']
  },
  {
    title: 'Ruy López',
    description: 'Também conhecida como Abertura Espanhola. Ao invés de atacar f7, o bispo branco ameaça o cavalo que defende o centro das pretas, criando pressão imediata.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']
  },
  {
    title: 'Defesa Siciliana',
    description: 'A resposta mais popular e agressiva contra e4. As pretas lutam pelo centro com um peão lateral, criando posições assimétricas e cheias de táticas.',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4']
  },
  {
    title: 'Defesa Francesa',
    description: 'As pretas jogam e6 para sustentar o avanço de d5. É uma defesa incrivelmente sólida, levando a uma estrutura de peões fechada e manobras estratégicas.',
    moves: ['e4', 'e6', 'd4', 'd5']
  },
  {
    title: 'Defesa Caro-Kann',
    description: 'Semelhante à Francesa, mas as pretas jogam c6. É considerada ainda mais sólida, pois permite que o bispo de casas claras das pretas saia para o jogo antes de fechar a cadeia de peões.',
    moves: ['e4', 'c6', 'd4', 'd5']
  },
  {
    title: 'Defesa Pirc',
    description: 'Uma defesa hipermoderna onde as pretas permitem que as brancas ocupem o centro com peões, planejando atacá-lo posteriormente com suas peças menores (especialmente o bispo em g7).',
    moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6']
  },
  {
    title: 'Defesa Escandinava',
    description: 'As pretas desafiam o centro imediatamente no primeiro lance com d5. Se as brancas capturam, a Dama preta sai cedo, levando a posições de desenvolvimento dinâmico.',
    moves: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5']
  }
];

const d4Lessons = [
  {
    title: 'Gambito da Dama',
    description: 'A mais famosa abertura com d4. As brancas "sacrificam" temporariamente o peão de c4 para desviar o peão central das pretas e dominar o tabuleiro.',
    moves: ['d4', 'd5', 'c4']
  },
  {
    title: 'Defesa Indiana do Rei',
    description: 'Uma defesa hipermoderna agressiva. As pretas deixam as brancas construírem um centro forte de peões, com a intenção de contra-atacar e destruí-lo depois.',
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6']
  },
  {
    title: 'Defesa Nimzo-Indiana',
    description: 'Uma das defesas mais respeitadas contra d4. As pretas desenvolvem o bispo em b4 para cravar o cavalo branco, lutando pelo centro com peças em vez de peões.',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4']
  },
  {
    title: 'Defesa Grünfeld',
    description: 'As pretas convidam as brancas a tomarem conta do centro imediatamente para depois atacá-lo furiosamente com d5 e o bispo em g7.',
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5']
  },
  {
    title: 'Sistema Londres',
    description: 'Uma configuração muito sólida para as brancas onde desenvolvem rapidamente o bispo para f4 e formam uma pirâmide de peões indestrutível no centro.',
    moves: ['d4', 'Nf6', 'Bf4', 'd5', 'e3', 'c5', 'c3']
  },
  {
    title: 'Defesa Eslava',
    description: 'A resposta mais sólida contra o Gambito da Dama. As pretas sustentam seu peão em d5 usando outro peão (c6), mantendo o bispo de casas claras livre para jogar.',
    moves: ['d4', 'd5', 'c4', 'c6']
  }
];

const advancedConceptsLessons = [
  {
    title: 'Sacrifício Posicional',
    description: 'Diferente de um sacrifício tático (que visa mate ou ganhar material), o sacrifício posicional entrega material para obter vantagens de longo prazo, como linhas abertas, controle do centro ou postos avançados.',
    startFen: 'rnbqkb1r/p2ppppp/5n2/1ppP4/2P5/8/PP2PPPP/RNBQKBNR w KQkq - 0 1',
    moves: ['cxb5', 'a6', 'bxa6', 'Bxa6']
  },
  {
    title: 'Qualidade da Estrutura',
    description: 'Avaliar a saúde dos peões. Uma estrutura conectada e flexível sem peões isolados ou dobrados é uma base sólida para o sucesso a longo prazo.',
    startFen: '8/pp3ppp/2k5/8/2P5/P7/1P3PPP/6K1 w - - 0 1',
    moves: ['b4', 'a6', 'a4', 'b5', 'cxb5+', 'axb5', 'a5']
  },
  {
    title: 'Domínio de Casas Escuras',
    description: 'Quando o oponente troca ou perde o bispo de casas escuras, você pode posicionar suas peças estrategicamente nessas casas para criar uma rede inatacável.',
    startFen: 'r1bq1rk1/pp1nbp1p/2p1p1p1/3pP3/5B2/2PBP3/PP1N1PPP/R2Q1RK1 w - - 0 1',
    moves: ['Bh6', 'Re8', 'Nf3']
  },
  {
    title: 'Domínio de Casas Claras',
    description: 'O mesmo conceito aplicado às casas de cor oposta. Encontrar e ocupar "buracos" (casas não defendidas por peões) na posição inimiga.',
    startFen: 'r2q1rk1/1pp1bppp/p1n1pn2/3p1b2/3P1B2/P1N1PN1P/1PP1BPP1/R2Q1RK1 w - - 0 1',
    moves: ['Ne5', 'Nxe5', 'Bxe5']
  },
  {
    title: 'Coordenação de Peças',
    description: 'Peças trabalhando juntas são muito mais fortes do que a soma de suas partes. A verdadeira maestria é fazer o seu exército atuar como uma unidade só.',
    startFen: 'r1bq1rk1/ppp2ppp/2n5/2bnp1N1/2B5/2NP4/PPP2PPP/R1BQ1RK1 w - - 0 1',
    moves: ['Qh5', 'h6', 'Nxf7', 'Rxf7', 'Bxd5']
  },
  {
    title: 'Invasão na Sétima Fileira',
    description: 'A infiltração de uma ou duas torres na penúltima fileira do adversário geralmente resulta na devastação de sua estrutura de peões ou num xeque-mate.',
    startFen: 'r5k1/pp3ppp/2p5/8/8/8/PP3PPP/2R3K1 w - - 0 1',
    moves: ['Rc7', 'Rb8', 'b3', 'Kf8']
  },
  {
    title: 'Conversão de Vantagem',
    description: 'O processo técnico de transformar uma vantagem material (uma peça a mais) em uma vitória certa, geralmente através de trocas forçadas para simplificar o jogo.',
    startFen: '8/pp3ppp/3r1k2/3R4/8/8/PP3PPP/3R2K1 w - - 0 1',
    moves: ['Rxd6+', 'Ke7', 'Rd7+', 'Ke6', 'Rxb7']
  },
  {
    title: 'Restrição do Adversário',
    description: 'A arte de jogar lances que não atacam ativamente, mas que asfixiam o oponente tirando as casas que suas peças precisam para respirar.',
    startFen: '4k3/8/8/2n5/3P4/8/4K3/8 w - - 0 1',
    moves: ['d5']
  },
  {
    title: 'Criação de Fraquezas',
    description: 'Se o oponente tem uma posição sólida sem alvos, você deve provocar avanços de peões ou criar tensões para forçá-lo a criar falhas em sua estrutura.',
    startFen: 'r1q2rk1/pp1b1ppp/2n1pb2/2pp4/3P4/2P1PNP1/PP1N1PBP/R2Q1RK1 w - - 0 1',
    moves: ['b4', 'cxb4', 'cxb4']
  },
  {
    title: 'Compressão Posicional',
    description: 'Empurrar lentamente o adversário contra a parede com o avanço coordenado de peões, ganhando espaço valioso ("vantagem de espaço").',
    startFen: '8/pppk1ppp/8/3pP3/3P4/6P1/PP1K3P/8 w - - 0 1',
    moves: ['b4', 'a6', 'a4', 'c6', 'a5']
  },
  {
    title: 'Ataque ao Rei',
    description: 'Manejar suas peças para criar um engarrafamento letal em torno do rei adversário. Sacrifícios como o "Presente de Grego" são comuns.',
    startFen: 'r1bq1rk1/ppp1nppp/2n1p3/3p4/3P4/2PBPN2/PP3PPP/RN1QK2R w KQ - 0 1',
    moves: ['Bxh7+', 'Kxh7', 'Ng5+', 'Kg8', 'Qh5', 'Re8', 'Qxf7+', 'Kh8', 'Qh5+', 'Kg8']
  },
  {
    title: 'Expansão no Flanco',
    description: 'Quando o centro está fechado ou estabilizado, as batalhas migram para as alas (flancos). Avançar peões nas alas é o principal motor de ataque.',
    startFen: 'r1bq1rk1/pp1n1pbp/2p1pnp1/3p4/2PPP3/2N1BP2/PP1QN1PP/R3KB1R w KQ - 0 1',
    moves: ['h4', 'h5', 'g4', 'hxg4', 'h5']
  },
  {
    title: 'Centralização do Rei',
    description: 'Na transição do meio-jogo para o final, assim que o perigo de xeque-mate passa, o Rei deve abandonar a defesa nas bordas e marchar para o centro do tabuleiro.',
    startFen: '8/3k4/8/8/8/8/4P3/3K4 w - - 0 1',
    moves: ['Kd2', 'Kd6', 'Kd3', 'Kd5', 'e4+', 'Ke5', 'Ke3']
  },
  {
    title: 'Técnica Defensiva',
    description: 'Saber reconhecer quando se está pior e construir barreiras ou fortalezas impossíveis de serem penetradas, salvando meio ponto (empate) de uma posição aparentemente perdida.',
    startFen: '8/8/8/5k2/5r2/6K1/8/7Q b - - 0 1',
    moves: ['Rg4+', 'Kf3', 'Rf4+', 'Ke3', 'Re4+']
  }
];

const psychLessons = [
  {
    title: 'Controle do Tempo',
    description: 'Saber quando pensar profundamente (momentos críticos) e quando jogar rápido (abertura e lances forçados) para evitar o apuro de tempo.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3']
  },
  {
    title: 'Jogo Rápido (Blitz)',
    description: 'No blitz, intuição, iniciativa e criar problemas práticos para o adversário costumam valer mais do que a precisão absoluta de lances lentos.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O', 'Nf6', 'd3', 'h6', 'c3']
  },
  {
    title: 'Jogo Clássico',
    description: 'Xadrez pensado exige resistência mental. O foco muda para planejamento de longo prazo, manobras profundas e cálculo exaustivo, sem a pressa do relógio.',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'd5', 'Nc3', 'Be7', 'Bf4', 'O-O', 'e3']
  },
  {
    title: 'Preparação de Abertura',
    description: 'Estudar teorias e preparar "novidades" em casa. Dominar as linhas principais e ramificações para surpreender o oponente ainda nos primeiros lances.',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6']
  },
  {
    title: 'Armadilhas de Abertura',
    description: 'Apostar em táticas e armadilhas sorrateiras no início do jogo, como o famoso "Mate de Légal", aproveitando a ganância ou descuido do adversário.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'd6', 'Nc3', 'Bg4', 'h3', 'Bh5', 'Nxe5', 'Bxd1', 'Bxf7+', 'Ke7', 'Nd5#']
  },
  {
    title: 'Gestão Emocional',
    description: 'Manter o sangue frio após cometer um erro grave, ignorar o nervosismo, o excesso de confiança ou o medo. A resiliência é a maior arma de um mestre.',
    moves: ['e4', 'e5', 'f4', 'exf4', 'Nf3', 'g5', 'h4', 'g4', 'Ne5']
  },
  {
    title: 'Cálculo de Variantes',
    description: 'A habilidade de visualizar a árvore de possibilidades "se eu for aqui, ele vai ali", penetrando o mais fundo possível na posição sem tocar nas peças.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Be2']
  },
  {
    title: 'Intuição Posicional',
    description: 'O "sexto sentido" do xadrez. A capacidade de saber instintivamente onde uma peça pertence ou qual é o melhor plano, mesmo quando o cálculo puro é impossível.',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3', 'O-O', 'Bd3', 'c5', 'Nge2', 'cxd4', 'exd4', 'd5', 'cxd5', 'Nxd5']
  },
  {
    title: 'Avaliação de Posição',
    description: 'Pausar para analisar quem está melhor, baseando-se em: segurança do rei, estrutura de peões, atividade das peças e vantagem material. Isso dita se você deve atacar ou defender.',
    moves: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6', 'Be2', 'c5']
  },
  {
    title: 'Conversão de Finais',
    description: 'Evitar o relaxamento e o empate acidental (afogamento). Executar com precisão de máquina os movimentos finais para garantir o ponto inteiro após horas de jogo.',
    startFen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
    moves: ['a8=Q+', 'Kd7', 'Qd5+', 'Ke7', 'Ke2']
  }
];

const startHereLessons = [
  {
    title: 'Garfo (Ataque Duplo)',
    description: 'Um único ataque a duas (ou mais) peças simultaneamente. O Cavalo é o mestre dos garfos devido ao seu movimento único em L.',
    startFen: '8/8/8/8/3n4/1K4R1/8/7k b - - 0 1',
    moves: ['Ne2+', 'Kc2', 'Nxg3']
  },
  {
    title: 'Cravada',
    description: 'Quando uma peça não pode se mover porque isso exporia o Rei (cravada absoluta) ou uma peça de maior valor (cravada relativa).',
    startFen: '4k3/4n3/8/8/8/8/8/6KR w - - 0 1',
    moves: ['Re1', 'Kd7', 'Rxe7+']
  },
  {
    title: 'Espeto (Raio-X)',
    description: 'O oposto da cravada. A peça de maior valor está na frente; quando ela foge do ataque, a peça de menor valor atrás dela é capturada.',
    startFen: '4k3/4q3/8/8/8/8/8/4R1K1 w - - 0 1',
    moves: ['Rxe7+', 'Kxe7']
  },
  {
    title: 'Mate do Corredor',
    description: 'Um dos padrões de xeque-mate mais vitais! Ocorre quando o Rei está preso atrás de seus próprios peões na oitava fileira.',
    startFen: '6k1/5ppp/8/8/8/8/8/1R4K1 w - - 0 1',
    moves: ['Rb8#']
  },
  {
    title: 'Ataque Descoberto',
    description: 'Mover uma peça para abrir caminho e "descobrir" o ataque de outra peça sua que estava escondida atrás. Pode ser devastador.',
    startFen: '4k3/8/4q3/8/4B3/8/8/4R1K1 w - - 0 1',
    moves: ['Bg6+', 'Kd7', 'Rxe6']
  },
  {
    title: 'Desenvolvimento Rápido',
    description: 'A regra de ouro da abertura: tirar as peças menores (cavalos e bispos) da fila de trás o mais rápido possível.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'Nc3']
  },
  {
    title: 'Controle do Centro',
    description: 'O centro (casas d4, e4, d5, e5) é o ponto mais alto do tabuleiro. Quem controla o centro domina a partida.',
    moves: ['e4', 'e5', 'd4', 'exd4', 'Qxd4']
  },
  {
    title: 'Roque Cedo',
    description: 'Colocar o Rei em segurança no canto antes de iniciar qualquer ataque. Um Rei no centro com peões abertos é um alvo fácil!',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']
  },
  {
    title: 'Aberturas Sólidas',
    description: 'Escolher aberturas simples, lutando pelo centro e desenvolvendo peças naturais (como a Abertura Italiana), em vez de truques complicados.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3']
  },
  {
    title: 'Oposição nos Finais',
    description: 'Um conceito mágico nos finais de peões. Ficar de frente para o Rei inimigo força ele a ceder espaço para o seu avanço.',
    startFen: '8/8/8/4k3/8/8/4K3/8 w - - 0 1',
    moves: ['Ke3', 'Kd5', 'Kd3', 'Kc5', 'Kc3']
  }
];

export default function Tutorial({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [category, setCategory] = useState('start');
  const [currentLesson, setCurrentLesson] = useState(0);
  const { themeStyles } = useBoardTheme();

  useEffect(() => {
    if (location.state && location.state.activeCategory) {
       // Mapeamento do nome sugerido pela IA para o ID da categoria
       const mapping = {
          "Comece por Aqui": "start",
          "O Tabuleiro": "basic",
          "Treinamento Base": "important",
          "Padrões de Xeque-Mate": "mating",
          "Táticas Essenciais": "advanced",
          "Finais Básicos": "endgame",
          "Aberturas com 1.e4": "opening",
          "Aberturas com 1.d4": "d4",
          "Conceitos avançados": "concepts",
          "Elementos Psicológicos e avançados": "psych",
          "As 10 coisas para se aprender primeiro": "start"
       };
       const mapped = mapping[location.state.activeCategory];
       if (mapped) {
           setCategory(mapped);
       }
    }
  }, [location.state]);

  const lessons = category === 'start' ? startHereLessons : category === 'basic' ? basicLessons : category === 'advanced' ? advancedLessons : category === 'important' ? importantLessons : category === 'mating' ? matingPatterns : category === 'positional' ? positionalLessons : category === 'endgame' ? endgameLessons : category === 'd4' ? d4Lessons : category === 'concepts' ? advancedConceptsLessons : category === 'psych' ? psychLessons : openingLessons;
  const lesson = lessons[currentLesson] || startHereLessons[0];

  const [game, setGame] = useState(() => lesson.startFen ? new Chess(lesson.startFen) : new Chess());
  const [isPlaying, setIsPlaying] = useState(false);
  const [completedLessons, setCompletedLessons] = useState([]);
  
  const isPlayingRef = useRef(false);

  useEffect(() => {
    setGame(lesson.startFen ? new Chess(lesson.startFen) : new Chess());
  }, [lesson]);

  const lessonId = `${category}-${currentLesson}`;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
    };
  }, []);

  const rewardStars = async () => {
    if (completedLessons.includes(lessonId)) return;
    setCompletedLessons(prev => [...prev, lessonId]);
    
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const currentStars = snap.data().stars || 0;
          await updateDoc(userRef, { stars: currentStars + 5 });
        }
      } catch (err) {
        console.error("Erro ao dar estrelas:", err);
      }
    }
  };

  const startAnimation = async () => {
    if (isPlayingRef.current) return;
    
    isPlayingRef.current = true;
    setIsPlaying(true);
    
    let activeGame = lesson.startFen ? new Chess(lesson.startFen) : new Chess();
    const initialGame = new Chess();
    initialGame.loadPgn(activeGame.pgn());
    setGame(initialGame);

    for (let i = 0; i < lesson.moves.length; i++) {
      if (!isPlayingRef.current) break;
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (!isPlayingRef.current) break;
      
      try {
        activeGame.move(lesson.moves[i]);
        const stepGame = new Chess();
        stepGame.loadPgn(activeGame.pgn());
        setGame(stepGame); 
      } catch (e) {
        console.error("Erro no movimento:", e);
      }
    }

    if (isPlayingRef.current) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      rewardStars();
    }
  };

  const handleNextLesson = () => {
    if (currentLesson < lessons.length - 1) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentLesson(c => c + 1);
    }
  };

  const handlePrevLesson = () => {
    if (currentLesson > 0) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentLesson(c => c - 1);
    }
  };

  return (
    <div className="tutorial-layout">
      
      <div className="glass-panel hide-scrollbar tutorial-sidebar">
        <h2 style={{ color: 'var(--text-main)', fontSize: '1.2rem', paddingBottom: '10px', borderBottom: '1px solid var(--glass-border)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BookOpen color="var(--accent-color)" size={24} /> Módulos
        </h2>
        <button 
          onClick={() => { setCategory('start'); setCurrentLesson(0); setIsPlaying(false); isPlayingRef.current = false; }} 
          className="btn" 
          style={{ background: category === 'start' ? 'var(--accent-color)' : 'var(--bg-color-lighter)' }}
        >
          <Rocket size={20} />
          <span>Comece por Aqui</span>
        </button>
        <button 
          onClick={() => { setCategory('basic'); setCurrentLesson(0); setIsPlaying(false); isPlayingRef.current = false; }} 
          className="btn" 
          style={{ background: category === 'basic' ? 'var(--accent-color)' : 'var(--bg-color-lighter)' }}
        >
          <BookOpen size={20} />
          <span>Treinamento Base</span>
        </button>
        <button 
          onClick={() => { setCategory('advanced'); setCurrentLesson(0); setIsPlaying(false); isPlayingRef.current = false; }} 
          className="btn" 
          style={{ background: category === 'advanced' ? 'var(--accent-color)' : 'var(--bg-color-lighter)' }}
        >
          <Swords size={20} />
          <span>Táticas Essenciais</span>
        </button>
        <button 
          onClick={() => { setCategory('important'); setCurrentLesson(0); setIsPlaying(false); isPlayingRef.current = false; }} 
          className="btn" 
          style={{ background: category === 'important' ? 'var(--accent-color)' : 'var(--bg-color-lighter)' }}
        >
          <Crown size={20} />
          <span>Táticas Importantes</span>
        </button>
        <button 
          onClick={() => { setCategory('mating'); setCurrentLesson(0); setIsPlaying(false); isPlayingRef.current = false; }} 
          className="btn" 
          style={{ background: category === 'mating' ? 'var(--accent-color)' : 'var(--bg-color-lighter)' }}
        >
          <Target size={20} />
          <span>Padrões de Xeque-Mate</span>
        </button>
        <button 
          onClick={() => { setCategory('positional'); setCurrentLesson(0); setIsPlaying(false); isPlayingRef.current = false; }} 
          className="btn" 
          style={{ background: category === 'positional' ? 'var(--accent-color)' : 'var(--bg-color-lighter)' }}
        >
          <Compass size={20} />
          <span>Estratégia Posicional</span>
        </button>
        <button 
          onClick={() => { setCategory('endgame'); setCurrentLesson(0); setIsPlaying(false); isPlayingRef.current = false; }} 
          className="btn" 
          style={{ background: category === 'endgame' ? 'var(--accent-color)' : 'var(--bg-color-lighter)' }}
        >
          <Hourglass size={20} />
          <span>Finais Importantes</span>
        </button>
        <button 
          onClick={() => { setCategory('opening'); setCurrentLesson(0); setIsPlaying(false); isPlayingRef.current = false; }} 
          className="btn" 
          style={{ background: category === 'opening' ? 'var(--accent-color)' : 'var(--bg-color-lighter)' }}
        >
          <Flag size={20} />
          <span>Aberturas e4</span>
        </button>
        <button 
          onClick={() => { setCategory('d4'); setCurrentLesson(0); setIsPlaying(false); isPlayingRef.current = false; }} 
          className="btn" 
          style={{ background: category === 'd4' ? 'var(--accent-color)' : 'var(--bg-color-lighter)' }}
        >
          <Shield size={20} />
          <span>Aberturas 1.d4</span>
        </button>
        <button 
          onClick={() => { setCategory('concepts'); setCurrentLesson(0); setIsPlaying(false); isPlayingRef.current = false; }} 
          className="btn" 
          style={{ background: category === 'concepts' ? 'var(--accent-color)' : 'var(--bg-color-lighter)' }}
        >
          <Lightbulb size={20} />
          <span>Conceitos Avançados</span>
        </button>
        <button 
          onClick={() => { setCategory('psych'); setCurrentLesson(0); setIsPlaying(false); isPlayingRef.current = false; }} 
          className="btn" 
          style={{ background: category === 'psych' ? 'var(--accent-color)' : 'var(--bg-color-lighter)' }}
        >
          <Brain size={20} />
          <span>Psicologia & Avançados</span>
        </button>
      </div>

      <div className="tutorial-content">
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '10px', textAlign: 'center', position: 'relative' }}>
        {completedLessons.includes(lessonId) && (
          <div style={{ position: 'absolute', top: 10, right: 10, color: '#fbbf24' }}>
            <Star size={20} fill="#fbbf24" />
          </div>
        )}
        <h2 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>{lesson.title}</h2>
        <p style={{ color: 'var(--text-muted)' }}>{lesson.description}</p>
      </div>

      <div style={{ textAlign: 'center', color: 'var(--success-color)', fontSize: '10px', marginBottom: '10px', wordBreak: 'break-all' }}>
        Memória: {game.fen().split(' ')[0]}
      </div>

      <div style={{ width: '100%', aspectRatio: '1 / 1', marginBottom: '20px', boxShadow: 'var(--glass-shadow)', borderRadius: '4px', overflow: 'hidden' }}>
        <Chessboard 
          position={game.fen()} 
          boardOrientation="white"
          animationDuration={300}
          {...themeStyles}
          onPieceDrop={() => false}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
        <button 
          onClick={startAnimation} 
          className="btn" 
          style={{ width: '100%', background: 'var(--success-color)' }}
          disabled={isPlaying}
        >
          <Play size={20} />
          {isPlaying ? 'Animando...' : 'Animar Movimento'}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '20px' }}>
        <button 
          onClick={handlePrevLesson} 
          className="btn" 
          style={{ background: 'var(--bg-color-lighter)' }}
          disabled={currentLesson === 0 || isPlaying}
        >
          <ChevronLeft size={20} /> Anterior
        </button>
        
        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
          {currentLesson + 1} de {lessons.length}
        </span>

        <button 
          onClick={handleNextLesson} 
          className="btn" 
          disabled={currentLesson === lessons.length - 1 || isPlaying}
        >
          Próxima <ChevronRight size={20} />
        </button>
      </div>

    </div>
    </div>
  );
}
