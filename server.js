const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const QUESTIONS = [
  { phase:1, title:"Fase 1 — Estados da matéria", q:"Qual estado da matéria apresenta forma e volume próprios?", options:["Sólido","Líquido","Gasoso","Plasma"], answer:0 },
  { phase:1, title:"Fase 1 — Estados da matéria", q:"Em qual estado as partículas ficam mais afastadas umas das outras?", options:["Sólido","Líquido","Gasoso","Todos igualmente"], answer:2 },
  { phase:1, title:"Fase 1 — Estados da matéria", q:"A água em um copo, em condições ambientes, é um exemplo de:", options:["Sólido","Líquido","Gasoso","Mistura heterogênea"], answer:1 },
  { phase:1, title:"Fase 1 — Estados da matéria", q:"O gelo é água no estado:", options:["Gasoso","Líquido","Sólido","Plasmático"], answer:2 },
  { phase:2, title:"Fase 2 — Mudanças de estado", q:"Quando o gelo derrete, ocorre:", options:["Fusão","Solidificação","Vaporização","Condensação"], answer:0 },
  { phase:2, title:"Fase 2 — Mudanças de estado", q:"A passagem do estado líquido para o gasoso é chamada de:", options:["Fusão","Vaporização","Solidificação","Sublimação"], answer:1 },
  { phase:2, title:"Fase 2 — Mudanças de estado", q:"Quando o vapor de água volta a ser líquido, ocorre:", options:["Fusão","Condensação","Sublimação","Solidificação"], answer:1 },
  { phase:2, title:"Fase 2 — Mudanças de estado", q:"A passagem direta do sólido para o gasoso é chamada de:", options:["Fusão","Condensação","Sublimação","Vaporização"], answer:2 },
  { phase:3, title:"Fase 3 — Substâncias e misturas", q:"Água destilada é considerada, em condições ideais:", options:["Mistura","Substância pura","Mistura heterogênea","Suspensão"], answer:1 },
  { phase:3, title:"Fase 3 — Substâncias e misturas", q:"Água + sal totalmente dissolvido forma uma:", options:["Mistura homogênea","Mistura heterogênea","Substância simples","Suspensão"], answer:0 },
  { phase:3, title:"Fase 3 — Substâncias e misturas", q:"Água + óleo é um exemplo de:", options:["Mistura homogênea","Substância pura","Mistura heterogênea","Elemento químico"], answer:2 },
  { phase:3, title:"Fase 3 — Substâncias e misturas", q:"Uma mistura é formada por:", options:["Apenas um componente","Dois ou mais componentes","Apenas elementos químicos","Apenas líquidos"], answer:1 },
  { phase:4, title:"Fase 4 — Fases e componentes", q:"Uma mistura homogênea apresenta:", options:["Duas ou mais fases visíveis","Uma única fase","Sempre dois componentes","Sempre três componentes"], answer:1 },
  { phase:4, title:"Fase 4 — Fases e componentes", q:"Uma mistura de água e óleo apresenta quantos componentes?", options:["1","2","3","4"], answer:1 },
  { phase:4, title:"Fase 4 — Fases e componentes", q:"Água + óleo, em um recipiente, apresenta quantas fases?", options:["1","2","3","4"], answer:1 },
  { phase:4, title:"Fase 4 — Fases e componentes", q:"Água + sal totalmente dissolvido apresenta:", options:["2 fases","3 fases","1 fase","4 fases"], answer:2 },
  { phase:5, title:"Fase 5 — Separação de misturas", q:"Qual método pode separar areia e água?", options:["Filtração","Evaporação","Catação","Imantação"], answer:0 },
  { phase:5, title:"Fase 5 — Separação de misturas", q:"Para separar água e sal e recuperar o sal, podemos usar:", options:["Catação","Evaporação","Filtração","Decantação"], answer:1 },
  { phase:5, title:"Fase 5 — Separação de misturas", q:"Qual método utiliza um ímã para separar materiais magnéticos?", options:["Filtração","Decantação","Imantação","Destilação"], answer:2 },
  { phase:5, title:"Fase 5 — Separação de misturas", q:"A decantação é adequada, por exemplo, para separar:", options:["Água e areia após repouso","Sal dissolvido em água","Dois gases","Água e sal sem evaporação"], answer:0 }
];

const BOSS = [
  { q:"Você tem água + areia. Qual método é mais adequado para separar essa mistura?", options:["Filtração","Imantação","Catação","Sublimação"], answer:0 },
  { q:"Para separar água e sal dissolvido e obter água e sal, o método mais completo é:", options:["Filtração","Destilação","Catação","Decantação"], answer:1 },
  { q:"Uma mistura com duas fases visíveis é, em geral:", options:["Homogênea","Heterogênea","Substância pura","Elemento"], answer:1 }
];

const rooms = new Map();
const code = () => { let c; do c = Math.random().toString(36).slice(2,7).toUpperCase(); while (rooms.has(c)); return c; };
const token = () => crypto.randomBytes(16).toString("hex");
const send = (ws, data) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(data)); };
const broadcast = (room, data) => { for (const p of room.players.values()) send(p.ws, data); if (room.teacherWs) send(room.teacherWs, data); };

function publicPlayers(room) {
  return [...room.players.values()].map(p => ({ id:p.id, name:p.name, score:p.score, xp:p.xp, lives:p.lives, answered:p.answered, progress:p.progress, finished:p.finished }))
    .sort((a,b) => b.score-a.score || b.xp-a.xp || a.name.localeCompare(b.name));
}
function currentQuestion(room) {
  return room.bossStarted ? BOSS[room.bossIndex] : QUESTIONS[room.index];
}
function currentPayload(room) {
  const q = currentQuestion(room);
  return { type:"question", index:room.bossStarted ? room.bossIndex : room.index, total:room.bossStarted ? BOSS.length : QUESTIONS.length, boss:room.bossStarted, phase:room.bossStarted ? 6 : q.phase, title:room.bossStarted ? "CHEFÃO FINAL" : q.title, q:q.q, options:q.options, deadline:room.deadline };
}
function leaderboard(room) { return { type:"leaderboard", players:publicPlayers(room) }; }

function startQuestion(room) {
  clearTimeout(room.timer);
  room.advancing = false;
  room.questionActive = true;
  room.answered = new Set();
  room.deadline = Date.now() + 90000;
  for (const p of room.players.values()) p.answered = false;
  broadcast(room, currentPayload(room));
  broadcast(room, leaderboard(room));
  room.timer = setTimeout(() => finishQuestion(room, "tempo"), 90000);
}

function finishQuestion(room, reason = "manual") {
  if (!rooms.has(room.code) || room.advancing || !room.questionActive) return;
  room.advancing = true;
  room.questionActive = false;
  clearTimeout(room.timer);
  room.timer = null;
  room.deadline = 0;
  broadcast(room, { type:"question_end", reason });

  setTimeout(() => {
    if (!rooms.has(room.code)) return;
    if (room.bossStarted) {
      room.bossIndex++;
      if (room.bossIndex >= BOSS.length) {
        room.finished = true;
        room.advancing = false;
        broadcast(room, { type:"game_finished", players:publicPlayers(room) });
        return;
      }
    } else {
      room.index++;
      if (room.index >= QUESTIONS.length) { room.bossStarted = true; room.bossIndex = 0; }
    }
    startQuestion(room);
  }, 1200);
}

function allAnswered(room) {
  const active = [...room.players.values()].filter(p => p.lives > 0 && !p.finished);
  return active.length > 0 && active.every(p => p.answered);
}

wss.on("connection", ws => {
  let session = { room:null, player:null, teacher:false };

  ws.on("message", raw => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "create_room") {
      const c = code(), t = token();
      const room = { code:c, teacherToken:t, teacherWs:ws, players:new Map(), index:0, bossStarted:false, bossIndex:0, deadline:0, timer:null, finished:false, questionActive:false, advancing:false };
      rooms.set(c, room); session.room=c; session.teacher=true;
      send(ws, { type:"room_created", code:c, teacherToken:t });
      send(ws, { type:"teacher_state", players:publicPlayers(room), status:"lobby", deadline:0 });
      return;
    }

    const room = rooms.get((msg.code || session.room || "").toUpperCase());

    if (msg.type === "join_room") {
      if (!room) return send(ws, { type:"error", message:"Sala não encontrada. Confira o código." });
      if (room.finished) return send(ws, { type:"error", message:"Esta sala já terminou." });
      const name = String(msg.name || "").trim().slice(0,24);
      if (!name) return send(ws, { type:"error", message:"Digite um nome." });
      if ([...room.players.values()].some(p => p.name.toLowerCase() === name.toLowerCase())) return send(ws, { type:"error", message:"Esse nome já está na sala." });
      const p = { id:token(), name, score:0, xp:0, lives:3, answered:false, progress:0, finished:false, ws };
      room.players.set(p.id,p); session.room=room.code; session.player=p.id;
      send(ws, { type:"joined", code:room.code, player:{id:p.id,name:p.name,lives:p.lives} });
      broadcast(room, { type:"lobby", players:publicPlayers(room) });
      if (room.questionActive) send(ws, currentPayload(room));
      return;
    }

    if (msg.type === "teacher_reconnect") {
      if (!room || msg.teacherToken !== room.teacherToken) return send(ws, { type:"error", message:"Código do professor inválido." });
      room.teacherWs = ws; session.room=room.code; session.teacher=true;
      send(ws, { type:"teacher_state", players:publicPlayers(room), status:room.finished?"finished":(room.questionActive?"playing":"lobby"), deadline:room.deadline });
      if (room.questionActive) send(ws, currentPayload(room));
      return;
    }

    if (!room) return;

    if (msg.type === "start_game" && session.teacher) {
      if (room.players.size === 0) return send(ws, { type:"error", message:"Entre com pelo menos um aluno antes de iniciar." });
      room.index=0; room.bossStarted=false; room.bossIndex=0; room.finished=false;
      startQuestion(room); return;
    }

    if (msg.type === "teacher_next" && session.teacher) { finishQuestion(room, "manual"); return; }

    if (msg.type === "answer" && session.player) {
      const p = room.players.get(session.player);
      if (!p || p.answered || p.lives <= 0 || p.finished || room.finished || !room.questionActive || !room.deadline) return;
      if (Date.now() > room.deadline) return send(ws, { type:"too_late" });
      const q = currentQuestion(room);
      const idx = Number(msg.answer);
      if (!Number.isInteger(idx) || idx < 0 || idx >= q.options.length) return;
      const remaining = Math.max(0, room.deadline - Date.now());
      p.answered = true;
      p.progress = room.bossStarted ? QUESTIONS.length + room.bossIndex + 1 : room.index + 1;
      if (idx === q.answer) {
        const points = 100 + Math.round((remaining / 90000) * 50) + (room.bossStarted ? 100 : 0);
        p.score += points; p.xp += points;
        send(ws, { type:"answer_result", correct:true, points, total:p.score, lives:p.lives });
      } else {
        p.lives = Math.max(0,p.lives-1); p.score = Math.max(0,p.score-25);
        if (p.lives === 0) p.finished = true;
        send(ws, { type:"answer_result", correct:false, points:-25, total:p.score, lives:p.lives });
      }
      broadcast(room, leaderboard(room));
      if (allAnswered(room)) finishQuestion(room, "all_answered");
    }
  });

  ws.on("close", () => {
    if (session.room && session.player) {
      const room = rooms.get(session.room);
      if (room) {
        const p = room.players.get(session.player);
        if (p) p.ws = null;
        broadcast(room, { type:"lobby", players:publicPlayers(room) });
      }
    }
    if (session.room && session.teacher) {
      const room = rooms.get(session.room);
      if (room && room.teacherWs === ws) room.teacherWs = null;
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.questionActive && room.deadline && now >= room.deadline) finishQuestion(room, "tempo");
  }
}, 1000);

server.listen(PORT, () => console.log(`Escape Room online V4 rodando na porta ${PORT}`));
