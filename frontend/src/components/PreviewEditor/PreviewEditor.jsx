import React, { useState, useEffect, useCallback, useRef } from 'react';
import PreviewCanvas from './PreviewCanvas';
import OrientationPicker from './OrientationPicker';
import FontPicker, { getFontFamily } from './FontPicker';
import PreviewControls from './PreviewControls';

export default function PreviewEditor({
  imageUrl,
  audioUrl,
  timingData,
  settings,
  onSettingsChange,
  onGenerate,
  isGenerating
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const animationRef = useRef(null);

  const duration = timingData?.duration || 0;

  // Handle settings change
  const handleChange = (key, value) => {
    onSettingsChange(prev => ({ ...prev, [key]: value }));
  };

  // Handle orientation change (updates both orientation and resolution together)
  const handleOrientationChange = (newOrientation, newResolution) => {
    onSettingsChange(prev => ({
      ...prev,
      orientation: newOrientation,
      resolution: newResolution
    }));
  };

  // Handle text box change from canvas
  const handleTextBoxChange = (box) => {
    onSettingsChange(prev => ({
      ...prev,
      textBox: box
    }));
  };

  // Reset text box to default
  const handleResetTextBox = () => {
    onSettingsChange(prev => ({
      ...prev,
      textBox: null
    }));
  };

  // Sync audio playback
  useEffect(() => {
    if (!audioRef.current || !audioUrl) return;

    const audio = audioRef.current;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      if (!audio.paused) {
        animationRef.current = requestAnimationFrame(updateTime);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      animationRef.current = requestAnimationFrame(updateTime);
    };

    const handlePause = () => {
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioUrl]);

  // Play/pause toggle
  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [isPlaying]);

  // Seek to time
  const handleSeek = useCallback((time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't capture if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleSeek(Math.max(0, currentTime - 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleSeek(Math.min(duration, currentTime + 5));
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handleSeek, currentTime, duration]);

  return (
    <div className="flex flex-col h-full">
      {/* Hidden audio element for playback */}
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
      )}

      {/* Top Controls Bar */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Orientation Picker */}
          <OrientationPicker
            value={settings.orientation || 'horizontal'}
            onChange={handleOrientationChange}
            resolution={settings.resolution}
          />

          <div className="h-6 w-px bg-gray-600" />

          {/* Font Picker */}
          <FontPicker
            value={settings.font || 'Arial'}
            onChange={(v) => handleChange('font', v)}
          />

          <div className="h-6 w-px bg-gray-600" />

          {/* Font Size */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Size</label>
            <input
              type="range"
              min="40"
              max="120"
              value={settings.fontSize || 60}
              onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
              className="w-20"
            />
            <span className="text-xs text-gray-500 w-10">{settings.fontSize || 60}px</span>
          </div>

          <div className="h-6 w-px bg-gray-600" />

          {/* Text Color */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Text</label>
            <input
              type="color"
              value={settings.textColor || '#ffffff'}
              onChange={(e) => handleChange('textColor', e.target.value)}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border border-gray-600"
            />
          </div>

          {/* Stroke Color */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Stroke</label>
            <input
              type="color"
              value={settings.strokeColor || '#000000'}
              onChange={(e) => handleChange('strokeColor', e.target.value)}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border border-gray-600"
            />
          </div>

          <div className="h-6 w-px bg-gray-600" />

          {/* Text Box Reset */}
          {settings.textBox && (
            <button
              onClick={handleResetTextBox}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Reset Box
            </button>
          )}

          {/* Text Box Info */}
          <div className="text-xs text-gray-500">
            {settings.textBox
              ? `Box: ${Math.round(settings.textBox.width * 100)}% × ${Math.round(settings.textBox.height * 100)}%`
              : 'Default text box'
            }
          </div>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center bg-gray-900 p-6 overflow-auto">
        <div className="flex flex-col items-center gap-4">
          <PreviewCanvas
            imageUrl={imageUrl}
            timingData={timingData}
            currentTime={currentTime}
            settings={{
              ...settings,
              font: getFontFamily(settings.font || 'Arial')
            }}
            onTextBoxChange={handleTextBoxChange}
          />

          {/* Current Line Display */}
          <div className="text-center">
            {timingData?.lines && (() => {
              const line = timingData.lines.find(
                l => currentTime >= l.start - 0.5 && currentTime <= l.end + 0.3
              );
              return line ? (
                <p
                  className="text-lg text-white"
                  style={{ fontFamily: getFontFamily(settings.font || 'Arial') }}
                >
                  {line.text}
                </p>
              ) : (
                <p className="text-gray-500 text-sm">
                  Drag timeline or play to preview lyrics
                </p>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <PreviewControls
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
      />

      {/* Generate Button */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-3 flex justify-end">
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className={`
            px-6 py-2 rounded-lg font-medium transition-colors
            ${isGenerating
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
            }
          `}
        >
          {isGenerating ? 'Generating...' : 'Generate Video'}
        </button>
      </div>
    </div>
  );
}
