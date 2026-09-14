let ws=null, role=null, roomCode=null, teacherToken=null, player=null, deadline=0, timerInt=null, answeredLocal=false;

function connect(){
  const proto=location.protocol==="https:"?"wss":"ws";
  ws=new WebSocket(`${proto}://${location.host}`);
  ws.onopen=()=>{setConn("● online",true); reconnectTeacher();};
  ws.onclose=()=>{setConn("● desconectado — tentando reconectar...",false); setTimeout(connect,2000);};
  ws.onerror=()=>setConn("● erro de conexão",false);
  ws.onmessage=e=>handle(JSON.parse(e.data));
}
function reconnectTeacher(){
  const saved=JSON.parse(localStorage.getItem("teacherRoom")||"null");
  if(saved&&saved.roomCode&&saved.teacherToken){ roomCode=saved.roomCode; teacherToken=saved.teacherToken; send({type:"teacher_reconnect",code:roomCode,teacherToken}); }
}
function setConn(t,on){const el=document.getElementById("connection");el.textContent=t;el.style.color=on?"#9ee6c3":"#ff9eaa"}
function send(x){if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(x))}
function show(id){document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));document.getElementById(id).classList.add("active")}
function createRoom(){role="teacher";send({type:"create_room"})}
function joinRoom(){
  const c=document.getElementById("joinCode").value.trim().toUpperCase();
  const n=document.getElementById("playerName").value.trim();
  document.getElementById("studentError").textContent="";
  if(!c||!n){document.getElementById("studentError").textContent="Preencha o código e seu nome.";return}
  role="student"; send({type:"join_room",code:c,name:n});
}
function startGame(){send({type:"start_game",code:roomCode})}
function nextQuestion(){send({type:"teacher_next",code:roomCode})}

function handle(m){
  if(m.type==="room_created"){
    role="teacher"; roomCode=m.code; teacherToken=m.teacherToken;
    localStorage.setItem("teacherRoom",JSON.stringify({roomCode,teacherToken}));
    document.getElementById("roomCode").textContent=roomCode; document.getElementById("teacherRoom").classList.remove("hidden"); show("teacher");
  }
  if(m.type==="teacher_state"){
    role="teacher"; document.getElementById("roomCode").textContent=roomCode||"-----"; document.getElementById("teacherRoom").classList.remove("hidden"); show("teacher");
    renderRanking("teacherRanking",m.players||[]);
    updateTeacherStatus(m.status,m.players||[]);
  }
  if(m.type==="lobby"){
    renderLobby(m.players||[]);
    if(role==="student" && !document.getElementById("game").classList.contains("active")) show("lobby");
  }
  if(m.type==="joined"){
    roomCode=m.code; player=m.player; answeredLocal=false; document.getElementById("lobbyCode").textContent=roomCode; show("lobby");
  }
  if(m.type==="question"){
    deadline=m.deadline; answeredLocal=false;
    if(role==="teacher"){
      renderTeacherQuestion(m);
      show("teacher"); startTimer("teacherTimer",m.deadline); return;
    }
    renderStudentQuestion(m); show("game"); startTimer("timer",m.deadline);
  }
  if(m.type==="answer_result"){
    const f=document.getElementById("feedback");
    document.getElementById("xp").textContent=m.total; document.getElementById("lives").textContent=m.lives;
    if(m.correct){f.textContent=`✅ CORRETO! +${m.points} pontos`;f.className="feedback good"}
    else{f.textContent=`❌ INCORRETO. ${m.lives>0?"Você perdeu uma vida.":"Suas vidas acabaram."}`;f.className="feedback bad"}
    lockOptions();
  }
  if(m.type==="too_late"){
    document.getElementById("feedback").textContent="⏰ Tempo esgotado!";document.getElementById("feedback").className="feedback bad";lockOptions();
  }
  if(m.type==="leaderboard"){
    renderRanking("teacherRanking",m.players||[]); renderRanking("studentRanking",m.players||[]);
    const me=(m.players||[]).find(x=>player&&x.id===player.id);
    if(me){document.getElementById("xp").textContent=me.score;document.getElementById("lives").textContent=me.lives}
    const answered=(m.players||[]).filter(x=>x.answered).length, active=(m.players||[]).filter(x=>!x.finished).length;
    const counter=document.getElementById("teacherAnswered"); if(counter) counter.textContent=`${answered} de ${m.players.length} responderam`;
  }
  if(m.type==="question_end"){
    lockOptions(); clearInterval(timerInt); const tt=document.getElementById("teacherTimer"); if(tt)tt.textContent="00:00";
    const st=document.getElementById("teacherStatus"); if(st)st.textContent=m.reason==="tempo"?"⏰ Tempo encerrado. Preparando próximo desafio...":"✅ Respostas encerradas. Preparando próximo desafio...";
  }
  if(m.type==="game_finished"){
    clearInterval(timerInt); renderRanking("finalRanking",m.players||[],true); show("finish");
  }
  if(m.type==="error"){
    if(role==="student")document.getElementById("studentError").textContent=m.message; else alert(m.message);
  }
}

function renderTeacherQuestion(m){
  document.getElementById("teacherPhase").textContent=m.boss?"👑 CHEFÃO FINAL":"FASE "+m.phase;
  document.getElementById("teacherQuestionCounter").textContent=`DESAFIO ${m.index+1}/${m.total}`;
  document.getElementById("teacherQuestionTitle").textContent=m.title;
  document.getElementById("teacherQuestionText").textContent=m.q;
  const box=document.getElementById("teacherOptions"); box.innerHTML="";
  m.options.forEach((o,i)=>{const div=document.createElement("div");div.className="teacher-option";div.innerHTML=`<span>${String.fromCharCode(65+i)}</span><strong>${esc(o)}</strong>`;box.appendChild(div)});
  document.getElementById("teacherAnswered").textContent="0 de 0 responderam";
  document.getElementById("teacherStatus").textContent="Pergunta ativa — leia para toda a turma.";
}
function renderStudentQuestion(m){
  document.getElementById("phaseLabel").textContent=m.boss?"👑 CHEFÃO FINAL":"FASE "+m.phase;
  document.getElementById("questionCounter").textContent=`${m.index+1}/${m.total}`;
  document.getElementById("questionTitle").textContent=m.title;
  document.getElementById("questionText").textContent=m.q;
  document.getElementById("feedback").textContent="";document.getElementById("feedback").className="feedback";
  const box=document.getElementById("options");box.innerHTML="";
  m.options.forEach((o,i)=>{
    const b=document.createElement("button"); b.type="button"; b.className="option"; b.dataset.answer=i;
    const letter=document.createElement("span"); letter.className="option-letter"; letter.textContent=String.fromCharCode(65+i);
    const text=document.createElement("span"); text.className="option-text"; text.textContent=String(o);
    b.append(letter,text); b.addEventListener("click",()=>answer(i)); b.addEventListener("touchend",e=>{e.preventDefault();answer(i)},{passive:false}); box.appendChild(b);
  });
}
function answer(i){
  if(answeredLocal) return;
  if(Date.now()>deadline){document.getElementById("feedback").textContent="⏰ Tempo esgotado!";lockOptions();return;}
  answeredLocal=true; lockOptions(); send({type:"answer",code:roomCode,answer:i});
}
function lockOptions(){document.querySelectorAll(".option").forEach(b=>b.disabled=true)}
function startTimer(id,end){clearInterval(timerInt);const el=document.getElementById(id);if(!el)return;const tick=()=>{const s=Math.max(0,Math.ceil((end-Date.now())/1000));el.textContent=`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;if(s<=0)clearInterval(timerInt)};tick();timerInt=setInterval(tick,200)}
function updateTeacherStatus(status,players){const el=document.getElementById("teacherStatus");if(!el)return;if(status==="playing")el.textContent="Jogo em andamento";else if(status==="finished")el.textContent="🏆 Missão concluída";else el.textContent=`${players.length} participante(s) conectado(s).`}
function renderLobby(players){document.getElementById("lobbyPlayers").innerHTML=(players||[]).map((p,i)=>`<div class="rank-row"><div>${i+1}</div><div class="rank-name">${esc(p.name)}</div><div>❤️ ${p.lives}</div><div>${p.score} XP</div></div>`).join("")}
function renderRanking(id,players,final=false){const el=document.getElementById(id);if(!el)return;el.innerHTML=(players||[]).map((p,i)=>`<div class="rank-row ${final&&i===0?"winner":""}"><div class="rank-num">${i===0&&final?"🥇":i+1}</div><div class="rank-name">${esc(p.name)}</div><div class="rank-score">${p.score} XP</div><div class="rank-life">❤️ ${p.lives}</div></div>`).join("")||"<div class='muted'>Aguardando participantes...</div>"}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
connect();
