import React, { useState, useRef, useEffect, useCallback } from 'react';

// Sample timing data for demo when no data provided
const SAMPLE_TIMING = {
  title: "Demo Song",
  duration: 45,
  lines: [
    {
      text: "Hello world it's a beautiful day",
      start: 2.0, end: 5.5,
      words: [
        { word: "Hello", start: 2.0, end: 2.4, confidence: 0.95 },
        { word: "world", start: 2.5, end: 2.9, confidence: 0.92 },
        { word: "it's", start: 3.0, end: 3.2, confidence: 0.88 },
        { word: "a", start: 3.3, end: 3.4, confidence: 0.90 },
        { word: "beautiful", start: 3.5, end: 4.2, confidence: 0.94 },
        { word: "day", start: 4.3, end: 5.5, confidence: 0.96 },
      ]
    },
    {
      text: "The sun is shining bright",
      start: 7.0, end: 10.0,
      words: [
        { word: "The", start: 7.0, end: 7.3, confidence: 0.91 },
        { word: "sun", start: 7.4, end: 7.8, confidence: 0.95 },
        { word: "is", start: 7.9, end: 8.1, confidence: 0.89 },
        { word: "shining", start: 8.2, end: 8.9, confidence: 0.93 },
        { word: "bright", start: 9.0, end: 10.0, confidence: 0.94 },
      ]
    },
    {
      text: "La la la singing along",
      start: 12.0, end: 15.5,
      words: [
        { word: "La", start: 12.0, end: 12.4, confidence: 0.97 },
        { word: "la", start: 12.5, end: 12.9, confidence: 0.96 },
        { word: "la", start: 13.0, end: 13.4, confidence: 0.45 }, // Low confidence example
        { word: "singing", start: 13.5, end: 14.3, confidence: 0.91 },
        { word: "along", start: 14.4, end: 15.5, confidence: 0.93 },
      ]
    },
    {
      text: "This is my happy song",
      start: 17.0, end: 20.5,
      words: [
        { word: "This", start: 17.0, end: 17.4, confidence: 0.92 },
        { word: "is", start: 17.5, end: 17.7, confidence: 0.90 },
        { word: "my", start: 17.8, end: 18.1, confidence: 0.88 },
        { word: "happy", start: 18.2, end: 18.9, confidence: 0.94 },
        { word: "song", start: 19.0, end: 20.5, confidence: 0.95 },
      ]
    },
  ]
};

const COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-400'];

export default function TimelineEditor({ initialData, onTimingChange, onGenerate, audioUrl, waveformPeaks }) {
  const [timingData, setTimingData] = useState(initialData || SAMPLE_TIMING);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(60);
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedWord, setSelectedWord] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [viewMode, setViewMode] = useState('words');
  const [snapEnabled, setSnapEnabled] = useState(true);

  const timelineRef = useRef(null);
  const playIntervalRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const waveformCanvasRef = useRef(null);

  const duration = timingData.duration;
  const timelineWidth = duration * zoom;

  // Update parent when timing changes
  useEffect(() => {
    if (onTimingChange) {
      onTimingChange(timingData);
    }
  }, [timingData, onTimingChange]);

  // Playback loop - sync with audio if available
  useEffect(() => {
    const audio = audioRef.current;

    if (isPlaying) {
      if (audio && audioUrl) {
        // Use audio element for timing
        audio.play();
        playIntervalRef.current = setInterval(() => {
          if (audio.ended) {
            setIsPlaying(false);
            setCurrentTime(0);
          } else {
            setCurrentTime(audio.currentTime);
          }
        }, 50);
      } else {
        // Fallback to simulated playback
        playIntervalRef.current = setInterval(() => {
          setCurrentTime(t => {
            if (t >= duration) {
              setIsPlaying(false);
              return 0;
            }
            return t + 0.05;
          });
        }, 50);
      }
    } else {
      clearInterval(playIntervalRef.current);
      if (audio && !audio.paused) {
        audio.pause();
      }
    }
    return () => clearInterval(playIntervalRef.current);
  }, [isPlaying, duration, audioUrl]);

  // Auto-scroll to keep playhead visible
  useEffect(() => {
    if (isPlaying && timelineRef.current) {
      const playheadPos = currentTime * zoom;
      const container = timelineRef.current;
      if (playheadPos < container.scrollLeft || playheadPos > container.scrollLeft + container.clientWidth - 100) {
        container.scrollLeft = playheadPos - 100;
      }
    }
  }, [currentTime, zoom, isPlaying]);

  // Draw waveform when peaks or zoom changes
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !waveformPeaks || waveformPeaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    const canvasWidth = timelineWidth + 100;
    const canvasHeight = 50;

    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw waveform
    const peakWidth = timelineWidth / waveformPeaks.length;
    const centerY = canvasHeight / 2;

    ctx.fillStyle = 'rgba(59, 130, 246, 0.5)'; // blue-500 with 50% opacity

    for (let i = 0; i < waveformPeaks.length; i++) {
      const peak = waveformPeaks[i];
      const x = i * peakWidth;
      const barHeight = peak * (canvasHeight - 4);

      // Draw mirrored bars (center-aligned)
      ctx.fillRect(x, centerY - barHeight / 2, Math.max(1, peakWidth - 0.5), barHeight);
    }
  }, [waveformPeaks, timelineWidth, zoom]);

  const timeToX = (time) => time * zoom;
  const xToTime = (x) => x / zoom;
  const snapTime = (t) => snapEnabled ? Math.round(t / 0.1) * 0.1 : t;

  const handleTimelineClick = (e) => {
    if (dragState) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const newTime = Math.max(0, Math.min(duration, xToTime(x)));
    setCurrentTime(newTime);
    // Sync audio position
    if (audioRef.current && audioUrl) {
      audioRef.current.currentTime = newTime;
    }
  };

  const startDrag = (e, type, lineIndex, wordIndex = null, edge = null) => {
    e.stopPropagation();
    const rect = timelineRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left + timelineRef.current.scrollLeft;
    setDragState({
      type, lineIndex, wordIndex, edge, startX,
      startTime: wordIndex !== null 
        ? timingData.lines[lineIndex].words[wordIndex][edge || 'start']
        : timingData.lines[lineIndex][edge || 'start']
    });
    setSelectedLine(lineIndex);
    setSelectedWord(wordIndex);
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragState || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const deltaTime = xToTime(currentX - dragState.startX);
    
    setTimingData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const line = newData.lines[dragState.lineIndex];
      
      if (dragState.wordIndex !== null) {
        const word = line.words[dragState.wordIndex];
        if (dragState.type === 'word') {
          const dur = word.end - word.start;
          word.start = snapTime(Math.max(0, dragState.startTime + deltaTime));
          word.end = word.start + dur;
        } else if (dragState.type === 'word-start') {
          word.start = snapTime(Math.max(0, Math.min(word.end - 0.1, dragState.startTime + deltaTime)));
        } else if (dragState.type === 'word-end') {
          word.end = snapTime(Math.max(word.start + 0.1, dragState.startTime + deltaTime));
        }
        line.start = Math.min(...line.words.map(w => w.start));
        line.end = Math.max(...line.words.map(w => w.end));
      } else {
        if (dragState.type === 'line') {
          const dur = line.end - line.start;
          const newStart = snapTime(Math.max(0, dragState.startTime + deltaTime));
          const shift = newStart - line.start;
          line.start = newStart;
          line.end = line.start + dur;
          line.words.forEach(w => { w.start += shift; w.end += shift; });
        } else if (dragState.type === 'line-start') {
          line.start = snapTime(Math.max(0, Math.min(line.end - 0.1, dragState.startTime + deltaTime)));
        } else if (dragState.type === 'line-end') {
          line.end = snapTime(Math.max(line.start + 0.1, dragState.startTime + deltaTime));
        }
      }
      return newData;
    });
  }, [dragState, zoom, snapEnabled]);

  const handleMouseUp = useCallback(() => setDragState(null), []);

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  const shiftSelected = (delta) => {
    if (selectedLine === null) return;
    setTimingData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const line = newData.lines[selectedLine];
      if (selectedWord !== null) {
        line.words[selectedWord].start = Math.max(0, line.words[selectedWord].start + delta);
        line.words[selectedWord].end += delta;
        line.start = Math.min(...line.words.map(w => w.start));
        line.end = Math.max(...line.words.map(w => w.end));
      } else {
        const shift = Math.max(-line.start, delta);
        line.start += shift;
        line.end += shift;
        line.words.forEach(w => { w.start += shift; w.end += shift; });
      }
      return newData;
    });
  };

  // Shift selected line and ALL lines after it
  const shiftFromHereOnward = (delta) => {
    if (selectedLine === null) return;
    setTimingData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      // Shift all lines from selectedLine to the end
      for (let i = selectedLine; i < newData.lines.length; i++) {
        const line = newData.lines[i];
        const shift = i === selectedLine ? Math.max(-line.start, delta) : delta;
        line.start = Math.max(0, line.start + shift);
        line.end = Math.max(0, line.end + shift);
        line.words.forEach(w => {
          w.start = Math.max(0, w.start + shift);
          w.end = Math.max(0, w.end + shift);
        });
      }
      return newData;
    });
  };

  // Chop selected line's end to playhead position
  const chopLineAtPlayhead = () => {
    if (selectedLine === null) return;
    const newEndTime = snapTime(currentTime);

    setTimingData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const line = newData.lines[selectedLine];

      // Don't chop before line starts
      if (newEndTime <= line.start) return prev;

      // Set line end to playhead
      line.end = newEndTime;

      // Truncate or remove words that extend past the new end
      line.words = line.words.filter(w => w.start < newEndTime);
      line.words.forEach(w => {
        if (w.end > newEndTime) {
          w.end = newEndTime;
        }
      });

      return newData;
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(p => !p);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.shiftKey && selectedLine !== null) {
          shiftSelected(-0.1);
        } else {
          setCurrentTime(t => Math.max(0, t - (e.ctrlKey ? 1 : 0.5)));
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.shiftKey && selectedLine !== null) {
          shiftSelected(0.1);
        } else {
          setCurrentTime(t => Math.min(duration, t + (e.ctrlKey ? 1 : 0.5)));
        }
      } else if (e.key === 'Escape') {
        setSelectedLine(null);
        setSelectedWord(null);
      } else if (e.key === 'c' || e.key === 'C') {
        // Chop line end to playhead
        e.preventDefault();
        chopLineAtPlayhead();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLine, selectedWord, duration, currentTime, snapEnabled]);

  const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toFixed(2).padStart(5,'0')}`;
  
  const currentLine = timingData.lines.find(l => 
    currentTime >= l.start - 0.1 && currentTime <= l.end + 0.1
  );

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(timingData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${timingData.title || 'lyrics'}_timing.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.lines && data.duration) {
          setTimingData(data);
          setSelectedLine(null);
          setSelectedWord(null);
          setCurrentTime(0);
        } else {
          alert('Invalid timing JSON format');
        }
      } catch (err) {
        alert('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
  };

  const timeMarkers = [];
  const interval = zoom > 50 ? 2 : zoom > 25 ? 5 : 10;
  for (let t = 0; t <= duration; t += interval) timeMarkers.push(t);

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* Hidden audio element for playback */}
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="auto" />
      )}

      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Timeline Editor</h2>
          <p className="text-gray-400 text-xs">Drag words to adjust timing • Click timeline to seek • Space to play/pause</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={importJSON}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-gray-700 rounded hover:bg-gray-600 text-sm"
          >
            Import JSON
          </button>
          <button
            onClick={exportJSON}
            className="px-3 py-1.5 bg-blue-600 rounded hover:bg-blue-700 text-sm"
          >
            Export JSON
          </button>
          {onGenerate && (
            <button
              onClick={onGenerate}
              className="px-3 py-1.5 bg-green-600 rounded hover:bg-green-700 text-sm font-medium"
            >
              Generate Video →
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="h-24 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border-b border-gray-700 px-4">
        <div className={`text-2xl font-bold text-center transition-opacity duration-200 ${currentLine ? 'opacity-100' : 'opacity-30'}`}>
          {currentLine ? currentLine.text : '♪ ♪ ♪'}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 border-b border-gray-700 p-2 flex items-center gap-4 flex-wrap">
        <button 
          onClick={() => setIsPlaying(!isPlaying)} 
          className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 flex-shrink-0"
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
        
        <div className="font-mono text-lg w-24">{formatTime(currentTime)}</div>
        
        <div className="h-6 w-px bg-gray-600" />
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Zoom:</span>
          <input
            type="range"
            min="5"
            max="120"
            value={zoom}
            onChange={e => {
              const newZoom = +e.target.value;
              const container = timelineRef.current;
              if (container) {
                // Maintain scroll position relative to current time
                const timeAtCenter = currentTime;
                const newScrollLeft = timeAtCenter * newZoom - container.clientWidth / 2;
                setZoom(newZoom);
                // Schedule scroll after render
                setTimeout(() => {
                  container.scrollLeft = Math.max(0, newScrollLeft);
                }, 0);
              } else {
                setZoom(newZoom);
              }
            }}
            className="w-32"
          />
          <span className="text-xs text-gray-500 w-10">{zoom}px/s</span>
        </div>
        
        <div className="h-6 w-px bg-gray-600" />
        
        <div className="flex gap-1">
          <button 
            onClick={() => setViewMode('lines')} 
            className={`px-2 py-1 rounded text-xs ${viewMode === 'lines' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            Lines
          </button>
          <button 
            onClick={() => setViewMode('words')} 
            className={`px-2 py-1 rounded text-xs ${viewMode === 'words' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            Words
          </button>
        </div>
        
        <div className="h-6 w-px bg-gray-600" />
        
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input 
            type="checkbox" 
            checked={snapEnabled} 
            onChange={e => setSnapEnabled(e.target.checked)}
            className="rounded"
          />
          <span className="text-gray-400">Snap (100ms)</span>
        </label>
      </div>

      {/* Timeline */}
      <div 
        ref={timelineRef} 
        className="flex-1 overflow-auto" 
        onClick={handleTimelineClick} 
        style={{ cursor: dragState ? 'grabbing' : 'default' }}
      >
        <div style={{ width: timelineWidth + 100, minHeight: '100%' }}>
          {/* Time Ruler */}
          <div className="h-7 bg-gray-800 border-b border-gray-700 sticky top-0 z-20 relative">
            {timeMarkers.map(t => (
              <div key={t} className="absolute flex flex-col items-center" style={{ left: timeToX(t) }}>
                <div className="h-2 w-px bg-gray-600"/>
                <span className="text-xs text-gray-500">{formatTime(t)}</span>
              </div>
            ))}
          </div>

          {/* Waveform */}
          {waveformPeaks && waveformPeaks.length > 0 && (
            <div className="h-[50px] bg-gray-850 border-b border-gray-700 sticky top-7 z-15">
              <canvas
                ref={waveformCanvasRef}
                className="h-full"
                style={{ width: timelineWidth + 100 }}
              />
            </div>
          )}

          {/* Tracks */}
          <div className="relative pt-2 pb-20">
            {/* Playhead */}
            <div 
              className="absolute top-0 h-full w-0.5 bg-red-500 z-30 pointer-events-none" 
              style={{ left: timeToX(currentTime) }}
            >
              <div className="w-3 h-3 bg-red-500 rounded-full -ml-[5px] -mt-0.5"/>
            </div>

            {/* Lines */}
            {timingData.lines.map((line, li) => (
              <div key={li} className="relative mb-2" style={{ height: viewMode === 'words' ? 65 : 45 }}>
                {/* Line number */}
                <div className="absolute left-2 top-1 text-xs text-gray-600 font-mono">
                  {li + 1}
                </div>
                
                {viewMode === 'lines' ? (
                  /* Line block view */
                  <div
                    className={`absolute top-3 h-9 rounded cursor-grab flex items-center justify-center text-sm font-medium transition-shadow
                      ${selectedLine === li && selectedWord === null ? 'ring-2 ring-white shadow-lg' : ''}
                      ${COLORS[li % COLORS.length]} hover:brightness-110`}
                    style={{ left: timeToX(line.start), width: Math.max(40, timeToX(line.end - line.start)) }}
                    onMouseDown={e => startDrag(e, 'line', li)}
                    onClick={e => { e.stopPropagation(); setSelectedLine(li); setSelectedWord(null); }}
                  >
                    <span className="truncate px-2">{line.text}</span>
                    <div 
                      className="absolute left-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/30 rounded-l" 
                      onMouseDown={e => startDrag(e, 'line-start', li, null, 'start')}
                    />
                    <div 
                      className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/30 rounded-r" 
                      onMouseDown={e => startDrag(e, 'line-end', li, null, 'end')}
                    />
                  </div>
                ) : (
                  /* Word block view */
                  <>
                    {/* Line background */}
                    <div 
                      className={`absolute top-3 h-14 rounded opacity-20 ${COLORS[li % COLORS.length]}`} 
                      style={{ left: timeToX(line.start), width: timeToX(line.end - line.start) }}
                    />
                    {/* Words */}
                    {line.words.map((word, wi) => (
                      <div
                        key={wi}
                        className={`absolute top-4 h-11 rounded cursor-grab flex items-center justify-center text-xs font-medium transition-shadow
                          ${selectedLine === li && selectedWord === wi ? 'ring-2 ring-white shadow-lg' : ''}
                          ${COLORS[li % COLORS.length]} hover:brightness-110
                          ${word.confidence < 0.5 ? 'border-2 border-dashed border-yellow-400' : ''}`}
                        style={{ left: timeToX(word.start), width: Math.max(22, timeToX(word.end - word.start)) }}
                        onMouseDown={e => startDrag(e, 'word', li, wi)}
                        onClick={e => { e.stopPropagation(); setSelectedLine(li); setSelectedWord(wi); }}
                        title={`${word.word}\n${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s\nConfidence: ${(word.confidence*100).toFixed(0)}%`}
                      >
                        <span className="truncate px-0.5">{word.word}</span>
                        <div 
                          className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-white/30 rounded-l" 
                          onMouseDown={e => startDrag(e, 'word-start', li, wi, 'start')}
                        />
                        <div 
                          className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-white/30 rounded-r" 
                          onMouseDown={e => startDrag(e, 'word-end', li, wi, 'end')}
                        />
                      </div>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selection Panel */}
      {selectedLine !== null && (
        <div className="bg-gray-800 border-t border-gray-700 p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm truncate">
                  {selectedWord !== null 
                    ? `Word: "${timingData.lines[selectedLine].words[selectedWord].word}"`
                    : `Line ${selectedLine + 1}: "${timingData.lines[selectedLine].text}"`}
                </span>
                <span className="text-gray-400 text-xs whitespace-nowrap">
                  {(selectedWord !== null 
                    ? timingData.lines[selectedLine].words[selectedWord].start 
                    : timingData.lines[selectedLine].start
                  ).toFixed(2)}s → {(selectedWord !== null 
                    ? timingData.lines[selectedLine].words[selectedWord].end 
                    : timingData.lines[selectedLine].end
                  ).toFixed(2)}s
                </span>
                {selectedWord !== null && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    timingData.lines[selectedLine].words[selectedWord].confidence < 0.5 
                      ? 'bg-yellow-900 text-yellow-300' 
                      : 'bg-green-900 text-green-300'
                  }`}>
                    {(timingData.lines[selectedLine].words[selectedWord].confidence * 100).toFixed(0)}% conf
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Shift:</span>
                <button onClick={() => shiftSelected(-0.5)} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600">-0.5s</button>
                <button onClick={() => shiftSelected(-0.1)} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600">-0.1s</button>
                <button onClick={() => shiftSelected(0.1)} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600">+0.1s</button>
                <button onClick={() => shiftSelected(0.5)} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600">+0.5s</button>
              </div>
              {selectedWord === null && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">All below:</span>
                  <button onClick={() => shiftFromHereOnward(-5)} className="px-2 py-1 bg-orange-700 rounded text-xs hover:bg-orange-600">-5s</button>
                  <button onClick={() => shiftFromHereOnward(-1)} className="px-2 py-1 bg-orange-700 rounded text-xs hover:bg-orange-600">-1s</button>
                  <button onClick={() => shiftFromHereOnward(1)} className="px-2 py-1 bg-orange-700 rounded text-xs hover:bg-orange-600">+1s</button>
                  <button onClick={() => shiftFromHereOnward(5)} className="px-2 py-1 bg-orange-700 rounded text-xs hover:bg-orange-600">+5s</button>
                </div>
              )}
              <div className="w-px h-6 bg-gray-600" />
              <button
                onClick={() => setCurrentTime(selectedWord !== null
                  ? timingData.lines[selectedLine].words[selectedWord].start
                  : timingData.lines[selectedLine].start
                )}
                className="px-2 py-1 bg-blue-600 rounded text-xs hover:bg-blue-700"
              >
                Jump
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help */}
      <div className="bg-gray-850 border-t border-gray-700 px-4 py-1.5 text-xs text-gray-500 flex gap-4 flex-wrap">
        <span><kbd className="bg-gray-700 px-1 rounded">Space</kbd> Play/Pause</span>
        <span><kbd className="bg-gray-700 px-1 rounded">←</kbd><kbd className="bg-gray-700 px-1 rounded">→</kbd> Seek</span>
        <span><kbd className="bg-gray-700 px-1 rounded">Shift</kbd>+Arrows: Nudge</span>
        <span><kbd className="bg-gray-700 px-1 rounded">C</kbd> Chop line end at playhead</span>
        <span><kbd className="bg-gray-700 px-1 rounded">Esc</kbd> Deselect</span>
        <span className="text-yellow-600">Yellow border = low confidence</span>
      </div>
    </div>
  );
}
