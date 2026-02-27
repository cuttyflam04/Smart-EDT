import React, { useRef, useEffect, useState } from 'react';
import { Eraser, MousePointerClick, Download, X, Undo, Redo, Type, Square, Check, Hand, ZoomIn, ZoomOut, Maximize, Settings, Pipette, AlignLeft, AlignCenter, AlignRight, Maximize2, Palette, Layers } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (editedImageUrl: string) => void;
  autoRotateEnabled: boolean;
  enabledFeatures: {
    removeText: boolean;
    removeColor: boolean;
    wordBox: boolean;
    wordBoxSimplified: boolean;
    eraser: boolean;
    zoom: boolean;
    undoRedo: boolean;
  };
}

interface TextElement {
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  fontFamily: string;
}

export default function ImageEditor({ imageUrl, onClose, onSave, autoRotateEnabled, enabledFeatures }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<'wand' | 'eraser' | 'remove-text' | 'hand' | 'pipette' | 'text-box' | 'brush'>('remove-text');
  const [prevTool, setPrevTool] = useState<'wand' | 'eraser' | 'remove-text' | 'hand' | 'pipette' | 'text-box' | 'brush'>('remove-text');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  
  const [brushSize, setBrushSize] = useState(20);
  const [manualBgColor, setManualBgColor] = useState('#ffffff');
  const [useManualColor, setUseManualColor] = useState(false);

  const [isEnteringText, setIsEnteringText] = useState(false);
  const [pendingTextBox, setPendingTextBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [boxText, setBoxText] = useState('');
  const [boxFontSize, setBoxFontSize] = useState(16);
  const [boxColor, setBoxColor] = useState('#000000');
  const [boxBgColor, setBoxBgColor] = useState('#ffffff');
  const [boxHasBg, setBoxHasBg] = useState(true);
  const [boxPadding, setBoxPadding] = useState(10);
  const [boxAlignment, setBoxAlignment] = useState<'left' | 'center' | 'right'>('left');
  const [boxBorderWidth, setBoxBorderWidth] = useState(0);
  const [boxBorderColor, setBoxBorderColor] = useState('#000000');
  const [boxBorderRadius, setBoxBorderRadius] = useState(0);
  const [boxBgOpacity, setBoxBgOpacity] = useState(1);
 
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
 
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [scale, setScale] = useState(1);
  const [isRotated, setIsRotated] = useState(false);

  // Handle orientation and rotation
  useEffect(() => {
    // Try to lock orientation if supported
    if (autoRotateEnabled && screen.orientation && (screen.orientation as any).lock) {
      (screen.orientation as any).lock('landscape').catch(() => {});
    } else if (!autoRotateEnabled && screen.orientation && (screen.orientation as any).unlock) {
      (screen.orientation as any).unlock();
    }

    // Auto-rotate UI if we are on a narrow screen (portrait)
    const checkOrientation = () => {
      if (autoRotateEnabled && window.innerHeight > window.innerWidth && window.innerWidth < 768) {
        setIsRotated(true);
      } else {
        setIsRotated(false);
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space' && tool !== 'hand') {
        e.preventDefault();
        setPrevTool(tool);
        setTool('hand');
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setScale(s => Math.min(10, s + 0.2));
        } else if (e.key === '-') {
          e.preventDefault();
          setScale(s => Math.max(0.1, s - 0.2));
        } else if (e.key === '0') {
          e.preventDefault();
          resetView();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space' && tool === 'hand') {
        setTool(prevTool);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (screen.orientation && (screen.orientation as any).unlock) {
        (screen.orientation as any).unlock();
      }
    };
  }, [tool, imageLoaded, imageSize, isRotated, prevTool, autoRotateEnabled]);

  // Load image onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      setImageSize({ width: img.width, height: img.height });
      setImageLoaded(true);
      saveState();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Recalculate scale when orientation or image changes
  useEffect(() => {
    if (!imageLoaded || !containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth - 40;
    const containerHeight = containerRef.current.clientHeight - 40;
    
    const availW = isRotated ? containerHeight : containerWidth;
    const availH = isRotated ? containerWidth : containerHeight;
    
    const scaleX = availW / imageSize.width;
    const scaleY = availH / imageSize.height;
    setScale(Math.min(scaleX, scaleY, 1));
  }, [isRotated, imageLoaded, imageSize]);

  const resetView = () => {
    setPanOffset({ x: 0, y: 0 });
    if (containerRef.current && imageLoaded) {
      const containerWidth = containerRef.current.clientWidth - 40;
      const containerHeight = containerRef.current.clientHeight - 40;
      const availW = isRotated ? containerHeight : containerWidth;
      const availH = isRotated ? containerWidth : containerHeight;
      const fitScale = Math.min(availW / imageSize.width, availH / imageSize.height, 1);
      setScale(fitScale);
    } else {
      setScale(1);
    }
  };

  const saveState = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      putImageData(history[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      putImageData(history[newIndex]);
    }
  };

  const putImageData = (imageData: ImageData) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.putImageData(imageData, 0, 0);
  };

  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    if (isRotated) {
      // Coordinate mapping for rotated UI
      const x = (clientY - rect.top) * (canvas.width / rect.height);
      const y = (rect.right - clientX) * (canvas.height / rect.width);
      return { x, y };
    }

    // Normal coordinate mapping
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY;
      const factor = Math.pow(1.1, delta / 100);
      const newScale = Math.min(Math.max(0.1, scale * factor), 10);
      
      if (newScale !== scale && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;
        
        const scaleRatio = newScale / scale;
        setPanOffset(prev => ({
          x: mouseX - (mouseX - prev.x) * scaleRatio,
          y: mouseY - (mouseY - prev.y) * scaleRatio
        }));
        
        setScale(newScale);
      }
    } else {
      // Normal scroll translates the view
      // Support Shift + Wheel for horizontal scrolling on standard mice
      let dx = e.deltaX;
      let dy = e.deltaY;

      if (e.shiftKey && dx === 0) {
        dx = dy;
        dy = 0;
      }

      if (isRotated) {
        // When UI is rotated 90deg, we swap scroll axes to match visual movement
        setPanOffset(prev => ({
          x: prev.x - dy,
          y: prev.y + dx
        }));
      } else {
        setPanOffset(prev => ({
          x: prev.x - dx,
          y: prev.y - dy
        }));
      }
    }
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length === 2) {
      setIsDrawing(false);
      setIsPanning(true);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastTouchDistance(dist);
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setLastPanPos({ x: midX, y: midY });
      return;
    }

    if (tool === 'hand' || (e as any).button === 1) {
      setIsPanning(true);
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      setLastPanPos({ x: clientX, y: clientY });
      return;
    }

    const pos = getMousePos(e);
    
    setStartPos(pos);
    setCurrentPos(pos);
    setIsDrawing(true);

    if (tool === 'brush') {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = brushSize;
      }
    }

    if (tool === 'wand') {
      removeColorAt(pos.x, pos.y);
      setIsDrawing(false);
      return;
    }

    if (tool === 'pipette') {
      sampleColorAt(pos.x, pos.y);
      setIsDrawing(false);
      return;
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length === 2 && lastTouchDistance !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist / lastTouchDistance;
      setScale(s => Math.min(Math.max(0.1, s * delta), 5));
      setLastTouchDistance(dist);
      
      // Also pan with two fingers
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dx = midX - lastPanPos.x;
      const dy = midY - lastPanPos.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPos({ x: midX, y: midY });
      return;
    }

    if (isPanning) {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      
      const dx = clientX - lastPanPos.x;
      const dy = clientY - lastPanPos.y;
      
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPos({ x: clientX, y: clientY });
      return;
    }

    if (!isDrawing || tool === 'wand') return;
    
    const pos = getMousePos(e);
    
    if (tool === 'brush') {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
    }
    
    setCurrentPos(pos);
  };

  const handlePointerUp = () => {
    setLastTouchDistance(null);
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    if (width === 0 || height === 0) return;

    if (tool === 'eraser') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, y, width, height);
      saveState();
    } else if (tool === 'brush') {
      saveState();
    } else if (tool === 'text-box') {
      setPendingTextBox({ x, y, w: width, h: height });
      setIsEnteringText(true);
    } else if (tool === 'remove-text') {
      let finalBgColor = '';

      if (useManualColor) {
        finalBgColor = manualBgColor;
      } else {
        // To get the best background color, we sample pixels just OUTSIDE the selection
        const samplePadding = 2;
        const sampleX = Math.max(0, x - samplePadding);
        const sampleY = Math.max(0, y - samplePadding);
        const sampleW = Math.min(canvas.width - sampleX, width + samplePadding * 2);
        const sampleH = Math.min(canvas.height - sampleY, height + samplePadding * 2);
        
        const sampleData = ctx.getImageData(sampleX, sampleY, sampleW, sampleH).data;
        
        const colors: Record<string, {r: number, g: number, b: number, count: number}> = {};
        let maxCount = 0;
        let bgR = 255, bgG = 255, bgB = 255;

        // Sample only the outermost pixels of this slightly larger area
        for (let py = 0; py < sampleH; py++) {
          for (let px = 0; px < sampleW; px++) {
            if (px === 0 || px === sampleW - 1 || py === 0 || py === sampleH - 1) {
              const i = (py * sampleW + px) * 4;
              const r = sampleData[i], g = sampleData[i+1], b = sampleData[i+2];
              
              // Ignore dark pixels (borders/text)
              if (r < 80 && g < 80 && b < 80) continue;

              const key = `${Math.round(r/5)*5},${Math.round(g/5)*5},${Math.round(b/5)*5}`;
              if (!colors[key]) colors[key] = { r, g, b, count: 0 };
              colors[key].count++;
              if (colors[key].count > maxCount) {
                maxCount = colors[key].count;
                bgR = r; bgG = g; bgB = b;
              }
            }
          }
        }
        finalBgColor = `rgb(${bgR}, ${bgG}, ${bgB})`;
      }

      ctx.fillStyle = finalBgColor;
      
      // Apply the mask to the exact selection area
      ctx.fillRect(x, y, width, height);
      saveState();
    }
  };

  const sampleColorAt = (x: number, y: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Sample pixel color
    const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    const color = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
    
    setManualBgColor(color);
    setUseManualColor(true);
    setTool('remove-text'); // Return to remove-text tool after picking color
  };

  const removeColorAt = (startX: number, startY: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    const sx = Math.floor(startX);
    const sy = Math.floor(startY);
    
    if (sx < 0 || sx >= width || sy < 0 || sy >= height) return;

    const startIndex = (sy * width + sx) * 4;
    const targetR = data[startIndex], targetG = data[startIndex + 1], targetB = data[startIndex + 2];

    if (targetR > 240 && targetG > 240 && targetB > 240) return;
    if (targetR < 50 && targetG < 50 && targetB < 50) return;

    const tolerance = 40;
    const matchColor = (r: number, g: number, b: number) => {
      const distance = Math.sqrt(Math.pow(r - targetR, 2) + Math.pow(g - targetG, 2) + Math.pow(b - targetB, 2));
      return distance < tolerance;
    };

    const stack = [sx, sy];
    const visited = new Uint8Array(width * height);
    
    while (stack.length > 0) {
      const y = stack.pop()!, x = stack.pop()!;
      const idx = y * width + x;
      if (visited[idx]) continue;
      visited[idx] = 1;

      const p = idx * 4;
      if (matchColor(data[p], data[p+1], data[p+2])) {
        data[p] = 255; data[p+1] = 255; data[p+2] = 255; data[p+3] = 255;
        if (x > 0 && !visited[idx - 1]) stack.push(x - 1, y);
        if (x < width - 1 && !visited[idx + 1]) stack.push(x + 1, y);
        if (y > 0 && !visited[idx - width]) stack.push(x, y - 1);
        if (y < height - 1 && !visited[idx + width]) stack.push(x, y + 1);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    saveState();
  };

  const commitTextBox = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !pendingTextBox) return;

    const { x, y, w, h } = pendingTextBox;

    ctx.save();

    // Draw background if needed
    if (boxHasBg) {
      ctx.globalAlpha = boxBgOpacity;
      ctx.fillStyle = boxBgColor;
      if (boxBorderRadius > 0) {
        ctx.beginPath();
        // @ts-ignore - roundRect might not be in all types yet but is in modern browsers
        if (ctx.roundRect) {
          // @ts-ignore
          ctx.roundRect(x, y, w, h, boxBorderRadius);
        } else {
          ctx.rect(x, y, w, h);
        }
        ctx.fill();
      } else {
        ctx.fillRect(x, y, w, h);
      }
      ctx.globalAlpha = 1;
    }

    // Draw border if needed
    if (boxBorderWidth > 0) {
      ctx.strokeStyle = boxBorderColor;
      ctx.lineWidth = boxBorderWidth;
      if (boxBorderRadius > 0) {
        ctx.beginPath();
        // @ts-ignore
        if (ctx.roundRect) {
          // @ts-ignore
          ctx.roundRect(x, y, w, h, boxBorderRadius);
        } else {
          ctx.rect(x, y, w, h);
        }
        ctx.stroke();
      } else {
        ctx.strokeRect(x, y, w, h);
      }
    }

    // Draw text
    ctx.fillStyle = boxColor;
    ctx.font = `${boxFontSize}px sans-serif`;
    ctx.textBaseline = 'top';
    
    const maxWidth = w - (boxPadding * 2);
    const lineHeight = boxFontSize * 1.2;
    let currentY = y + boxPadding;

    const drawAlignedLine = (text: string, lineX: number, lineY: number) => {
      const metrics = ctx.measureText(text);
      let drawX = lineX;
      if (boxAlignment === 'center') {
        drawX = lineX + (maxWidth - metrics.width) / 2;
      } else if (boxAlignment === 'right') {
        drawX = lineX + (maxWidth - metrics.width);
      }
      ctx.fillText(text, drawX, lineY);
    };

    // Handle manual line breaks and wrapping
    const paragraphs = boxText.split('\n');
    
    for (const paragraph of paragraphs) {
      const words = paragraph.split(' ');
      let line = '';

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && n > 0) {
          drawAlignedLine(line.trim(), x + boxPadding, currentY);
          line = words[n] + ' ';
          currentY += lineHeight;
        } else {
          line = testLine;
        }
      }
      drawAlignedLine(line.trim(), x + boxPadding, currentY);
      currentY += lineHeight; // Move to next line for the next paragraph
    }

    ctx.restore();
    saveState();
    setIsEnteringText(false);
    setPendingTextBox(null);
    setBoxText('');
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    onSave(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div className={cn(
      "fixed inset-0 z-50 bg-black/90 flex flex-col transition-all duration-300",
      isRotated && "origin-center"
    )}
    style={isRotated ? {
      width: '100vh',
      height: '100vw',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%) rotate(90deg)'
    } : {}}
    >
      {/* Toolbar */}
      <div className="h-16 bg-white flex items-center justify-between px-4 shadow-md overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors" title="Fermer">
            <X size={20} />
          </button>
          <div className="h-6 w-px bg-black/10 mx-2" />
          
          {enabledFeatures.removeText && (
            <>
              <button
                onClick={() => { setTool('remove-text'); setPrevTool('remove-text'); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors",
                  (tool === 'remove-text' || tool === 'pipette') ? "bg-[var(--color-brand-accent)] text-white" : "hover:bg-black/5"
                )}
                title="Effacer Texte"
              >
                <Eraser size={18} />
                <span className="hidden sm:inline">Effacer Texte</span>
              </button>

              {(tool === 'remove-text' || tool === 'pipette') && (
                <div className="flex items-center gap-2 px-2 py-1 bg-black/5 rounded-lg ml-2">
                  <button
                    onClick={() => setTool(tool === 'pipette' ? 'remove-text' : 'pipette')}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      tool === 'pipette' ? "bg-[var(--color-brand-accent)] text-white" : "hover:bg-black/10"
                    )}
                    title="Pipette (Prélever couleur)"
                  >
                    <Pipette size={16} />
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                    <input 
                      type="checkbox" 
                      checked={useManualColor} 
                      onChange={(e) => setUseManualColor(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-[var(--color-brand-accent)] focus:ring-[var(--color-brand-accent)]"
                    />
                    <span>Couleur Manuelle</span>
                  </label>
                  {useManualColor && (
                    <input 
                      type="color" 
                      value={manualBgColor} 
                      onChange={(e) => setManualBgColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent"
                      title="Choisir la couleur de fond"
                    />
                  )}
                </div>
              )}
            </>
          )}

          {enabledFeatures.removeColor && (
            <button
              onClick={() => { setTool('wand'); setPrevTool('wand'); }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors",
                tool === 'wand' ? "bg-[var(--color-brand-accent)] text-white" : "hover:bg-black/5"
              )}
              title="Effacer Couleur"
            >
              <MousePointerClick size={18} />
              <span className="hidden sm:inline">Effacer Couleur</span>
            </button>
          )}

          {enabledFeatures.wordBox && (
            <button
              onClick={() => { setTool('text-box'); setPrevTool('text-box'); }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors",
                tool === 'text-box' ? "bg-[var(--color-brand-accent)] text-white" : "hover:bg-black/5"
              )}
              title="Word Box (Boîte de texte)"
            >
              <Type size={18} />
              <span className="hidden sm:inline">Word Box</span>
            </button>
          )}
          
          {enabledFeatures.eraser && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setTool('brush'); setPrevTool('brush'); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors",
                  tool === 'brush' ? "bg-[var(--color-brand-accent)] text-white" : "hover:bg-black/5"
                )}
                title="Gomme (Pinceau)"
              >
                <Eraser size={18} />
                <span className="hidden sm:inline">Gomme</span>
              </button>

              <button
                onClick={() => { setTool('eraser'); setPrevTool('eraser'); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors",
                  tool === 'eraser' ? "bg-[var(--color-brand-accent)] text-white" : "hover:bg-black/5"
                )}
                title="Zone Blanche (Rectangle)"
              >
                <Square size={18} />
                <span className="hidden sm:inline">Zone</span>
              </button>

              {(tool === 'brush' || tool === 'eraser') && (
                <div className="flex items-center gap-2 px-2 py-1 bg-black/5 rounded-lg ml-1">
                  <span className="text-[10px] font-bold text-black/40 uppercase">Taille</span>
                  <input 
                    type="range" 
                    min="5" max="100" 
                    value={brushSize} 
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="w-20 h-4 accent-[var(--color-brand-accent)]"
                  />
                  <span className="text-[10px] font-bold w-6">{brushSize}</span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => { setTool('hand'); setPrevTool('hand'); }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-colors",
              tool === 'hand' ? "bg-[var(--color-brand-accent)] text-white" : "hover:bg-black/5"
            )}
            title="Déplacer (Main)"
          >
            <Hand size={18} />
            <span className="hidden sm:inline">Déplacer</span>
          </button>
        </div>

        <div className="flex items-center gap-2 min-w-max ml-4">
          {enabledFeatures.undoRedo && (
            <>
              <button onClick={undo} disabled={historyIndex <= 0} className="p-2 hover:bg-black/5 rounded-full transition-colors disabled:opacity-30" title="Annuler">
                <Undo size={20} />
              </button>
              <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 hover:bg-black/5 rounded-full transition-colors disabled:opacity-30" title="Rétablir">
                <Redo size={20} />
              </button>
              <div className="h-6 w-px bg-black/10 mx-2" />
            </>
          )}
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-1.5 bg-black text-white rounded-lg font-medium hover:bg-black/80 transition-colors">
            <Download size={18} />
            <span className="hidden sm:inline">Terminer</span>
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef} 
        className="flex-1 overflow-hidden flex items-center justify-center p-4 relative bg-black/5 touch-none"
        onWheel={handleWheel}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <div 
          className={cn(
            "relative shadow-2xl bg-white",
            !isPanning && !isDrawing && "transition-transform duration-75 ease-out"
          )}
          style={{ 
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`, 
            transformOrigin: 'center center', 
            cursor: tool === 'hand' ? (isPanning ? 'grabbing' : 'grab') : (tool === 'pipette' ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='m2 22 1-1h3l9-9M3 21v-3h3m9-5 4.4-4.4a3.3 3.3 0 0 0-4.7-4.7L10.3 8.3m9.7 2.7 3 3' stroke='black' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='m2 22 1-1h3l9-9M3 21v-3h3m9-5 4.4-4.4a3.3 3.3 0 0 0-4.7-4.7L10.3 8.3m9.7 2.7 3 3' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") 2 22, crosshair" : 'crosshair') 
          }}
        >
          <canvas
            ref={canvasRef}
            className="block pointer-events-none"
          />
          
          {isDrawing && tool === 'eraser' && (
            <div 
              className="absolute border-2 border-black/50 bg-white/50 pointer-events-none"
              style={{ left: Math.min(startPos.x, currentPos.x), top: Math.min(startPos.y, currentPos.y), width: Math.abs(currentPos.x - startPos.x), height: Math.abs(currentPos.y - startPos.y) }}
            />
          )}

          {isDrawing && tool === 'remove-text' && (
            <div 
              className="absolute border-2 border-blue-500 border-dashed bg-blue-500/10 pointer-events-none"
              style={{ 
                left: Math.min(startPos.x, currentPos.x), 
                top: Math.min(startPos.y, currentPos.y), 
                width: Math.abs(currentPos.x - startPos.x), 
                height: Math.abs(currentPos.y - startPos.y) 
              }}
            />
          )}

          {isDrawing && tool === 'text-box' && (
            <div 
              className="absolute border-2 border-[var(--color-brand-accent)] bg-[var(--color-brand-accent)]/5 pointer-events-none"
              style={{ 
                left: Math.min(startPos.x, currentPos.x), 
                top: Math.min(startPos.y, currentPos.y), 
                width: Math.abs(currentPos.x - startPos.x), 
                height: Math.abs(currentPos.y - startPos.y) 
              }}
            />
          )}
        </div>
      </div>
      
      {enabledFeatures.zoom && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <button 
            onClick={() => setScale(s => Math.max(0.1, s - 0.1))} 
            className="w-8 h-8 flex items-center justify-center hover:bg-black/5 rounded-full transition-colors"
            title="Zoom arrière"
          >
            <ZoomOut size={18} />
          </button>
          
          <div className="flex flex-col items-center px-2 min-w-[60px]">
            <span className="font-mono text-xs font-bold">{Math.round(scale * 100)}%</span>
          </div>

          <button 
            onClick={() => setScale(s => Math.min(10, s + 0.2))} 
            className="w-8 h-8 flex items-center justify-center hover:bg-black/5 rounded-full transition-colors"
            title="Zoom avant"
          >
            <ZoomIn size={18} />
          </button>

          <div className="w-px h-4 bg-black/10 mx-1" />

          <button 
            onClick={resetView} 
            className="w-8 h-8 flex items-center justify-center hover:bg-black/5 rounded-full transition-colors"
            title="Réinitialiser la vue"
          >
            <Maximize size={18} />
          </button>
        </div>
      )}

      {isEnteringText && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Word Box</h3>
                <button onClick={() => setIsEnteringText(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Text Settings */}
                <div className="space-y-3 p-4 bg-black/5 rounded-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Type size={16} className="text-black/40" />
                    <span className="text-xs font-bold uppercase tracking-wider text-black/40">Texte</span>
                  </div>
                  <div className="space-y-2">
                    <textarea 
                      value={boxText}
                      onChange={(e) => setBoxText(e.target.value)}
                      placeholder="Tapez votre texte ici..."
                      className="w-full px-4 py-3 bg-white rounded-xl border border-black/5 focus:ring-2 focus:ring-[var(--color-brand-accent)] outline-none min-h-[100px] resize-none"
                      autoFocus
                    />
                  </div>
                  {!enabledFeatures.wordBoxSimplified && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-black/40 ml-1">Taille</label>
                          <input 
                            type="number" 
                            value={boxFontSize}
                            onChange={(e) => setBoxFontSize(parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-white rounded-lg border border-black/5 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-black/40 ml-1">Couleur</label>
                          <input 
                            type="color" 
                            value={boxColor}
                            onChange={(e) => setBoxColor(e.target.value)}
                            className="w-full h-9 p-1 bg-white rounded-lg border border-black/5 cursor-pointer"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-black/40 ml-1">Alignement</label>
                        <div className="grid grid-cols-3 gap-1 p-1 bg-white rounded-lg border border-black/5">
                          {(['left', 'center', 'right'] as const).map((align) => (
                            <button
                              key={align}
                              onClick={() => setBoxAlignment(align)}
                              className={cn(
                                "flex items-center justify-center py-1.5 rounded transition-colors",
                                boxAlignment === align ? "bg-[var(--color-brand-accent)] text-white" : "hover:bg-black/5 text-black/40"
                              )}
                            >
                              {align === 'left' && <AlignLeft size={18} />}
                              {align === 'center' && <AlignCenter size={18} />}
                              {align === 'right' && <AlignRight size={18} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {!enabledFeatures.wordBoxSimplified && (
                  <>
                    {/* Box Settings */}
                    <div className="space-y-3 p-4 bg-black/5 rounded-2xl">
                      <div className="flex items-center gap-2 mb-1">
                        <Square size={16} className="text-black/40" />
                        <span className="text-xs font-bold uppercase tracking-wider text-black/40">Boîte</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Afficher le fond</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={boxHasBg}
                            onChange={(e) => setBoxHasBg(e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-brand-accent)]"></div>
                        </label>
                      </div>
                      {boxHasBg && (
                        <div className="space-y-3 pt-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-black/40 ml-1">Couleur fond</label>
                              <input 
                                type="color" 
                                value={boxBgColor}
                                onChange={(e) => setBoxBgColor(e.target.value)}
                                className="w-full h-9 p-1 bg-white rounded-lg border border-black/5 cursor-pointer"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold uppercase text-black/40 ml-1">Opacité ({Math.round(boxBgOpacity * 100)}%)</label>
                              <input 
                                type="range" 
                                min="0" max="1" step="0.1"
                                value={boxBgOpacity}
                                onChange={(e) => setBoxBgOpacity(parseFloat(e.target.value))}
                                className="w-full h-9 accent-[var(--color-brand-accent)]"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-black/40 ml-1">Padding ({boxPadding}px)</label>
                          <input 
                            type="range" 
                            min="0" max="50" step="1"
                            value={boxPadding}
                            onChange={(e) => setBoxPadding(parseInt(e.target.value))}
                            className="w-full h-9 accent-[var(--color-brand-accent)]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-black/40 ml-1">Arrondi ({boxBorderRadius}px)</label>
                          <input 
                            type="range" 
                            min="0" max="50" step="1"
                            value={boxBorderRadius}
                            onChange={(e) => setBoxBorderRadius(parseInt(e.target.value))}
                            className="w-full h-9 accent-[var(--color-brand-accent)]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Border Settings */}
                    <div className="space-y-3 p-4 bg-black/5 rounded-2xl">
                      <div className="flex items-center gap-2 mb-1">
                        <Maximize2 size={16} className="text-black/40" />
                        <span className="text-xs font-bold uppercase tracking-wider text-black/40">Bordure</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-black/40 ml-1">Épaisseur ({boxBorderWidth}px)</label>
                          <input 
                            type="range" 
                            min="0" max="10" step="1"
                            value={boxBorderWidth}
                            onChange={(e) => setBoxBorderWidth(parseInt(e.target.value))}
                            className="w-full h-9 accent-[var(--color-brand-accent)]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-black/40 ml-1">Couleur bordure</label>
                          <input 
                            type="color" 
                            value={boxBorderColor}
                            onChange={(e) => setBoxBorderColor(e.target.value)}
                            className="w-full h-9 p-1 bg-white rounded-lg border border-black/5 cursor-pointer"
                            disabled={boxBorderWidth === 0}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsEnteringText(false)}
                  className="flex-1 py-3 bg-black/5 hover:bg-black/10 rounded-2xl font-bold transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={commitTextBox}
                  className="flex-1 py-3 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:brightness-95 transition-all"
                >
                  <Check size={18} />
                  Valider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
