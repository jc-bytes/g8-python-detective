import { speak, finishSpeech } from './speech.js';
import { tasks } from './shop-tasks.js';
import { openOrder, judge, nextOrder, pendingQuestion, investigationGoal, currentOrderRun } from './task-scene.js';
import { createRuleBook } from './rule-book.js';
import { setupWalk } from './shop-walk.js';
import { TOOLBOX } from './case.js';
import { paint } from './shop-art.js';

const icon = (glyph, label) => '<span aria-hidden="true">'+glyph+'</span> '+label;
const id = key => document.getElementById(key);
function art(subject, width, height) {
  return '<canvas aria-hidden="true" data-art="'+subject+'" width="'+width+'" height="'+height+'"></canvas>';
}
function illustrate(root) {
  for (const canvas of root.querySelectorAll('[data-art]')) paint(canvas,canvas.dataset.art);
}

export function setupPrinter({getAttempt, save, canEdit, edit, openDialog, run, visit, openFolder}) {
  const room=id('shop-scene');
  room.innerHTML='<div class="shop-heading"><section><h1 id="detective-name"></h1></section><div><button class="primary" id="start-order">Try the order</button></div></div><div id="shop-floor" tabindex="0" role="group" aria-label="Walk on the shop floor" aria-describedby="walk-guide" class="shop-stage"><div class="shop-world">'+art('shop',480,168)+
    '<div data-station-id="owner" class="shop-owner">'+art('owner',36,60)+'</div><div class="shop-detective">'+art('detective',36,60)+'<button id="worn-bag" aria-label="Open carried satchel"></button></div>'+

    tasks.map(task=>`<div data-station-id="${task.id}" class="shop-prop shop-task" style="left:${task.center/480*100}%">${art(task.id,40,32)}<span>${task.title}</span></div>`).join('')+
    '<div data-station-id="printer" class="shop-prop shop-printer">'+art('printer',46,34)+'<span>Printer</span></div>'+
    '<div data-station-id="book" class="shop-prop shop-book">'+art('book',44,38)+'<span>Rule book</span></div>'+
    '<div class="shop-talk"><div id="shop-intro"><strong>Store owner</strong><p aria-live="polite" aria-atomic="true" id="owner-line"></p></div><section id="counter-talk" aria-label="Conversation with the store owner" hidden></section></div>'+
    '</div>'+

    '<div class="shop-hud"><button id="room-bag" class="satchel-access">'+art('satchel',28,25)+'<span>Detective bag</span></button><button id="case-folder" class="satchel-access">'+art('folder',28,25)+'<span>Case folder</span></button><section class="shop-goal" role="status" aria-label="Current objective"><small id="quest-stage"></small><strong id="quest-title"></strong><span id="shop-goal"></span></section></div>'+
    '<div class="interaction-prompt" hidden><button id="use-object"><kbd aria-hidden="true"></kbd><span></span></button><span id="locked-hint" hidden>Read the rule book first</span></div>'+
    '<span id="walk-guide" class="page-announcement">Use the arrow keys or tap the floor to walk. When you’re close, press Enter or tap the action button.</span><span id="walk-status" class="page-announcement" role="status"></span></div><section class="detective-choices" hidden aria-labelledby="detective-choices-title"><strong id="detective-choices-title">Your choices</strong><div><button id="owner-order"></button></div></section><section id="printer-chat" aria-label="Detective reply" hidden></section>';
  illustrate(room);
  id('owner-line').onclick=()=>finishSpeech(id('owner-line'));
  const tools=document.createElement('dialog');
  tools.className='kit-window';
  tools.setAttribute('aria-labelledby','kit-title');
  document.body.append(tools);
  function tool(title,content){
    tools.innerHTML='<header><h2 id="kit-title"></h2><button aria-label="Close tool">✕</button></header>'+content;
    tools.querySelector('h2').textContent=title;
    tools.querySelector('header button').onclick=()=>tools.close();
    tools.showModal();
  }
  let held='';
  function bag(onChoose){
    tool('Detective bag','<div class="bag-lining"><p>Choose a code piece to carry.</p><div id="strip-bag"></div></div>');
    for(const token of TOOLBOX){
      const button=document.createElement('button');
      button.textContent=token==='    '?'4 spaces':token;
      button.onclick=()=>{held=token;tools.close();onChoose?.(token);};
      id('strip-bag').append(button);
    }
  }
  const hud=room.querySelector('.shop-hud');
  const home=hud.parentElement;
  const bagButton=id('room-bag');
  function restoreBag(){
    if(hud.parentElement===home)return;
    hud.hidePopover();hud.removeAttribute('popover');home.append(hud);
    bagButton.onclick=()=>bag();
  }
  function useBag(onChoose){
    const dialog=id('work-dialog');
    hud.setAttribute('popover','manual');dialog.append(hud);hud.showPopover();
    bagButton.onclick=()=>bag(onChoose);
  }
  const readBook=createRuleBook({
    page:()=>getAttempt().printer.page,
    remember:index=>{if(canEdit()){getAttempt().printer.page=index;save();}}
  });
  function openBook(opener){
    if(canEdit()){getAttempt().printer.visitedBook=true;save();refresh();}
    readBook(opener);
  }
  const stops=[
    ['conversion','Input terminal',['See the screen and keyboard? That’s the input terminal.','I type the price of one notebook here.','Then I enter how many the customer wants.']],
    ['operator','Calculator',['See the yellow keys? That’s my calculator.','It uses the price and quantity to work out the total.']],
    ['name','Ledger',['The red book on the counter is my ledger.','It holds the total for the receipt.']],
    ['indent','Order notice',['That sign on the wooden stand is the order notice.','It tells the till when to put “Order recorded” on a receipt.']],
    ['printer','Printer',['See the paper sticking up? That’s the receipt printer.','The last line usually says “Debug check complete”.','This morning, no receipt came out.']],
    ['book','Rule book',['The open book on the stand is my Python rule book.','I look here when I forget how to write some code.','You can look things up here while you investigate.']]
  ];
  const firstStop='Let’s start at the input terminal, where I enter the order.';
  const nextStopLines=[
    'Now let’s check the calculator. What does it do with those two numbers?',
    'Let’s look in the ledger to see where the total is kept.',
    'Next, let’s read the order notice. When should a receipt say “Order recorded”?',
    'Let’s go to the printer and see where the receipt comes out.',
    'Let’s look at the rule book. I use it when I need help with Python.',
    'Come back to the counter with me. Let’s try the customer’s order.'
  ];
  const story=['A customer brought me three notebooks.','Each one cost 6.','The till gave me no receipt.','I wrote one by hand for 18.',firstStop];
  const till=['The till is the machine I use for a sale.','It works out what you owe and prints your receipt.',firstStop];
  let currentAttempt,screen='',line='',pageIndex=0,stopIndex=0,repeatVisit=false,motion=0;
  function needsWelcome(){const a=getAttempt();return !a.printer.tourDone && !a.runs.length && !a.revision;}
  const walk=setupWalk(room,{canRead:()=>true,inspectTask,read:openBook,inspect:opener=>inspectTask('bracket',opener),talk:meetOwner,leaveOwner:()=>{if(screen==='greeting' || screen==='menu')closeConversation();}});
  function show(which,text=''){
    screen=which;line=text;pageIndex=0;id('shop-intro').hidden=false;refresh();
    if(!room.hidden && screen!=='walking')focusReply();
  }
  function focusReply(){
    const choices=room.querySelector('.detective-choices');
    id(choices.hidden?'use-object':'owner-order').focus({preventScroll:true});
  }
  function closeConversation(){
    screen='';line='';walk.home();id('shop-intro').hidden=true;refresh();walk.focus();
  }
  function inviteToTalk(){
    screen='arrival';line='Come talk to me at the counter, Detective.';id('shop-intro').hidden=false;refresh();
  }
  function meetOwner(){
    show(needsWelcome()?'greeting':'menu');
  }
  async function travel(index,revisit){
    const ticket=++motion;repeatVisit=revisit;stopIndex=index;
    if(!revisit && canEdit()){getAttempt().printer.tourStop=index;save();}
    show('walking');await walk.escort(stops[index][0]);
    if(ticket===motion)show('stop');
  }
  async function returnTogether(finish){
    const ticket=++motion;show('walking');await walk.escort('owner');
    if(ticket!==motion)return;
    if(finish && canEdit()){getAttempt().printer.tourDone=true;getAttempt().printer.tourStop=-1;save();}
    show('menu',finish?['Your bag holds spare code pieces.','Your case folder keeps your work.','Use my handwritten receipt to enter the price and quantity.','Run the order and tell me what happens.']:'What would you like to know?');
  }
  function inspectTask(station,opener){
    if(needsWelcome()){inviteToTalk();return;}
    screen='';line='';walk.home();id('shop-floor').removeAttribute('data-escorting');id('shop-intro').hidden=true;
    if(opener===id('owner-order') || !opener?.isConnected)opener=id('start-order');
    if(station==='bracket')visit();
    openOrder(station,opener,{getAttempt,canEdit,edit,save,refresh,openDialog,run,useBag,paint,openFolder});
  }
  function refresh(){
    const a=getAttempt();
    walk.setCharacter(a.identity.character);
    if(a!==currentAttempt){currentAttempt=a;++motion;walk.reset();line='';screen=needsWelcome()?'arrival':'';id('shop-intro').hidden=!screen;}
    const last=currentOrderRun(a);
    const customer=nextOrder(a), question=pendingQuestion(a);
    const finished=!customer && !question;
    const review=()=>openFolder(id('start-order'));
    const order=()=>inspectTask(null,id('start-order'));
    const [number,taskTitle,taskHint]=investigationGoal(a,last,customer,question);
    let message=line,title=taskTitle,goal=taskHint;
    const touring=needsWelcome() || ['walking','stop','objects'].includes(screen);
    const choices=[];
    const choice=(text,fn)=>choices.push([text,fn]);
    if(screen==='greeting' || screen==='arrival'){
      title='Meet the owner';goal=screen==='arrival'?'Walk up to the counter.':'Hear what happened.';
      message ||= screen==='arrival' ? `Come a little closer, Detective ${a.identity.firstName.trim()}!` : ['Thanks for coming to my shop.','I had to write a receipt by hand this morning.','Can you find out what went wrong?'];
      if(a.printer.tourStop>=0){
        if(screen==='greeting')message=`Let’s go back to the ${stops[a.printer.tourStop][1].toLowerCase()}.`;
        choice('Continue the tour',()=>travel(a.printer.tourStop,false));
      }else if(line===story || line===till){
        if(line===story)choice('What’s a till?',()=>show('greeting',till));
        choice('Show me around',()=>travel(0,false));
      }else choice('What happened?',()=>show('greeting',story));
    }else if(screen==='walking'){title='Shop tour';goal='Walk with the owner.';}
    else if(screen==='stop'){
      const [,label,description]=stops[stopIndex];title=label;goal='Listen to the owner.';
      message=repeatVisit?description:[...description,nextStopLines[stopIndex]];
      if(repeatVisit){
        choice('Ask about another object',()=>show('objects'));
        choice('Back to the counter',()=>returnTogether(false));
      }else{
        const lastStop=stopIndex===stops.length-1;
        choice(lastStop?'Finish the tour':'Let’s keep going',()=>lastStop?returnTogether(true):travel(stopIndex+1,false));
        if(stopIndex)choice('Go back one stop',()=>travel(stopIndex-1,false));
      }
      choice('Say that again',()=>show('stop'));
    }else if(screen==='objects'){
      message='Which one would you like to see?';stops.forEach(([,label],i)=>choice(label,()=>travel(i,true)));choice('Back to the counter',()=>returnTogether(false));
    }else if(screen==='menu'){
      message ||= 'What would you like to know?';
      choice('Tell me what happened again',()=>show('menu',story));choice('What does something in the shop do?',()=>show('objects'));
      choice('I’m lost',()=>{
        let clue='We know what happened to me this morning. We haven’t seen what happens when you try it yet.';
        if(a.runs.length)clue='Try the order with your current code and entries. What comes out this time?';
        if(last){const [result,feedback]=judge(last,last.price,last.quantity);clue=feedback;
          if(result==='ok'){const test=nextOrder(a);clue=test?`That receipt matches. Another customer wants ${test.quantity} items at ${test.price} each.`:pendingQuestion(a) ? 'Your receipts are ready. Continue the order to tell me what you found.' : 'Your receipts and replies are saved. You can review them in your case folder.';}
        }
        show('menu',clue);
      });
      choice(finished?'Review case folder':last?'Continue order':'I’m ready to try the order',finished?review:order);
      if(finished)goal='Review your case report.';
    }
    for(const task of tasks)room.querySelector(`[data-station-id="${task.id}"]`).toggleAttribute('data-available',true);
    id('detective-name').textContent='Detective '+a.identity.firstName.trim();id('quest-stage').textContent=touring?'The broken order':`Task ${number}`;id('quest-title').textContent=title;id('shop-goal').textContent=goal;
    const walking=screen==='walking';id('shop-floor').toggleAttribute('data-escorting',walking || screen==='stop' || screen==='objects');
    const guiding=id('shop-floor').hasAttribute('data-escorting');
    for(const control of ['worn-bag','room-bag','case-folder'])id(control).hidden=guiding;
    id('shop-intro').parentElement.hidden=walking;const pages=Array.isArray(message)?message:message.split(/(?<=[.!?])\s+(?=[A-Z])/);
    speak(id('owner-line'), pages[pageIndex] ?? pages[0]);
    id('shop-floor').toggleAttribute('data-arrival',screen==='arrival');
    const inConversation=Boolean(screen && screen!=='arrival' && !walking);
    const more=inConversation && pageIndex+1<pages.length;
    id('shop-floor').toggleAttribute('data-speaking',inConversation || walking);
    room.querySelector('.detective-choices').hidden=!inConversation || more;
    if(inConversation)choice('End conversation',closeConversation);
    const primary=id('owner-order'); const group=primary.parentElement;group.querySelectorAll('.owner-choice').forEach(el=>el.remove());
    choices.forEach(([label,fn],i)=>{const button=i===0?primary:document.createElement('button');button.textContent=label;button.onclick=fn;if(i){button.className='owner-choice';group.append(button);}});
    id('start-order').textContent=needsWelcome()?'Meet the owner':'Talk to the owner';id('start-order').disabled=walking;id('start-order').hidden=inConversation || walking;id('start-order').onclick=()=>walk.goTo('owner');
    walk.setConversationAction(more?'Continue':null,()=>{if(finishSpeech(id('owner-line')))return;pageIndex++;refresh();focusReply();});
  }
  id('case-folder').onclick=e=>openFolder(e.currentTarget);
  id('worn-bag').onclick=id('room-bag').onclick=()=>bag();
  return {refresh,useBag,restoreBag,needsWelcome,inviteToTalk,walkToCounter:()=>walk.focus()};
}
