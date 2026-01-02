import React from 'react';

const RESOLUTIONS = [
  { value: '1920x1080', label: '1080p (1920x1080)' },
  { value: '1280x720', label: '720p (1280x720)' },
  { value: '3840x2160', label: '4K (3840x2160)' },
];

const POSITIONS = [
  { value: 'center', label: 'Center' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'top', label: 'Top' },
];

export default function StylePanel({ settings, onChange }) {
  const handleChange = (key, value) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
      <div className="flex items-center gap-6 flex-wrap">
        {/* Font Size */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 whitespace-nowrap">Font Size</label>
          <input
            type="range"
            min="40"
            max="100"
            value={settings.fontSize || 60}
            onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
            className="w-20"
          />
          <span className="text-xs text-gray-500 w-8">{settings.fontSize || 60}px</span>
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

        {/* Position */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Position</label>
          <select
            value={settings.position || 'center'}
            onChange={(e) => handleChange('position', e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
          >
            {POSITIONS.map((pos) => (
              <option key={pos.value} value={pos.value}>
                {pos.label}
              </option>
            ))}
          </select>
        </div>

        <div className="h-6 w-px bg-gray-600" />

        {/* Resolution */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Resolution</label>
          <select
            value={settings.resolution || '1920x1080'}
            onChange={(e) => handleChange('resolution', e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
          >
            {RESOLUTIONS.map((res) => (
              <option key={res.value} value={res.value}>
                {res.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
