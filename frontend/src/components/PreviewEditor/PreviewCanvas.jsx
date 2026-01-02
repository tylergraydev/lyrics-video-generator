import React, { useRef, useEffect, useState, useCallback } from 'react';

// Draw image with "cover" fit (fills canvas, crops excess)
function drawImageCover(ctx, img, canvasWidth, canvasHeight) {
  const imgRatio = img.width / img.height;
  const canvasRatio = canvasWidth / canvasHeight;

  let drawWidth, drawHeight, offsetX, offsetY;

  if (imgRatio > canvasRatio) {
    // Image is wider - fit height, crop width
    drawHeight = canvasHeight;
    drawWidth = img.width * (canvasHeight / img.height);
    offsetX = (canvasWidth - drawWidth) / 2;
    offsetY = 0;
  } else {
    // Image is taller - fit width, crop height
    drawWidth = canvasWidth;
    drawHeight = img.height * (canvasWidth / img.width);
    offsetX = 0;
    offsetY = (canvasHeight - drawHeight) / 2;
  }

  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

// Wrap text to fit within a maximum width
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// Draw text with stroke outline, with word wrap support
function drawStyledText(ctx, text, box, settings) {
  const { fontSize, textColor, strokeColor, strokeWidth, font } = settings;

  ctx.font = `bold ${fontSize}px ${font || 'Arial'}, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Wrap text if box width is specified
  const lines = box.width ? wrapText(ctx, text, box.width) : [text];
  const lineHeight = fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;

  // Center text vertically in box
  const startY = box.y - (totalHeight / 2) + (lineHeight / 2);

  lines.forEach((line, index) => {
    const y = startY + (index * lineHeight);

    // Draw stroke
    if (strokeWidth > 0) {
      ctx.strokeStyle = strokeColor || '#000000';
      ctx.lineWidth = strokeWidth * 2;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, box.x, y);
    }

    // Draw fill
    ctx.fillStyle = textColor || '#ffffff';
    ctx.fillText(line, box.x, y);
  });

  return lines.length;
}

// Default text box (normalized 0-1 coordinates)
const DEFAULT_TEXT_BOX = {
  x: 0.5,      // center x
  y: 0.5,      // center y
  width: 0.8,  // 80% of canvas width
  height: 0.3  // 30% of canvas height
};

// Hit test zones for resize handles
const HANDLE_SIZE = 10;

function getHandleZone(mouseX, mouseY, box, canvasSize) {
  const bx = box.x * canvasSize.width;
  const by = box.y * canvasSize.height;
  const bw = box.width * canvasSize.width;
  const bh = box.height * canvasSize.height;

  const left = bx - bw / 2;
  const right = bx + bw / 2;
  const top = by - bh / 2;
  const bottom = by + bh / 2;

  // Check corners first
  if (Math.abs(mouseX - left) < HANDLE_SIZE && Math.abs(mouseY - top) < HANDLE_SIZE) return 'nw';
  if (Math.abs(mouseX - right) < HANDLE_SIZE && Math.abs(mouseY - top) < HANDLE_SIZE) return 'ne';
  if (Math.abs(mouseX - left) < HANDLE_SIZE && Math.abs(mouseY - bottom) < HANDLE_SIZE) return 'sw';
  if (Math.abs(mouseX - right) < HANDLE_SIZE && Math.abs(mouseY - bottom) < HANDLE_SIZE) return 'se';

  // Check edges
  if (Math.abs(mouseX - left) < HANDLE_SIZE && mouseY > top && mouseY < bottom) return 'w';
  if (Math.abs(mouseX - right) < HANDLE_SIZE && mouseY > top && mouseY < bottom) return 'e';
  if (Math.abs(mouseY - top) < HANDLE_SIZE && mouseX > left && mouseX < right) return 'n';
  if (Math.abs(mouseY - bottom) < HANDLE_SIZE && mouseX > left && mouseX < right) return 's';

  // Check inside box
  if (mouseX > left && mouseX < right && mouseY > top && mouseY < bottom) return 'move';

  return null;
}

export default function PreviewCanvas({
  imageUrl,
  timingData,
  currentTime,
  settings,
  onTextBoxChange,
  className = ''
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [dragMode, setDragMode] = useState(null); // null, 'move', 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'
  const [dragStart, setDragStart] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 360 });
  const [hoveredZone, setHoveredZone] = useState(null);

  // Get text box from settings or use default
  const textBox = settings.textBox || DEFAULT_TEXT_BOX;

  // Calculate canvas dimensions based on orientation
  useEffect(() => {
    const { orientation } = settings;
    const maxWidth = 640;
    const maxHeight = 480;

    if (orientation === 'vertical') {
      const height = maxHeight;
      const width = height * (9 / 16);
      setCanvasSize({ width, height });
    } else {
      const width = maxWidth;
      const height = width * (9 / 16);
      setCanvasSize({ width, height });
    }
  }, [settings.orientation]);

  // Load background image
  useEffect(() => {
    if (!imageUrl) {
      setBackgroundImage(null);
      return;
    }

    const img = new Image();
    img.onload = () => setBackgroundImage(img);
    img.onerror = () => setBackgroundImage(null);
    img.src = imageUrl;
  }, [imageUrl]);

  // Find current line based on playback time
  const getCurrentLine = useCallback(() => {
    if (!timingData?.lines) return null;
    return timingData.lines.find(
      l => currentTime >= l.start - 0.5 && currentTime <= l.end + 0.3
    );
  }, [timingData, currentTime]);

  // Convert text box to pixel coordinates
  const getPixelBox = useCallback(() => {
    const { width, height } = canvasSize;
    return {
      x: textBox.x * width,
      y: textBox.y * height,
      width: textBox.width * width,
      height: textBox.height * height
    };
  }, [canvasSize, textBox]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvasSize;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw dark background if no image
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw background image
    if (backgroundImage) {
      drawImageCover(ctx, backgroundImage, width, height);
    }

    // Get pixel box for text
    const pixelBox = getPixelBox();

    // Scale factor for preview
    const scaleFactor = width / 1920;
    const previewFontSize = Math.round((settings.fontSize || 60) * scaleFactor * 1.5);

    // Draw current lyrics or sample text
    const currentLine = getCurrentLine();
    const textToShow = currentLine?.text || (!timingData?.lines?.length ? 'Sample Lyrics Here' : null);

    if (textToShow) {
      drawStyledText(ctx, textToShow, pixelBox, {
        ...settings,
        fontSize: previewFontSize,
        strokeWidth: (settings.strokeWidth || 3) * scaleFactor * 1.5
      });
    }

    // Draw text box outline when editing
    if (onTextBoxChange) {
      const bx = pixelBox.x - pixelBox.width / 2;
      const by = pixelBox.y - pixelBox.height / 2;

      // Draw box outline
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(bx, by, pixelBox.width, pixelBox.height);
      ctx.setLineDash([]);

      // Draw resize handles
      const handlePositions = [
        { x: bx, y: by, zone: 'nw' },
        { x: bx + pixelBox.width, y: by, zone: 'ne' },
        { x: bx, y: by + pixelBox.height, zone: 'sw' },
        { x: bx + pixelBox.width, y: by + pixelBox.height, zone: 'se' },
        { x: bx + pixelBox.width / 2, y: by, zone: 'n' },
        { x: bx + pixelBox.width / 2, y: by + pixelBox.height, zone: 's' },
        { x: bx, y: by + pixelBox.height / 2, zone: 'w' },
        { x: bx + pixelBox.width, y: by + pixelBox.height / 2, zone: 'e' },
      ];

      handlePositions.forEach(({ x, y, zone }) => {
        const isHovered = hoveredZone === zone;
        const size = isHovered ? 8 : 6;

        ctx.fillStyle = isHovered ? 'rgba(59, 130, 246, 1)' : 'rgba(59, 130, 246, 0.8)';
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - size / 2, y - size / 2, size, size);
      });
    }
  }, [backgroundImage, canvasSize, currentTime, settings, timingData, getCurrentLine, getPixelBox, onTextBoxChange, hoveredZone]);

  // Get cursor style based on zone
  const getCursor = (zone) => {
    const cursors = {
      'nw': 'nw-resize', 'ne': 'ne-resize', 'sw': 'sw-resize', 'se': 'se-resize',
      'n': 'n-resize', 's': 's-resize', 'e': 'e-resize', 'w': 'w-resize',
      'move': 'move'
    };
    return cursors[zone] || 'crosshair';
  };

  // Handle mouse down
  const handleMouseDown = (e) => {
    if (!onTextBoxChange) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zone = getHandleZone(mouseX, mouseY, textBox, canvasSize);

    if (zone) {
      setDragMode(zone);
      setDragStart({ mouseX, mouseY, box: { ...textBox } });
    } else {
      // Click outside box - create new box centered at click
      const newBox = {
        x: mouseX / canvasSize.width,
        y: mouseY / canvasSize.height,
        width: textBox.width,
        height: textBox.height
      };
      onTextBoxChange(newBox);
    }
  };

  // Handle mouse move
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (dragMode && dragStart) {
      const dx = (mouseX - dragStart.mouseX) / canvasSize.width;
      const dy = (mouseY - dragStart.mouseY) / canvasSize.height;
      const startBox = dragStart.box;

      let newBox = { ...startBox };

      switch (dragMode) {
        case 'move':
          newBox.x = Math.max(newBox.width / 2, Math.min(1 - newBox.width / 2, startBox.x + dx));
          newBox.y = Math.max(newBox.height / 2, Math.min(1 - newBox.height / 2, startBox.y + dy));
          break;
        case 'e':
          newBox.width = Math.max(0.1, Math.min(1 - startBox.x + startBox.width / 2, startBox.width + dx * 2));
          break;
        case 'w':
          newBox.width = Math.max(0.1, Math.min(startBox.x + startBox.width / 2, startBox.width - dx * 2));
          break;
        case 's':
          newBox.height = Math.max(0.1, Math.min(1 - startBox.y + startBox.height / 2, startBox.height + dy * 2));
          break;
        case 'n':
          newBox.height = Math.max(0.1, Math.min(startBox.y + startBox.height / 2, startBox.height - dy * 2));
          break;
        case 'se':
          newBox.width = Math.max(0.1, startBox.width + dx * 2);
          newBox.height = Math.max(0.1, startBox.height + dy * 2);
          break;
        case 'sw':
          newBox.width = Math.max(0.1, startBox.width - dx * 2);
          newBox.height = Math.max(0.1, startBox.height + dy * 2);
          break;
        case 'ne':
          newBox.width = Math.max(0.1, startBox.width + dx * 2);
          newBox.height = Math.max(0.1, startBox.height - dy * 2);
          break;
        case 'nw':
          newBox.width = Math.max(0.1, startBox.width - dx * 2);
          newBox.height = Math.max(0.1, startBox.height - dy * 2);
          break;
      }

      onTextBoxChange(newBox);
    } else if (onTextBoxChange) {
      // Update cursor based on hover zone
      const zone = getHandleZone(mouseX, mouseY, textBox, canvasSize);
      setHoveredZone(zone);
    }
  }, [dragMode, dragStart, canvasSize, textBox, onTextBoxChange]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setDragMode(null);
    setDragStart(null);
  }, []);

  // Add/remove global event listeners for drag
  useEffect(() => {
    if (dragMode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragMode, handleMouseMove, handleMouseUp]);

  // Handle hover for cursor changes
  const handleCanvasMouseMove = (e) => {
    if (!onTextBoxChange || dragMode) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zone = getHandleZone(mouseX, mouseY, textBox, canvasSize);
    setHoveredZone(zone);
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="border border-gray-600 rounded-lg shadow-lg"
        style={{ cursor: getCursor(hoveredZone) }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={() => setHoveredZone(null)}
      />

      {/* Instruction overlay */}
      {onTextBoxChange && !settings.textBox && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
            Drag to move, resize handles on edges
          </div>
        </div>
      )}
    </div>
  );
}
