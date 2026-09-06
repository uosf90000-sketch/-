export type WallLike={id?:string;entityId?:number;x1:number;y1:number;x2:number;y2:number;thickness?:number|null};
export type Point2={x:number;y:number};
export type InferredRoom={id:string;polygon:Point2[];areaM2:number;center:Point2};

function cross(ax:number,ay:number,bx:number,by:number){return ax*by-ay*bx}
function signedArea(p:Point2[]){
  let s=0;
  for(let i=0,j=p.length-1;i<p.length;j=i++) s+=p[j].x*p[i].y-p[i].x*p[j].y;
  return s/2;
}
function centroid(p:Point2[]){
  const a=signedArea(p);
  if(Math.abs(a)<1e-9)return {x:p.reduce((s,q)=>s+q.x,0)/p.length,y:p.reduce((s,q)=>s+q.y,0)/p.length};
  let cx=0,cy=0;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const k=p[j].x*p[i].y-p[i].x*p[j].y;
    cx+=(p[j].x+p[i].x)*k;cy+=(p[j].y+p[i].y)*k;
  }
  return {x:cx/(6*a),y:cy/(6*a)};
}
function projection(p:Point2,a:Point2,b:Point2){
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  if(l2<1e-12)return {t:0,x:a.x,y:a.y,d:Math.hypot(p.x-a.x,p.y-a.y)};
  const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2;
  const x=a.x+t*dx,y=a.y+t*dy;
  return {t,x,y,d:Math.hypot(p.x-x,p.y-y)};
}
function intersect(a1:Point2,a2:Point2,b1:Point2,b2:Point2){
  const rx=a2.x-a1.x,ry=a2.y-a1.y,sx=b2.x-b1.x,sy=b2.y-b1.y;
  const den=cross(rx,ry,sx,sy);
  if(Math.abs(den)<1e-10)return null;
  const qx=b1.x-a1.x,qy=b1.y-a1.y;
  const ta=cross(qx,qy,sx,sy)/den,tb=cross(qx,qy,rx,ry)/den;
  return {ta,tb,x:a1.x+ta*rx,y:a1.y+ta*ry};
}
function median(values:number[]){
  if(!values.length)return 0.15;
  const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
}

export function inferRoomsFromWalls(input:WallLike[],minAreaM2=1.2):InferredRoom[]{
  const walls=input.filter(w=>Number.isFinite(w.x1)&&Number.isFinite(w.y1)&&Number.isFinite(w.x2)&&Number.isFinite(w.y2)&&Math.hypot(w.x2-w.x1,w.y2-w.y1)>.08);
  if(walls.length<3)return [];
  const med=median(walls.map(w=>Number(w.thickness)||0).filter(v=>v>0));
  const tol=Math.max(.025,Math.min(.22,med*1.25));
  const cuts=walls.map(()=>[0,1]);

  for(let i=0;i<walls.length;i++){
    const a1={x:walls[i].x1,y:walls[i].y1},a2={x:walls[i].x2,y:walls[i].y2};
    const lenA=Math.hypot(a2.x-a1.x,a2.y-a1.y);
    for(let j=i+1;j<walls.length;j++){
      const b1={x:walls[j].x1,y:walls[j].y1},b2={x:walls[j].x2,y:walls[j].y2};
      const lenB=Math.hypot(b2.x-b1.x,b2.y-b1.y);
      const hit=intersect(a1,a2,b1,b2);
      if(hit&&hit.ta>=-tol/lenA&&hit.ta<=1+tol/lenA&&hit.tb>=-tol/lenB&&hit.tb<=1+tol/lenB){
        cuts[i].push(Math.max(0,Math.min(1,hit.ta)));
        cuts[j].push(Math.max(0,Math.min(1,hit.tb)));
      }
    }
  }

  for(let i=0;i<walls.length;i++){
    for(const p of [{x:walls[i].x1,y:walls[i].y1},{x:walls[i].x2,y:walls[i].y2}]){
      for(let j=0;j<walls.length;j++){
        if(i===j)continue;
        const a={x:walls[j].x1,y:walls[j].y1},b={x:walls[j].x2,y:walls[j].y2};
        const pr=projection(p,a,b);
        if(pr.t>0&&pr.t<1&&pr.d<=tol)cuts[j].push(pr.t);
      }
    }
  }

  const raw:Point2[]=[];
  const segs:{a:number;b:number}[]=[];
  function addPoint(p:Point2){
    for(let i=0;i<raw.length;i++)if(Math.hypot(raw[i].x-p.x,raw[i].y-p.y)<=tol)return i;
    raw.push(p);return raw.length-1;
  }
  for(let i=0;i<walls.length;i++){
    const w=walls[i],ts=[...new Set(cuts[i].map(t=>Math.round(t*1e8)/1e8))].sort((a,b)=>a-b);
    for(let k=0;k<ts.length-1;k++){
      const ta=ts[k],tb=ts[k+1]; if(tb-ta<1e-7)continue;
      const pa={x:w.x1+(w.x2-w.x1)*ta,y:w.y1+(w.y2-w.y1)*ta};
      const pb={x:w.x1+(w.x2-w.x1)*tb,y:w.y1+(w.y2-w.y1)*tb};
      const a=addPoint(pa),b=addPoint(pb); if(a!==b)segs.push({a,b});
    }
  }

  const edgeSet=new Set<string>(),adj=new Map<number,number[]>();
  for(const s of segs){
    const lo=Math.min(s.a,s.b),hi=Math.max(s.a,s.b),key=`${lo}:${hi}`;
    if(edgeSet.has(key))continue; edgeSet.add(key);
    if(!adj.has(s.a))adj.set(s.a,[]);if(!adj.has(s.b))adj.set(s.b,[]);
    adj.get(s.a)!.push(s.b);adj.get(s.b)!.push(s.a);
  }
  for(const [u,ns] of adj)ns.sort((a,b)=>Math.atan2(raw[a].y-raw[u].y,raw[a].x-raw[u].x)-Math.atan2(raw[b].y-raw[u].y,raw[b].x-raw[u].x));

  const used=new Set<string>(),faces:Point2[][]=[];
  const maxSteps=Math.max(50,edgeSet.size*3);
  for(const [u,ns] of adj){
    for(const v of ns){
      const start=`${u}>${v}`;if(used.has(start))continue;
      let a=u,b=v;const poly:Point2[]=[];let closed=false;
      for(let step=0;step<maxSteps;step++){
        const key=`${a}>${b}`;if(used.has(key)&&step>0)break;
        used.add(key);poly.push(raw[a]);
        const nexts=adj.get(b)||[];const idx=nexts.indexOf(a);if(idx<0||nexts.length<2)break;
        const c=nexts[(idx-1+nexts.length)%nexts.length];
        a=b;b=c;
        if(a===u&&b===v){closed=true;break}
      }
      if(closed&&poly.length>=3)faces.push(poly);
    }
  }

  const positive=faces.map(p=>({p,a:signedArea(p)})).filter(x=>x.a>minAreaM2);
  if(!positive.length)return [];
  const unique:InferredRoom[]=[];
  for(const f of positive){
    const c=centroid(f.p),area=Math.abs(f.a);
    if(unique.some(r=>Math.hypot(r.center.x-c.x,r.center.y-c.y)<tol&&Math.abs(r.areaM2-area)<.05))continue;
    unique.push({id:`space-${unique.length+1}`,polygon:f.p,areaM2:area,center:c});
  }
  return unique.sort((a,b)=>b.areaM2-a.areaM2);
}
