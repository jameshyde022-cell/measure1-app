'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const PRESET_MEASUREMENTS = [
  'Waist','Outseam','Inseam','Rise','Thigh','Knee','Leg Opening',
  'Chest','Shoulder','Sleeve','Back Length','Hem','Bust','Hip','Armhole','Neck','Cuff',
];

const LINE_COLORS = [
  '#4FC3F7','#81C784','#FFB74D','#F06292','#CE93D8',
  '#4DB6AC','#FFF176','#FF8A65','#90CAF9','#A5D6A7',
  '#FFCC02','#EF9A9A','#80DEEA','#BCAAA4','#80CBC4','#FFAB91',
];

function mid(a, b) { return { x: (a.x+b.x)/2, y: (a.y+b.y)/2 }; }

function drawEndDot(ctx, pt, color, r=4) {
  ctx.beginPath(); ctx.arc(pt.x,pt.y,r,0,Math.PI*2);
  ctx.fillStyle=color; ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1; ctx.stroke();
}

function drawNumberTag(ctx, num, x, y, color) {
  const label = String(num);
  ctx.font = 'bold 10px monospace';
  const tw = ctx.measureText(label).width;
  const r = Math.max(9, tw/2+4);
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fillStyle='rgba(8,8,8,0.82)'; ctx.fill();
  ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle=color; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(label,x,y);
}

function drawPendingCrosshair(ctx, pt) {
  const g=2, size=11;
  const segs=[[pt.x-size,pt.y,pt.x-g,pt.y],[pt.x+g,pt.y,pt.x+size,pt.y],[pt.x,pt.y-size,pt.x,pt.y-g],[pt.x,pt.y+g,pt.x,pt.y+size]];
  ctx.strokeStyle='rgba(0,0,0,0.7)'; ctx.lineWidth=3;
  segs.forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();});
  ctx.strokeStyle='#e8b84b'; ctx.lineWidth=2;
  segs.forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();});
  ctx.beginPath();ctx.arc(pt.x,pt.y,2,0,Math.PI*2);ctx.fillStyle='#e8b84b';ctx.fill();
}

function renderCanvas(canvas, img, lines, pendingPoint, hoverIdx) {
  if (!canvas||!img) return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  lines.forEach((line,i)=>{
    const isH=hoverIdx===i;
    const {p1,p2,color}=line;
    ctx.save(); ctx.globalAlpha=isH?1:0.85;
    ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y);
    ctx.strokeStyle=color; ctx.lineWidth=isH?2:1.5; ctx.stroke();
    drawEndDot(ctx,p1,color,isH?5:3.5);
    drawEndDot(ctx,p2,color,isH?5:3.5);
    const m=mid(p1,p2);
    drawNumberTag(ctx,i+1,m.x,m.y,color);
    ctx.restore();
  });
  if (pendingPoint) {
    ctx.save(); drawPendingCrosshair(ctx,pendingPoint); ctx.restore();
  }
}

function renderExportImage(canvas, img, lines) {
  if (!canvas||!img) return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  lines.forEach(line=>{
    const {p1,p2,color}=line;
    ctx.save(); ctx.globalAlpha=0.9;
    ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y);
    ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.stroke();
    drawEndDot(ctx,p1,color,3);
    drawEndDot(ctx,p2,color,3);
    ctx.restore();
  });
}

export default function MeasureTool() {
  const [phase,setPhase]           = useState('upload');
  const [naturalSize,setNatural]   = useState({w:1,h:1});
  const [lines,setLines]           = useState([]);
  const [pending,setPending]       = useState(null);
  const [hoverIdx,setHoverIdx]     = useState(null);
  const [dragging,setDragging]     = useState(false);
  const [colorIdx,setColorIdx]     = useState(0);
  const [curName,setCurName]       = useState('Waist');
  const [useCustom,setUseCustom]   = useState(false);
  const [customName,setCustom]     = useState('');
  const [curValue,setCurValue]     = useState('');
  const [curUnit,setCurUnit]       = useState('"');
  const [brand,setBrand]           = useState('');
  const [itemName,setItemName]     = useState('');
  const [notes,setNotes]           = useState('');
  const [showExport,setShowExport] = useState(false);
  const [bgRemoving,setBgRemoving] = useState(false);
  const [bgError,setBgError]       = useState(null);

  const canvasRef        = useRef(null);
  const exportRef        = useRef(null);
  const imgRef           = useRef(null);
  const fileRef          = useRef(null);
  const exportSectionRef = useRef(null);

  const activeName = useCustom?(customName||'Measurement'):curName;

  const redraw = useCallback(()=>{
    renderCanvas(canvasRef.current,imgRef.current,lines,pending,hoverIdx);
  },[lines,pending,hoverIdx]);

  useEffect(()=>{ redraw(); },[redraw]);

  useEffect(()=>{
    if (phase!=='annotate'||!canvasRef.current||!imgRef.current) return;
    const container=canvasRef.current.parentElement;
    const maxW=container.clientWidth-2, maxH=window.innerHeight-160;
    const {w,h}=naturalSize;
    const scale=Math.min(1,maxW/w,maxH/h);
    canvasRef.current.width=Math.floor(w*scale);
    canvasRef.current.height=Math.floor(h*scale);
    redraw();
  },[phase,naturalSize]);

  const loadImageFromBlob = (blob) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNatural({w:img.naturalWidth, h:img.naturalHeight});
      setBgRemoving(false);
      setPhase('annotate');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleFile = useCallback(async (file)=>{
    if (!file||!file.type.startsWith('image/')) return;
    setLines([]); setPending(null); setColorIdx(0); setShowExport(false); setBgError(null);
    setBgRemoving(true);

    // Call our Next.js API route which proxies PhotoRoom server-side (no CORS issues)
    try {
      const formData = new FormData();
      formData.append('image_file', file);
      const res = await fetch('/api/remove-bg', { method: 'POST', body: formData });
      if (res.ok) {
        const blob = await res.blob();
        loadImageFromBlob(blob);
        return;
      } else {
        const err = await res.json().catch(()=>({}));
        setBgError(err.error || 'Background removal unavailable. Using original photo.');
      }
    } catch(e) {
      setBgError('Background removal unavailable. Using original photo.');
    }

    // Fallback: load original file
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        setNatural({w:img.naturalWidth, h:img.naturalHeight});
        setBgRemoving(false);
        setPhase('annotate');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },[]);

  const handleClick = e => {
    const c=canvasRef.current;
    const r=c.getBoundingClientRect();
    const pt={x:(e.clientX-r.left)*(c.width/r.width), y:(e.clientY-r.top)*(c.height/r.height)};
    if (!pending) {
      setPending(pt);
    } else {
      const color=LINE_COLORS[colorIdx%LINE_COLORS.length];
      setLines(prev=>[...prev,{name:activeName,value:curValue,unit:curUnit,p1:pending,p2:pt,color}]);
      setPending(null); setColorIdx(c=>c+1); setCurValue('');
      if (!useCustom) {
        const idx=PRESET_MEASUREMENTS.indexOf(curName);
        if (idx>=0&&idx<PRESET_MEASUREMENTS.length-1) setCurName(PRESET_MEASUREMENTS[idx+1]);
      }
    }
  };

  const handleMove = e => {
    const c=canvasRef.current; if(!c) return;
    const r=c.getBoundingClientRect();
    const mx=(e.clientX-r.left)*(c.width/r.width), my=(e.clientY-r.top)*(c.height/r.height);
    let closest=null,minD=16;
    lines.forEach((l,i)=>{
      const dx=l.p2.x-l.p1.x,dy=l.p2.y-l.p1.y,lenSq=dx*dx+dy*dy; if(!lenSq) return;
      const t=Math.max(0,Math.min(1,((mx-l.p1.x)*dx+(my-l.p1.y)*dy)/lenSq));
      const d=Math.hypot(l.p1.x+t*dx-mx,l.p1.y+t*dy-my);
      if(d<minD){minD=d;closest=i;}
    });
    setHoverIdx(closest);
  };

  const updLine=(i,f,v)=>setLines(prev=>prev.map((l,idx)=>idx===i?{...l,[f]:v}:l));
  const delLine=i=>setLines(prev=>prev.filter((_,idx)=>idx!==i));
  const undo=()=>{ if(pending){setPending(null);return;} setLines(p=>p.slice(0,-1)); setColorIdx(c=>Math.max(0,c-1)); };

  const handleExport = () => {
    const src=canvasRef.current; if(!src||!imgRef.current) return;
    const W=src.width;
    const ROW_H=36, COLS=2, PAD=20;
    const rows=Math.ceil(lines.length/COLS);
    const tableH=lines.length>0?rows*ROW_H+48:0;
    const infoH=(brand||itemName||notes)?68:0;
    const ec=document.createElement('canvas');
    ec.width=W; ec.height=src.height+tableH+infoH;
    const ctx=ec.getContext('2d');
    const imgCanvas=document.createElement('canvas');
    imgCanvas.width=W; imgCanvas.height=src.height;
    renderExportImage(imgCanvas,imgRef.current,lines);
    ctx.drawImage(imgCanvas,0,0);
    if (lines.length>0) {
      const tableY=src.height;
      ctx.fillStyle='#f8f6f0'; ctx.fillRect(0,tableY,W,tableH);
      ctx.fillStyle='#e0ddd6'; ctx.fillRect(0,tableY,W,1);
      ctx.font='bold 11px monospace'; ctx.fillStyle='#888';
      ctx.textBaseline='middle'; ctx.textAlign='left';
      ctx.fillText('MEASUREMENTS',PAD,tableY+14);
      ctx.fillStyle='#e0ddd6'; ctx.fillRect(0,tableY+26,W,1);
      const colW=(W-PAD*2)/COLS;
      lines.forEach((line,i)=>{
        const col=i%COLS, row=Math.floor(i/COLS);
        const x=PAD+col*colW, y=tableY+28+row*ROW_H+ROW_H/2;
        ctx.beginPath(); ctx.arc(x+8,y,5,0,Math.PI*2);
        ctx.fillStyle=line.color; ctx.fill();
        ctx.font='bold 10px monospace'; ctx.fillStyle='#888'; ctx.textAlign='left';
        ctx.fillText(`${i+1}.`,x+18,y);
        ctx.font='11px monospace'; ctx.fillStyle='#333';
        ctx.fillText(line.name,x+34,y);
        if (line.value) {
          ctx.font='bold 13px monospace'; ctx.fillStyle='#1a1a1a'; ctx.textAlign='right';
          ctx.fillText(`${line.value}${line.unit}`,x+colW-8,y);
        }
        if (col===COLS-1||i===lines.length-1) {
          ctx.fillStyle='#ece9e2'; ctx.fillRect(PAD,tableY+28+(row+1)*ROW_H-1,W-PAD*2,1);
        }
      });
    }
    if (infoH>0) {
      const iy=src.height+tableH;
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(0,iy,W,infoH);
      ctx.fillStyle='#333'; ctx.fillRect(0,iy,W,1);
      ctx.textBaseline='top'; ctx.textAlign='left'; let ty=iy+12;
      if(brand){ctx.font='bold 13px monospace';ctx.fillStyle='#f0ebe0';ctx.fillText(`Brand: ${brand}`,PAD,ty);ty+=18;}
      if(itemName){ctx.font='bold 13px monospace';ctx.fillStyle='#f0ebe0';ctx.fillText(`Item: ${itemName}`,PAD,ty);ty+=18;}
      if(notes){ctx.font='11px monospace';ctx.fillStyle='#888';ctx.fillText(`Notes: ${notes}`,PAD,ty);}
      ctx.font='9px monospace'; ctx.fillStyle='#444'; ctx.textAlign='right';
      ctx.fillText('MEASURE · Garment Annotation Tool',W-PAD,iy+infoH-12);
    }
    const el=exportRef.current;
    el.width=ec.width; el.height=ec.height;
    el.getContext('2d').drawImage(ec,0,0);
    setShowExport(true);
    setTimeout(()=>exportSectionRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),150);
  };

  const S = {
    lbl:{fontFamily:'monospace',fontSize:9,letterSpacing:'0.18em',textTransform:'uppercase',color:'#555',marginBottom:5,display:'block'},
    inp:{fontFamily:'monospace',fontSize:12,padding:'7px 10px',border:'1px solid #2a2a2a',borderRadius:2,background:'#080808',color:'#f0ebe0',width:'100%'},
    ghost:{padding:'6px 10px',background:'transparent',border:'1px solid #1e1e1e',fontFamily:'monospace',fontSize:9,letterSpacing:'0.12em',textTransform:'uppercase',color:'#555',cursor:'pointer',borderRadius:2},
  };

  const instr=!pending
    ?{text:`Click START of "${activeName}"`,color:'#4FC3F7'}
    :{text:`Click END of "${activeName}"`,color:'#81C784'};

  return (
    <div style={{background:'#0d0d0d',minHeight:'100vh',color:'#f0ebe0',display:'flex',flexDirection:'column',fontFamily:'monospace'}}>

      {/* Header */}
      <div style={{borderBottom:'1px solid #1a1a1a',padding:'12px 24px',display:'flex',alignItems:'center',gap:14}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700}}>
          MEAS<span style={{color:'#e8b84b'}}>UR</span>E
        </div>
        <div style={{width:1,height:14,background:'#2a2a2a'}}/>
        <div style={{fontSize:9,color:'#444',letterSpacing:'0.18em',textTransform:'uppercase'}}>Garment Annotation Tool</div>
        {phase==='annotate'&&lines.length>0&&(
          <div style={{marginLeft:'auto',display:'flex',gap:8}}>
            <button onClick={handleExport} style={{padding:'6px 16px',background:'#e8b84b',border:'none',fontFamily:'monospace',fontSize:9,letterSpacing:'0.15em',textTransform:'uppercase',cursor:'pointer',borderRadius:2,color:'#0d0d0d'}}>
              Generate Sheet
            </button>
            <button onClick={()=>fileRef.current.click()} style={S.ghost}>New Photo</button>
          </div>
        )}
      </div>

      {/* UPLOAD */}
      {phase==='upload'&&(
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:40}}>
          <div style={{maxWidth:460,width:'100%',display:'flex',flexDirection:'column',gap:24}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,lineHeight:1.2,marginBottom:10}}>
                Your measurements.<br/><span style={{color:'#e8b84b'}}>Beautifully annotated.</span>
              </div>
              <p style={{fontSize:11,color:'#555',lineHeight:1.8}}>
                Upload a garment photo. Click two points for each measurement.<br/>
                Enter the value. Generate a professional spec sheet.
              </p>
            </div>
            <div
              onClick={()=>fileRef.current.click()}
              onDragOver={e=>{e.preventDefault();setDragging(true);}}
              onDragLeave={()=>setDragging(false)}
              onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}}
              style={{border:`2px dashed ${dragging?'#e8b84b':'#222'}`,borderRadius:4,padding:'52px 40px',textAlign:'center',cursor:'pointer',transition:'border-color 0.2s'}}
            >
              <div style={{fontSize:36,marginBottom:12}}>📷</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:5}}>Drop your flat-lay photo here</div>
              <div style={{fontSize:9,color:'#444',letterSpacing:'0.15em'}}>OR CLICK TO BROWSE · JPG PNG WEBP</div>
            </div>
            <div style={{background:'#111',border:'1px solid #1a1a1a',borderRadius:2,padding:'14px 16px'}}>
              <div style={{fontSize:9,color:'#e8b84b',letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:8}}>Tip</div>
              <p style={{fontSize:10,color:'#555',lineHeight:1.7}}>
                For the cleanest results, use PhotoRoom or similar to remove the background before uploading.
                A garment on white makes measurement lines and the spec sheet much clearer.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ANNOTATE */}
      {phase==='annotate'&&(
        <div style={{flex:1,display:'flex',flexDirection:'column'}}>
          <div style={{display:'grid',gridTemplateColumns:'268px 1fr',flex:1,minHeight:0,overflow:'hidden'}}>

            {/* LEFT */}
            <div style={{borderRight:'1px solid #1a1a1a',padding:'16px',display:'flex',flexDirection:'column',gap:14,overflowY:'auto'}}>

              <div style={{background:'#080808',border:'1px solid #1e1e1e',borderRadius:2,padding:'13px'}}>
                <span style={{...S.lbl,color:'#4FC3F7',marginBottom:10}}>Add Measurement</span>
                <div style={{background:`${instr.color}11`,border:`1px solid ${instr.color}33`,borderRadius:2,padding:'8px 10px',marginBottom:12}}>
                  <div style={{fontSize:10,color:instr.color,fontWeight:'bold'}}>{instr.text}</div>
                </div>
                <div style={{marginBottom:8}}>
                  <label style={S.lbl}>Name</label>
                  <select value={useCustom?'__custom__':curName} onChange={e=>{if(e.target.value==='__custom__')setUseCustom(true);else{setUseCustom(false);setCurName(e.target.value);}}} style={S.inp}>
                    {PRESET_MEASUREMENTS.map(m=><option key={m} value={m}>{m}</option>)}
                    <option value='__custom__'>Custom…</option>
                  </select>
                </div>
                {useCustom&&<div style={{marginBottom:8}}><label style={S.lbl}>Custom Name</label><input type='text' placeholder='e.g. Crotch depth' value={customName} onChange={e=>setCustom(e.target.value)} style={S.inp}/></div>}
                <div style={{display:'flex',gap:6}}>
                  <div style={{flex:1}}><label style={S.lbl}>Value (optional)</label><input type='text' placeholder='e.g. 16.5' value={curValue} onChange={e=>setCurValue(e.target.value)} style={S.inp}/></div>
                  <div style={{width:58}}><label style={S.lbl}>Unit</label><select value={curUnit} onChange={e=>setCurUnit(e.target.value)} style={S.inp}><option value='"'>in</option><option value='cm'>cm</option></select></div>
                </div>
              </div>

              <div style={{display:'flex',gap:6}}>
                <button onClick={undo} style={{...S.ghost,flex:1}}>← Undo</button>
                <button onClick={()=>{setLines([]);setPending(null);setColorIdx(0);setShowExport(false);}} style={{...S.ghost,flex:1}}>Clear</button>
              </div>

              {lines.length>0&&(
                <div style={{borderTop:'1px solid #1a1a1a',paddingTop:12}}>
                  <span style={S.lbl}>Lines ({lines.length})</span>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    {lines.map((line,i)=>(
                      <div key={i} onMouseEnter={()=>setHoverIdx(i)} onMouseLeave={()=>setHoverIdx(null)}
                        style={{background:hoverIdx===i?'#111':'#080808',border:`1px solid ${hoverIdx===i?line.color+'44':'#1a1a1a'}`,borderLeft:`3px solid ${line.color}`,borderRadius:2,padding:'7px 9px',transition:'all 0.1s'}}>
                        <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:4}}>
                          <div style={{width:16,height:16,borderRadius:'50%',background:'rgba(8,8,8,0.85)',border:`1.5px solid ${line.color}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <span style={{fontFamily:'monospace',fontSize:8,color:line.color,fontWeight:'bold'}}>{i+1}</span>
                          </div>
                          <input type='text' value={line.name} onChange={e=>updLine(i,'name',e.target.value)} style={{...S.inp,flex:1,fontSize:10,padding:'2px 6px',color:line.color}}/>
                          <button onClick={()=>delLine(i)} style={{background:'transparent',border:'none',color:'#333',cursor:'pointer',fontSize:13,padding:'0 2px',flexShrink:0}}>×</button>
                        </div>
                        <div style={{display:'flex',gap:5,paddingLeft:22}}>
                          <input type='text' placeholder='value' value={line.value} onChange={e=>updLine(i,'value',e.target.value)} style={{...S.inp,flex:1,fontSize:11,padding:'2px 6px'}}/>
                          <select value={line.unit} onChange={e=>updLine(i,'unit',e.target.value)} style={{...S.inp,width:50,fontSize:10,padding:'2px 4px'}}><option value='"'>in</option><option value='cm'>cm</option></select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lines.length>0&&(
                <div style={{borderTop:'1px solid #1a1a1a',paddingTop:12,display:'flex',flexDirection:'column',gap:8}}>
                  <span style={S.lbl}>Sheet Details</span>
                  <div><label style={S.lbl}>Brand</label><input type='text' placeholder='e.g. Moschino Jeans' value={brand} onChange={e=>setBrand(e.target.value)} style={S.inp}/></div>
                  <div><label style={S.lbl}>Item</label><input type='text' placeholder='e.g. Love All Over' value={itemName} onChange={e=>setItemName(e.target.value)} style={S.inp}/></div>
                  <div><label style={S.lbl}>Notes</label><input type='text' placeholder='e.g. Condition, colour' value={notes} onChange={e=>setNotes(e.target.value)} style={S.inp}/></div>
                  <button onClick={handleExport} style={{padding:'11px',background:'#e8b84b',border:'none',fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,letterSpacing:'0.06em',cursor:'pointer',borderRadius:2,color:'#0d0d0d'}}>
                    Generate Sheet ↓
                  </button>
                </div>
              )}
            </div>

            {/* CANVAS */}
            <div style={{overflow:'auto',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'20px',background:'#060606',position:'relative'}}>
              {bgRemoving&&(
                <div style={{position:'absolute',inset:0,background:'rgba(6,6,6,0.88)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,zIndex:10}}>
                  <div style={{position:'relative',width:48,height:48}}>
                    {[0,1].map(i=>(
                      <div key={i} style={{position:'absolute',inset:i*7,borderRadius:'50%',border:'1.5px solid transparent',borderTopColor:i===0?'#e8b84b':'#333',animation:`spin ${i===0?0.9:1.3}s linear infinite ${i?'reverse':''}`}}/>
                    ))}
                  </div>
                  <div style={{fontFamily:'monospace',fontSize:10,color:'#e8b84b',letterSpacing:'0.15em',textTransform:'uppercase'}}>Removing background…</div>
                  <div style={{fontFamily:'monospace',fontSize:9,color:'#555',letterSpacing:'0.1em'}}>Powered by PhotoRoom</div>
                </div>
              )}
              {bgError&&(
                <div style={{position:'absolute',top:12,left:'50%',transform:'translateX(-50%)',background:'rgba(90,26,26,0.95)',border:'1px solid #c8401a',borderRadius:2,padding:'8px 16px',zIndex:10,whiteSpace:'nowrap'}}>
                  <span style={{fontFamily:'monospace',fontSize:9,color:'#EF9A9A',letterSpacing:'0.1em'}}>{bgError}</span>
                  <button onClick={()=>setBgError(null)} style={{background:'transparent',border:'none',color:'#EF9A9A',cursor:'pointer',marginLeft:10,fontSize:12}}>×</button>
                </div>
              )}
              <canvas ref={canvasRef} onClick={handleClick} onMouseMove={handleMove}
                style={{cursor:'crosshair',borderRadius:2,maxWidth:'100%',boxShadow:'0 4px 40px rgba(0,0,0,0.7)'}}/>
            </div>
          </div>

          {/* EXPORT PREVIEW */}
          <div ref={exportSectionRef} style={{display:showExport?'flex':'none',borderTop:'2px solid #e8b84b44',padding:'28px 32px',background:'#060606',flexDirection:'column',alignItems:'center',gap:16}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:'#e8b84b'}}>Measurement Sheet</div>
            <p style={{fontFamily:'monospace',fontSize:10,color:'#555',letterSpacing:'0.1em',textAlign:'center',lineHeight:1.8}}>
              <strong style={{color:'#888'}}>Right-click → Save Image As</strong> to download
            </p>
            <canvas ref={exportRef} style={{maxWidth:'min(100%, 640px)',borderRadius:2,boxShadow:'0 8px 48px rgba(0,0,0,0.8)',border:'1px solid #2a2a2a'}}/>
            <div style={{display:'flex',gap:8,marginTop:4}}>
              <button onClick={handleExport} style={{...S.ghost,color:'#e8b84b',borderColor:'#e8b84b44'}}>Regenerate</button>
              <button onClick={()=>setShowExport(false)} style={S.ghost}>Close</button>
            </div>
          </div>
        </div>
      )}

      <input ref={fileRef} type='file' accept='image/*' style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>

      <div style={{borderTop:'1px solid #111',padding:'7px 24px',display:'flex',justifyContent:'space-between'}}>
        <span style={{fontSize:8,color:'#1e1e1e'}}>MEASURE — Garment Annotation Tool</span>
        <span style={{fontSize:8,color:'#1e1e1e'}}>Click · Label · Export</span>
      </div>
    </div>
  );
}
