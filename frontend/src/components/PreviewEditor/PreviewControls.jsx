import React from 'react';

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function PreviewControls({
  currentTime,
  duration,
  isPlaying,
  onPlayPause,
  onSeek
}) {
  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(percent * duration);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-gray-800 border-t border-gray-700 px-4 py-3">
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          onClick={onPlayPause}
          className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Time Display */}
        <div className="text-sm text-gray-400 min-w-[80px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Seek Bar */}
        <div
          className="flex-1 h-2 bg-gray-700 rounded-full cursor-pointer group"
          onClick={handleSeek}
        >
          <div className="relative h-full">
            {/* Progress Fill */}
            <div
              className="absolute top-0 left-0 h-full bg-blue-600 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />

            {/* Hover Effect */}
            <div className="absolute inset-0 bg-gray-600 rounded-full opacity-0 group-hover:opacity-30 transition-opacity" />

            {/* Playhead */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
        </div>

        {/* Skip Buttons */}
        <div className="flex gap-1">
          <button
            onClick={() => onSeek(Math.max(0, currentTime - 5))}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Back 5 seconds"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>
          <button
            onClick={() => onSeek(Math.min(duration, currentTime + 5))}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Forward 5 seconds"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>
        </div>

        {/* Reset Position Button */}
        <button
          onClick={() => onSeek(0)}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Reset to start"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
