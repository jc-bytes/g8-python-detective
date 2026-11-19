import { playSound } from './sound.js';
import { tasks } from './shop-tasks.js';
import { counter, paint, strideLength } from './shop-art.js';

// The player's position is the midpoint between the shoes, in background pixels.
// Stop the shoes just in front of the furniture footprint.
const walkSpeed=.048; // Background pixels per millisecond.
const counterEdge = counter.left - 13;
const counterStop = counter.base + 4;
const wallStop = 115;
const stations = [
  ...tasks.map(task=>({id:task.id,center:task.center,x:task.center,key:'Enter',label:'Inspect '+task.title.toLowerCase(),task:true})),
  {id:'book',center:353,x:317,key:'R',label:'Read rule book'},
  {id:'printer',center:452,x:415,key:'Enter',label:'Inspect printer'},
  {id:'owner',center:230,x:230,key:'Enter',label:'Talk to the owner'}
];
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
const rearLimit = x => x >= counterEdge ? counterStop : wallStop;
const keys = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],a:[-1,0],d:[1,0],w:[0,-1],s:[0,1]};

export function setupWalk(room,{ownerOnly,canRead,read,inspect,inspectTask,talk,leaveOwner}){
  const stage=room.querySelector('.shop-stage'), floor=room.querySelector('[data-art="shop"]');
  const player=room.querySelector('.shop-detective'), sprite=player.querySelector('canvas');
  const action=room.querySelector('#use-object'), status=room.querySelector('#walk-status');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let x=67,y=157,front=164,facing='right',near=null,frame=0,last=0,travel=0;
  let lastStation=null;
  let route=[], destination=null;
  let conversationAction=null;
  const held=new Map();
  const handlers={book:read,printer:inspect,owner:talk};
  function availableStation(station){
    if(ownerOnly())return station.id==='owner';
    return !station.task || room.querySelector(`[data-station-id="${station.id}"]`).hasAttribute('data-available');
  }
  function withinReach(station){
    const left=Math.min(station.x,station.center-16), right=station.center+16;
    return Math.hypot(x-clamp(x,left,right),y-counterStop)<=24;
  }
  let character = 'boy';
  function draw(phase=null){
    player.dataset.facing=facing;
    player.style.left=(x/480*100)+'%';
    player.style.bottom=((168-y)/168*100)+'%';
    paint(sprite,'detective',facing,phase,character);
    const wasAtOwner=near?.id==='owner';
    near=lastStation && availableStation(lastStation) && withinReach(lastStation) ? lastStation : stations.filter(station=>withinReach(station) && availableStation(station))
      .sort((a,b)=>Math.abs(a.center-x)-Math.abs(b.center-x))[0];
    if(wasAtOwner && near?.id!=='owner')leaveOwner();
    const prompt=conversationAction || (!stage.hasAttribute('data-speaking') && room.querySelector('#counter-talk').hidden && near);
    const available=prompt && !route.length;
    const locked=prompt?.id==='printer' && !canRead();
    action.parentElement.hidden=!available;
    action.disabled=!available || locked;
    action.hidden=locked;
    room.querySelector('#locked-hint').hidden=!locked;
    let hint='';
    if(available){
      if(!locked){
        const label=prompt.label;
        if(action.lastElementChild.textContent!==label){
          action.firstElementChild.textContent=prompt.key;
          action.lastElementChild.textContent=label;
          action.setAttribute('aria-keyshortcuts',prompt.key==='R'?'R Enter':'Enter');
        }
        hint=label+'. Press '+prompt.key+'.';
      }else hint='Read the rule book first.';
    }
    if(status.textContent!==hint)status.textContent=hint;
  }
  let nextFoot = 0, lastStepTime = -Infinity;
  function footstep() {
    const now = performance.now();
    if (now - lastStepTime < 240) return;
    lastStepTime = now;
    playSound(`footstep_${nextFoot}`, 0.15);
    nextFoot = 1 - nextFoot;
  }
  function drawStep(distance){
    if (Math.floor((travel + distance) / (strideLength / 2)) > Math.floor(travel / (strideLength / 2))) footstep();
    if(distance>0)lastStation=null;
    travel+=distance;
    draw(reduced.matches || distance===0 ? null : (travel%strideLength)/strideLength);
  }
  function stop(){
    cancelAnimationFrame(frame); frame=0; route=[];destination=null;held.clear();last=0;
    draw();
  }
  function tick(time){
    if(room.hidden || document.querySelector('dialog[open]')){stop();return;}
    const [tx,ty]=route[0], dx=tx-x,dy=ty-y,dist=Math.hypot(dx,dy);
    const speed=reduced.matches?dist:Math.min(40,time-(last||time-16))*walkSpeed;
    last=time;
    const fraction=dist?Math.min(1,speed/dist):1;
    if(dist>0)facing=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'back':'front');
    x+=dx*fraction;y=Math.max(rearLimit(x),y+dy*fraction);
    drawStep(dist*fraction);
    if(fraction===1)route.shift();
    if(route.length){
      if(!reduced.matches)frame=requestAnimationFrame(tick);
    }else{
      const arrived=destination;
      stop();
      if(arrived)use(arrived);
    }
  }
  function walk(tx,ty,station=null){
    tx=clamp(tx,18,462);ty=clamp(ty,rearLimit(tx),front);
    stop();destination=station;
    // Clear the end of the counter before crossing its side in either direction.
    if(x<counterEdge && tx>=counterEdge && y<counterStop)route.push([x,counterStop]);
    if(x>=counterEdge && tx<counterEdge && ty<counterStop)route.push([tx,Math.max(y,counterStop)]);
    route.push([tx,ty]);last=0;
    if(reduced.matches){while(route.length)tick(performance.now());}
    else {draw();frame=requestAnimationFrame(tick);}
  }
  function resize(){
    const rect=floor.getBoundingClientRect();
    if(!rect.width)return;
    front=Math.max(162,(stage.getBoundingClientRect().bottom-rect.top)*480/rect.width-5);
    y=clamp(y,rearLimit(x),front);draw();
  }
  room.querySelector('.shop-world').style.setProperty('--counter-surface',((168-counter.top)/168*100)+'%');
  new ResizeObserver(resize).observe(stage);
  function move(dx,dy,distance){
    const oldX=x,oldY=y;
    const nextX=clamp(x+dx*distance,18,462);
    if(y>=rearLimit(nextX))x=nextX;
    y=clamp(y+dy*distance,rearLimit(x),front);
    facing=dx?(dx<0?'left':'right'):(dy<0?'back':'front');
    drawStep(Math.hypot(x-oldX,y-oldY));
  }
  function manualTick(time){
    if(room.hidden || document.querySelector('dialog[open]') || !held.size){stop();return;}
    const [dx,dy]=Array.from(held.values()).at(-1);
    move(dx,dy,Math.min(40,time-(last||time))*walkSpeed);
    last=time;
    frame=requestAnimationFrame(manualTick);
  }
  function use(station){
    if(!availableStation(station) || !withinReach(station) || (station.id==='printer'&&!canRead()))return;
    stop();
    lastStation=station;
    facing=Math.abs(station.center-x)<8?'back':station.center>x?'back-right':'back-left';
    draw();
    if(station.task)inspectTask(station.id,stage);
    else (station.onArrival || handlers[station.id])(stage);
  }
  document.addEventListener('keydown',event=>{
    if((stage.hasAttribute('data-escorting') && !(conversationAction && event.key==='Enter')) || room.hidden || document.querySelector('dialog[open]') || event.altKey || event.metaKey || event.ctrlKey ||
       ![document.body,stage,action].includes(event.target))return;
    const direction=Object.hasOwn(keys,event.key) && keys[event.key];
    if(direction){
      event.preventDefault();stage.focus({preventScroll:true});
      if(event.repeat && !reduced.matches)return;
      if(!held.size)stop();
      held.set(event.key,direction);
      move(...direction,reduced.matches?12:4);
      if(!reduced.matches && !frame)frame=requestAnimationFrame(manualTick);
    }else if(event.key==='Enter' || event.key===' ' || (near?.key==='R' && event.key.toLowerCase()==='r')){
      event.preventDefault();
      if(event.repeat)return;
      if(!action.disabled)action.click();
    }
  });
  document.addEventListener('keyup',event=>{
    if(held.delete(event.key) && !held.size)stop();
  });
  stage.addEventListener('blur',()=>{if(held.size)stop();});
  window.addEventListener('blur',stop);
  stage.addEventListener('click',event=>{
    if(stage.hasAttribute('data-escorting') || event.target.closest('button,.shop-talk,.detective-choices'))return;
    const rect=floor.getBoundingClientRect(), scale=480/rect.width;
    const targetX=(event.clientX-rect.left)*scale, targetY=(event.clientY-rect.top)*scale;
    const prop=event.target.closest('[data-station-id]');
    const station=stations.find(item=>item.id===prop?.dataset.stationId && availableStation(item));
    stage.focus({preventScroll:true});
    if(station && withinReach(station))use(station);
    else if(station)walk(station.x,counterStop,station);
    else walk(targetX,targetY);
  });
  action.onclick=()=>{
    if(action.disabled)return;
    if(conversationAction)conversationAction.advance();
    else if(near)use(near);
  };
  const owner=room.querySelector('.shop-owner');
  let tourAnimations=[], strideFrame=0;
  function cancelTourMotion(){cancelAnimationFrame(strideFrame);for(const motion of tourAnimations)motion.cancel();tourAnimations=[];}
  function slide(element, before, duration){
    const after=element.getBoundingClientRect();
    return element.animate([{translate:`${before.left-after.left}px ${before.top-after.top}px`},{translate:'0px 0px'}],{duration:reduced.matches?0:duration,easing:'linear'});
  }
  function home(){stage.querySelector('[data-current]')?.removeAttribute('data-current');owner.removeAttribute('style');stage.classList.remove('with-owner');}
  draw();
  return {setCharacter(value){
    if (character === value) return;
    character = value;
    paint(sprite,'detective',facing,null,character);
  },async escort(id){
    const station=stations.find(item=>item.id===id);
    cancelTourMotion();stop();
    const from=player.getBoundingClientRect(), ownerFrom=owner.getBoundingClientRect();
    // Tour positions follow the machine itself. Free walking uses its approach point.
    const stopX=id==='owner'?station.center:station.center-14;
    const distance=Math.abs(x-stopX);
    facing=x<=stopX?'right':'left';x=stopX;y=counterStop;lastStation=station;draw();
    stage.querySelector('[data-current]')?.removeAttribute('data-current');
    if(id==='owner')home();
    else{
      const ownerX=clamp(station.center+16,18,462);
      stage.querySelector(`[data-station-id="${id}"]`).setAttribute('data-current','');
      stage.classList.add('with-owner');
      owner.style.left=((ownerX-18)/480*100)+'%';
      stage.style.setProperty('--speaker-x',(ownerX/480*100)+'%');
    }
    const duration=Math.max(350,Math.min(2100,distance*9));
    tourAnimations=[slide(player,from,duration),slide(owner,ownerFrom,duration)];
    const animations=tourAnimations;
    const started=performance.now(), ownerCanvas=owner.querySelector('canvas');
    let lastBeat = -1;
    function stride(now){
      const phase=((now-started)/duration*Math.max(distance,32)/strideLength)%1;
      const beat = Math.floor((now-started)/duration*distance/(strideLength/2));
      if (beat !== lastBeat && distance > 1) footstep();
      lastBeat = beat;
      paint(sprite,'detective',facing,phase,character);paint(ownerCanvas,'owner',facing,(phase+0.25)%1);
      strideFrame=requestAnimationFrame(stride);
    }
    if(!reduced.matches)strideFrame=requestAnimationFrame(stride);
    await Promise.allSettled(animations.map(motion=>motion.finished));
    if(animations===tourAnimations){cancelAnimationFrame(strideFrame);if(id!=='owner')facing='back-right';paint(ownerCanvas,'owner');draw();}

  },home(){cancelTourMotion();home();},goTo(id){
    const station=stations.find(item=>item.id===id);
    if(station)walk(station.x,counterStop,station);
  },returnSlip:(onArrival)=>{
    stop();
    const owner=stations.find(station=>station.id==='owner');
    stage.focus({preventScroll:true});
    walk(owner.x,counterStop,{...owner,onArrival});
  },setConversationAction(label,advance){
    conversationAction=label?{label,key:'Enter',advance}:null;
    draw();
  },refresh:()=>draw(),focus:()=>stage.focus(),reset:()=>{cancelTourMotion();home();x=67;y=157;near=null;lastStation=null;facing='right';stop();}};
}
