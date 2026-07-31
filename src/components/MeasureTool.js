'use client';



import { useState, useRef, useEffect, useCallback } from 'react';

import { supabase } from '../lib/supabase';

import { consumeExport, getExportStatus } from "../lib/exportLimits";



const PRESET_MEASUREMENTS = [
  'Waist','Outseam','Inseam','Rise','Thigh','Knee','Leg Opening',
  'Chest','Shoulder','Sleeve','Back Length','Hem','Bust','Hip','Armhole','Neck','Cuff',
  'Overall Width','Overall Height','Depth','Shelf Spacing','Seat Width','Seat Height','Back Height',
  'Brim Width','Crown Height','Bag Width','Bag Height','Handle Drop',
];



const LINE_COLORS = [

  '#4FC3F7','#81C784','#FFB74D','#F06292','#CE93D8',

  '#4DB6AC','#FFF176','#FF8A65','#90CAF9','#A5D6A7',

  '#FFCC02','#EF9A9A','#80DEEA','#BCAAA4','#80CBC4','#FFAB91',

];



const DRAFT_KEY_BASE = 'measure-tool-draft-v2';

const MEASUREMENT_CONFIGS_KEY = 'measure-tool-measurement-configs-v1';
const CUSTOM_MEASUREMENT_LABELS_KEY = 'measure-tool-custom-measurement-labels-v1';

const BUILT_IN_MEASUREMENT_CONFIGS = [
  { id: 'pants-basic', name: 'Pants Basic', measurements: ['Waist', 'Hip', 'Rise', 'Inseam', 'Outseam'] },
  { id: 'tops-basic', name: 'Tops Basic', measurements: ['Chest', 'Shoulder', 'Sleeve', 'Back Length', 'Hem'] },
  { id: 'dress-basic', name: 'Dress Basic', measurements: ['Bust', 'Waist', 'Hip', 'Shoulder', 'Back Length'] },
  { id: 'shelving-basic', name: 'Shelving Basic', measurements: ['Overall Width', 'Overall Height', 'Depth', 'Shelf Spacing', 'Clearance'] },
  { id: 'chair-basic', name: 'Chair Basic', measurements: ['Seat Width', 'Seat Depth', 'Seat Height', 'Back Height', 'Overall Height'] },
  { id: 'hat-basic', name: 'Hat Basic', measurements: ['Brim Width', 'Crown Height', 'Opening Width', 'Overall Height'] },
  { id: 'handbag-basic', name: 'Handbag Basic', measurements: ['Bag Width', 'Bag Height', 'Depth', 'Handle Drop', 'Strap Length'] },
];

const PREP_MAX_W = 980;

const PREP_MAX_H = 720;



function mid(a, b) { return { x: (a.x+b.x)/2, y: (a.y+b.y)/2 }; }





function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }



function axisGuide(p1, p2) {

  if (!p1 || !p2) return null;

  const dx = p2.x - p1.x;

  const dy = p2.y - p1.y;

  const length = Math.hypot(dx, dy);

  if (length < 8) return null;



  const horizontalOff = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);

  const horizontalDeviation = Math.min(horizontalOff, Math.abs(180 - horizontalOff));

  const verticalDeviation = Math.abs(90 - horizontalOff);

  const axis = horizontalDeviation <= verticalDeviation ? 'Horizontal' : 'Vertical';

  const deviation = axis === 'Horizontal' ? horizontalDeviation : verticalDeviation;



  return {

    axis,

    deviation,

    label: `${axis}: ${deviation.toFixed(1)} deg off`,

    status: deviation <= 1 ? 'true' : deviation <= 3 ? 'close' : 'off',

  };

}



function guideColor(guide) {

  if (!guide) return '#555';

  if (guide.status === 'true') return '#81C784';

  if (guide.status === 'close') return '#e8b84b';

  return '#FF8A65';

}



function drawGuideBadge(ctx, guide, x, y) {

  if (!guide) return;

  const text = guide.status === 'true' ? `${guide.axis}: straight` : guide.label;

  ctx.save();

  ctx.font = 'bold 10px monospace';

  const padX = 7;

  const w = ctx.measureText(text).width + padX * 2;

  const h = 20;

  const bx = clamp(x - w / 2, 6, ctx.canvas.width - w - 6);

  const by = clamp(y - 30, 6, ctx.canvas.height - h - 6);

  ctx.fillStyle = 'rgba(8,8,8,0.86)';

  ctx.fillRect(bx, by, w, h);

  ctx.strokeStyle = guideColor(guide);

  ctx.lineWidth = 1;

  ctx.strokeRect(bx, by, w, h);

  ctx.fillStyle = guideColor(guide);

  ctx.textAlign = 'center';

  ctx.textBaseline = 'middle';

  ctx.fillText(text, bx + w / 2, by + h / 2 + 0.5);

  ctx.restore();

}



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



function renderCanvas(canvas, img, lines, pendingPoint, previewPoint, hoverIdx, activeHandle) {

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

    if (isH) drawGuideBadge(ctx, axisGuide(p1, p2), m.x, m.y);

    ctx.restore();

  });

  if (pendingPoint) {

    ctx.save();

    if (previewPoint) {

      const guide = axisGuide(pendingPoint, previewPoint);

      ctx.beginPath(); ctx.moveTo(pendingPoint.x, pendingPoint.y); ctx.lineTo(previewPoint.x, previewPoint.y);

      ctx.strokeStyle = guideColor(guide); ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.stroke();

      drawGuideBadge(ctx, guide, mid(pendingPoint, previewPoint).x, mid(pendingPoint, previewPoint).y);

    }

    drawPendingCrosshair(ctx,pendingPoint);

    ctx.restore();

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



export default function MeasureTool({ user, shopifyMode = false, shop = '' }) {

  const [phase,setPhase]           = useState('upload');

  const [naturalSize,setNatural]   = useState({w:1,h:1});

  const [lines,setLines]           = useState([]);

  const [pending,setPending]       = useState(null);

  const [cursorPoint,setCursorPoint] = useState(null);

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

  const [gender,setGender]         = useState('female');

  const [aiGenerating,setAiGenerating] = useState(false);

  const [aiStatus,setAiStatus]     = useState('');

  const [sourceLabel,setSourceLabel] = useState('Original image selected');

  const [imageDataUrl,setImageDataUrl] = useState(null);

  const [originalDataUrl,setOriginalDataUrl] = useState(null);

  const [activeHandle,setActiveHandle] = useState(null);

  const [exportBg,setExportBg]     = useState('black');

  const [exportLayout,setExportLayout] = useState('spec');

  const [footerMode,setFooterMode] = useState('app');

  const [customFooter,setCustomFooter] = useState('');

  const [cropMode,setCropMode]     = useState(false);

  const [cropRect,setCropRect]     = useState(null);

  const [prepSize,setPrepSize]     = useState({w:1,h:1});

  const [draftStatus,setDraftStatus] = useState('ready');

  const [exportStatus, setExportStatus] = useState(null);

  const [shopifyPicking,setShopifyPicking] = useState(false);

  const [shopifyPickError,setShopifyPickError] = useState(null);

  const [shopifyBilling,setShopifyBilling] = useState(null);

  const [shopifySubscribing,setShopifySubscribing] = useState(false);

  const [shopifyPickStatus,setShopifyPickStatus] = useState('');

  const [customConfigs,setCustomConfigs] = useState([]);

  const [selectedConfigId,setSelectedConfigId] = useState('pants-basic');

  const [configName,setConfigName] = useState('');

  const [configItemsText,setConfigItemsText] = useState('Waist, Hip, Rise, Inseam, Outseam');

  const [customLabels,setCustomLabels] = useState([]);

  const [newLabelName,setNewLabelName] = useState('');



  const [prepEraseMode, setPrepEraseMode] = useState(false);

  const [isPrepErasing, setIsPrepErasing] = useState(false);

  const [prepBrushSize, setPrepBrushSize] = useState(20);

  const [prepUndoImage, setPrepUndoImage] = useState(null);

  const [prepBrushPreview, setPrepBrushPreview] = useState({ x: 0, y: 0, visible: false });

const draftKey = shopifyMode && shop

    ? `${DRAFT_KEY_BASE}-shopify-${shop}`

    : user?.id

      ? `${DRAFT_KEY_BASE}-${user.id}`

      : `${DRAFT_KEY_BASE}-guest`;

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



  const allMeasurementConfigs = [...BUILT_IN_MEASUREMENT_CONFIGS, ...customConfigs];

  const selectedConfig = allMeasurementConfigs.find(config => config.id === selectedConfigId) || BUILT_IN_MEASUREMENT_CONFIGS[0];

  const baseMeasurementOptions = selectedConfig?.measurements?.length ? selectedConfig.measurements : PRESET_MEASUREMENTS;

  const measurementOptions = Array.from(new Set([...baseMeasurementOptions, ...customLabels, ...PRESET_MEASUREMENTS]));

  const activeName = useCustom?(customName||'Measurement'):curName;



  const redraw = useCallback(()=>{

    renderCanvas(canvasRef.current,imgRef.current,lines,pending,cursorPoint,hoverIdx,activeHandle);

  },[lines,pending,cursorPoint,hoverIdx,activeHandle]);



  const redrawPrep = useCallback(()=>{

    renderPrepCanvas(prepCanvasRef.current, prepImgRef.current, cropRect, cropMode);

  },[cropRect,cropMode]);



  useEffect(()=>{ redraw(); },[redraw]);

  useEffect(()=>{

    if (typeof window === 'undefined') return;

    try {

      const raw = window.localStorage.getItem(MEASUREMENT_CONFIGS_KEY);

      const parsed = raw ? JSON.parse(raw) : [];

      if (Array.isArray(parsed)) setCustomConfigs(parsed.filter(config => config?.name && Array.isArray(config.measurements)));

    } catch (error) {

      console.error('Failed to load measurement configs:', error);

    }

  },[]);


  useEffect(()=>{

    if (typeof window === 'undefined') return;

    try {

      const raw = window.localStorage.getItem(CUSTOM_MEASUREMENT_LABELS_KEY);

      const parsed = raw ? JSON.parse(raw) : [];

      if (Array.isArray(parsed)) {

        setCustomLabels(parsed.filter(label => typeof label === 'string' && label.trim()).map(label => label.trim()));

      }

    } catch (error) {

      console.error('Failed to load measurement labels:', error);

    }

  },[]);

  useEffect(()=>{ redrawPrep(); },[redrawPrep]);

  useEffect(() => {

    if (user && !shopifyMode) loadExportStatus();

  }, [user, shopifyMode]);

  const loadShopifyBillingStatus = useCallback(async () => {

    if (!shopifyMode || !shop) return;

    try {

      const res = await fetch(`/api/shopify/billing?shop=${encodeURIComponent(shop)}`);

      const data = await res.json();

      if (res.ok) setShopifyBilling(data);

    } catch (error) {

      console.error('Failed to load Shopify billing status:', error);

    }

  }, [shopifyMode, shop]);

  useEffect(() => {

    loadShopifyBillingStatus();

  }, [loadShopifyBillingStatus]);

  const handleShopifySubscribe = useCallback(async () => {

    if (!shop || shopifySubscribing) return;

    setShopifySubscribing(true);

    try {

      const res = await fetch('/api/shopify/billing', {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ shop }),

      });

      const data = await res.json();

      if (!res.ok || !data.confirmationUrl) throw new Error(data.error || 'Could not start subscription.');

      window.top.location.href = data.confirmationUrl;

    } catch (error) {

      setBgError(error.message || 'Could not start subscription.');

      setShopifySubscribing(false);

    }

  }, [shop, shopifySubscribing]);



  useEffect(()=>{

    if (phase!=='annotate'||!canvasRef.current||!imgRef.current) return;

    const container=canvasRef.current.parentElement;

    const maxW=container.clientWidth-2;

    const maxH=Math.max(720, window.innerHeight-160);

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

        setExportLayout(draft.exportLayout || 'spec');

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

        imageDataUrl,originalDataUrl,naturalSize,lines,pending,colorIdx,curName,useCustom,customName,curValue,curUnit,brand,itemName,notes,exportBg,exportLayout,footerMode,customFooter,

      }));

      setDraftStatus('ready');

    } catch (error) {

      console.warn('Draft autosave unavailable:', error);

      setDraftStatus('unavailable');

    }

   },[draftKey,phase,imageDataUrl,originalDataUrl,naturalSize,lines,pending,colorIdx,curName,useCustom,customName,curValue,curUnit,brand,itemName,notes,exportBg,exportLayout,footerMode,customFooter]);



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

    setSourceLabel('Original image selected');

    resetAnnotationState();

    clearDraft();

    const dataUrl = await normalizeImageFile(file);

    setOriginalDataUrl(dataUrl);

    await loadWorkingImage(dataUrl, 'prepare');

  },[clearDraft,loadWorkingImage,resetAnnotationState]);




  const getShopifyProductImageUrl = (product) => {
    if (!product) return '';
    const imageCandidates = [
      product.image,
      product.featuredImage,
      Array.isArray(product.images) ? product.images[0] : null,
      product.images?.nodes?.[0],
      product.media?.nodes?.[0]?.image,
    ].filter(Boolean);

    for (const image of imageCandidates) {
      const url = image.url || image.originalSrc || image.src || image.transformedSrc;
      if (url) return url;
    }

    const variantImage = product.variants?.[0]?.image || product.variants?.nodes?.[0]?.image;
    return variantImage?.url || variantImage?.originalSrc || variantImage?.src || '';
  };

  const handlePickShopifyProductImage = useCallback(async ()=>{
    if (typeof window === 'undefined' || !window.shopify?.resourcePicker) {
      setShopifyPickError('Shopify product picker is not available in this preview.');
      return;
    }

    setShopifyPicking(true);
    setShopifyPickError(null);
    setShopifyPickStatus('Opening Shopify product picker...');
    try {
      const pickerPromise = window.shopify.resourcePicker({
        type: 'product',
        action: 'select',
        multiple: false,
        filter: { variants: false },
      });
      const selected = await Promise.race([
        pickerPromise,
        new Promise((_, reject)=>setTimeout(()=>reject(new Error('Shopify picker took too long to respond. Close the picker and try again.')), 30000)),
      ]);
      const product = selected?.[0];
      if (!product) return;

      const imageUrl = getShopifyProductImageUrl(product);
      if (!imageUrl) {
        setShopifyPickError('That product does not have an image to load.');
        return;
      }

      setShopifyPickStatus('Loading product image...');
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(), 20000);
      let response;
      try {
        response = await fetch(imageUrl, { mode: 'cors', signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) throw new Error('Could not download the product image.');
      const blob = await response.blob();
      const dataUrl = await readFileAsDataUrl(blob);

      setBgError(null);
      setSourceLabel(`Shopify product image: ${product.title || 'selected product'}`);
      resetAnnotationState();
      clearDraft();
      setOriginalDataUrl(dataUrl);
      await loadWorkingImage(dataUrl, 'prepare');
      window.shopify.toast?.show?.('Product image loaded');
    } catch (error) {
      setShopifyPickError(error.name === 'AbortError' ? 'The product image download timed out. Try a smaller product image.' : (error.message || 'Could not load Shopify product image.'));
    } finally {
      setShopifyPicking(false);
      setShopifyPickStatus('');
    }
  },[clearDraft,loadWorkingImage,readFileAsDataUrl,resetAnnotationState,shopifyMode]);

  const handleRemoveBackground = useCallback(async ()=>{

    if (!originalDataUrl) return;

    if (shopifyMode) {

      setBgError('Background removal needs a server billing/auth setup before it can be enabled inside Shopify.');

      return;

    }

    setBgRemoving(true);

    setBgError(null);

    try {

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {

        setBgRemoving(false);

        setBgError('Log in to use background removal.');

        return;

      }

      const originalBlob = await fetch(originalDataUrl).then(r=>r.blob());

      const formData = new FormData();

      formData.append('image_file', originalBlob, 'upload.png');

      const res = await fetch('/api/remove-bg', {

        method: 'POST',

        headers: { Authorization: `Bearer ${session.access_token}` },

        body: formData,

      });

      if (!res.ok) {

        const err = await res.json().catch(()=>({}));

        throw new Error(err.error || 'Background removal failed.');

      }

      const blob = await res.blob();

      const dataUrl = await readFileAsDataUrl(blob);

      resetAnnotationState();

      setSourceLabel('PhotoRoom background cleanup selected');

      await loadWorkingImage(dataUrl, 'prepare');

      setBgRemoving(false);

    } catch (error) {

      setBgRemoving(false);

      setBgError(error.message || 'Background removal unavailable.');

    }

  },[originalDataUrl,loadWorkingImage,resetAnnotationState,shopifyMode]);



  const handleGeminiImage = useCallback(async ({ endpoint, view = 'front', label })=>{

    if (!originalDataUrl || aiGenerating) return;

    setAiGenerating(true);

    setAiStatus(label || 'Generating image...');

    setBgError(null);

    try {

      const sourceBlob = await fetch(originalDataUrl).then(r=>r.blob());

      const formData = new FormData();

      formData.append('image_file', sourceBlob, 'garment.jpg');

      formData.append('gender', gender);

      if (view) formData.append('view', view);

      if (shopifyMode && shop) formData.append('shop', shop);



      const res = await fetch(endpoint, { method: 'POST', body: formData });

      if (!res.ok) {

        const err = await res.json().catch(()=>({}));

        if (res.status === 402) {

          if (err.billingStatus) setShopifyBilling(err.billingStatus);

          else loadShopifyBillingStatus();

        }

        throw new Error(err.error || 'Gemini image generation failed.');

      }



      const blob = await res.blob();

      const dataUrl = await readFileAsDataUrl(blob);

      resetAnnotationState();

      setSourceLabel(label || 'Gemini generated image selected');

      await loadWorkingImage(dataUrl, 'prepare');

    } catch (error) {

      setBgError(error.message || 'Gemini image generation unavailable.');

    } finally {

      setAiGenerating(false);

      setAiStatus('');

    }

  },[originalDataUrl,aiGenerating,gender,loadWorkingImage,resetAnnotationState,shopifyMode,shop,loadShopifyBillingStatus]);



  const handleUseOriginal = useCallback(async ()=>{

    if (!originalDataUrl) return;

    resetAnnotationState();

    setSourceLabel('Original image selected');

    await loadWorkingImage(originalDataUrl, 'prepare');

  },[originalDataUrl,loadWorkingImage,resetAnnotationState,shopifyMode]);



  const downloadCurrentImage = useCallback(()=>{
    const canvas = prepCanvasRef.current;
    if (!canvas?.width || !canvas?.height) return;
    const safeName = (sourceLabel || 'measure-image')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'measure-image';
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = safeName + '.png';
    link.click();
  },[sourceLabel]);
  const startMeasuring = useCallback(async ()=>{

    if (!imageDataUrl) return;

    resetAnnotationState();

    const prepCanvas = prepCanvasRef.current;

    if (prepCanvas?.width && prepCanvas?.height) {

      try {

        const cleanedDataUrl = prepCanvas.toDataURL('image/png');

        await loadWorkingImage(cleanedDataUrl, 'annotate');

        return;

      } catch (error) {

        console.warn('Could not snapshot prep canvas, using current image:', error);

      }

    }

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

        const idx=measurementOptions.indexOf(curName);

        if (idx>=0&&idx<measurementOptions.length-1) setCurName(measurementOptions[idx+1]);

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



  const handleCanvasLeave = () => {

    handleMouseUp();

    setCursorPoint(null);

    setHoverIdx(null);

  };



  const handleMove = e => {

    const c=canvasRef.current; if(!c) return;

    const pt=getCanvasPoint(c,e);

    setCursorPoint(pt);



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



  const parseConfigItems = (value) => value

    .split(/[,\n]/)

    .map(item => item.trim())

    .filter(Boolean);



  const isVerticalMeasurement = (name) => /outseam|inseam|rise|sleeve|length|armhole|neck|height|drop|clearance/i.test(name);



  const spawnMeasurementLines = (measurements) => {

    const canvas = canvasRef.current;

    if (!canvas || phase !== 'annotate' || !measurements.length) return false;



    const w = canvas.width;

    const h = canvas.height;

    const marginX = Math.max(26, w * 0.12);

    const marginY = Math.max(26, h * 0.12);

    const usableW = Math.max(80, w - marginX * 2);

    const usableH = Math.max(80, h - marginY * 2);



    const spawned = measurements.map((name, i) => {

      const color = LINE_COLORS[i % LINE_COLORS.length];

      const t = measurements.length === 1 ? 0.5 : (i + 1) / (measurements.length + 1);



      if (isVerticalMeasurement(name)) {

        const x = marginX + usableW * t;

        return {

          name,

          value: '',

          unit: curUnit,

          p1: { x, y: marginY },

          p2: { x, y: marginY + usableH },

          color,

        };

      }



      const y = marginY + usableH * t;

      return {

        name,

        value: '',

        unit: curUnit,

        p1: { x: marginX, y },

        p2: { x: marginX + usableW, y },

        color,

      };

    });



    setLines(spawned);

    setPending(null);

    setHoverIdx(null);

    setColorIdx(spawned.length);

    setShowExport(false);

    return true;

  };



  const applyMeasurementConfig = (config) => {

    if (!config?.measurements?.length) return;

    setSelectedConfigId(config.id);

    setConfigItemsText(config.measurements.join(', '));

    setUseCustom(false);

    setCurName(config.measurements[0]);

    setCurValue('');

    spawnMeasurementLines(config.measurements);

  };




  const saveMeasurementLabel = () => {

    const label = newLabelName.trim();

    if (!label) return;

    const exists = measurementOptions.some(item => item.toLowerCase() === label.toLowerCase());

    const next = exists

      ? customLabels

      : [...customLabels, label].sort((a,b)=>a.localeCompare(b));

    setCustomLabels(next);

    setCurName(label);

    setUseCustom(false);

    setNewLabelName('');

    if (typeof window !== 'undefined') {

      window.localStorage.setItem(CUSTOM_MEASUREMENT_LABELS_KEY, JSON.stringify(next));

    }

  };



  const saveMeasurementConfig = () => {

    const measurements = parseConfigItems(configItemsText);

    const name = configName.trim();

    if (!name || measurements.length === 0) {

      alert('Add a config name and at least one measurement.');

      return;

    }

    const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || Date.now()}`;

    const next = [

      ...customConfigs.filter(config => config.id !== id && config.name.toLowerCase() !== name.toLowerCase()),

      { id, name, measurements },

    ];

    setCustomConfigs(next);

    setSelectedConfigId(id);

    setConfigName('');

    if (typeof window !== 'undefined') {

      window.localStorage.setItem(MEASUREMENT_CONFIGS_KEY, JSON.stringify(next));

    }

    setUseCustom(false);

    setCurName(measurements[0]);

  };



  const activeGuide = pending && cursorPoint

    ? axisGuide(pending, cursorPoint)

    : hoverIdx !== null && lines[hoverIdx]

      ? axisGuide(lines[hoverIdx].p1, lines[hoverIdx].p2)

      : null;



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



  const buildGalleryExportCanvas = () => {

    const src=canvasRef.current; if(!src||!imgRef.current) return null;

    const W=src.width;

    const H=src.height;

    const ec=document.createElement('canvas');

    ec.width=W; ec.height=H;

    const ctx=ec.getContext('2d');

    ctx.fillStyle=exportTheme.panel;

    ctx.fillRect(0,0,W,H);

    renderExportImage(ec,imgRef.current,lines);

    return ec;

  };
  const buildGalleryListExportCanvas = () => {

    const ec=buildGalleryExportCanvas(); if(!ec) return null;

    const ctx=ec.getContext('2d');

    const W=ec.width;

    const H=ec.height;

    if (lines.length>0) {

      const PAD=18;

      const rowH=20;

      const listW=Math.min(Math.max(190, Math.floor(W*0.34)), W-PAD*2);

      const listH=28 + lines.length*rowH + 12;

      const x=W-listW-PAD;

      const y=H-listH-PAD;

      ctx.fillStyle=exportBg==='black'?'rgba(8,8,8,0.82)':'rgba(255,255,255,0.88)';

      ctx.fillRect(x,y,listW,listH);

      ctx.strokeStyle=exportTheme.divider;

      ctx.lineWidth=1;

      ctx.strokeRect(x,y,listW,listH);

      ctx.font='bold 11px monospace';

      ctx.fillStyle=exportTheme.text;

      ctx.textAlign='left';

      ctx.textBaseline='middle';

      ctx.fillText('MEASUREMENTS',x+12,y+16);

      lines.forEach((line,i)=>{

        const ly=y+34+i*rowH;

        ctx.beginPath(); ctx.arc(x+16,ly,5,0,Math.PI*2);

        ctx.fillStyle=line.color; ctx.fill();

        ctx.font='bold 10px monospace'; ctx.fillStyle=exportTheme.muted; ctx.textAlign='left';

        ctx.fillText(`${i+1}.`,x+28,ly);

        ctx.font='11px monospace'; ctx.fillStyle=exportTheme.text;

        const value=line.value?`: ${line.value}${line.unit}`:'';

        ctx.fillText(`${line.name}${value}`,x+48,ly);

      });

    }

    return ec;

  };
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

    const ec = exportLayout === 'gallery' ? buildGalleryExportCanvas() : exportLayout === 'gallery-list' ? buildGalleryListExportCanvas() : buildExportCanvas();

    if (!ec) return;

    const el=exportRef.current;

    el.width=ec.width; el.height=ec.height;

    el.getContext('2d').drawImage(ec,0,0);

    setShowExport(true);

    setTimeout(()=>exportSectionRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),150);

  };



  useEffect(()=>{

    if (!showExport) return;

    const ec = buildExportCanvas();

    const el = exportRef.current;

    if (!ec || !el) return;

    el.width = ec.width;

    el.height = ec.height;

    el.getContext('2d').drawImage(ec,0,0);

  },[showExport,exportBg,exportLayout,footerMode,customFooter,brand,itemName,notes,lines]);



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

      const { data: { session } } = await supabase.auth.getSession();



      if (!session) {

        alert('Log in first to upgrade to Pro.');

        window.location.href = '/login';

        return;

      }



      const response = await fetch('/api/create-checkout-session', {

        method: 'POST',

        headers: { Authorization: `Bearer ${session.access_token}` },

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



  const goToBillingPortal = async () => {

    try {

      const { data: { session } } = await supabase.auth.getSession();



      if (!session) {

        alert('You must be logged in');

        return;

      }



      const response = await fetch('/api/create-portal-session', {

        method: 'POST',

        headers: { Authorization: `Bearer ${session.access_token}` },

      });



      const data = await response.json();



      if (!response.ok) {

        alert(data.error || 'Could not open billing portal');

        return;

      }



      window.location.href = data.url;

    } catch (error) {

      alert('Something went wrong opening the billing portal');

    }

  };



  const downloadExport = async () => {

    if (shopifyMode) {

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



      if (window.shopify?.toast?.show) {

        window.shopify.toast.show('Measurement sheet downloaded');

      }

      return;

    }



    if (!user) {

      alert('Log in to download exports. Free accounts get 1 export per day.');

      window.location.href = '/login';

      return;

    }



    try {

      const result = await consumeExport();



      if (!result.allowed) {

        alert('Free plan limit reached. You get 1 export per day. Upgrade to Pro for unlimited exports.');

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

    lbl:{fontFamily:'monospace',fontSize:9,letterSpacing:'0.18em',textTransform:'uppercase',color:'#9f988c',marginBottom:5,display:'block'},

    inp:{fontFamily:'monospace',fontSize:12,padding:'7px 10px',border:'1px solid #2a2a2a',borderRadius:2,background:'#080808',color:'#f0ebe0',width:'100%'},

    ghost:{padding:'6px 10px',background:'transparent',border:'1px solid #1e1e1e',fontFamily:'monospace',fontSize:9,letterSpacing:'0.12em',textTransform:'uppercase',color:'#9f988c',cursor:'pointer',borderRadius:2},

  };



  const instr=activeHandle

    ?{text:`Dragging ${lines[activeHandle.lineIdx]?.name || 'measurement'} endpoint`,color:'#FFB74D'}

    :!pending

      ?{text:`Click START of "${activeName}"`,color:'#4FC3F7'}

      :{text:`Click END of "${activeName}"`,color:'#81C784'};



  return (

    <div style={{background:'#0d0d0d',minHeight:shopifyMode?'calc(100vh - 48px)':'100vh',color:'#f0ebe0',display:'flex',flexDirection:'column',fontFamily:'monospace'}}>

      <div style={{borderBottom:'1px solid #1a1a1a',padding:shopifyMode?'8px 20px':'12px 24px',display:'flex',alignItems:'center',gap:14}}>

        <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700}}>

          MEAS<span style={{color:'#e8b84b'}}>UR</span>E

        </div>

        <div style={{width:1,height:14,background:'#2a2a2a'}}/>

        <div style={{fontSize:9,color:'#9f988c',letterSpacing:'0.18em',textTransform:'uppercase'}}>Garment Annotation Tool</div>

        {phase==='annotate'&&(

          <div style={{marginLeft:'auto',display:'flex',gap:8}}>

            <button onClick={handleExport} style={{padding:'6px 16px',background:'#e8b84b',border:'none',fontFamily:'monospace',fontSize:9,letterSpacing:'0.15em',textTransform:'uppercase',cursor:'pointer',borderRadius:2,color:'#0d0d0d'}}>{exportLayout === 'spec' ? 'Generate Sheet' : exportLayout === 'gallery-list' ? 'Generate Gallery + List' : 'Generate Gallery Image'}</button>

            <button onClick={async()=>{clearDraft(); if (imageDataUrl) await loadWorkingImage(imageDataUrl,'prepare');}} style={S.ghost}>Back to Prep</button>

            <button onClick={()=>fileRef.current.click()} style={S.ghost}>New Photo</button>

          </div>

        )}

      </div>



      {phase==='upload'&&(

        <div style={{flex:1,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:shopifyMode?'18px 24px 22px':'40px'}}>

          <div style={{maxWidth:460,width:'100%',display:'flex',flexDirection:'column',gap:shopifyMode?14:24}}>

            <div>

              <div style={{fontFamily:"'Playfair Display',serif",fontSize:shopifyMode?26:30,fontWeight:700,lineHeight:1.15,marginBottom:shopifyMode?8:10}}>

                Ghost mannequin photos.<br/><span style={{color:'#e8b84b'}}>Measurement sheets.</span>

              </div>

              <p style={{fontSize:13,color:'#d6d0c4',lineHeight:shopifyMode?1.55:1.75}}>Upload a garment photo, create a clean ghost mannequin image, then add measurement lines, enter your values, and export a listing-ready sheet.</p>

            </div>

            {true && (
              <button onClick={handlePickShopifyProductImage} disabled={shopifyPicking} style={{padding:'10px 12px',background:'#e8b84b',border:'none',fontFamily:'monospace',fontSize:10,letterSpacing:'0.12em',textTransform:'uppercase',cursor:shopifyPicking?'default':'pointer',borderRadius:2,color:'#0d0d0d',opacity:shopifyPicking?0.65:1}}>
                {shopifyPicking ? (shopifyPickStatus || 'Working...') : 'Pick Shopify Product Image'}
              </button>
            )}
            {shopifyPickError && (
              <div style={{fontSize:11,color:'#FFB74D',lineHeight:1.5,border:'1px solid #5a3514',padding:'8px 10px',background:'#140c04'}}>{shopifyPickError}</div>
            )}

            <div onClick={()=>fileRef.current.click()} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}} style={{border:`2px dashed ${dragging?'#e8b84b':'#222'}`,borderRadius:4,padding:shopifyMode?'34px 34px':'52px 40px',textAlign:'center',cursor:'pointer',transition:'border-color 0.2s'}}>

              <div style={{fontSize:15,marginBottom:12,fontFamily:'monospace',letterSpacing:'0.12em',textTransform:'uppercase',color:'#e8b84b'}}>Photo</div>

              <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:5}}>Drop your garment photo here</div>

              <div style={{fontSize:11,color:'#c8c0b3',letterSpacing:'0.12em'}}>OR CLICK TO BROWSE - JPG PNG WEBP</div>

            </div>

          </div>

        </div>

      )}



      {phase==='prepare'&&(

        <div style={{flex:1,display:'grid',gridTemplateColumns:'280px 1fr',minHeight:0}}>

          <div style={{borderRight:'1px solid #1a1a1a',padding:'16px',display:'flex',flexDirection:'column',gap:12,overflowY:'auto'}}>

            <div style={{background:'#080808',border:'1px solid #1e1e1e',borderRadius:2,padding:'13px'}}>

              <div style={{fontSize:9,color:'#e8b84b',letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:8}}>Image Prep</div>

              <div style={{fontSize:12,color:'#d0c8bb',lineHeight:1.65}}>Choose the source you want to measure. Background removal is optional. Crop before adding measurement lines.</div>

            </div>



            <div style={{display:'grid',gap:8}}>

              {shopifyMode && shopifyBilling && shopifyBilling.plan === 'none' && (
                <div style={{padding:'10px 12px',background:'#1a1408',border:'1px solid #e8b84b44',borderRadius:2,display:'flex',flexDirection:'column',gap:8,alignItems:'center'}}>
                  <div style={{fontSize:10,color:'#e8b84b',letterSpacing:'0.08em',textAlign:'center'}}>SUBSCRIBE TO GENERATE IMAGES — $12.95/MONTH, 7-DAY FREE TRIAL</div>
                  <button onClick={handleShopifySubscribe} disabled={shopifySubscribing} style={{padding:'8px 12px',background:'#e8b84b',border:'none',fontFamily:'monospace',fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',cursor:shopifySubscribing?'default':'pointer',borderRadius:2,color:'#0d0d0d',opacity:shopifySubscribing?0.65:1}}>
                    {shopifySubscribing ? 'Redirecting...' : 'Start Free Trial'}
                  </button>
                </div>
              )}

              {shopifyMode && shopifyBilling && shopifyBilling.plan === 'cancelled' && (
                <div style={{padding:'10px 12px',background:'#1a1408',border:'1px solid #e8b84b44',borderRadius:2,display:'flex',flexDirection:'column',gap:8,alignItems:'center'}}>
                  <div style={{fontSize:10,color:'#e8b84b',letterSpacing:'0.08em',textAlign:'center'}}>SUBSCRIPTION CANCELLED — RESUBSCRIBE TO GENERATE IMAGES</div>
                  <button onClick={handleShopifySubscribe} disabled={shopifySubscribing} style={{padding:'8px 12px',background:'#e8b84b',border:'none',fontFamily:'monospace',fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',cursor:shopifySubscribing?'default':'pointer',borderRadius:2,color:'#0d0d0d',opacity:shopifySubscribing?0.65:1}}>
                    {shopifySubscribing ? 'Redirecting...' : 'Resubscribe'}
                  </button>
                </div>
              )}

              {shopifyMode && shopifyBilling && ['trialing','active'].includes(shopifyBilling.plan) && (
                <div style={{fontSize:9,color:'#999',letterSpacing:'0.08em',textAlign:'center'}}>
                  {shopifyBilling.plan === 'trialing' ? 'FREE TRIAL — ' : ''}{shopifyBilling.remaining} OF {shopifyBilling.limit} IMAGES LEFT THIS MONTH
                </div>
              )}

              {true && (
                <button onClick={handlePickShopifyProductImage} disabled={shopifyPicking} style={{padding:'8px 12px',background:'#111',border:'1px solid #e8b84b44',fontFamily:'monospace',fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',cursor:shopifyPicking?'default':'pointer',borderRadius:2,color:'#e8b84b',opacity:shopifyPicking?0.65:1}}>
                  {shopifyPicking ? (shopifyPickStatus || 'Working...') : 'Pick Shopify Product Image'}
                </button>
              )}
              {shopifyPickError && <div style={{fontSize:10,color:'#FFB74D',lineHeight:1.5}}>{shopifyPickError}</div>}

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>

                <button onClick={()=>setGender('female')} style={{...S.ghost,color:gender==='female'?'#e8b84b':'#555',borderColor:gender==='female'?'#e8b84b44':'#1e1e1e'}}>Women</button>

                <button onClick={()=>setGender('male')} style={{...S.ghost,color:gender==='male'?'#4FC3F7':'#555',borderColor:gender==='male'?'#4FC3F744':'#1e1e1e'}}>Men</button>

              </div>

              <button onClick={()=>handleGeminiImage({endpoint:'/api/ghost-mannequin',view:'front',label:'Gemini ghost mannequin selected'})} disabled={aiGenerating} style={{padding:'8px 12px',background:'#e8b84b',border:'none',fontFamily:'monospace',fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',cursor:aiGenerating?'default':'pointer',borderRadius:2,color:'#0d0d0d',opacity:aiGenerating?0.6:1}}>Create Ghost Mannequin</button>

              <button onClick={()=>handleGeminiImage({endpoint:'/api/clean-flat-lay',view:'',label:'Clean flat lay selected'})} disabled={aiGenerating} style={{...S.ghost,color:'#e8b84b',borderColor:'#e8b84b44',opacity:aiGenerating?0.6:1}}>Clean Flat Lay</button>

              <button onClick={()=>handleGeminiImage({endpoint:'/api/retail-mannequin',view:'',label:'Retail mannequin selected'})} disabled={aiGenerating} style={{...S.ghost,color:'#f0ebe0',borderColor:'#f0ebe044',opacity:aiGenerating?0.6:1}}>Retail Mannequin</button>

              <button onClick={()=>handleGeminiImage({endpoint:'/api/model-dressup',view:'',label:'Gemini model dress-up selected'})} disabled={aiGenerating} style={{...S.ghost,color:'#4FC3F7',borderColor:'#4FC3F744',opacity:aiGenerating?0.6:1}}>Model Dress-Up</button>

              <button onClick={handleUseOriginal} style={{...S.ghost, color: originalDataUrl === imageDataUrl ? '#e8b84b' : '#555', borderColor: originalDataUrl === imageDataUrl ? '#e8b84b44' : '#1e1e1e'}}>Use Original Image</button>

              <button onClick={downloadCurrentImage} style={{...S.ghost,color:'#81C784',borderColor:'#81C78444'}}>Download Current Image</button>

              <button onClick={handleRemoveBackground} style={S.ghost}>PhotoRoom Cleanup</button>



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

                <div style={{fontSize:12,color:'#c8c0b3',lineHeight:1.6,marginTop:8}}>Drag on the image to erase hanger parts before measuring.</div>

              </div>

            )}



            <div style={{background:'#080808',border:'1px solid #1e1e1e',borderRadius:2,padding:'11px 12px'}}>

              <div style={{fontSize:9,color:'#e8b84b',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:4}}>Current source</div>

              <div style={{fontSize:12,color:'#d6d0c4',lineHeight:1.6}}>{sourceLabel}</div>

            </div>



            <button onClick={startMeasuring} style={{padding:'11px',background:'#e8b84b',border:'none',fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,letterSpacing:'0.06em',cursor:'pointer',borderRadius:2,color:'#0d0d0d'}}>Add Measurement Lines</button>

          </div>



         <div style={{overflow:'auto',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',background:'#060606',position:'relative'}}>

  {aiGenerating&&(

    <div style={{position:'absolute',inset:0,background:'rgba(6,6,6,0.9)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,zIndex:11}}>

      <div style={{position:'relative',width:48,height:48}}>{[0,1].map(i=><div key={i} style={{position:'absolute',inset:i*7,borderRadius:'50%',border:'1.5px solid transparent',borderTopColor:i===0?'#e8b84b':'#333',animation:'spin 0.9s linear infinite'}}/>)}</div>

      <div style={{fontFamily:'monospace',fontSize:10,color:'#e8b84b',letterSpacing:'0.15em',textTransform:'uppercase'}}>{aiStatus}</div>

      <div style={{fontFamily:'monospace',fontSize:9,color:'#9f988c',letterSpacing:'0.1em'}}>Powered by Gemini - this may take 20-30 seconds</div>

    </div>

  )}



  {bgRemoving&&(

    <div style={{position:'absolute',inset:0,background:'rgba(6,6,6,0.88)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,zIndex:10}}>

      <div style={{position:'relative',width:48,height:48}}>{[0,1].map(i=><div key={i} style={{position:'absolute',inset:i*7,borderRadius:'50%',border:'1.5px solid transparent',borderTopColor:i===0?'#e8b84b':'#333',animation:`spin ${i===0?0.9:1.3}s linear infinite ${i?'reverse':''}`}}/>)}</div>

      <div style={{fontFamily:'monospace',fontSize:10,color:'#e8b84b',letterSpacing:'0.15em',textTransform:'uppercase'}}>Removing background...</div>

      <div style={{fontFamily:'monospace',fontSize:9,color:'#9f988c',letterSpacing:'0.1em'}}>Powered by PhotoRoom</div>

    </div>

  )}



  {bgError&&(

    <div style={{position:'absolute',top:12,left:'50%',transform:'translateX(-50%)',background:'rgba(90,26,26,0.95)',border:'1px solid #c8401a',borderRadius:2,padding:'8px 16px',zIndex:10,whiteSpace:'nowrap'}}>

      <span style={{fontFamily:'monospace',fontSize:9,color:'#EF9A9A',letterSpacing:'0.1em'}}>{bgError}</span>

      <button onClick={()=>setBgError(null)} style={{background:'transparent',border:'none',color:'#EF9A9A',cursor:'pointer',marginLeft:10,fontSize:12}}>x</button>

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

              <div style={{background:'#080808',border:'1px solid #1e1e1e',borderRadius:2,padding:'13px',display:'grid',gap:8}}>

                <span style={{...S.lbl,color:'#e8b84b',marginBottom:0}}>Measurement Config</span>

                <select value={selectedConfigId} onChange={e=>{const config=allMeasurementConfigs.find(item=>item.id===e.target.value); if(config) applyMeasurementConfig(config);}} style={S.inp}>

                  {allMeasurementConfigs.map(config=><option key={config.id} value={config.id}>{config.name}</option>)}

                </select>

                <textarea value={configItemsText} onChange={e=>setConfigItemsText(e.target.value)} rows={2} placeholder='Waist, Hip, Rise, Inseam' style={{...S.inp,resize:'vertical',lineHeight:1.5}} />

                <input type='text' value={configName} onChange={e=>setConfigName(e.target.value)} placeholder='Save as config name' style={S.inp} />

                <div style={{display:'flex',gap:6}}>

                  <button onClick={()=>applyMeasurementConfig({id:selectedConfigId,name:'Current',measurements:parseConfigItems(configItemsText)})} style={{...S.ghost,flex:1,color:'#e8b84b',borderColor:'#e8b84b44'}}>{phase==='annotate'?'Spawn Lines':'Use Config'}</button>

                  <button onClick={saveMeasurementConfig} style={{...S.ghost,flex:1}}>Save</button>

                </div>

              </div>



              <div style={{background:'#080808',border:'1px solid #1e1e1e',borderRadius:2,padding:'13px'}}>

                <span style={{...S.lbl,color:'#4FC3F7',marginBottom:10}}>Add Measurement</span>

                <div style={{background:`${instr.color}11`,border:`1px solid ${instr.color}33`,borderRadius:2,padding:'8px 10px',marginBottom:12}}><div style={{fontSize:10,color:instr.color,fontWeight:'bold'}}>{instr.text}</div></div>

                <div style={{marginBottom:8}}>

                  <label style={S.lbl}>Name</label>

                  <select value={useCustom?'__custom__':curName} onChange={e=>{if(e.target.value==='__custom__')setUseCustom(true);else{setUseCustom(false);setCurName(e.target.value);}}} style={S.inp}>

                    {measurementOptions.map(m=><option key={m} value={m}>{m}</option>)}

                    <option value='__custom__'>Custom...</option>

                  </select>

                </div>

                {useCustom&&<div style={{marginBottom:8}}><label style={S.lbl}>Custom Name</label><input type='text' placeholder='e.g. Crotch depth' value={customName} onChange={e=>setCustom(e.target.value)} style={S.inp}/></div>}

                <div style={{marginBottom:8}}>

                  <label style={S.lbl}>Save Label</label>

                  <div style={{display:'flex',gap:6}}>

                    <input type='text' placeholder='e.g. Crotch depth' value={newLabelName} onChange={e=>setNewLabelName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveMeasurementLabel();}}} style={{...S.inp,flex:1}}/>

                    <button onClick={saveMeasurementLabel} style={{...S.ghost,color:'#e8b84b',borderColor:'#e8b84b44',flexShrink:0}}>Add</button>

                  </div>

                </div>

                <div style={{display:'flex',gap:6}}>

                  <div style={{flex:1}}><label style={S.lbl}>Value (optional)</label><input type='text' placeholder='e.g. 16.5' value={curValue} onChange={e=>setCurValue(e.target.value)} style={S.inp}/></div>

                  <div style={{width:58}}><label style={S.lbl}>Unit</label><select value={curUnit} onChange={e=>setCurUnit(e.target.value)} style={S.inp}><option value='"'>in</option><option value='cm'>cm</option></select></div>

                </div>

              </div>



              <div style={{background:'#080808',border:'1px solid #1e1e1e',borderRadius:2,padding:'11px 12px'}}>

                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:8}}>

                  <span style={{...S.lbl,color:activeGuide?guideColor(activeGuide):'#555',marginBottom:0}}>Straightness Gauge</span>

                  <span style={{fontSize:9,color:activeGuide?guideColor(activeGuide):'#444'}}>{activeGuide ? activeGuide.label : 'Draw or hover a line'}</span>

                </div>

                <div style={{height:6,background:'#151515',border:'1px solid #222',borderRadius:999,overflow:'hidden'}}>

                  <div style={{height:'100%',width:activeGuide?`${Math.max(8,100-Math.min(activeGuide.deviation,10)*10)}%`:'0%',background:activeGuide?guideColor(activeGuide):'#333',transition:'width 0.12s'}} />

                </div>

                <div style={{fontSize:11,color:'#c8c0b3',lineHeight:1.6,marginTop:7}}>Green is straight. Gold is close. Orange means the line is tilted off horizontal or vertical. Drag spawned endpoints to place each saved measurement.</div>

              </div>



              <div style={{display:'flex',gap:6}}>

                <button onClick={undo} style={{...S.ghost,flex:1}}>Undo</button>

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

                          <button onClick={()=>delLine(i)} style={{background:'transparent',border:'none',color:'#333',cursor:'pointer',fontSize:13,padding:'0 2px',flexShrink:0}}>x</button>

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

                    <label style={S.lbl}>Export Layout</label>

                    <div style={{display:'flex',gap:6}}>

                      <button onClick={()=>setExportLayout('spec')} style={{...S.ghost,flex:1,color:exportLayout==='spec'?'#e8b84b':'#555',borderColor:exportLayout==='spec'?'#e8b84b44':'#1e1e1e'}}>Spec Sheet</button>

                      <button onClick={()=>setExportLayout('gallery')} style={{...S.ghost,flex:1,color:exportLayout==='gallery'?'#e8b84b':'#555',borderColor:exportLayout==='gallery'?'#e8b84b44':'#1e1e1e'}}>Gallery Image</button>

                      <button onClick={()=>setExportLayout('gallery-list')} style={{...S.ghost,flex:1,color:exportLayout==='gallery-list'?'#e8b84b':'#555',borderColor:exportLayout==='gallery-list'?'#e8b84b44':'#1e1e1e'}}>Gallery + List</button>

                    </div>

                  </div>

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

                  <button onClick={handleExport} style={{padding:'11px',background:'#e8b84b',border:'none',fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,letterSpacing:'0.06em',cursor:'pointer',borderRadius:2,color:'#0d0d0d'}}>{exportLayout === 'spec' ? 'Generate Sheet' : exportLayout === 'gallery-list' ? 'Generate Gallery + List' : 'Generate Gallery Image'}</button>

                </div>

              )}

            </div>



            <div style={{overflow:'auto',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'20px',background:'#060606',position:'relative'}}>

              <canvas ref={canvasRef} onClick={handleCanvasClick} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseLeave={handleCanvasLeave} onMouseMove={handleMove} style={{cursor:activeHandle ? 'grabbing' : 'crosshair',borderRadius:2,maxWidth:'100%',boxShadow:'0 4px 40px rgba(0,0,0,0.7)'}}/>

            </div>

          </div>



          <div ref={exportSectionRef} style={{display:showExport?'flex':'none',borderTop:'2px solid #e8b84b44',padding:'28px 32px',background:'#060606',flexDirection:'column',alignItems:'center',gap:16}}>

            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:'#e8b84b'}}>{exportLayout === 'spec' ? 'Measurement Sheet' : exportLayout === 'gallery-list' ? 'Gallery + List' : 'Gallery Image'}</div>

            <p style={{fontFamily:'monospace',fontSize:12,color:'#c8c0b3',letterSpacing:'0.08em',textAlign:'center',lineHeight:1.7}}>{exportLayout === 'spec' ? 'Export the finished sheet directly as a PNG.' : exportLayout === 'gallery-list' ? 'Export the annotated product image with a compact measurement list.' : 'Export the annotated product image directly as a PNG.'}</p>



            <canvas ref={exportRef} style={{maxWidth:'min(100%, 640px)',borderRadius:2,boxShadow:'0 8px 48px rgba(0,0,0,0.8)',border:'1px solid #2a2a2a',background:exportTheme.panel}}/>



            <div style={{display:'flex',gap:8,marginTop:4,flexWrap:'wrap',justifyContent:'center'}}>

              <button onClick={downloadExport} style={{padding:'8px 14px',background:'#e8b84b',border:'none',fontFamily:'monospace',fontSize:9,letterSpacing:'0.15em',textTransform:'uppercase',cursor:'pointer',borderRadius:2,color:'#0d0d0d'}}>Download PNG</button>

              <button onClick={handleExport} style={{...S.ghost,color:'#e8b84b',borderColor:'#e8b84b44'}}>Regenerate</button>

              <button onClick={()=>setShowExport(false)} style={S.ghost}>Close</button>

              {exportStatus?.plan === 'pro' ? (

                <button onClick={goToBillingPortal} style={{...S.ghost,display:shopifyMode?'none':'inline-block',color:'#7dd3fc',borderColor:'#7dd3fc44'}}>

                  Manage Billing

                </button>

              ) : (

                <button onClick={goToCheckout} style={{...S.ghost,display:shopifyMode?'none':'inline-block',color:'#7dd3fc',borderColor:'#7dd3fc44'}}>

                  Upgrade to Pro

                </button>

              )}

            </div>



            {shopifyMode && (

              <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 10, color: '#999', letterSpacing: '0.08em', textAlign: 'center' }}>

                SHOPIFY APP MODE: EXPORTS DOWNLOAD DIRECTLY IN ADMIN

              </div>

            )}



            {!shopifyMode && exportStatus && (

              <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 10, color: '#999', letterSpacing: '0.08em', textAlign: 'center' }}>

                {exportStatus.plan === 'pro'

                  ? 'PRO PLAN: UNLIMITED EXPORTS'

                  : `FREE PLAN: ${exportStatus.remaining} OF ${exportStatus.limit ?? 1} EXPORT${(exportStatus.limit ?? 1) === 1 ? '' : 'S'} LEFT TODAY`}

              </div>

            )}

          </div>

        </div>

      )}



      <input ref={fileRef} type='file' accept='image/*' style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>



      <div style={{borderTop:'1px solid #111',padding:'7px 24px',display:'flex',justifyContent:'space-between'}}>

        <span style={{fontSize:8,color:'#1e1e1e'}}>MEASURE - Garment Annotation Tool</span>

        <span style={{fontSize:8,color:'#1e1e1e'}}>Prep - Click - Drag - Export</span>

      </div>

    </div>

  );

}



