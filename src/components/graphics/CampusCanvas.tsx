'use client';

import { useEffect, useRef } from 'react';
import { siteContent } from '@/data/siteContent';

function StatementText({text}:{text:string}) {
  return <span>{text.split(/(\S+-\S+)/).map((part,i)=>part.includes('-')?<span key={i} style={{whiteSpace:'nowrap'}}>{part}</span>:part)}</span>;
}

type Props = { mode: 'journey' | 'room'; selected?: number; onSelect?: (index:number)=>void };
export function CampusCanvas({ mode, selected=0, onSelect }:Props) {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const selectCallback=useRef(onSelect);
  useEffect(()=>{selectCallback.current=onSelect;canvasRef.current?.dispatchEvent(new Event('campus-selection'));},[selected,onSelect]);
  useEffect(()=>{
    const canvas=canvasRef.current!;const host=canvas.parentElement!;const journey=canvas.closest<HTMLElement>('.ecosystem-scene');
    let alive=true;let frame=0;let view:ReturnType<typeof import('@/lib/three/campus')['createCampusView']>|undefined;
    const render=()=>{
      frame=0;
      const answer=document.getElementById('audience-answer');
      host.closest<HTMLElement>('.wec-site')?.style.setProperty('--classroom-copy-bottom',`${(answer?.offsetHeight||104)+30}px`);
      if(!view)return;
      const reading=journey?.closest<HTMLElement>('.wec-site')?.dataset.motion==='reduced'||innerHeight<640;
      const progress=journey?(reading ? .64 : Number(journey.dataset.progress||0)):0;
      view.resize(host.clientWidth,host.clientHeight);
      view.render(progress);
      const labelProgress=mode==='room'?1:reading?0:Math.max(0,Math.min(1,(progress-.92)/.06));
      const labelOpacity=labelProgress*labelProgress*(3-2*labelProgress);
      host.style.setProperty('--seat-label-opacity',String(labelOpacity));
      const classroom=labelOpacity>0;
      host.dataset.classroom=String(classroom);
      const caption=journey?.querySelector<HTMLElement>('.journey-classroom-caption');
      if(caption){const reveal=reading?0:Math.max(0,Math.min(1,(progress-.84)/.06));caption.style.opacity=String(reveal);caption.style.visibility=reveal>0?'visible':'hidden';}
      if(classroom&&canvas.dataset.seats){
        const points=JSON.parse(canvas.dataset.seats) as {x:number;y:number}[];
        const heads=JSON.parse(canvas.dataset.pickPoints!) as {x:number;y:number}[];
        host.querySelectorAll<HTMLElement>('.campus-person').forEach((button,i)=>{
          const half=button.offsetWidth/2;
          const gutter=host.clientWidth<760?2:8;
          const offset=host.clientWidth<760?0:[20,140,160,-80,-250,-110][i]*host.clientWidth/1440;
          const center=host.clientWidth<760?(i===3||i===4||i===5?half+gutter:host.clientWidth-half-gutter):points[i].x+offset;
          const x=Math.max(half+gutter,Math.min(host.clientWidth-half-gutter,center));
          let bottom=Math.max(button.offsetHeight+8,Math.min(host.clientHeight-155,points[i].y-8,heads[i].y-22));
          if(host.clientWidth<760){
            const previous=[1,2,-1,-1,3,4][i];
            if(previous>=0)bottom=Math.min(heads[i].y-4,Math.max(bottom,heads[previous].y+8+button.offsetHeight));
          }
          button.style.left=`${x}px`;button.style.top=`${bottom}px`;
          const line=host.querySelector(`[data-seat-line="${i}"]`);
          if(line){line.setAttribute('x1',String(x));line.setAttribute('y1',String(bottom));line.setAttribute('x2',String(points[i].x));line.setAttribute('y2',String(points[i].y));}
        });
      }
    };
    const requestRender=()=>{if(!frame)frame=requestAnimationFrame(render);};
    const resize=new ResizeObserver(requestRender);resize.observe(host);
    host.querySelectorAll('.campus-person').forEach(button=>resize.observe(button));
    const answer=document.getElementById('audience-answer');if(answer)resize.observe(answer);
    const mutations=new MutationObserver(requestRender);
    if(journey){mutations.observe(journey,{attributes:true,attributeFilter:['data-progress']});const root=journey.closest('.wec-site');if(root)mutations.observe(root,{attributes:true,attributeFilter:['data-motion']});}
    const pick=(event:MouseEvent)=>{
      if(!view||(mode==='journey'&&Number(journey?.dataset.progress||0)<.94))return;
      const rect=canvas.getBoundingClientRect();const index=view.pick((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
      if(index>=0){if(mode==='journey')document.querySelector<HTMLButtonElement>(`.circle-person-${index}`)?.click();else selectCallback.current?.(index);}
    };
    const onLost=(event:Event)=>{event.preventDefault();delete host.dataset.ready;};
    const onRestored=()=>{host.dataset.ready='true';requestRender();};
    canvas.addEventListener('click',pick);canvas.addEventListener('campus-selection',requestRender);canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);
    const observer=new IntersectionObserver(entries=>{if(!entries.some(entry=>entry.isIntersecting))return;observer.disconnect();
      Promise.all([import('@/lib/three/campus'),Promise.all([document.fonts.load('600 32px "Caveat"'),document.fonts.load('600 32px "Space Grotesk Variable"')]).catch(()=>[])]).then(([{createCampusView}])=>{if(!alive)return;try{view=createCampusView(canvas,mode);host.dataset.ready='true';render();}catch{delete host.dataset.ready;host.dataset.fallback='true';}}).catch(()=>{if(alive)host.dataset.fallback='true';});
    },{rootMargin:'800px'});observer.observe(host);
    return()=>{alive=false;cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();mutations.disconnect();canvas.removeEventListener('click',pick);canvas.removeEventListener('campus-selection',requestRender);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);view?.dispose();};
  },[mode]);
  return <div className={`campus-render campus-render-${mode}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="campus-fallback" src={`/images/${mode==='room'?'classroom':'campus'}-fallback.png`} alt={mode==='room'?'Six people around an oak table in a bright studio with sage furnishings and subtle purple accents.':'A winding garden path leads through soft sage trees to the pale-glass Morrissette Institute.'} />
    <canvas ref={canvasRef} aria-hidden="true" />
    <svg className="campus-label-leaders" aria-hidden="true">{siteContent.audience.statements.map((_,i)=><line key={i} data-seat-line={i}/>)}</svg>
    {mode==='room'?<div className="campus-seat-labels circle-people" role="group" aria-label="Find your starting point">{siteContent.audience.statements.map((statement,i)=><button key={statement.quote} className={`campus-person circle-person circle-person-${i}`} onClick={()=>onSelect?.(i)} aria-pressed={selected===i} aria-controls="audience-answer"><StatementText text={statement.quote}/></button>)}</div>:<div className="campus-seat-labels journey-people" aria-hidden="true">{siteContent.audience.statements.map((statement,i)=><span className="campus-person journey-person" key={statement.quote} onClick={()=>document.querySelector<HTMLButtonElement>(`.circle-person-${i}`)?.click()}><StatementText text={statement.quote}/></span>)}</div>}
  </div>;
}
