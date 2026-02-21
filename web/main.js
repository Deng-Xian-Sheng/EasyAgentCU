const sessionId = 'default-session';
let currentTaskId = null;
let runState = null;
const messagesEl = document.getElementById('messages');

function addUserMessage(text){
  const div = document.createElement('div');
  div.className='msg user';
  div.textContent=text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderRunCard(){
  if(!runState?.container) return;
  const c = runState.container;
  c.innerHTML='';
  if(runState.mode==='answer'){
    const ans = document.createElement('div');
    ans.className='answer';
    ans.textContent=runState.answerText;
    c.appendChild(ans);
    if(runState.awaitingUser){
      const row=document.createElement('div'); row.className='actions-row';
      const btn=document.createElement('button'); btn.className='ack'; btn.textContent='我已经操作';
      btn.onclick=async()=>{
        await fetch('/api/chat/ack-user-action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({task_id:currentTaskId})});
      };
      row.appendChild(btn); c.appendChild(row);
    }
    return;
  }

  const card = document.createElement('div'); card.className='run-card';
  const head = document.createElement('div'); head.className='progress-head';
  head.innerHTML = `<span>${runState.collapsed ? (runState.steps.at(-1)?.text || '正在思考') : '进展列表'}</span><span>${runState.collapsed ? '展开' : '收起'}</span>`;
  head.onclick=()=>{runState.collapsed=!runState.collapsed; renderRunCard();};
  card.appendChild(head);

  if(!runState.collapsed){
    const tl=document.createElement('div'); tl.className='timeline';
    runState.steps.forEach((s,idx)=>{
      const item=document.createElement('div'); item.className='timeline-item'+(idx===runState.selected?' active':'');
      item.textContent=`${idx+1}. ${s.text}`;
      item.onclick=()=>{runState.selected=idx; renderRunCard();};
      tl.appendChild(item);
    });
    card.appendChild(tl);
  }

  const screen=document.createElement('div'); screen.className='screen';
  const img=document.createElement('img');
  const frame = runState.selected===runState.steps.length ? runState.liveFrame : runState.steps[runState.selected]?.data_url || runState.liveFrame;
  img.src=frame || '';
  screen.appendChild(img);

  const scrub=document.createElement('div'); scrub.className='scrubber';
  for(let i=0;i<runState.steps.length;i++){
    const d=document.createElement('div'); d.className='dot'+(i===runState.selected?' active':''); d.onclick=()=>{runState.selected=i; renderRunCard();}; scrub.appendChild(d);
  }
  const live=document.createElement('span'); live.className='realtime'; live.textContent='直播';
  const liveDot=document.createElement('div'); liveDot.className='dot'+(runState.selected===runState.steps.length?' active':''); liveDot.onclick=()=>{runState.selected=runState.steps.length; renderRunCard();};
  scrub.appendChild(liveDot); scrub.appendChild(live); screen.appendChild(scrub); card.appendChild(screen);
  c.appendChild(card);
}

function ensureAssistantContainer(){
  if(runState?.container) return;
  const wrap=document.createElement('div'); wrap.className='msg assistant';
  messagesEl.appendChild(wrap);
  runState={container:wrap,steps:[],selected:0,collapsed:true,mode:'run',liveFrame:null,answerText:''};
}

const es = new EventSource(`/api/chat/stream?session_id=${encodeURIComponent(sessionId)}`);
es.addEventListener('task.started', (e)=>{ ensureAssistantContainer(); const d=JSON.parse(e.data); currentTaskId=d.task_id; renderRunCard(); });
es.addEventListener('screen.live', (e)=>{ ensureAssistantContainer(); const d=JSON.parse(e.data); runState.liveFrame=d.frame.data_url; runState.selected=runState.steps.length; renderRunCard(); });
es.addEventListener('progress.append', (e)=>{ const d=JSON.parse(e.data); runState.steps.push({text:d.step.text, data_url:d.step.screenshot.data_url}); runState.selected=runState.steps.length; renderRunCard();});
es.addEventListener('task.awaiting_user', (e)=>{ const d=JSON.parse(e.data); runState.mode='answer'; runState.answerText=d.text; runState.awaitingUser=!!d.show_ack_button; renderRunCard();});
es.addEventListener('task.completed', (e)=>{ const d=JSON.parse(e.data); runState.mode='answer'; runState.answerText=d.text; runState.awaitingUser=false; renderRunCard();});
es.addEventListener('task.failed', (e)=>{ const d=JSON.parse(e.data); runState.mode='answer'; runState.answerText='失败：'+d.text; runState.awaitingUser=false; renderRunCard();});

document.getElementById('send').onclick=async()=>{
  const text=document.getElementById('input').value.trim();
  if(!text) return;
  addUserMessage(text);
  runState=null;
  const res=await fetch('/api/chat/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:sessionId,text})});
  const data=await res.json();
  currentTaskId=data.task_id;
  document.getElementById('input').value='';
};

document.getElementById('stop').onclick=async()=>{
  if(!currentTaskId) return;
  await fetch('/api/chat/stop',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({task_id:currentTaskId})});
};
