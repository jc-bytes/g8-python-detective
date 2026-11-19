// Pixel artwork uses the same 480 by 168 counter for the room and the close-up props.
export const strideLength=32;
export const counter = {left:123, top:110, base:136};
const ink = '#263638', wood = '#995c43', gold = '#e6b867', cream = '#f5e6c2';
const palettes = ['#ae634f', '#789486', '#d3ab68', '#8495a5'];
export function paint(canvas, subject, facing = 'right', phase = null, character = 'boy') {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const box = (x,y,w,h,color) => {ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  const shelf = (x,y) => {
    for (let i=0;i<8;i++) {
      const left=x+i*10, height=9+i%3*3;
      box(left,y-height,8,height,ink);
      box(left+1,y-height+1,6,height-2,palettes[i%4]);
      box(left+1,y-6,6,3,cream);
    }
    box(x-4,y,88,3,'#b7845c');box(x-4,y+3,88,2,ink);
  };
  if(subject==='shop') {
    box(0,0,480,168,'#40625e');
    for(let x=0;x<480;x+=16) box(x,0,1,112,'#395855');
    for(const x of [8,112,350]) for(const y of [36,65]) shelf(x,y);
    box(219,5,95,67,ink);box(222,8,89,60,'#90bab5');
    for(const [x,h] of [[224,20],[236,29],[252,25],[266,36],[286,22],[300,33]]) {
      box(x,68-h,12,h,'#567b7c');box(x+3,70-h,3,4,gold);
    }
    box(264,7,3,62,cream);box(221,32,90,3,cream);
    box(215,69,103,5,'#c4956e');
    box(0,109,480,59,'#b88965');
    for(let y=110;y<168;y+=12) {
      box(0,y,480,1,'#906e54');
      for(let x=(y%24)*3;x<480;x+=64)box(x,y,1,12,'#906e54');
    }
    const {top,base}=counter;
    box(128,top+3,352,base-top-3,ink);box(130,top+6,350,base-top-9,wood);
    for(let x=136;x<480;x+=52){box(x,top+9,45,12,'#be8660');box(x+2,top+10,41,9,'#ac7252');}
    box(counter.left,top,357,4,'#e6c18d');box(counter.left,top+4,357,2,ink);
  } else if(subject==='conversion'){
    box(4,1,32,22,ink);box(6,2,28,19,'#c9c7ac');box(8,4,24,13,'#233e34');
    box(10,7,12,2,'#cef0cc');box(10,11,6,1,'#cef0cc');box(30,19,2,1,'#83bb7e');
    box(16,23,9,3,'#666f60');box(2,26,36,6,ink);box(4,26,32,4,'#c9c7ac');
    for(let x=6;x<29;x+=4)box(x,27,3,1,'#707b69');box(31,27,3,2,'#304c41');
  } else if(subject==='operator'){
    box(1,9,19,21,cream);for(let y=13;y<26;y+=4)box(4,y,11,1,wood);
    box(17,3,21,28,ink);box(20,6,15,7,'#a8c6ae');for(let y=16;y<28;y+=5)for(let x=20;x<35;x+=5)box(x,y,3,3,gold);
  } else if(subject==='name'){
    box(3,7,33,23,ink);box(5,6,28,21,'#925246');box(9,7,2,20,gold);box(14,10,15,6,cream);box(6,27,28,2,cream);
  } else if(subject==='indent'){
    box(18,19,5,12,wood);box(8,29,25,3,ink);box(1,2,38,22,wood);box(3,4,34,18,cream);
    box(9,8,22,2,ink);box(7,13,24,1,wood);box(10,17,19,1,wood);
  } else if(subject==='printer'){
    box(9,4,29,19,ink);box(11,5,25,18,cream);
    for(let y=9;y<17;y+=3)box(14,y,17,1,'#958c76');
    box(3,17,41,15,ink);box(5,18,37,6,'#9aac9c');box(5,24,37,6,'#647e76');
    box(9,26,25,3,ink);box(37,21,3,2,gold);
  } else if(subject==='book'){
    // A brass reading stand with two cream pages and a ribbon at the fold.
    box(11,35,23,3,ink);box(13,34,19,2,'#ab7845');
    box(19,17,7,17,ink);box(21,17,3,17,gold);
    box(3,12,38,6,ink);box(4,11,36,5,'#934d38');
    for(let x=0;x<34;x++){
      const left=x<17, rise=Math.floor((left?x:33-x)/6);
      box(5+x,3+rise,1,10,left?'#faebbd':'#e7d7a3');
      if(x%17>2 && x%17<14)for(const y of [6,9])box(5+x,y+rise,1,1,'#ac9974');
    }
    box(21,5,2,10,'#ac9269');box(23,12,2,6,'#a94d39');
  } else if(subject==='folder'){
    box(2,4,10,5,ink);box(3,5,8,5,gold);box(1,8,26,15,ink);box(2,9,24,13,'#c89852');
    box(5,6,19,12,cream);box(7,8,13,1,'#917d5c');box(7,11,10,1,'#917d5c');
    box(2,13,24,9,'#e6b867');box(6,15,11,4,cream);
  } else if(subject==='satchel'){
    box(8,2,11,5,ink);box(10,3,7,3,'#c58e54');box(11,4,5,2,'#49382d');
    box(2,7,24,16,ink);box(4,9,20,12,'#9b5b39');box(3,7,22,8,'#c18b52');
    box(5,14,18,2,'#765039');box(12,12,4,6,ink);box(13,13,2,3,gold);
  } else {
    const detective=subject==='detective', skin=detective?'#bf8769':'#9e624b', coat=detective?'#ce975c':'#66958c';
    ctx.save();
    if(facing==='left'||facing==='back-left'){ctx.translate(canvas.width,0);ctx.scale(-1,1);}
    const walking=phase!==null;
    const profile=facing==='left'||facing==='right';
    const side=detective && profile;
    const bob=walking && Math.sin(phase*4*Math.PI)>.55?1:0;
    // Stamp whole pixels along each limb so elbows and knees stay joined.
    function limb(x1,y1,x2,y2,width,color){
      const count=Math.max(1,Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1))));
      for(let i=0;i<=count;i++){
        box(Math.round(x1+(x2-x1)*i/count-width/2),Math.round(y1+(y2-y1)*i/count),width,2,color);
      }
    }
    function leg(offset,far){
      const t=(phase+offset)%1;
      const swing=Math.max(0,(t-.5)*2);
      // During stance the heel moves back exactly as far as the body advances.
      const step=strideLength/2;
      const reach=t<.5?step/2-strideLength*t:
        -step/2+step*(swing-Math.sin(2*Math.PI*swing)/Math.PI);
      const lift=Math.sin(Math.PI*swing);
      const hip=profile?(far?15:18):(far?12:24);
      const ankle=hip+(profile?reach:0);
      const sole=profile?58-(far?1:0)-3*lift:55+(facing==='back'?-1:1)*reach*.28-4*lift;
      const knee=hip+(profile?reach*.5+3*lift:0);
      const cloth=far?'#50534a':ink;
      limb(hip,43+bob,knee,49+bob,6,cloth);
      limb(knee,49+bob,ankle,sole-3,5,cloth);
      box(Math.round(ankle)-3,Math.round(sole)-2,profile?9:7,3,far?'#51463d':'#352f2c');
    }
    const swing=walking?Math.cos(phase*2*Math.PI):0;
    function arm(x,beat,color){
      const hand=x+(profile?beat*3:0);
      const elbow=x+(profile?beat*2-1:0);
      const height=profile?40-Math.max(0,beat)*2:40+beat*2;
      limb(x,28,elbow,35,5,color);limb(elbow,35,hand,height,5,color);
      box(Math.round(hand)-2,Math.round(height),5,4,skin);
    }
    if(walking){
      leg(.5,true);leg(0,false);ctx.translate(0,bob);
      arm(profile?18:6,swing,detective?'#aa7447':coat);
    }else if(side){
      limb(15,43,14,54,6,'#50534a');box(11,55,9,3,'#51463d');
      limb(18,43,20,55,6,ink);box(17,56,9,3,'#352f2c');
    }else{
      box(8,44,7,14,ink);box(20,44,7,14,ink);
      box(5,55,10,4,'#3d3634');box(20,55,11,4,'#3d3634');
    }
    if(side){
      box(12,24,12,3,ink);box(10,27,17,11,ink);box(9,38,19,9,ink);
      box(11,28,15,11,coat);box(10,39,17,7,coat);box(10,45,17,2,'#a9794e');
    }else{
      box(7,24,22,24,ink);box(8,26,20,20,coat);
    }
    if(!walking && !side){
      box(4,28,5,15,coat);box(28,28,6,15,coat);
      box(4,40,5,5,skin);box(29,40,5,5,skin);
    }
    box(10,6,18,17,ink);box(11,9,17,14,skin);if(!detective || facing==='left' || facing==='right'){box(25,16,5,4,skin);box(22,14,2,2,ink);}
    box(15,22,10,5,skin);
    if(detective){box(8,4,19,8,'#72533d');box(9,9,20,3,ink);box(4,12,30,3,'#9a7148');box(17,27,5,15,'#6a4437');box(12,26,6,7,cream);}
    else {box(9,4,18,6,'#494043');box(7,8,8,12,'#494043');box(5,6,6,8,'#494043');box(12,28,14,19,'#ead8ad');box(14,37,9,5,'#bfaa82');}
    if(detective){
      if(facing.startsWith('back')||facing==='front'){
        box(9,15,21,7,facing.startsWith('back')?'#70503e':skin);
        if(facing==='front'){box(14,15,2,2,ink);box(23,15,2,2,ink);}
        if(facing.startsWith('back')){
          box(11,16,17,5,'#79573e');box(13,21,13,2,'#684937');
          if(facing!=='back'){box(24,15,4,7,skin);box(27,18,3,2,skin);box(26,15,2,1,ink);}
          box(12,25,14,19,coat);box(10,25,17,3,'#ad784b');box(17,29,1,14,'#b6804d');
          box(9,42,18,2,'#aa7549');
        }
      }
      if(character === 'girl') {
        const braidX = facing.startsWith('back') ? 15 : 8;
        box(braidX,15,5,9,'#573b31');box(braidX-1,22,5,5,'#704934');
        box(braidX,26,3,3,'#286d67');box(braidX-1,29,4,3,'#573b31');
        box(10,9,17,3,'#286d67');
      }
      if(walking && !profile)arm(30,-swing,coat);
      for(let i=0;i<13;i++)box(23-i,26+i,3,3,'#634b36');
      box(5,36,13,9,ink);box(6,37,11,7,'#96603d');box(6,37,11,3,'#c18b52');box(11,39,2,3,gold);
    }
    if(side)arm(19,-swing,'#bf8651');
    else if(walking && !detective)arm(27,-swing,coat);
    ctx.restore();
  }
}
