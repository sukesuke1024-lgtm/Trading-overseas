(()=>{
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
// nav
const nav=document.getElementById('nav');
addEventListener('scroll',()=>nav.classList.toggle('solid',scrollY>40),{passive:true});
// reveal
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.15});
document.querySelectorAll('.reveal').forEach((el,i)=>{el.style.transitionDelay=(i%4)*70+'ms';io.observe(el)});
// cursor glow + card spotlight
const glow=document.querySelector('.glow');
addEventListener('pointermove',e=>{glow.style.left=e.clientX+'px';glow.style.top=e.clientY+'px'},{passive:true});
document.querySelectorAll('.card').forEach(c=>c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect();c.style.setProperty('--mx',e.clientX-r.left+'px');c.style.setProperty('--my',e.clientY-r.top+'px')}));
// canvas helper
function setup(cv){const d=Math.min(devicePixelRatio||1,2);const fit=()=>{const r=cv.getBoundingClientRect();cv.width=r.width*d;cv.height=r.height*d;cv._w=r.width;cv._h=r.height};fit();addEventListener('resize',fit);const x=cv.getContext('2d');x.scale=x.scale;return{x,d}}
const A='94,240,200',B='106,140,255',C='255,122,184';
// ---- globe
const g=document.getElementById('globe'),G=setup(g);
const pts=[];for(let i=0;i<1800;i++){const y=1-2*(i+.5)/1800,r=Math.sqrt(1-y*y),t=Math.PI*(3-Math.sqrt(5))*i;pts.push([Math.cos(t)*r,y,Math.sin(t)*r])}
const cities=[[35.7,139.7],[1.35,103.8],[37.5,127],[25.2,55.3],[51.5,-0.1],[48.8,2.3],[40.7,-74],[34,-118],[22.3,114.2]].map(([la,lo])=>{la*=Math.PI/180;lo*=Math.PI/180;return[Math.cos(la)*Math.sin(lo),Math.sin(la),Math.cos(la)*Math.cos(lo)]});
let rot=-2.2;
function proj(p,rt,R,cx,cy){const c=Math.cos(rt),s=Math.sin(rt);const x=p[0]*c-p[2]*s,z=p[0]*s+p[2]*c;const tilt=.35,ct=Math.cos(tilt),st=Math.sin(tilt);const y=p[1]*ct-z*st,z2=p[1]*st+z*ct;return[cx+x*R,cy-y*R,z2]}
function drawGlobe(){
 const{x,d}=G,w=g._w*d,h=g._h*d,R=w*.4,cx=w/2,cy=h/2;x.clearRect(0,0,w,h);
 const gr=x.createRadialGradient(cx,cy,R*.6,cx,cy,R*1.25);gr.addColorStop(0,`rgba(${B},.12)`);gr.addColorStop(1,'transparent');x.fillStyle=gr;x.fillRect(0,0,w,h);
 for(const p of pts){const q=proj(p,rot,R,cx,cy);const a=q[2]>0?.3+q[2]*.7:.07;x.fillStyle=`rgba(${A},${a})`;x.fillRect(q[0],q[1],2.2*d,2.2*d)}
 const tk=proj(cities[0],rot,R,cx,cy);
 cities.forEach((c,i)=>{const q=proj(c,rot,R,cx,cy);if(q[2]<-.1)return;
  if(i){const m=[(cities[0][0]+c[0]),(cities[0][1]+c[1]),(cities[0][2]+c[2])];const l=Math.hypot(...m)||1;const k=1.28/l;const mp=proj([m[0]*k,m[1]*k,m[2]*k],rot,R,cx,cy);
   x.strokeStyle=`rgba(${B},${.25+.4*Math.max(q[2],0)})`;x.lineWidth=1.2*d;x.beginPath();x.moveTo(tk[0],tk[1]);x.quadraticCurveTo(mp[0],mp[1],q[0],q[1]);x.stroke();
   const t=((performance.now()/2600)+i*.17)%1,u=1-t;const px=u*u*tk[0]+2*u*t*mp[0]+t*t*q[0],py=u*u*tk[1]+2*u*t*mp[1]+t*t*q[1];x.fillStyle=`rgb(${C})`;x.beginPath();x.arc(px,py,2.4*d,0,7);x.fill()}
  const pl=(Math.sin(performance.now()/500+i)+1)/2;x.fillStyle=`rgba(${A},${.25*pl})`;x.beginPath();x.arc(q[0],q[1],(5+pl*8)*d,0,7);x.fill();x.fillStyle=`rgb(${A})`;x.beginPath();x.arc(q[0],q[1],3*d,0,7);x.fill()});
}
// ---- routes (flat map)
const rc=document.getElementById('routes'),RC=setup(rc);
const flat=[[.88,.4],[.78,.52],[.82,.43],[.62,.5],[.49,.33],[.5,.37],[.2,.38],[.1,.4],[.8,.48],[.74,.62],[.52,.7]];
const dots=[];for(let i=0;i<1400;i++){const px=Math.random(),py=Math.random();const land=(px>.05&&px<.32&&py>.15&&py<.6)||(px>.44&&px<.62&&py>.2&&py<.75)||(px>.55&&px<.95&&py>.18&&py<.55)||(px>.78&&px<.9&&py>.62&&py<.78);if(land)dots.push([px,py])}
function drawRoutes(){
 const{x,d}=RC,w=rc._w*d,h=rc._h*d;x.clearRect(0,0,w,h);
 x.fillStyle=`rgba(${A},.22)`;for(const p of dots)x.fillRect(p[0]*w,p[1]*h,1.6*d,1.6*d);
 const o=flat[0],ox=o[0]*w,oy=o[1]*h,now=performance.now();
 flat.forEach((f,i)=>{const fx=f[0]*w,fy=f[1]*h;
  if(i){const mx=(ox+fx)/2,my=Math.min(oy,fy)-Math.abs(ox-fx)*.28;x.strokeStyle=`rgba(${B},.5)`;x.lineWidth=1.2*d;x.beginPath();x.moveTo(ox,oy);x.quadraticCurveTo(mx,my,fx,fy);x.stroke();
   const t=((now/3000)+i*.13)%1,u=1-t;x.fillStyle=`rgb(${C})`;x.beginPath();x.arc(u*u*ox+2*u*t*mx+t*t*fx,u*u*oy+2*u*t*my+t*t*fy,2.6*d,0,7);x.fill()}
  const pl=(Math.sin(now/600+i)+1)/2;x.fillStyle=`rgba(${A},${.3*pl})`;x.beginPath();x.arc(fx,fy,(5+pl*9)*d,0,7);x.fill();x.fillStyle=`rgb(${i?A:'255,255,255'})`;x.beginPath();x.arc(fx,fy,(i?3:5)*d,0,7);x.fill()});
}
let vis=new Set();new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting?vis.add(e.target):vis.delete(e.target))).observe(g);
const io2=new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting?vis.add(e.target):vis.delete(e.target)));io2.observe(g);io2.observe(rc);
(function loop(){if(vis.has(g)){if(!reduce)rot+=.0035;drawGlobe()}if(vis.has(rc))drawRoutes();requestAnimationFrame(loop)})();
})();
