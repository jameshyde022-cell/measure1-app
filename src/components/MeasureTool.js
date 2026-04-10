'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { consumeExport, getExportStatus } from "../lib/exportLimits";

const PRESET_MEASUREMENTS = [
  'Waist','Outseam','Inseam','Rise','Thigh','Knee','Leg Opening',
  'Chest','Shoulder','Sleeve','Back Length','Hem','Bust','Hip','Armhole','Neck','Cuff',
];

const LINE_COLORS = [
  '#4FC3F7','#81C784','#FFB74D','#F06292','#CE93D8',
  '#4DB6AC','#FFF176','#FF8A65','#90CAF9','#A5D6A7',
  '#FFCC02','#EF9A9A','#80DEEA','#BCAAA4','#80CBC4','#FFAB91',
];

const DRAFT_KEY_BASE = 'measure-tool-draft-v2';
const PREP_MAX_W = 980;
const PREP_MAX_H = 720;

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

function getCanvasPoint(canvas, event) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (event.clientX-r.left)*(canvas.width/r.width),
    y: (event.clientY-r.top)*(canvas.height/r.height),
  };
}

function getPointer(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.touches?.[0]?.clientX ?? event.clientX;
  const clientY = event.touches?.[0]?.clientY ?? event.clientY;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

function findEndpointHit(lines, pt, radius=10) {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (Math.hypot(line.p1.x-pt.x, line.p1.y-pt.y) <= radius) return { lineIdx:i, pointKey:'p1' };
    if (Math.hypot(line.p2.x-pt.x, line.p2.y-pt.y) <= radius) return { lineIdx:i, pointKey:'p2' };
  }
  return null;
}

function renderCanvas(canvas, img, lines, pendingPoint, hoverIdx, activeHandle) {
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
    drawEndDot(ctx,p1,color,activeHandle?.lineIdx===i && activeHandle?.pointKey==='p1' ? 6 : isH?5:3.5);
    drawEndDot(ctx,p2,color,activeHandle?.lineIdx===i && activeHandle?.pointKey==='p2' ? 6 : isH?5:3.5);
    const m=mid(p1,p2);
    drawNumberTag(ctx,i+1,m.x,m.y,color);
    ctx.restore();
  });
  if (pendingPoint) {
    ctx.save(); drawPendingCrosshair(ctx,pendingPoint); ctx.restore();
  }
}

function renderPrepCanvas(canvas, img, cropRect, cropMode) {
  if (!canvas || !img) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  if (!cropRect || !cropMode) return;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.clearRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  ctx.drawImage(
    img,
    cropRect.x, cropRect.y, cropRect.w, cropRect.h,
    cropRect.x, cropRect.y, cropRect.w, cropRect.h,
  );
  ctx.strokeStyle = '#e8b84b';
  ctx.lineWidth = 2;
  ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  ctx.fillStyle = '#e8b84b';
  [[cropRect.x,cropRect.y],[cropRect.x+cropRect.w,cropRect.y],[cropRect.x,cropRect.y+cropRect.h],[cropRect.x+cropRect.w,cropRect.y+cropRect.h]].forEach(([x,y])=>{
    ctx.fillRect(x-4,y-4,8,8);
  });
  ctx.restore();
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

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function getFittedSize(w, h, maxW = PREP_MAX_W, maxH = PREP_MAX_H) {
  const scale = Math.min(1, maxW / w, maxH / h);
  return { w: Math.max(1, Math.floor(w * scale)), h: Math.max(1, Math.floor(h * scale)) };
}

export default function MeasureTool({ user }) {
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
  const [imageDataUrl,setImageDataUrl] = useState(null);
  const [originalDataUrl,setOriginalDataUrl] = useState(null);
  const [activeHandle,setActiveHandle] = useState(null);
  const [exportBg,setExportBg]     = useState('black');
  const [footerMode,setFooterMode] = useState('app');
  const [customFooter,setCustomFooter] = useState('');
  const [cropMode,setCropMode]     = useState(false);
  const [cropRect,setCropRect]     = useState(null);
  const [prepSize,setPrepSize]     = useState({w:1,h:1});
  const [draftStatus,setDraftStatus] = useState('ready');
  const [exportStatus, setExportStatus] = useState(null);

  const [prepEraseMode, setPrepEraseMode] = useState(false);
  const [isPrepErasing, setIsPrepErasing] = useState(false);
  const [prepBrushSize, setPrepBrushSize] = useState(20);
  const [prepUndoImage, setPrepUndoImage] = useState(null);
  const [prepBrushPreview, setPrepBrushPreview] = useState({ x: 0, y: 0, visible: false });
const draftKey = user?.id ? `${DRAFT_KEY_BASE}-${user.id}` : `${DRAFT_KEY_BASE}-guest`;
  const canvasRef        = useRef(null);
  const prepCanvasRef    = useRef(null);
  const prepCanvasWrapRef = useRef(null);
  const exportRef        = useRef(null);
  const imgRef           = useRef(null);
  const prepImgRef       = useRef(null);
  const fileRef          = useRef(null);
  const exportSectionRef = useRef(null);
  const dragHandleRef    = useRef(null);
  const didDragRef       = useRef(false);
  const cropDragRef      = useRef(null);

  const activeName = useCustom?(customName||'Measurement'):curName;

  const redraw = useCallback(()=>{
    renderCanvas(canvasRef.current,imgRef.current,lines,pending,hoverIdx,activeHandle);
  },[lines,pending,hoverIdx,activeHandle]);

  const redrawPrep = useCallback(()=>{
    renderPrepCanvas(prepCanvasRef.current, prepImgRef.current, cropRect, cropMode);
  },[cropRect,cropMode]);

  useEffect(()=>{ redraw(); },[redraw]);
  useEffect(()=>{ redrawPrep(); },[redrawPrep]);
  useEffect(() => {
    loadExportStatus();
  }, []);

  useEffect(()=>{
    if (phase!=='annotate'||!canvasRef.current||!imgRef.current) return;
    const container=canvasRef.current.parentElement;
    const maxW=container.clientWidth-2, maxH=window.innerHeight-160;
    const {w,h}=naturalSize;
    const scale=Math.min(1,maxW/w,maxH/h);
    canvasRef.current.width=Math.floor(w*scale);
    canvasRef.current.height=Math.floor(h*scale);
    redraw();
  },[phase,naturalSize,redraw]);

  useEffect(()=>{
    if (phase !== 'prepare' || !prepCanvasRef.current || !prepImgRef.current) return;
    const { w, h } = getFittedSize(prepImgRef.current.naturalWidth, prepImgRef.current.naturalHeight);
    prepCanvasRef.current.width = w;
    prepCanvasRef.current.height = h;
    setPrepSize({ w, h });
    redrawPrep();
  },[phase,imageDataUrl,redrawPrep]);

   useEffect(()=>{
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem('measure-tool-draft-v2');
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft?.imageDataUrl || !draft?.naturalSize) return;
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        prepImgRef.current = img;
        setImageDataUrl(draft.imageDataUrl);
        setOriginalDataUrl(draft.originalDataUrl || draft.imageDataUrl);
        setNatural(draft.naturalSize);
        setLines(Array.isArray(draft.lines) ? draft.lines : []);
        setPending(draft.pending || null);
        setColorIdx(draft.colorIdx || 0);
        setCurName(draft.curName || 'Waist');
        setUseCustom(Boolean(draft.useCustom));
        setCustom(draft.customName || '');
        setCurValue(draft.curValue || '');
        setCurUnit(draft.curUnit || '"');
        setBrand(draft.brand || '');
        setItemName(draft.itemName || '');
        setNotes(draft.notes || '');
        setExportBg(draft.exportBg || 'black');
        setFooterMode(draft.footerMode || 'app');
        setCustomFooter(draft.customFooter || '');
        setPhase('annotate');
      };
      img.src = draft.imageDataUrl;
    } catch {}
  },[draftKey]);

  useEffect(()=>{
    if (typeof window === 'undefined' || phase !== 'annotate' || !imageDataUrl) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({
        imageDataUrl,originalDataUrl,naturalSize,lines,pending,colorIdx,curName,useCustom,customName,curValue,curUnit,brand,itemName,notes,exportBg,footerMode,customFooter,
      }));
      setDraftStatus('ready');
    } catch (error) {
      console.warn('Draft autosave unavailable:', error);
      setDraftStatus('unavailable');
    }
   },[draftKey,phase,imageDataUrl,originalDataUrl,naturalSize,lines,pending,colorIdx,curName,useCustom,customName,curValue,curUnit,brand,itemName,notes,exportBg,footerMode,customFooter]);

  const clearDraft = useCallback(()=>{
    if (typeof window !== 'undefined') window.localStorage.removeItem(draftKey);
  },[draftKey]);
  const loadWorkingImage = useCallback(async (dataUrl, nextPhase = 'prepare') => {
    const img = await loadImage(dataUrl);
    imgRef.current = img;
    prepImgRef.current = img;
    setImageDataUrl(dataUrl);
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    setCropRect(null);
    setCropMode(false);
    setBgRemoving(false);
    setPrepEraseMode(false);
    setIsPrepErasing(false);
    setPrepUndoImage(null);
    setPhase(nextPhase);
  },[]);

  const resetAnnotationState = useCallback(() => {
    setLines([]);
    setPending(null);
    setColorIdx(0);
    setShowExport(false);
    setHoverIdx(null);
    setActiveHandle(null);
  },[]);

  const readFileAsDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const canvasToBlob = (canvas, type = 'image/jpeg', quality = 0.92) => new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to encode image.')), type, quality);
  });

  const normalizeImageFile = async (file) => {
    const objectUrl = URL.createObjectURL(file);
    try {
      let drawSource;
      if ('createImageBitmap' in window) {
        drawSource = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } else {
        drawSource = await loadImage(objectUrl);
      }

      const canvas = document.createElement('canvas');
      canvas.width = drawSource.width || drawSource.naturalWidth;
      canvas.height = drawSource.height || drawSource.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(drawSource, 0, 0);
      drawSource.close?.();

      const normalizedBlob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
      return await readFileAsDataUrl(normalizedBlob);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleFile = useCallback(async (file)=>{
    if (!file||!file.type.startsWith('image/')) return;
    setBgError(null);
    resetAnnotationState();
    clearDraft();
    const dataUrl = await normalizeImageFile(file);
    setOriginalDataUrl(dataUrl);
    await loadWorkingImage(dataUrl, 'prepare');
  },[clearDraft,loadWorkingImage,resetAnnotationState]);

  const handleRemoveBackground = useCallback(async ()=>{
    if (!originalDataUrl) return;
    setBgRemoving(true);
    setBgError(null);
    try {
      const originalBlob = await fetch(originalDataUrl).then(r=>r.blob());
      const formData = new FormData();
      formData.append('image_file', originalBlob, 'upload.png');
      const res = await fetch('/api/remove-bg', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err.error || 'Background removal failed.');
      }
      const blob = await res.blob();
      const dataUrl = await readFileAsDataUrl(blob);
      resetAnnotationState();
      await loadWorkingImage(dataUrl, 'prepare');
    } catch (error) {
      setBgRemoving(false);
      setBgError(error.message || 'Background removal unavailable.');
    }
  },[originalDataUrl,loadWorkingImage,resetAnnotationState]);

  const handleUseOriginal = useCallback(async ()=>{
    if (!originalDataUrl) return;
    resetAnnotationState();
    await loadWorkingImage(originalDataUrl, 'prepare');
  },[originalDataUrl,loadWorkingImage,resetAnnotationState]);

  const startMeasuring = useCallback(async ()=>{
    if (!imageDataUrl) return;

    const prepCanvas = prepCanvasRef.current;
    if (prepCanvas) {
      const cleanedDataUrl = prepCanvas.toDataURL('image/png');
      resetAnnotationState();
      await loadWorkingImage(cleanedDataUrl, 'annotate');
      return;
    }

    resetAnnotationState();
    await loadWorkingImage(imageDataUrl, 'annotate');
  },[imageDataUrl,loadWorkingImage,resetAnnotationState]);

  const beginCropMode = () => {
    if (!prepCanvasRef.current) return;
    setCropMode(true);
    setPrepEraseMode(false);
    setCropRect({
      x: Math.round(prepCanvasRef.current.width * 0.08),
      y: Math.round(prepCanvasRef.current.height * 0.08),
      w: Math.round(prepCanvasRef.current.width * 0.84),
      h: Math.round(prepCanvasRef.current.height * 0.84),
    });
  };

  const cancelCrop = () => {
    setCropMode(false);
    setCropRect(null);
    cropDragRef.current = null;
  };

  const applyCrop = useCallback(async ()=>{
    const canvas = prepCanvasRef.current;
    if (!canvas || !cropRect || cropRect.w < 10 || cropRect.h < 10) return;
    const out = document.createElement('canvas');
    out.width = cropRect.w;
    out.height = cropRect.h;
    const ctx = out.getContext('2d');
    ctx.drawImage(canvas, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, cropRect.w, cropRect.h);
    const dataUrl = out.toDataURL('image/png');
    resetAnnotationState();
    await loadWorkingImage(dataUrl, 'prepare');
  },[cropRect,loadWorkingImage,resetAnnotationState]);

  const handlePrepPointerDown = e => {
    if (!cropMode || !cropRect) return;
    const canvas = prepCanvasRef.current;
    const pt = getPointer(canvas, e);
    cropDragRef.current = { start: pt, initial: { ...cropRect } };
  };

  const handlePrepPointerMove = e => {
    if (!cropMode || !cropDragRef.current) return;
    const canvas = prepCanvasRef.current;
    const pt = getPointer(canvas, e);
    const { start, initial } = cropDragRef.current;
    const x1 = Math.max(0, Math.min(start.x, pt.x));
    const y1 = Math.max(0, Math.min(start.y, pt.y));
    const x2 = Math.min(canvas.width, Math.max(start.x, pt.x));
    const y2 = Math.min(canvas.height, Math.max(start.y, pt.y));
    const w = Math.max(12, x2 - x1);
    const h = Math.max(12, y2 - y1);
    if (Math.abs(pt.x - start.x) < 5 && Math.abs(pt.y - start.y) < 5) {
      setCropRect(initial);
      return;
    }
    setCropRect({ x: x1, y: y1, w, h });
  };

  const handlePrepPointerUp = () => {
    cropDragRef.current = null;
  };

  const startPrepErasing = () => {
    if (!prepEraseMode || cropMode) return;

    const canvas = prepCanvasRef.current;
    if (canvas) {
      setPrepUndoImage(canvas.toDataURL('image/png'));
    }

    setIsPrepErasing(true);
  };

  const stopPrepErasing = () => {
    setIsPrepErasing(false);
  };

const showPrepBrushPreview = (event) => {
  if (!prepEraseMode || cropMode) {
    setPrepBrushPreview(prev => ({ ...prev, visible: false }));
    return;
  }

  const wrap = prepCanvasWrapRef.current;
  if (!wrap) return;

  const wrapRect = wrap.getBoundingClientRect();
  const clientX = event.touches?.[0]?.clientX ?? event.clientX;
  const clientY = event.touches?.[0]?.clientY ?? event.clientY;

  setPrepBrushPreview({
    x: clientX - wrapRect.left,
    y: clientY - wrapRect.top,
    visible: true,
  });
};
  const hidePrepBrushPreview = () => {
    setPrepBrushPreview(prev => ({ ...prev, visible: false }));
  };

  const erasePrepAtPoint = (event) => {
    if (!prepEraseMode || !isPrepErasing || cropMode) return;

    const canvas = prepCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches?.[0]?.clientX ?? event.clientX;
    const clientY = event.touches?.[0]?.clientY ?? event.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, prepBrushSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const undoPrepErase = () => {
    if (!prepUndoImage) return;

    const canvas = prepCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setPrepUndoImage(null);
    };

    img.src = prepUndoImage;
  };

  const handleCanvasClick = e => {
    if (dragHandleRef.current || didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    const c=canvasRef.current;
    const pt=getCanvasPoint(c,e);
    if (findEndpointHit(lines, pt)) return;
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

  const handleMouseDown = e => {
    const c = canvasRef.current; if (!c) return;
    const pt = getCanvasPoint(c, e);
    const hit = findEndpointHit(lines, pt);
    if (!hit) return;
    dragHandleRef.current = hit;
    didDragRef.current = false;
    setActiveHandle(hit);
    setHoverIdx(hit.lineIdx);
  };

  const handleMouseUp = () => {
    dragHandleRef.current = null;
    setActiveHandle(null);
  };

  const handleMove = e => {
    const c=canvasRef.current; if(!c) return;
    const pt=getCanvasPoint(c,e);

    if (dragHandleRef.current) {
      const { lineIdx, pointKey } = dragHandleRef.current;
      didDragRef.current = true;
      setLines(prev=>prev.map((line,idx)=>idx===lineIdx?{...line,[pointKey]:pt}:line));
      setHoverIdx(lineIdx);
      return;
    }

    const endpointHit = findEndpointHit(lines, pt);
    if (endpointHit) {
      setHoverIdx(endpointHit.lineIdx);
      return;
    }

    let closest=null,minD=16;
    lines.forEach((l,i)=>{
      const dx=l.p2.x-l.p1.x,dy=l.p2.y-l.p1.y,lenSq=dx*dx+dy*dy; if(!lenSq) return;
      const t=Math.max(0,Math.min(1,((pt.x-l.p1.x)*dx+(pt.y-l.p1.y)*dy)/lenSq));
      const d=Math.hypot(l.p1.x+t*dx-pt.x,l.p1.y+t*dy-pt.y);
      if(d<minD){minD=d;closest=i;}
    });
    setHoverIdx(closest);
  };

  const updLine=(i,f,v)=>setLines(prev=>prev.map((l,idx)=>idx===i?{...l,[f]:v}:l));
  const delLine=i=>setLines(prev=>prev.filter((_,idx)=>idx!==i));
  const undo=()=>{ if(pending){setPending(null);return;} setLines(p=>p.slice(0,-1)); setColorIdx(c=>Math.max(0,c-1)); };

  const footerText = footerMode === 'none'
    ? ''
    : footerMode === 'custom'
      ? customFooter.trim()
      : 'Create yours at Measure';

  const exportTheme = {
    black: {
      panel: '#0b0b0b',
      divider: '#202020',
      text: '#f0ebe0',
      muted: '#8a8a8a',
      footer: '#565656',
    },
    white: {
      panel: '#ffffff',
      divider: '#dedede',
      text: '#151515',
      muted: '#666666',
      footer: '#8a8a8a',
    },
    gray: {
      panel: '#d7d7d7',
      divider: '#bbbbbb',
      text: '#161616',
      muted: '#555555',
      footer: '#707070',
    },
  }[exportBg];

  const buildExportCanvas = () => {
    const src=canvasRef.current; if(!src||!imgRef.current) return null;
    const W=src.width;
    const ROW_H=36, COLS=2, PAD=20;
    const rows=Math.ceil(lines.length/COLS);
    const tableH=lines.length>0?rows*ROW_H+48:0;
    const infoRows = [brand,itemName,notes].filter(Boolean).length;
    const footerH = footerText ? 28 : 0;
    const infoH = infoRows > 0 ? Math.max(68, 16 + infoRows * 18 + footerH) : footerH;
    const ec=document.createElement('canvas');
    ec.width=W; ec.height=src.height+tableH+infoH;
    const ctx=ec.getContext('2d');

    ctx.fillStyle = exportTheme.panel;
    ctx.fillRect(0, 0, ec.width, ec.height);

    const imgCanvas=document.createElement('canvas');
    imgCanvas.width=W; imgCanvas.height=src.height;
    const imgCtx = imgCanvas.getContext('2d');
    imgCtx.fillStyle = exportTheme.panel;
    imgCtx.fillRect(0, 0, imgCanvas.width, imgCanvas.height);
    renderExportImage(imgCanvas,imgRef.current,lines);
    ctx.drawImage(imgCanvas,0,0);

    if (lines.length>0) {
      const tableY=src.height;
      ctx.fillStyle=exportTheme.panel; ctx.fillRect(0,tableY,W,tableH);
      ctx.fillStyle=exportTheme.divider; ctx.fillRect(0,tableY,W,1);
      ctx.font='bold 11px monospace'; ctx.fillStyle=exportTheme.muted;
      ctx.textBaseline='middle'; ctx.textAlign='left';
      ctx.fillText('MEASUREMENTS',PAD,tableY+14);
      ctx.fillStyle=exportTheme.divider; ctx.fillRect(0,tableY+26,W,1);
      const colW=(W-PAD*2)/COLS;
      lines.forEach((line,i)=>{
        const col=i%COLS, row=Math.floor(i/COLS);
        const x=PAD+col*colW, y=tableY+28+row*ROW_H+ROW_H/2;
        ctx.beginPath(); ctx.arc(x+8,y,5,0,Math.PI*2);
        ctx.fillStyle=line.color; ctx.fill();
        ctx.font='bold 10px monospace'; ctx.fillStyle=exportTheme.muted; ctx.textAlign='left';
        ctx.fillText(`${i+1}.`,x+18,y);
        ctx.font='11px monospace'; ctx.fillStyle=exportTheme.text;
        ctx.fillText(line.name,x+34,y);
        if (line.value) {
          ctx.font='bold 13px monospace'; ctx.fillStyle=exportTheme.text; ctx.textAlign='right';
          ctx.fillText(`${line.value}${line.unit}`,x+colW-8,y);
        }
        if (col===COLS-1||i===lines.length-1) {
          ctx.fillStyle=exportTheme.divider; ctx.fillRect(PAD,tableY+28+(row+1)*ROW_H-1,W-PAD*2,1);
        }
      });
    }

    if (infoH>0) {
      const iy=src.height+tableH;
      ctx.fillStyle=exportTheme.panel; ctx.fillRect(0,iy,W,infoH);
      ctx.fillStyle=exportTheme.divider; ctx.fillRect(0,iy,W,1);
      ctx.textBaseline='top'; ctx.textAlign='left'; let ty=iy+12;
      if(brand){ctx.font='bold 13px monospace';ctx.fillStyle=exportTheme.text;ctx.fillText(`Brand: ${brand}`,PAD,ty);ty+=18;}
      if(itemName){ctx.font='bold 13px monospace';ctx.fillStyle=exportTheme.text;ctx.fillText(`Item: ${itemName}`,PAD,ty);ty+=18;}
      if(notes){ctx.font='11px monospace';ctx.fillStyle=exportTheme.muted;ctx.fillText(`Notes: ${notes}`,PAD,ty);ty+=18;}
      if (footerText) {
        ctx.font='10px monospace';
        ctx.fillStyle=exportTheme.footer;
        ctx.textAlign='right';
        ctx.fillText(footerText, W - PAD, iy + infoH - 12);
      }
    }
    return ec;
  };

  const handleExport = () => {
    const ec = buildExportCanvas();
    if (!ec) return;
    const el=exportRef.current;
    el.width=ec.width; el.height=ec.height;
    el.getContext('2d').drawImage(ec,0,0);
    setShowExport(true);
    setTimeout(()=>exportSectionRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),150);
  };

  const loadExportStatus = async () => {
    try {
      const status = await getExportStatus();
      setExportStatus(status);
    } catch (error) {
      console.error('Failed to load export status:', error);
    }
  };

  const goToCheckout = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert('You must be logged in');
        return;
      }

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Could not start checkout');
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      alert('Something went wrong starting checkout');
    }
  };

  const downloadExport = async () => {
    try {
      const result = await consumeExport();

      if (!result.allowed) {
        alert('Free plan limit reached. You get 3 exports per day.');
        return;
      }

      const exportCanvas = exportRef.current;
      if (!exportCanvas?.width || !exportCanvas?.height) return;

      const link = document.createElement('a');
      const safeName = (itemName || brand || 'measurement-sheet')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'measurement-sheet';

      link.href = exportCanvas.toDataURL('image/png');
      link.download = `${safeName}.png`;
      link.click();
      await loadExportStatus();
    } catch (error) {
      console.error('Export limit check failed:', error);
      alert(error.message || 'Export limit check failed');
    }
  };

  const resetDraftAndTool = async () => {
    resetAnnotationState();
    setBrand('');
    setItemName('');
    setNotes('');
    clearDraft();
    if (imageDataUrl) {
      await loadWorkingImage(imageDataUrl, 'prepare');
    }
  };

  const S = {
    lbl:{fontFamily:'monospace',fontSize:9,letterSpacing:'0.18em',textTransform:'uppercase',color:'#555',marginBottom:5,display:'block'},
    inp:{fontFamily:'monospace',fontSize:12,padding:'7px 10px',border:'1px solid #2a2a2a',borderRadius:2,background:'#080808',color:'#f0ebe0',width:'100%'},
    ghost:{padding:'6px 10px',background:'transparent',border:'1px solid #1e1e1e',fontFamily:'monospace',fontSize:9,letterSpacing:'0.12em',textTransform:'uppercase',color:'#555',cursor:'pointer',borderRadius:2},
  };

  const instr=activeHandle
    ?{text:`Dragging ${lines[activeHandle.lineIdx]?.name || 'measurement'} endpoint`,color:'#FFB74D'}
    :!pending
      ?{text:`Click START of "${activeName}"`,color:'#4FC3F7'}
      :{text:`Click END of "${activeName}"`,color:'#81C784'};

  return (
    <div style={{background:'#0d0d0d',minHeight:'100vh',color:'#f0ebe0',display:'flex',flexDirection:'column',fontFamily:'monospace'}}>
      <div style={{borderBottom:'1px solid #1a1a1a',padding:'12px 24px',display:'flex',alignItems:'center',gap:14}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700}}>
          MEAS<span style={{color:'#e8b84b'}}>UR</span>E
        </div>
        <div style={{width:1,height:14,background:'#2a2a2a'}}/>
        <div style={{fontSize:9,color:'#444',letterSpacing:'0.18em',textTransform:'uppercase'}}>Garment Annotation Tool</div>
        {phase==='annotate'&&(
          <div style={{marginLeft:'auto',display:'flex',gap:8}}>
            <button onClick={handleExport} style={{padding:'6px 16px',background:'#e8b84b',border:'none',fontFamily:'monospace',fontSize:9,letterSpacing:'0.15em',textTransform:'uppercase',cursor:'pointer',borderRadius:2,color:'#0d0d0d'}}>Generate Sheet</button>
            <button onClick={async()=>{clearDraft(); if (imageDataUrl) await loadWorkingImage(imageDataUrl,'prepare');}} style={S.ghost}>Back to Prep</button>
            <button onClick={()=>fileRef.current.click()} style={S.ghost}>New Photo</button>
          </div>
        )}
      </div>

      {phase==='upload'&&(
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:40}}>
          <div style={{maxWidth:460,width:'100%',display:'flex',flexDirection:'column',gap:24}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,lineHeight:1.2,marginBottom:10}}>
                Your measurements.<br/><span style={{color:'#e8b84b'}}>Beautifully annotated.</span>
              </div>
              <p style={{fontSize:11,color:'#555',lineHeight:1.8}}>Upload a garment photo. Keep the original or remove the background. Crop if needed. Then click two points for each measurement and generate a clean listing-ready sheet.</p>
            </div>
            <div onClick={()=>fileRef.current.click()} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}} style={{border:`2px dashed ${dragging?'#e8b84b':'#222'}`,borderRadius:4,padding:'52px 40px',textAlign:'center',cursor:'pointer',transition:'border-color 0.2s'}}>
              <div style={{fontSize:36,marginBottom:12}}>📷</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:5}}>Drop your flat-lay photo here</div>
              <div style={{fontSize:9,color:'#444',letterSpacing:'0.15em'}}>OR CLICK TO BROWSE · JPG PNG WEBP</div>
            </div>
          </div>
        </div>
      )}

      {phase==='prepare'&&(
        <div style={{flex:1,display:'grid',gridTemplateColumns:'280px 1fr',minHeight:0}}>
          <div style={{borderRight:'1px solid #1a1a1a',padding:'16px',display:'flex',flexDirection:'column',gap:12,overflowY:'auto'}}>
            <div style={{background:'#080808',border:'1px solid #1e1e1e',borderRadius:2,padding:'13px'}}>
              <div style={{fontSize:9,color:'#e8b84b',letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:8}}>Image Prep</div>
              <div style={{fontSize:10,color:'#666',lineHeight:1.7}}>Choose the source you want to measure. Background removal is optional. Crop before you start measuring.</div>
            </div>

            <div style={{display:'grid',gap:8}}>
              <button onClick={handleUseOriginal} style={{...S.ghost, color: originalDataUrl === imageDataUrl ? '#e8b84b' : '#555', borderColor: originalDataUrl === imageDataUrl ? '#e8b84b44' : '#1e1e1e'}}>Use Original Image</button>
              <button onClick={handleRemoveBackground} style={{padding:'8px 12px',background:'#e8b84b',border:'none',fontFamily:'monospace',fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',cursor:'pointer',borderRadius:2,color:'#0d0d0d'}}>Remove Background</button>

              {!cropMode ? (
                <button onClick={beginCropMode} style={S.ghost}>Crop Image</button>
              ) : (
                <div style={{display:'grid',gap:8}}>
                  <button onClick={applyCrop} style={{padding:'8px 12px',background:'#e8b84b',border:'none',fontFamily:'monospace',fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',cursor:'pointer',borderRadius:2,color:'#0d0d0d'}}>Apply Crop</button>
                  <button onClick={cancelCrop} style={S.ghost}>Cancel Crop</button>
                </div>
              )}

              <button onClick={() => { setPrepEraseMode(!prepEraseMode); setCropMode(false); setCropRect(null); }} style={{...S.ghost,color:prepEraseMode ? '#ff8a8a' : '#e8b84b',borderColor:prepEraseMode ? '#ff8a8a44' : '#e8b84b44'}}>
                {prepEraseMode ? 'Stop Erasing' : 'Manual Erase'}
              </button>

              <button onClick={undoPrepErase} disabled={!prepUndoImage} style={{...S.ghost,opacity:prepUndoImage ? 1 : 0.4,cursor:prepUndoImage ? 'pointer' : 'default'}}>
                Undo
              </button>
            </div>

            {prepEraseMode && (
              <div style={{background:'#080808',border:'1px solid #1e1e1e',borderRadius:2,padding:'11px 12px'}}>
                <div style={{fontSize:9,color:'#e8b84b',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:8}}>Eraser Size</div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={prepBrushSize}
                  onChange={(e) => setPrepBrushSize(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div style={{fontSize:10,color:'#555',lineHeight:1.7,marginTop:8}}>Drag on the image to erase hanger parts before measuring.</div>
              </div>
            )}

            <div style={{background:'#080808',border:'1px solid #1e1e1e',borderRadius:2,padding:'11px 12px'}}>
              <div style={{fontSize:9,color:'#e8b84b',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:4}}>Current source</div>
              <div style={{fontSize:10,color:'#555',lineHeight:1.7}}>{imageDataUrl === originalDataUrl ? 'Original image selected' : 'Background-removed image selected'}</div>
            </div>

            <button onClick={startMeasuring} style={{padding:'11px',background:'#e8b84b',border:'none',fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,letterSpacing:'0.06em',cursor:'pointer',borderRadius:2,color:'#0d0d0d'}}>Start Measuring →</button>
          </div>

         <div style={{overflow:'auto',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',background:'#060606',position:'relative'}}>
  {bgRemoving&&(
    <div style={{position:'absolute',inset:0,background:'rgba(6,6,6,0.88)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,zIndex:10}}>
      <div style={{position:'relative',width:48,height:48}}>{[0,1].map(i=><div key={i} style={{position:'absolute',inset:i*7,borderRadius:'50%',border:'1.5px solid transparent',borderTopColor:i===0?'#e8b84b':'#333',animation:`spin ${i===0?0.9:1.3}s linear infinite ${i?'reverse':''}`}}/>)}</div>
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

  <div ref={prepCanvasWrapRef} style={{position:'relative',display:'inline-block',lineHeight:0}}>
    <canvas
      ref={prepCanvasRef}
      onMouseDown={(e) => {
        if (prepEraseMode && !cropMode) {
          showPrepBrushPreview(e);
          startPrepErasing();
          erasePrepAtPoint(e);
        } else {
          handlePrepPointerDown(e);
        }
      }}
      onMouseMove={(e) => {
        if (prepEraseMode && !cropMode) {
          showPrepBrushPreview(e);
          erasePrepAtPoint(e);
        } else {
          handlePrepPointerMove(e);
        }
      }}
      onMouseUp={() => {
        stopPrepErasing();
        handlePrepPointerUp();
      }}
      onMouseLeave={() => {
        stopPrepErasing();
        handlePrepPointerUp();
        hidePrepBrushPreview();
      }}
      onTouchStart={(e) => {
        if (prepEraseMode && !cropMode) {
          e.preventDefault();
          showPrepBrushPreview(e);
          startPrepErasing();
          erasePrepAtPoint(e);
        }
      }}
      onTouchMove={(e) => {
        if (prepEraseMode && !cropMode) {
          e.preventDefault();
          showPrepBrushPreview(e);
          erasePrepAtPoint(e);
        }
      }}
      onTouchEnd={() => {
        stopPrepErasing();
        hidePrepBrushPreview();
      }}
      style={{maxWidth:'100%',boxShadow:'0 8px 48px rgba(0,0,0,0.8)',border:'1px solid #202020',cursor:cropMode?'crosshair':prepEraseMode?'none':'default',touchAction:prepEraseMode ? 'none' : 'auto'}}
    />

    {prepEraseMode && prepBrushPreview.visible && !cropMode && (
      <div
        style={{
          position: 'absolute',
          left: prepBrushPreview.x - prepBrushSize,
          top: prepBrushPreview.y - prepBrushSize,
          width: prepBrushSize * 2,
          height: prepBrushSize * 2,
          border: '1px solid #e8b84b',
          borderRadius: '50%',
          background: 'rgba(232, 184, 75, 0.10)',
          pointerEvents: 'none',
          boxSizing: 'border-box',
        }}
      />
    )}
  </div>
</div>
        </div>
      )}

      {phase==='annotate'&&(
        <div style={{flex:1,display:'flex',flexDirection:'column'}}>
          <div style={{display:'grid',gridTemplateColumns:'286px 1fr',flex:1,minHeight:0,overflow:'hidden'}}>
            <div style={{borderRight:'1px solid #1a1a1a',padding:'16px',display:'flex',flexDirection:'column',gap:14,overflowY:'auto'}}>
              <div style={{background:'#080808',border:'1px solid #1e1e1e',borderRadius:2,padding:'13px'}}>
                <span style={{...S.lbl,color:'#4FC3F7',marginBottom:10}}>Add Measurement</span>
                <div style={{background:`${instr.color}11`,border:`1px solid ${instr.color}33`,borderRadius:2,padding:'8px 10px',marginBottom:12}}><div style={{fontSize:10,color:instr.color,fontWeight:'bold'}}>{instr.text}</div></div>
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
                <button onClick={resetDraftAndTool} style={{...S.ghost,flex:1}}>Clear</button>
              </div>

              <div style={{background:'#080808',border:'1px solid #1e1e1e',borderRadius:2,padding:'10px 12px'}}>
                <div style={{fontSize:9,color:'#e8b84b',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:4}}>Draft autosave</div>
                <div style={{fontSize:10,color:draftStatus==='unavailable'?'#d08d73':'#555',lineHeight:1.6}}>
                  {draftStatus==='unavailable'
                    ? 'Autosave is off for this image because the browser storage limit was reached. The app will keep working, but this draft may not restore after refresh.'
                    : 'Your current image, lines, values, and notes are saved in this browser automatically while you work.'}
                </div>
              </div>

              {lines.length>0&&(
                <div style={{borderTop:'1px solid #1a1a1a',paddingTop:12}}>
                  <span style={S.lbl}>Lines ({lines.length})</span>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    {lines.map((line,i)=>(
                      <div key={i} onMouseEnter={()=>setHoverIdx(i)} onMouseLeave={()=>setHoverIdx(null)} style={{background:hoverIdx===i?'#111':'#080808',border:`1px solid ${hoverIdx===i?line.color+'44':'#1a1a1a'}`,borderLeft:`3px solid ${line.color}`,borderRadius:2,padding:'7px 9px',transition:'all 0.1s'}}>
                        <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:4}}>
                          <div style={{width:16,height:16,borderRadius:'50%',background:'rgba(8,8,8,0.85)',border:`1.5px solid ${line.color}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontFamily:'monospace',fontSize:8,color:line.color,fontWeight:'bold'}}>{i+1}</span></div>
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
                  <div>
                    <label style={S.lbl}>Export Background</label>
                    <div style={{display:'flex',gap:6}}>
                      {['white','black','gray'].map(opt => (
                        <button key={opt} onClick={()=>setExportBg(opt)} style={{...S.ghost,flex:1,color:exportBg===opt?'#e8b84b':'#555',borderColor:exportBg===opt?'#e8b84b44':'#1e1e1e'}}>{opt}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={S.lbl}>Footer</label>
                    <select value={footerMode} onChange={e=>setFooterMode(e.target.value)} style={S.inp}>
                      <option value='app'>Measure footer</option>
                      <option value='custom'>Custom store footer</option>
                      <option value='none'>No footer</option>
                    </select>
                  </div>
                  {footerMode === 'custom' && (
                    <div><label style={S.lbl}>Custom Footer Text</label><input type='text' placeholder='e.g. shopyourstore.com' value={customFooter} onChange={e=>setCustomFooter(e.target.value)} style={S.inp}/></div>
                  )}
                  <button onClick={handleExport} style={{padding:'11px',background:'#e8b84b',border:'none',fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,letterSpacing:'0.06em',cursor:'pointer',borderRadius:2,color:'#0d0d0d'}}>Generate Sheet ↓</button>
                </div>
              )}
            </div>

            <div style={{overflow:'auto',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'20px',background:'#060606',position:'relative'}}>
              <canvas ref={canvasRef} onClick={handleCanvasClick} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onMouseMove={handleMove} style={{cursor:activeHandle ? 'grabbing' : 'crosshair',borderRadius:2,maxWidth:'100%',boxShadow:'0 4px 40px rgba(0,0,0,0.7)'}}/>
            </div>
          </div>

          <div ref={exportSectionRef} style={{display:showExport?'flex':'none',borderTop:'2px solid #e8b84b44',padding:'28px 32px',background:'#060606',flexDirection:'column',alignItems:'center',gap:16}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:'#e8b84b'}}>Measurement Sheet</div>
            <p style={{fontFamily:'monospace',fontSize:10,color:'#555',letterSpacing:'0.1em',textAlign:'center',lineHeight:1.8}}>Export the finished sheet directly as a PNG.</p>

            <canvas ref={exportRef} style={{maxWidth:'min(100%, 640px)',borderRadius:2,boxShadow:'0 8px 48px rgba(0,0,0,0.8)',border:'1px solid #2a2a2a',background:exportTheme.panel}}/>

            <div style={{display:'flex',gap:8,marginTop:4,flexWrap:'wrap',justifyContent:'center'}}>
              <button onClick={downloadExport} style={{padding:'8px 14px',background:'#e8b84b',border:'none',fontFamily:'monospace',fontSize:9,letterSpacing:'0.15em',textTransform:'uppercase',cursor:'pointer',borderRadius:2,color:'#0d0d0d'}}>Download PNG</button>
              <button onClick={handleExport} style={{...S.ghost,color:'#e8b84b',borderColor:'#e8b84b44'}}>Regenerate</button>
              <button onClick={()=>setShowExport(false)} style={S.ghost}>Close</button>
              {exportStatus?.plan !== 'pro' && (
                <button onClick={goToCheckout} style={{...S.ghost,color:'#7dd3fc',borderColor:'#7dd3fc44'}}>
                  Upgrade to Pro
                </button>
              )}
            </div>

            {exportStatus && (
              <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 10, color: '#999', letterSpacing: '0.08em', textAlign: 'center' }}>
                {exportStatus.plan === 'pro'
                  ? 'PRO PLAN: UNLIMITED EXPORTS'
                  : `FREE PLAN: ${exportStatus.remaining} EXPORTS LEFT TODAY`}
              </div>
            )}
          </div>
        </div>
      )}

      <input ref={fileRef} type='file' accept='image/*' style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>

      <div style={{borderTop:'1px solid #111',padding:'7px 24px',display:'flex',justifyContent:'space-between'}}>
        <span style={{fontSize:8,color:'#1e1e1e'}}>MEASURE — Garment Annotation Tool</span>
        <span style={{fontSize:8,color:'#1e1e1e'}}>Prep · Click · Drag · Export</span>
      </div>
    </div>
  );
}
