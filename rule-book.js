import { playSound } from './sound.js';
export const ruleTopics = { bracket: 'Function calls', name: 'Names', conversion: 'Input values', operator: 'Calculations', indent: 'Conditions' };

const pages = [
  ['Function calls','Every opening ( in a function call needs a closing ). Quotation marks enclose the words to print.','print("Lantern lit")','The quote ends the message. The last ) ends the call.'],
  ['Names','Python looks up a name exactly as you wrote it. Compare the spelling where you store a value and where you use it.','shelf = "Blue"\nprint(shelf)','shelf and shel are different names. Only shelf has a value here.'],
  ['Input values','Even when you type digits, input() gives you text. Use int() to turn whole-number text into a number for math.','age = int(input("Age: "))\nprint(age + 1)','Type 12. The inner call reads “12”, the outer call makes it 12, and the next line prints 13.'],
  ['Calculations','Use * for equal groups. Use + to add separate amounts, - to subtract and / to divide.','hours = 3\nminutes = hours * 60\nprint(minutes)','Three hours means three groups of 60 minutes. This prints 180.'],
  ['Conditions','An if tests whether something is true. Start its next line four spaces in. Python runs that line only when the test is true. A line back at the left edge runs either way.','rain = 0\nif rain > 0:\n    print("Bring boots")\nprint("Time to go")','When rain is 0, rain > 0 is false. Only “Time to go” prints. When rain is 2, both messages print.']
];

// Ink drawings for the flyleaf and the five examples, all in the same print palette.
function sketch(canvas,index) {
  const c=canvas.getContext('2d');
  c.clearRect(0,0,200,96);
  c.strokeStyle='#394d42';c.fillStyle='#e4cd97';c.lineWidth=2.6;c.lineJoin='round';c.lineCap='round';
  function line(points, fill=false){
    c.beginPath();c.moveTo(...points[0]);for(const point of points.slice(1))c.lineTo(...point);
    if(fill){c.closePath();c.fill();}c.stroke();
  }
  const box=(x,y,w,h)=>{c.fillRect(x,y,w,h);c.strokeRect(x,y,w,h);};
  if(index===-1){
    // A two-colour shop print, with cream cutouts for the glass and awning.
    const ink='#274f49', paper='#f9edcf', brick='#a04c37', glass='#acbb9c';
    const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
    c.lineWidth=1.2;c.strokeStyle=ink;
    rect(40,14,120,70,ink);rect(44,19,112,61,paper);
    rect(37,11,126,4,ink);rect(41,8,118,3,brick);
    rect(48,21,104,9,ink);rect(52,24,96,1,glass);
    rect(47,43,70,30,ink);rect(50,46,64,24,glass);
    for(const x of [53,73,96]){
      rect(x,59,12,10,brick);rect(x+2,56,8,3,paper);
      rect(x+2,62,8,2,paper);
    }
    rect(69,45,3,26,ink);rect(92,45,3,26,ink);
    rect(47,74,70,4,brick);rect(121,42,30,40,ink);
    rect(124,46,24,18,glass);rect(124,67,24,12,brick);rect(144,66,2,3,paper);
    for(let i=0;i<10;i++){
      const x=41+i*11.8, end=35+i*13;
      c.fillStyle=i%2?paper:brick;
      line([[x,30],[x+11.8,30],[end+13,40],[end,40]],true);
      rect(end,40,13,4,c.fillStyle);
    }
    rect(34,44,132,1,ink);
    rect(35,83,130,2,ink);rect(23,87,153,1,ink);
    // A pavement sign sits just outside the door.
    c.fillStyle=ink;line([[155,64],[168,64],[173,85],[152,85]],true);
    rect(158,68,9,10,paper);rect(159,71,7,1,brick);rect(159,74,5,1,brick);
    for(const [x,y,w] of [[17,90,17],[47,89,30],[123,90,19],[165,89,15]])rect(x,y,w,1,glass);
  }else if(index===0){
    line([[84,25],[84,17],[92,11],[107,11],[116,17],[116,25]]);
    box(78,25,44,6);line([[82,32],[87,72],[113,72],[118,32]],true);
    line([[98,61],[95,54],[103,43],[105,59],[101,64]],true);box(82,73,36,6);
    for(const x of [61,138])line([[x,42],[x+(x<100?-10:10),37]]);
  }else if(index===1){
    box(49,33,102,44);box(46,25,108,10);box(71,43,58,21);
    c.font='bold 15px Georgia';c.fillStyle='#394d42';c.fillText('Blue',84,59);
  }else if(index===2){
    box(27,24,55,46);box(118,24,55,46);line([[88,47],[110,47],[104,42]]);line([[110,47],[104,52]]);
    c.fillStyle='#394d42';c.font='bold 19px monospace';c.fillText('"12"',31,53);c.fillText('12',134,53);
  }else if(index===3){
    for(const x of [47,100,153]){
      c.beginPath();c.arc(x,47,20,0,Math.PI*2);c.fill();c.stroke();
      line([[x,31],[x,47],[x+10,47]]);
    }
  }else{
    c.beginPath();c.moveTo(37,37);c.bezierCurveTo(23,24,44,12,54,23);c.bezierCurveTo(66,2,89,13,88,25);c.bezierCurveTo(104,20,111,39,93,41);c.closePath();c.fill();c.stroke();
    for(const x of [48,67,86])line([[x,49],[x-5,60]]);
    for(const x of [114,138])line([[x,38],[x+15,38],[x+15,61],[x+24,64],[x+24,72],[x-1,72]],true);
  }
}

export function chapterIndex(topic) { return pages.findIndex(([title]) => title === topic); }

export function createRuleBook({page,remember}) {
  const dialog=document.createElement('dialog');
  dialog.className='bound-book';
  dialog.setAttribute('aria-label','Python rule book');
  dialog.innerHTML='<div class="book-spread"><section class="book-leaf flyleaf"></section><section class="book-leaf facing-page"></section><button class="page-arrow previous" aria-label="Previous page">‹</button><button class="page-arrow next" aria-label="Next page">›</button></div><button class="shut-book">Close book</button>';
  document.body.append(dialog);
  const [left,right]=dialog.querySelectorAll('section');
  const announcement=document.createElement('span');
  announcement.className='page-announcement';
  announcement.setAttribute('role','status');
  dialog.append(announcement);
  const spread=dialog.querySelector('.book-spread');
  const previous=spread.querySelector('.previous'), next=spread.querySelector('.next');
  let origin, current, transition;
  previous.onclick=()=>choose(current-1);
  next.onclick=()=>choose(current+1);
  dialog.addEventListener('keydown',event=>{
    if(event.altKey || event.metaKey || event.ctrlKey)return;
    if(event.key==='ArrowLeft' || event.key==='ArrowRight'){
      event.preventDefault();
      if(!event.repeat)choose(current+(event.key==='ArrowRight'?1:-1));
    }
  });
  dialog.querySelector('.shut-book').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{transition?.remove();origin?.focus({preventScroll:true});});
  function turn(index){
    current=index;
    previous.disabled=index===-1;next.disabled=index===pages.length-1;
    const contents=index===-1;
    left.classList.toggle('title-leaf',contents);
    right.classList.toggle('title-leaf',contents);
    left.innerHTML='<h2></h2><canvas width="200" height="96" aria-hidden="true"></canvas>';
    const heading=left.querySelector('h2');
    if(contents)heading.innerHTML='<small>The Shopkeeper’s</small>Python<br>Rule Book';
    else heading.textContent=pages[index][0];
    sketch(left.querySelector('canvas'),index);
    right.replaceChildren();
    if(contents){
      right.innerHTML='<h3>Contents</h3><nav aria-label="Rule book chapters"></nav>';
      pages.forEach(([title],i)=>{
        const button=document.createElement('button');
        button.textContent=title;
        const folio=document.createElement('span');
        folio.setAttribute('aria-hidden','true');
        folio.textContent=String(2+i*2);
        button.append(folio);
        button.onclick=()=>choose(i);
        right.querySelector('nav').append(button);
      });
    }else{
      const rule=document.createElement('p');rule.textContent=pages[index][1];left.append(rule);
      right.innerHTML='<h3>Python example</h3><pre><code></code></pre><p class="ink-note"></p>';
      right.querySelector('code').textContent=pages[index][2];
      right.querySelector('.ink-note').textContent=pages[index][3];
      left.dataset.folio=String(2+index*2);
      right.dataset.folio=String(3+index*2);
    }
  }

  function copyLeaf(leaf){
    const copy=leaf.cloneNode(true);
    const canvas=copy.querySelector('canvas');
    if(canvas)canvas.getContext('2d').drawImage(leaf.querySelector('canvas'),0,0);
    return copy;
  }

  function choose(index){
    if(index< -1 || index>=pages.length || index===current)return;
    playSound('book_flip_1');
    const forward=index>current;
    const animate=!matchMedia('(prefers-reduced-motion: reduce)').matches;
    const compact=matchMedia('(max-width:600px)').matches;
    transition?.remove();
    let sheet;
    if(animate){
      transition=document.createElement('div');
      transition.className='page-transition '+(forward?'turn-forward':'turn-backward');
      transition.inert=true;
      transition.setAttribute('aria-hidden','true');
      sheet=document.createElement('div');
      sheet.className='turning-sheet';
      const front=document.createElement('div');
      front.className='sheet-face';
      if(compact){
        front.append(copyLeaf(left),copyLeaf(right));
      }else{
        const resting=copyLeaf(forward?left:right);
        resting.classList.add('resting-leaf');
        transition.append(resting);
        front.append(copyLeaf(forward?right:left));
      }
      sheet.append(front);
      transition.append(sheet);
    }
    remember(index);turn(index);announcement.textContent=index===-1?'Contents':pages[index][0];dialog.scrollTop=0;
    if(animate){
      const direction=forward?-1:1;
      if(!compact){
        const back=document.createElement('div');
        back.className='sheet-face sheet-back';
        back.append(copyLeaf(forward?left:right));
        sheet.append(back);
      }
      spread.append(transition);
      const frames=compact ? [
        {transform:'translateX(0)'},
        {transform:'translateX('+direction*102+'%)'}
      ] : [
        {transform:'rotateY(0deg)'},
        {transform:'rotateY('+direction*86+'deg) skewY('+direction*1.8+'deg)',offset:.5},
        {transform:'rotateY('+direction*180+'deg)'}
      ];
      const layer=transition;
      sheet.animate(frames,{duration:compact?300:540,easing:'cubic-bezier(.42,0,.22,1)',fill:'forwards'}).onfinish=()=>layer.remove();
    }

    if(![previous,next].includes(document.activeElement) || document.activeElement.disabled)
      (forward&&!next.disabled?next:!previous.disabled?previous:next).focus({preventScroll:true});
  }
  return opener=>{
    const index = page();
    playSound('book_open');
    origin=opener;turn(index);dialog.showModal();dialog.scrollTop=0;
    remember(index);
  };
}
