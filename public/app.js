
let ws=null, role=null, roomCode=null, teacherToken=null, player=null, deadline=0, timerInt=null;

function connect(){
  const proto=location.protocol==="https:"?"wss":"ws";
  ws=new WebSocket(`${proto}://${location.host}`);
  ws.onopen=()=>setConn("● online",true);
  ws.onclose=()=>setConn("● desconectado",false);
  ws.onerror=()=>setConn("● erro",false);
  ws.onmessage=e=>handle(JSON.parse(e.data));
}
function setConn(t,on){const el=document.getElementById("connection");el.textContent=t;el.style.color=on?"#9ee6c3":"#ff9eaa"}
function send(x){if(ws&&ws.readyState===1)ws.send(JSON.stringify(x))}
function show(id){document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));document.getElementById(id).classList.add("active")}
function createRoom(){role="teacher";send({type:"create_room"})}
function joinRoom(){
  const c=document.getElementById("joinCode").value.trim().toUpperCase();
  const n=document.getElementById("playerName").value.trim();
  document.getElementById("studentError").textContent="";
  if(!c||!n){document.getElementById("studentError").textContent="Preencha o código e seu nome.";return}
  role="student";send({type:"join_room",code:c,name:n});
}
function startGame(){send({type:"start_game",code:roomCode})}
function nextQuestion(){send({type:"teacher_next",code:roomCode})}

function handle(m){
  if(m.type==="room_created"){
    roomCode=m.code;teacherToken=m.teacherToken;
    document.getElementById("roomCode").textContent=roomCode;
    document.getElementById("teacherRoom").classList.remove("hidden");
    show("teacher"); localStorage.setItem("teacherRoom",JSON.stringify({roomCode,teacherToken}));
  }
  if(m.type==="teacher_state"){
    roomCode=roomCode||JSON.parse(localStorage.getItem("teacherRoom")||"{}").roomCode;
    document.getElementById("roomCode").textContent=roomCode||"-----";
    document.getElementById("teacherRoom").classList.remove("hidden");show("teacher");
    renderRanking("teacherRanking",m.players||[]);
    document.getElementById("teacherStatus").textContent=m.status==="playing"?"Jogo em andamento":m.status==="finished"?"Missão concluída":"Aguardando alunos...";
  }
  if(m.type==="lobby"){
    renderLobby(m.players||[]);
    if(role==="student")show("lobby");
  }
  if(m.type==="joined"){
    roomCode=m.code;player=m.player;document.getElementById("lobbyCode").textContent=roomCode;show("lobby");
  }
  if(m.type==="question"){
    if(role==="teacher"){
      document.getElementById("teacherStatus").textContent=`Desafio ${m.index+1}/${m.total} • ${m.boss?"CHEFÃO":"Fase "+m.phase}`;
      return;
    }
    deadline=m.deadline;
    document.getElementById("phaseLabel").textContent=m.boss?"👑 CHEFÃO FINAL":"FASE "+m.phase;
    document.getElementById("questionCounter").textContent=`${m.index+1}/${m.total}`;
    document.getElementById("questionTitle").textContent=m.title;
    document.getElementById("questionText").textContent=m.q;
    document.getElementById("feedback").textContent="";
    document.getElementById("feedback").className="feedback";
    const box=document.getElementById("options");box.innerHTML="";
    m.options.forEach((o,i)=>{const b=document.createElement("button");b.className="option";b.textContent=String.fromCharCode(65+i)+") "+o;b.onclick=()=>answer(i);box.appendChild(b)});
    show("game");startTimer();
  }
  if(m.type==="answer_result"){
    document.getElementById("xp").textContent=m.total;
    if(m.lives!=null)document.getElementById("lives").textContent=m.lives;
    const f=document.getElementById("feedback");
    if(m.correct){f.textContent=`✅ CORRETO! +${m.points} pontos`;f.className="feedback good"}else{f.textContent=`❌ INCORRETO. ${m.lives>0?"Você perdeu uma vida.":"Suas vidas acabaram."}`;f.className="feedback bad"}
    document.querySelectorAll(".option").forEach(b=>b.disabled=true);
  }
  if(m.type==="too_late"){
    const f=document.getElementById("feedback");f.textContent="⏰ Tempo esgotado!";f.className="feedback bad";
    document.querySelectorAll(".option").forEach(b=>b.disabled=true);
  }
  if(m.type==="leaderboard"){
    renderRanking("teacherRanking",m.players||[]);
    renderRanking("studentRanking",m.players||[]);
    const me=(m.players||[]).find(x=>player&&x.id===player.id);
    if(me){document.getElementById("xp").textContent=me.score;document.getElementById("lives").textContent=me.lives}
  }
  if(m.type==="question_end"){
    document.querySelectorAll(".option").forEach(b=>b.disabled=true);
    clearInterval(timerInt);
  }
  if(m.type==="game_finished"){
    renderRanking("finalRanking",m.players||[],true);show("finish");
  }
  if(m.type==="error"){
    if(role==="student")document.getElementById("studentError").textContent=m.message;
    else alert(m.message);
  }
}
function answer(i){send({type:"answer",code:roomCode,answer:i});}
function startTimer(){
  clearInterval(timerInt);
  const el=document.getElementById("timer");
  const tick=()=>{const s=Math.max(0,Math.ceil((deadline-Date.now())/1000));el.textContent=`00:${String(s).padStart(2,"0")}`;if(s<=0)clearInterval(timerInt)};
  tick();timerInt=setInterval(tick,200);
}
function renderLobby(players){
  document.getElementById("lobbyPlayers").innerHTML=(players||[]).map((p,i)=>`<div class="rank-row"><div>${i+1}</div><div class="rank-name">${esc(p.name)}</div><div>❤️ ${p.lives}</div><div>${p.score} XP</div></div>`).join("");
  if(role==="teacher")document.getElementById("teacherStatus").textContent=`${players.length} participante(s) conectado(s).`;
}
function renderRanking(id,players,final=false){
  const el=document.getElementById(id);if(!el)return;
  el.innerHTML=(players||[]).map((p,i)=>`<div class="rank-row ${final&&i===0?"winner":""}"><div class="rank-num">${i===0&&final?"🥇":i+1}</div><div class="rank-name">${esc(p.name)}</div><div class="rank-score">${p.score} XP</div><div class="rank-life">❤️ ${p.lives}</div></div>`).join("") || "<div class='muted'>Aguardando participantes...</div>";
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
connect();
