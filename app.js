/* =====================================================================
   NEW GEN — Code & AI
   app.js — motion system + WebGL (otimizado)
   ===================================================================== */
(() => {
'use strict';

if (!window.gsap) { document.body.classList.remove('loading'); return; }
gsap.registerPlugin(ScrollTrigger);

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root    = document.documentElement;
const body    = document.body;

/* =====================================================================
   0. CAPABILITY TIER — decide o quanto o navegador aguenta
   ===================================================================== */
const TIER = (() => {
  const mobile  = matchMedia('(max-width:860px)').matches || matchMedia('(pointer:coarse)').matches;
  const cores   = navigator.hardwareConcurrency || 4;
  const mem     = navigator.deviceMemory || 4;
  let webgl = false;
  try {
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch(e){}
  const weak = cores <= 4 || mem <= 4;
  return {
    mobile, webgl,
    /* WebGL só no desktop com hardware razoável */
    hero3d: webgl && !mobile && !REDUCED,
    footFog: webgl && !mobile && !weak && !REDUCED,
    dpr: Math.min(devicePixelRatio, mobile ? 1.25 : (weak ? 1 : 1.35)),
    sparks: weak ? 90 : 150,
    aa: !weak && devicePixelRatio < 2
  };
})();
if (!TIER.hero3d) body.classList.add('no-webgl');

/* =====================================================================
   1. PROGRESSOS COMPARTILHADOS (DOM + WebGL + áudio)
   ===================================================================== */
const S = { hover:0, charge:0, explode:0, vibrate:0,
            mouse:{x:0,y:0}, target:{x:0,y:0} };

/* =====================================================================
   2. CURSOR
   ===================================================================== */
const cursor = document.getElementById('cursor');
const cur = { x:innerWidth/2, y:innerHeight/2, tx:innerWidth/2, ty:innerHeight/2, s:1 };
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
let lastPointer = 0;
if (FINE){
  addEventListener('pointermove', e => {
    cur.tx = e.clientX; cur.ty = e.clientY;
    S.target.x = (e.clientX/innerWidth)*2-1;
    S.target.y = -((e.clientY/innerHeight)*2-1);
    lastPointer = performance.now();
  }, {passive:true});
  document.querySelectorAll('a,button,.orbit-card,.svc,.founder').forEach(el => {
    el.addEventListener('pointerenter', () => gsap.to(cur,{s:2.1,duration:.4,ease:'power2.out'}));
    el.addEventListener('pointerleave', () => gsap.to(cur,{s:1,duration:.4,ease:'power2.out'}));
  });
} else { cursor.remove(); }

/* =====================================================================
   3. ÁUDIO — sintetizado em runtime, criado só no primeiro gesto
   ===================================================================== */
let actx=null, analyser=null, aData=null, master=null;
function audio(){
  if (actx){ if(actx.state==='suspended') actx.resume(); return actx; }
  const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return null;
  actx = new AC();
  master = actx.createGain(); master.gain.value = .5;
  analyser = actx.createAnalyser(); analyser.fftSize = 64;
  aData = new Uint8Array(analyser.frequencyBinCount);
  master.connect(analyser); analyser.connect(actx.destination);
  return actx;
}
function beep(f=880,d=.07,type='sine',v=.05){
  const a=audio(); if(!a)return;
  const o=a.createOscillator(),g=a.createGain();
  o.type=type; o.frequency.setValueAtTime(f,a.currentTime);
  g.gain.setValueAtTime(0,a.currentTime);
  g.gain.linearRampToValueAtTime(v,a.currentTime+.006);
  g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+d);
  o.connect(g); g.connect(master); o.start(); o.stop(a.currentTime+d+.02);
}
function noiseBurst(d=.5,v=.2){
  const a=audio(); if(!a)return;
  const buf=a.createBuffer(1,(a.sampleRate*d)|0,a.sampleRate), ch=buf.getChannelData(0);
  for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*Math.pow(1-i/ch.length,2.4);
  const s=a.createBufferSource(); s.buffer=buf;
  const f=a.createBiquadFilter(); f.type='lowpass';
  f.frequency.setValueAtTime(4400,a.currentTime);
  f.frequency.exponentialRampToValueAtTime(150,a.currentTime+d);
  const g=a.createGain(); g.gain.setValueAtTime(v,a.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+d);
  s.connect(f); f.connect(g); g.connect(master); s.start();
}

/* =====================================================================
   4. BLUR TEXT REVEAL
   ===================================================================== */
function splitInto(el,text){
  const frag=document.createDocumentFragment(), out=[];
  for(const ch of text){ const s=document.createElement('span'); s.textContent=ch; frag.appendChild(s); out.push(s); }
  el.textContent=''; el.appendChild(frag); return out;
}
function blurReveal(el,{delay=0,scroll=false}={}){
  const spans = splitInto(el, el.dataset.text || el.textContent);
  el.style.willChange='filter, opacity';
  const cfg={opacity:1,filter:'blur(0px)',duration:REDUCED?.4:.95,ease:'power2.out',
    stagger:{each:REDUCED?.012:.045,from:'random'},
    onComplete(){ el.style.willChange='auto'; }};
  if(scroll) cfg.scrollTrigger={trigger:el,start:'top 82%'};
  else cfg.delay = REDUCED?delay*.35:delay;
  gsap.to(spans,cfg);
}

/* =====================================================================
   5. PRELOADER
   ===================================================================== */
const loader = document.getElementById('loader');
const loaderPaths = loader.querySelectorAll('path');
loaderPaths.forEach(p => p.style.setProperty('--len', p.getTotalLength()));
const pctEl = loader.querySelector('.pct b');
const barEl = loader.querySelector('.bar i');
const prog  = {v:0};

function startSite(){
  body.classList.remove('loading');
  document.querySelectorAll('#hero .btr').forEach(el => blurReveal(el,{delay:+(el.dataset.delay||0)}));
  gsap.from('header',{y:-30,opacity:0,duration:1.2,ease:'power3.out',delay:.4});
  gsap.from('.scroll-cue',{scaleY:0,opacity:0,transformOrigin:'top',duration:1.4,ease:'power3.out',delay:1.9});
  if (TIER.hero3d) initHero3D();
  ScrollTrigger.refresh();
}

gsap.timeline({delay:.2})
  .to(loaderPaths,{strokeDashoffset:0,duration:1.4,ease:'power2.inOut',stagger:.16},0)
  .to(prog,{v:100,duration:1.75,ease:'power1.inOut',
       onUpdate(){ pctEl.textContent=Math.round(prog.v); barEl.style.width=prog.v+'%'; }},0)
  .to(loaderPaths,{fill:'#00c853',stroke:'#00c853',duration:.5,ease:'power2.out'},1.4)
  .to(loader,{opacity:0,duration:.7,ease:'power2.inOut',
       onComplete(){ loader.remove(); startSite(); }},'+=.1');

/* =====================================================================
   6. MARQUEE
   ===================================================================== */
(() => {
  const track=document.getElementById('marquee-track');
  track.innerHTML = track.innerHTML + track.innerHTML;
  const w = track.scrollWidth/2;
  gsap.to(track,{x:-w,duration:REDUCED?60:26,ease:'none',repeat:-1});
})();

/* =====================================================================
   7. PALETTE SHIFT (black → white nos serviços)
   ===================================================================== */
let paletteOn = null;
const headerEl0 = document.querySelector('header');
ScrollTrigger.create({
  trigger:'#services', start:'top 60%', end:'bottom 45%',
  onUpdate(self){
    const on = self.progress>0.06 && self.progress<0.94;
    if (on === paletteOn) return;           // só escreve quando muda de estado
    paletteOn = on;
    headerEl0.classList.toggle('on-light', on);
    root.style.setProperty('--bg-primary',      on?'#f2f2f4':'#0a0a0a');
    root.style.setProperty('--text-primary',    on?'#0a0a0a':'#ffffff');
    root.style.setProperty('--text-secondary',  on?'#55555c':'#c8c8cc');
    root.style.setProperty('--line',            on?'rgba(10,10,10,.14)':'rgba(255,255,255,.12)');
  }
});

/* =====================================================================
   8. PARTICLE GLYPH EXPLODE
   ===================================================================== */
(() => {
  const title=document.getElementById('glyph-title');
  const cvs=document.getElementById('glyph-canvas');
  const ctx=cvs.getContext('2d',{alpha:true});
  let P=[], raf=null, W=0, H=0;

  function build(){
    const r=title.getBoundingClientRect();
    const dpr=Math.min(devicePixelRatio,1.5);
    W=r.width; H=r.height;
    cvs.width=W*dpr; cvs.height=H*dpr; cvs.style.height=H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const cs=getComputedStyle(title);
    ctx.clearRect(0,0,W,H);
    ctx.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.textBaseline='top'; ctx.fillStyle='#000';
    ctx.fillText(title.textContent, 0, H*0.06);
    const w2=cvs.width, data=ctx.getImageData(0,0,w2,cvs.height).data;
    P=[];
    const step=Math.max(3,Math.round(4*dpr));
    for(let y=0;y<cvs.height;y+=step){
      for(let x=0;x<w2;x+=step){
        if(data[(y*w2+x)*4+3]>128){
          const px=x/dpr, py=y/dpr;
          const a=Math.random()*6.283, d=60+Math.random()*260;
          P.push({x:px+Math.cos(a)*d, y:py+Math.sin(a)*d, tx:px, ty:py, vx:0, vy:0,
                  s:Math.random()>.9?1.9:1.2, g:Math.random()>.86});
        }
      }
    }
    ctx.clearRect(0,0,W,H);
  }

  function loop(){
    ctx.clearRect(0,0,W,H);
    const ink=getComputedStyle(root).getPropertyValue('--text-primary').trim()||'#fff';
    let moving=0;
    ctx.fillStyle=ink;
    for(const p of P){
      p.vx+=(p.tx-p.x)*.028; p.vy+=(p.ty-p.y)*.028;
      p.vx*=.86; p.vy*=.86; p.x+=p.vx; p.y+=p.vy;
      if(Math.abs(p.tx-p.x)>.4||Math.abs(p.ty-p.y)>.4) moving++;
      if(!p.g) ctx.fillRect(p.x,p.y,p.s,p.s);
    }
    ctx.fillStyle='#00c853';
    for(const p of P) if(p.g) ctx.fillRect(p.x,p.y,p.s,p.s);

    if(moving>4){ raf=requestAnimationFrame(loop); }
    else{
      cancelAnimationFrame(raf);
      gsap.to(title,{opacity:1,duration:.45,ease:'power2.out'});
      gsap.to(cvs,{opacity:0,duration:.45,onComplete(){ ctx.clearRect(0,0,W,H); P=[]; }});
    }
  }

  ScrollTrigger.create({trigger:'#glyph-wrap',start:'top 78%',once:true,
    onEnter(){
      if(REDUCED||TIER.mobile){ gsap.to(title,{opacity:1,duration:.5}); return; }
      build(); cvs.style.opacity=1; raf=requestAnimationFrame(loop);
    }});
})();

/* =====================================================================
   9. REVEALS DE SCROLL
   ===================================================================== */
gsap.utils.toArray('.svc').forEach((el,i)=>{
  gsap.from(el,{y:44,opacity:0,duration:1,ease:'power3.out',delay:i*.05,
    scrollTrigger:{trigger:el,start:'top 88%'}});
});
gsap.fromTo('.big-statement',{opacity:0,filter:'blur(12px)',y:26},
  {opacity:1,filter:'blur(0px)',y:0,duration:1.25,ease:'power2.out',
   scrollTrigger:{trigger:'.big-statement',start:'top 84%'}});
gsap.utils.toArray('.manifesto-cols p').forEach((p,i)=>{
  gsap.from(p,{opacity:0,y:28,duration:1,ease:'power3.out',delay:i*.12,
    scrollTrigger:{trigger:p,start:'top 90%'}});
});
gsap.utils.toArray('.founder').forEach(f=>{
  const dir = f.dataset.from==='left' ? -90 : 90;
  gsap.from(f,{x:REDUCED?0:dir,y:56,opacity:0,duration:1.25,ease:'power3.out',
    scrollTrigger:{trigger:f,start:'top 86%'}});
});
gsap.utils.toArray('[data-count]').forEach(el=>{
  const end=+el.dataset.count, suffix=el.querySelector('i')?.outerHTML||'', o={v:0};
  gsap.to(o,{v:end,duration:1.9,ease:'power2.out',
    scrollTrigger:{trigger:el,start:'top 88%'},
    onUpdate(){ el.innerHTML=Math.round(o.v)+suffix; }});
});
document.querySelectorAll('.btr-scroll').forEach(el=>{ el.classList.add('btr'); blurReveal(el,{scroll:true}); });

/* =====================================================================
   10. VÍDEO — sources injetados só quando chega perto da viewport
   ===================================================================== */
(() => {
  const v=document.getElementById('brandvid');
  const btn=document.getElementById('soundbtn');
  const shell=document.querySelector('.video-shell');
  let wired=false;

  function wire(){
    if(wired) return; wired=true;
    const webm=document.createElement('source');
    webm.src=v.dataset.webm; webm.type='video/webm';
    const mp4=document.createElement('source');
    mp4.src=v.dataset.mp4; mp4.type='video/mp4';
    v.append(webm,mp4);
    v.preload='auto'; v.load();
  }

  new IntersectionObserver((es,obs)=>{
    if(es[0].isIntersecting){ wire(); obs.disconnect(); }
  },{rootMargin:'400px'}).observe(shell);

  /* threshold alto: o vídeo só decodifica quando está de fato em cena */
  new IntersectionObserver(es=>{
    if(es[0].isIntersecting){ wire(); v.play().catch(()=>{}); } else v.pause();
  },{threshold:.4}).observe(shell);
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) v.pause(); });

  if(!REDUCED){
    gsap.fromTo(shell,{scale:.86,filter:'brightness(.5)'},
      {scale:1,filter:'brightness(1)',ease:'none',
       scrollTrigger:{trigger:shell,start:'top 88%',end:'top 26%',scrub:.6}});
  }
  btn.addEventListener('click',()=>{
    wire(); v.muted=!v.muted; btn.textContent=v.muted?'som off':'som on';
    if(!v.muted) v.play().catch(()=>{});
  });
})();

/* =====================================================================
   10b. ORBIT — carrossel de portfólio em anel de Saturno
   ===================================================================== */
const orbit = (() => {
  const stage = document.getElementById('orbit');
  if(!stage) return null;
  const cards = [...stage.querySelectorAll('.orbit-card')];
  const N = cards.length;
  const STEP = 360/N;
  const nowIdx  = document.querySelector('.orbit-now .idx');
  const nowName = document.querySelector('.orbit-now .name');
  const nowKind = document.querySelector('.orbit-now .kind');
  const openBtn = document.getElementById('orbit-open');

  let angle = 180;          // ângulo do card que está na frente
  let target = 180;
  let vel = 0;
  let dragging = false, lastX = 0, moved = 0, downT = 0;
  let front = -1;
  let mounted = false, visible = false;

  const rad = d => d*Math.PI/180;

  /* ------------------------------------------------------------------
     Orçamento de iframes.
     Cada site vivo roda o próprio rAF, vídeos e animações — 4 ao mesmo
     tempo é o que derrubava o frame rate. Mantemos no máximo BUDGET
     montados (o da frente + o anterior), o resto vira placeholder.
     ------------------------------------------------------------------ */
  const BUDGET = 1;                      // um único site vivo por vez
  const live = [];                       // ordem de uso, mais recente no fim

  function mountFrame(card){
    if(card._frame){ touchLive(card); return; }
    const f = document.createElement('iframe');
    f.src = card.dataset.url;
    f.loading = 'lazy';
    f.tabIndex = -1;
    f.setAttribute('scrolling','no');
    f.setAttribute('sandbox','allow-scripts allow-same-origin');
    f.setAttribute('aria-hidden','true');
    f.addEventListener('load',()=>{
      f.classList.add('ready');
      const ph=card.querySelector('.ph'); if(ph) ph.style.opacity='0';
    });
    card._frame = f;
    card.querySelector('.frame').appendChild(f);
    scaleFrame(card);
    touchLive(card);
  }
  function unmountFrame(card){
    if(!card._frame) return;
    card._frame.src = 'about:blank';     // mata o rAF do site antes de remover
    card._frame.remove();
    card._frame = null;
    const ph=card.querySelector('.ph'); if(ph) ph.style.opacity='';
  }
  function touchLive(card){
    const i=live.indexOf(card); if(i>-1) live.splice(i,1);
    live.push(card);
    while(live.length>BUDGET) unmountFrame(live.shift());
  }
  function scaleFrame(card){
    const f=card._frame; if(!f) return;
    f.style.transform = `scale(${card.clientWidth/1440})`;
  }
  /* só o card da frente é montado; troca quando a órbita assenta */
  let mountTimer=null;
  function syncFrames(){
    clearTimeout(mountTimer);
    mountTimer = setTimeout(()=>{
      if(!visible || front<0) return;
      mountFrame(cards[front]);
    }, 260);                              // espera parar de girar
  }
  function depthOf(i){ return -Math.cos(rad(angle + i*STEP)); }

  let RX=380, RY=90;                     // medidos no resize, não a cada frame
  function measure(){
    RX = Math.min(stage.clientWidth*0.34, 420);
    RY = Math.min(stage.clientHeight*0.17, 96);
  }
  measure();

  const dims = cards.map(c=>c.querySelector('.dim'));

  function layout(){
    let best=-2, bestI=0;
    for(let i=0;i<N;i++){
      const a = rad(angle + i*STEP);
      const d = -Math.cos(a);                       // 1 = frente, -1 = atrás do planeta
      const k = (d+1)/2;
      const card = cards[i];
      /* só transform / opacity / z-index: tudo no compositor, zero re-layout */
      card.style.transform =
        `translate3d(${(Math.sin(a)*RX).toFixed(1)}px,${(-Math.cos(a)*RY).toFixed(1)}px,0) scale(${(0.52+0.48*k).toFixed(3)})`;
      card.style.opacity = (0.34 + 0.66*k).toFixed(3);
      card.style.zIndex  = (k*198)|0;
      dims[i].style.opacity = (0.52*(1-k)).toFixed(3);
      if(d>best){ best=d; bestI=i; }
    }
    if(bestI!==front){
      front=bestI;
      cards.forEach((c,i)=>c.classList.toggle('is-front',i===front));
      const c=cards[front];
      nowIdx.textContent  = String(front+1).padStart(2,'0')+' / '+String(N).padStart(2,'0');
      nowName.textContent = c.dataset.name;
      nowKind.textContent = c.dataset.kind;
      openBtn.href = c.dataset.url;
      gsap.fromTo([nowName,nowKind],{opacity:0,y:8},{opacity:1,y:0,duration:.5,ease:'power2.out',stagger:.05});
      syncFrames();
    }
  }

  function snap(){ target = Math.round((angle-180)/STEP)*STEP + 180; }
  function goTo(i){
    const cur=Math.round((angle-180)/STEP);
    let delta=(i-((cur%N)+N)%N);
    if(delta>N/2) delta-=N; if(delta<-N/2) delta+=N;
    target = angle - delta*STEP; // manter o giro pelo caminho curto
    bumpAuto();
  }
  function step(dir){ target = Math.round((angle-180)/STEP)*STEP + 180 + dir*STEP; bumpAuto(); }

  /* ---- autoplay ----
     A vitrine gira sozinha o tempo todo — mesmo sem ninguém tocando nela.
     Só pausa quando: alguém está arrastando, o mouse está em cima do
     carrossel, a seção está fora da viewport, ou a aba está oculta (esse
     último já é tratado pelo loop principal em paused/tick). */
  const AUTO_MS = 3800;
  let hovering = false;
  let autoNext = performance.now() + AUTO_MS;
  function bumpAuto(now){ autoNext = (now||performance.now()) + AUTO_MS; }

  /* ---- drag / swipe ---- */
  function down(e){
    dragging=true; moved=0; downT=performance.now();
    lastX=(e.touches?e.touches[0]:e).clientX;
    stage.classList.add('dragging'); vel=0;
  }
  function move(e){
    if(!dragging) return;
    const x=(e.touches?e.touches[0]:e).clientX;
    const dx=x-lastX; lastX=x; moved+=Math.abs(dx);
    angle += dx*0.32; target = angle; vel = dx*0.32;
    if(e.cancelable && moved>8) e.preventDefault();
    layout();
  }
  function upEv(){
    if(!dragging) return;
    dragging=false; stage.classList.remove('dragging');
    target = angle + vel*7;            // inércia
    snap();
    bumpAuto();
  }
  stage.addEventListener('pointerenter',()=>{ hovering=true; });
  stage.addEventListener('pointerleave',()=>{ hovering=false; bumpAuto(); });
  if('PointerEvent' in window){
    stage.addEventListener('pointerdown',down);
    addEventListener('pointermove',move,{passive:false});
    addEventListener('pointerup',upEv,{passive:true});
    addEventListener('pointercancel',upEv,{passive:true});
  }else{
    stage.addEventListener('mousedown',down);
    addEventListener('mousemove',move,{passive:false});
    addEventListener('mouseup',upEv,{passive:true});
    stage.addEventListener('touchstart',down,{passive:true});
    stage.addEventListener('touchmove',move,{passive:false});
    stage.addEventListener('touchend',upEv,{passive:true});
  }

  /* clique: card da frente abre, os outros giram até a frente */
  cards.forEach((c,i)=>{
    c.addEventListener('click',()=>{
      if(moved>8 || performance.now()-downT>420) return;   // foi arrasto, não clique
      if(i===front) window.open(c.dataset.url,'_blank','noopener');
      else goTo(i);
    });
  });
  document.querySelectorAll('.orbit-ctrl button').forEach(b=>
    b.addEventListener('click',()=>step(+b.dataset.dir)));
  addEventListener('keydown',e=>{
    if(!visible) return;
    if(e.key==='ArrowLeft')  step(-1);
    if(e.key==='ArrowRight') step(1);
  });

  new IntersectionObserver(es=>{
    visible=es[0].isIntersecting;
    if(visible){ bumpAuto(); syncFrames(); }
    else { clearTimeout(mountTimer); while(live.length) unmountFrame(live.shift()); }
  },{rootMargin:'200px'}).observe(stage);

  layout();
  return {
    tick(){
      if(!visible) return;
      if(!dragging && !hovering){
        const now = performance.now();
        if(now>=autoNext){ step(1); }
      }
      if(dragging) return;
      const diff=target-angle;
      if(Math.abs(diff)>0.02){ angle+=diff*0.085; layout(); }
      else if(angle!==target){ angle=target; layout(); }
    },
    resize(){ measure(); cards.forEach(scaleFrame); layout(); },
    lite(){ while(live.length>1) unmountFrame(live.shift()); },
    resumeAuto(){ bumpAuto(); }
  };
})();

/* =====================================================================
   11. WEBGL — hero (inicializado sob demanda)
   ===================================================================== */
/* ---------------------------------------------------------------------
   FOG — o fbm procedural era o maior custo de GPU do site: rodava ~9
   avaliações de ruído por pixel, em tela cheia, todo frame. Agora o ruído
   é assado UMA vez numa textura tileável de 192px (3 escalas nos canais
   R/G/B) e o shader só faz duas leituras de textura.
   --------------------------------------------------------------------- */
const FOG_VERT = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.999,1.0);}';
const FOG_FRAG = `
precision mediump float; varying vec2 vUv;
uniform sampler2D uNoise;
uniform float uTime,uHover,uAudio,uAspect; uniform vec3 uAccent;
void main(){
  vec2 p=vec2((vUv.x-.5)*uAspect,vUv.y-.5);
  float t=uTime*.028;
  float n1=texture2D(uNoise,p*0.62+vec2(t,-t*.72)).r;
  float n2=texture2D(uNoise,p*1.35+vec2(-t*.58,t*.34)).g;
  float n=pow(n1*.72+n2*.48,2.1);
  float mask=smoothstep(.94,.05,length(p*vec2(1.,1.25)));
  float smoke=n*mask*(.62+uAudio*.5);
  vec3 ash=mix(vec3(.055),vec3(.30,.30,.33),smoke);
  ash+=uAccent*smoke*uHover*.55;
  ash+=uAccent*pow(smoke,3.0)*uAudio*.35;
  gl_FragColor=vec4(ash,1.0);
}`;

/* ruído tileável assado em JS, uma única vez, compartilhado hero + rodapé */
let NOISE_TEX = null;
function noiseTexture(THREE){
  if(NOISE_TEX) return NOISE_TEX;
  const S=192, c=document.createElement('canvas'); c.width=c.height=S;
  const ctx=c.getContext('2d'), img=ctx.createImageData(S,S), D=img.data;
  const hash=(i,j,P)=>{
    i=((i%P)+P)%P; j=((j%P)+P)%P;
    let n=(i*374761393+j*668265263)|0;
    n=(n^(n>>13))*1274126177|0;
    return ((n^(n>>16))>>>0)/4294967295;
  };
  const vn=(u,v,P)=>{                       // value noise periódico → tileável
    const fx=u*P, fy=v*P, i=Math.floor(fx), j=Math.floor(fy);
    let sx=fx-i, sy=fy-j; sx=sx*sx*(3-2*sx); sy=sy*sy*(3-2*sy);
    const a=hash(i,j,P), b=hash(i+1,j,P), cc=hash(i,j+1,P), d=hash(i+1,j+1,P);
    const t1=a+(b-a)*sx, t2=cc+(d-cc)*sx;
    return t1+(t2-t1)*sy;
  };
  const fbm=(u,v,P0)=>{ let val=0,amp=.5,P=P0;
    for(let o=0;o<4;o++){ val+=amp*vn(u,v,P); P*=2; amp*=.5; } return val; };
  for(let y=0;y<S;y++){
    const v=y/S;
    for(let x=0;x<S;x++){
      const u=x/S, k=(y*S+x)<<2;
      D[k]  =fbm(u,v,4)*255;
      D[k+1]=fbm(u,v,7)*255;
      D[k+2]=fbm(u,v,11)*255;
      D[k+3]=255;
    }
  }
  ctx.putImageData(img,0,0);
  NOISE_TEX=new THREE.CanvasTexture(c);
  NOISE_TEX.wrapS=NOISE_TEX.wrapT=THREE.RepeatWrapping;
  NOISE_TEX.minFilter=NOISE_TEX.magFilter=THREE.LinearFilter;
  NOISE_TEX.generateMipmaps=false;
  return NOISE_TEX;
}

/* geometria real do monograma NG (traçada do PNG, y-up, altura = 1) */
const NG_PATHS = [
[[-0.5822,-0.4993],[-0.485,-0.4986],[-0.4837,-0.1743],[-0.4823,0.1499],[-0.459,0.1205],[-0.4356,0.0911],[-0.3066,-0.0747],[-0.1777,-0.2404],[-0.1017,-0.3384],[-0.0258,-0.4363],[-0.0027,-0.4666],[0.0204,-0.4969],[0.3471,-0.4971],[0.6739,-0.4972],[0.6739,-0.1983],[0.6739,0.1006],[0.4239,0.1006],[0.1739,0.1006],[0.1739,0.0014],[0.1739,-0.0978],[0.3288,-0.0978],[0.4837,-0.0978],[0.4837,-0.1983],[0.4837,-0.2989],[0.3023,-0.2988],[0.1209,-0.2988],[0.0543,-0.2116],[-0.0122,-0.1245],[-0.0728,-0.0452],[-0.1335,0.034],[-0.1531,0.0598],[-0.1728,0.0856],[-0.2178,0.144],[-0.2627,0.2025],[-0.319,0.2758],[-0.3753,0.3492],[-0.4191,0.4063],[-0.463,0.4633],[-0.4767,0.4815],[-0.4905,0.4997],[-0.5849,0.4999],[-0.6793,0.5],[-0.6793,0.0],[-0.6793,-0.5]],
[[0.0532,-0.0054],[0.0543,0.1487],[0.0545,0.3027],[0.0565,0.3047],[0.3183,0.3059],[0.5801,0.307],[0.6297,0.307],[0.6793,0.3071],[0.6793,0.4035],[0.6793,0.5],[0.1738,0.5],[-0.3317,0.5],[-0.3064,0.4668],[-0.2812,0.4337],[-0.2364,0.3747],[-0.1916,0.3157],[-0.1019,0.1979],[-0.0123,0.0802],[0.02,0.0374]]
];

let hero3d = null;   // preenchido por initHero3D()

function initHero3D(){
  if (hero3d || !window.THREE) return;
  const THREE = window.THREE;
  const GREEN = new THREE.Color('#00c853');
  const DARK  = new THREE.Color('#0a0a0a');

  const canvas   = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({canvas,antialias:TIER.aa,powerPreference:'high-performance',stencil:false,depth:true});
  renderer.setPixelRatio(TIER.dpr);
  renderer.setSize(innerWidth,innerHeight,false);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.setClearColor(0x0a0a0a,1);

  const scene  = new THREE.Scene();
  scene.fog    = new THREE.FogExp2(0x0a0a0a,.05);
  const camera = new THREE.PerspectiveCamera(38, innerWidth/innerHeight, .1, 60);
  camera.position.set(0,0,8.4);

  /* env map procedural via PMREM (uma vez, depois descartado) */
  const envMap = (() => {
    const c=document.createElement('canvas'); c.width=512; c.height=256;
    const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,0,256);
    g.addColorStop(0,'#3c3c44'); g.addColorStop(.48,'#101014'); g.addColorStop(1,'#050506');
    x.fillStyle=g; x.fillRect(0,0,512,256);
    [[105,58,92,'#ffffff'],[382,72,72,'#ccd3da'],[250,192,124,'#00c853'],[470,146,58,'#6a7078']]
      .forEach(([cx,cy,r,col])=>{
        const rg=x.createRadialGradient(cx,cy,0,cx,cy,r);
        rg.addColorStop(0,col); rg.addColorStop(1,'rgba(0,0,0,0)');
        x.fillStyle=rg; x.beginPath(); x.arc(cx,cy,r,0,6.283); x.fill();
      });
    const tex=new THREE.CanvasTexture(c); tex.mapping=THREE.EquirectangularReflectionMapping;
    const p=new THREE.PMREMGenerator(renderer); p.compileEquirectangularShader();
    const env=p.fromEquirectangular(tex).texture; p.dispose(); tex.dispose();
    return env;
  })();
  scene.environment = envMap;

  scene.add(new THREE.AmbientLight(0xffffff,.2));
  const key=new THREE.DirectionalLight(0xffffff,1.55); key.position.set(4,6,6); scene.add(key);
  const rimL=new THREE.PointLight(0x00c853,7,24,2); rimL.position.set(-4,-2,3); scene.add(rimL);

  /* fog volumétrico */
  const fogU={uTime:{value:0},uHover:{value:0},uAudio:{value:0},
              uNoise:{value:noiseTexture(THREE)},
              uAccent:{value:new THREE.Color('#00c853')},uAspect:{value:innerWidth/innerHeight}};
  const fogMesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),
    new THREE.ShaderMaterial({uniforms:fogU,vertexShader:FOG_VERT,fragmentShader:FOG_FRAG,depthTest:false,depthWrite:false}));
  fogMesh.frustumCulled=false; fogMesh.renderOrder=-1; scene.add(fogMesh);

  /* símbolo: monograma NG extrudado */
  const symbol=new THREE.Group(); scene.add(symbol);
  const parts=[]; const SCALE=3.15;
  NG_PATHS.forEach((pts,i)=>{
    const shape=new THREE.Shape();
    shape.moveTo(pts[0][0]*SCALE,pts[0][1]*SCALE);
    for(let k=1;k<pts.length;k++) shape.lineTo(pts[k][0]*SCALE,pts[k][1]*SCALE);
    shape.closePath();
    const flat=new THREE.ExtrudeGeometry(shape,{depth:.34,bevelEnabled:false});
    const box=new THREE.Box3().setFromBufferAttribute(flat.attributes.position);
    const c=box.getCenter(new THREE.Vector3());
    flat.dispose();

    const geo=new THREE.ExtrudeGeometry(shape,{
      depth:.34,bevelEnabled:true,bevelThickness:.045,bevelSize:.045,bevelSegments:2,curveSegments:2});
    geo.center();
    /* SEM transmission: qualquer material com transmission > 0 obriga o three
       a renderizar a cena inteira num render target extra a cada frame.
       O look de vidro é recriado com envMap forte + clearcoat + roughness baixa. */
    const mat=new THREE.MeshPhysicalMaterial({
      color:0x141416,metalness:.78,roughness:.16,
      envMap,envMapIntensity:3.4,clearcoat:1,clearcoatRoughness:.04,
      emissive:0x00c853,emissiveIntensity:0});
    const mesh=new THREE.Mesh(geo,mat);
    mesh.position.copy(c);
    symbol.add(mesh);
    const dir=c.clone().setZ(0).normalize();
    if(!isFinite(dir.x)||dir.length()===0) dir.set(i?1:-1,i?1:-1,0).normalize();
    parts.push({mesh,mat,base:c.clone(),dir,flash:0,index:i});
  });

  const emberMat=new THREE.MeshBasicMaterial({color:0x00e676,transparent:true,opacity:0});
  const ember=new THREE.Mesh(new THREE.SphereGeometry(.5,16,16),emberMat); symbol.add(ember);

  const ringMat=new THREE.MeshPhysicalMaterial({color:0x0d0d0f,metalness:.95,roughness:.15,envMap,
    envMapIntensity:3.2,clearcoat:1,transparent:true,opacity:.85});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.62,.028,8,140),ringMat);
  ring.rotation.x=1.16; symbol.add(ring);

  /* weld sparks */
  const NSP=TIER.sparks;
  const sPos=new Float32Array(NSP*3), sVel=new Float32Array(NSP*3), sLife=new Float32Array(NSP);
  const sparkGeo=new THREE.BufferGeometry();
  sparkGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3));
  sparkGeo.setAttribute('aLife',new THREE.BufferAttribute(sLife,1));
  const sparks=new THREE.Points(sparkGeo,new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uAccent:{value:new THREE.Color('#00e676')},uPR:{value:TIER.dpr}},
    vertexShader:'attribute float aLife;varying float vL;uniform float uPR;void main(){vL=aLife;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=(2.+aLife*7.)*uPR*(6./-mv.z);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'precision mediump float;varying float vL;uniform vec3 uAccent;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(mix(uAccent,vec3(1.),pow(vL,2.)),smoothstep(.5,0.,d)*vL);}'
  }));
  scene.add(sparks);
  sparks.visible=false;
  let spI=0,lastSpark=0,sparksDirty=false,sparksEnabled=true;
  function emitSpark(o,spread,power){
    const i=spI=(spI+1)%NSP, i3=i*3;
    sPos[i3]=o.x+(Math.random()-.5)*spread;
    sPos[i3+1]=o.y+(Math.random()-.5)*spread;
    sPos[i3+2]=o.z+(Math.random()-.5)*spread*.5;
    sVel[i3]=(Math.random()-.5)*power;
    sVel[i3+1]=(Math.random()-.5)*power+power*.25;
    sVel[i3+2]=(Math.random()-.5)*power*.6;
    sLife[i]=1;
  }

  /* hover magnético + hold-to-blast */
  const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(-2,-2), tmp=new THREE.Vector3();
  let hovered=null, holding=false, holdStart=0, blasted=false, rayTick=false;
  const chargeEl=document.getElementById('charge'), chargeC=chargeEl.querySelector('circle');
  const hero=document.getElementById('hero');
  const meshes=parts.map(p=>p.mesh);

  function down(){ if(scrollY>innerHeight*.7)return; holding=true; holdStart=performance.now(); blasted=false; audio(); }
  function up(){ holding=false; gsap.to(chargeEl,{opacity:0,duration:.3}); gsap.to(S,{charge:0,duration:.4,ease:'power2.out'}); }
  hero.addEventListener('pointerdown',down);
  addEventListener('pointerup',up,{passive:true});
  addEventListener('pointercancel',up,{passive:true});
  addEventListener('keydown',e=>{if(e.code==='Space'&&!holding&&scrollY<innerHeight*.7){e.preventDefault();down();}});
  addEventListener('keyup',e=>{if(e.code==='Space')up();});

  function blast(){
    blasted=true; noiseBurst(.85,.26); beep(68,.55,'sine',.14);
    gsap.timeline()
      .to(S,{explode:1,duration:.32,ease:'power3.out'})
      .to(S,{vibrate:1,duration:.08},0)
      .to(S,{vibrate:0,duration:.7,ease:'power2.out'},.1)
      .to(S,{explode:0,duration:1.6,ease:'elastic.out(1,0.42)'},.34);
    gsap.fromTo(emberMat,{opacity:.85},{opacity:0,duration:.9,ease:'power2.out'});
    for(let i=0;i<70;i++) emitSpark({x:0,y:0,z:0},1.6,.1);
  }

  const heroUI=document.querySelector('.hero-ui');
  const headerEl=document.querySelector('header');
  let uiShaken=false;

  function resize(){
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight,false);
    fogU.uAspect.value=innerWidth/innerHeight;
    symbol.scale.setScalar(innerWidth<1100?.72:1);
  }
  resize();

  /* --- degradação automática em dois estágios --- */
  let fpsAcc=0, fpsN=0, degraded=false, stage2=false;
  function checkPerf(dt){
    if(stage2) return;
    fpsAcc+=1/Math.max(dt,.001); fpsN++;
    if(fpsN>=70){
      const avg=fpsAcc/fpsN; fpsAcc=0; fpsN=0;
      if(avg<48 && !degraded){
        degraded=true;                       // estágio 1: baixa resolução e brilho
        renderer.setPixelRatio(Math.min(TIER.dpr,1));
        parts.forEach(p=>{ p.mat.clearcoat=0; p.mat.needsUpdate=true; });
        sparksEnabled=false;
      }else if(avg<40 && degraded){
        stage2=true;                          // estágio 2: modo lite global
        renderer.setPixelRatio(.75);
        ring.visible=false;
        fogMesh.visible=false;
        document.body.classList.add('lite');
        if(window.__ngLite) window.__ngLite();
      }
    }
  }

  hero3d = {
    renderer, resize,
    update(dt,t,audioLevel){
      const lerp=.065;
      S.mouse.x+=(S.target.x-S.mouse.x)*lerp;
      S.mouse.y+=(S.target.y-S.mouse.y)*lerp;
      ndc.set(S.target.x,S.target.y);

      if(holding&&!blasted){
        const p=Math.min((performance.now()-holdStart)/500,1);
        S.charge=p; chargeEl.style.opacity=p*.9;
        chargeC.style.strokeDashoffset=452*(1-p);
        if(p>=1) blast();
      }

      /* raycast em frames alternados — imperceptível, metade do custo */
      rayTick=!rayTick;
      if(rayTick){
        ray.setFromCamera(ndc,camera);
        const hit=ray.intersectObjects(meshes,false)[0];
        const nh=hit?hit.object:null;
        if(nh!==hovered){
          hovered=nh;
          if(hovered){ beep(740+Math.random()*280,.06,'sine',.04);
            const p=parts.find(p=>p.mesh===hovered); if(p) p.flash=1; }
        }
      }
      S.hover+=((hovered?1:0)-S.hover)*.09;

      const now=performance.now();
      if(hovered && now-lastSpark>36){
        lastSpark=now; hovered.getWorldPosition(tmp); emitSpark(tmp,1.3,.035);
        if(Math.random()>.72) beep(2100+Math.random()*900,.028,'square',.014);
      }

      for(const p of parts){
        p.flash*=.92;
        const heat=Math.max(p.flash,(hovered===p.mesh?1:0)*(.35+S.charge*.65));
        if(!degraded){
          p.mat.envMapIntensity=3.4+heat*1.9+S.charge*.9;
          p.mat.emissiveIntensity=heat*.22+S.charge*.14;
        }
        p.mat.color.copy(DARK).lerp(GREEN,heat*.18+S.explode*.12);
        const push=S.explode*2.6+S.charge*.1;
        const vib=S.vibrate*.05;
        p.mesh.position.set(
          p.base.x+p.dir.x*push+(Math.random()-.5)*vib,
          p.base.y+p.dir.y*push+(Math.random()-.5)*vib,
          p.base.z+S.explode*(p.index?1.1:-1.1));
        p.mesh.rotation.z=S.explode*.7*(p.index?1:-1);
        p.mesh.rotation.x=S.explode*.5;
      }

      if(ring.visible){
        ringMat.color.copy(DARK).lerp(GREEN,S.charge*.55+S.hover*.15);
        ringMat.envMapIntensity=3.2+S.charge*2.4;
        ring.rotation.z=t*.14;
        ring.scale.setScalar(1+S.explode*.55-S.charge*.06);
      }
      ember.scale.setScalar(.5+S.charge*1.6+S.explode*3.4);

      symbol.rotation.y+=((S.mouse.x*.3)-symbol.rotation.y)*.06;
      symbol.rotation.x+=((-S.mouse.y*.21)-symbol.rotation.x)*.06;
      symbol.rotation.z=Math.sin(t*.32)*.035;
      symbol.position.x+=((S.mouse.x*.3)-symbol.position.x)*.05;
      symbol.position.y+=((S.mouse.y*.2)-symbol.position.y)*.05;

      camera.position.x+=((S.mouse.x*.45)-camera.position.x)*.035;
      camera.position.y+=((S.mouse.y*.3)-camera.position.y)*.035;
      camera.lookAt(0,0,0);

      /* só sobe buffers para a GPU se houver faísca viva */
      let alive=0;
      for(let i=0;i<NSP;i++){
        if(sLife[i]<=0) continue;
        alive++;
        const i3=i*3;
        sPos[i3]+=sVel[i3]; sPos[i3+1]+=sVel[i3+1]; sPos[i3+2]+=sVel[i3+2];
        sVel[i3+1]-=.0016;
        sVel[i3]*=.985; sVel[i3+1]*=.985; sVel[i3+2]*=.985;
        sLife[i]=Math.max(0,sLife[i]-dt*1.35);
      }
      if(alive || sparksDirty){
        sparkGeo.attributes.position.needsUpdate=true;
        sparkGeo.attributes.aLife.needsUpdate=true;
      }
      sparksDirty = alive>0;
      sparks.visible = sparksEnabled && (alive>0 || S.hover>.02);

      fogU.uTime.value=t;
      fogU.uHover.value=S.hover*.6+S.charge*.5+S.explode*.8;
      fogU.uAudio.value=audioLevel;

      if(S.vibrate>.001){
        const v=S.vibrate*6; uiShaken=true;
        heroUI.style.transform=`translate(${(Math.random()-.5)*v}px,${(Math.random()-.5)*v}px)`;
        headerEl.style.transform=`translate(${(Math.random()-.5)*v*.6}px,0)`;
      }else if(uiShaken){ uiShaken=false; heroUI.style.transform=''; headerEl.style.transform=''; }

      checkPerf(dt);
      renderer.render(scene,camera);
    }
  };
}

/* =====================================================================
   12. WEBGL — footer fog (throttle 30fps, resolução baixa)
   ===================================================================== */
let foot=null;
function initFootFog(){
  if(foot || !window.THREE || !TIER.footFog) return;
  const THREE=window.THREE;
  const canvas=document.getElementById('footfog');
  const r=new THREE.WebGLRenderer({canvas,antialias:false,depth:false,stencil:false});
  r.setPixelRatio(1);
  const u={uTime:{value:0},uHover:{value:.25},uAudio:{value:0},
           uNoise:{value:noiseTexture(THREE)},
           uAccent:{value:new THREE.Color('#00c853')},uAspect:{value:1}};
  const sc=new THREE.Scene(), cam=new THREE.PerspectiveCamera(50,1,.1,10);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(2,2),
    new THREE.ShaderMaterial({uniforms:u,vertexShader:FOG_VERT,fragmentShader:FOG_FRAG,depthTest:false}));
  m.frustumCulled=false; sc.add(m);
  foot={r,u,sc,cam,
    size(){ const b=document.getElementById('contact').getBoundingClientRect();
            r.setSize(Math.round(b.width/2),Math.round(b.height/2),false);
            u.uAspect.value=b.width/Math.max(b.height,1); }};
  foot.size();
}
let footVisible=false;
ScrollTrigger.create({trigger:'#contact',start:'top bottom',end:'bottom top',
  onToggle(self){ footVisible=self.isActive; if(self.isActive){ initFootFog(); foot&&foot.size(); } }});

/* =====================================================================
   13. LOOP ÚNICO
   ===================================================================== */
/* gancho global do modo lite (chamado pelo monitor de FPS do hero) */
window.__ngLite = () => { orbit && orbit.lite(); };

let heroVisible=true, paused=false, last=performance.now(), t0=performance.now();
let audioLevel=0, footAcc=0, heroAcc=0;
ScrollTrigger.create({trigger:'#hero',start:'top bottom',end:'bottom top',
  onToggle(self){ heroVisible=self.isActive; }});
document.addEventListener('visibilitychange',()=>{ paused=document.hidden; last=performance.now(); if(!paused) orbit&&orbit.resumeAuto(); });

function tick(now){
  requestAnimationFrame(tick);
  if(paused) return;
  const dt=Math.min((now-last)/1000,.05); last=now;
  const t=(now-t0)/1000;

  if(FINE){
    cur.x+=(cur.tx-cur.x)*.18; cur.y+=(cur.ty-cur.y)*.18;
    cursor.style.transform=`translate3d(${cur.x}px,${cur.y}px,0) scale(${cur.s})`;
  }

  if(analyser){
    analyser.getByteFrequencyData(aData);
    let sum=0; for(let i=0;i<aData.length;i++) sum+=aData[i];
    audioLevel+=((sum/aData.length/255)-audioLevel)*.18;
  }

  /* Frame rate adaptativo no hero: 60fps enquanto há interação, 32fps quando
     a cena está só respirando. O fog é lento, ninguém percebe — e sobra GPU
     para a rolagem continuar lisa. */
  if(hero3d && heroVisible){
    heroAcc += dt;
    const idle = (now-lastPointer)>1100 && S.charge<.01 && S.explode<.01 && S.hover<.02
                 && Math.abs(S.target.x-S.mouse.x)<.004 && audioLevel<.02;
    if(!idle || heroAcc>=1/32){ hero3d.update(heroAcc,t,audioLevel); heroAcc=0; }
  }
  if(orbit) orbit.tick();

  if(foot && footVisible){
    footAcc+=dt;
    if(footAcc>1/30){ footAcc=0; foot.u.uTime.value=t; foot.u.uAudio.value=audioLevel; foot.r.render(foot.sc,foot.cam); }
  }
}
requestAnimationFrame(tick);

/* =====================================================================
   14. RESIZE (debounced)
   ===================================================================== */
let rid;
addEventListener('resize',()=>{
  clearTimeout(rid);
  rid=setTimeout(()=>{ hero3d&&hero3d.resize(); foot&&foot.size(); orbit&&orbit.resize(); ScrollTrigger.refresh(); },160);
},{passive:true});

/* =====================================================================
   15. CTA + âncoras
   ===================================================================== */
document.querySelector('.cta').addEventListener('click',()=>{
  audio(); beep(320,.18,'triangle',.07);
  document.getElementById('contact').scrollIntoView({behavior:'smooth'});
});
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click',e=>{
    const el=document.querySelector(a.getAttribute('href'));
    if(el){ e.preventDefault(); el.scrollIntoView({behavior:'smooth'}); }
  });
});
})();
