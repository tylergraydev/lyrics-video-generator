import React from 'react';

// Web-safe fonts with their CSS font-family and macOS system font paths
export const AVAILABLE_FONTS = [
  {
    name: 'Arial',
    family: 'Arial, sans-serif',
    path: '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
  },
  {
    name: 'Impact',
    family: 'Impact, sans-serif',
    path: '/System/Library/Fonts/Supplemental/Impact.ttf'
  },
  {
    name: 'Georgia',
    family: 'Georgia, serif',
    path: '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
  },
  {
    name: 'Verdana',
    family: 'Verdana, sans-serif',
    path: '/System/Library/Fonts/Supplemental/Verdana Bold.ttf'
  },
  {
    name: 'Times New Roman',
    family: '"Times New Roman", serif',
    path: '/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf'
  },
  {
    name: 'Courier New',
    family: '"Courier New", monospace',
    path: '/System/Library/Fonts/Courier New Bold.ttf'
  },
  {
    name: 'Trebuchet MS',
    family: '"Trebuchet MS", sans-serif',
    path: '/System/Library/Fonts/Supplemental/Trebuchet MS Bold.ttf'
  },
  {
    name: 'Comic Sans MS',
    family: '"Comic Sans MS", cursive',
    path: '/System/Library/Fonts/Supplemental/Comic Sans MS Bold.ttf'
  }
];

// Get font path from font name
export function getFontPath(fontName) {
  const font = AVAILABLE_FONTS.find(f => f.name === fontName);
  return font?.path || AVAILABLE_FONTS[0].path;
}

// Get CSS font family from font name
export function getFontFamily(fontName) {
  const font = AVAILABLE_FONTS.find(f => f.name === fontName);
  return font?.family || AVAILABLE_FONTS[0].family;
}

export default function FontPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-400">Font</label>
      <select
        value={value || 'Arial'}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white min-w-[120px]"
        style={{ fontFamily: getFontFamily(value) }}
      >
        {AVAILABLE_FONTS.map((font) => (
          <option
            key={font.name}
            value={font.name}
            style={{ fontFamily: font.family }}
          >
            {font.name}
          </option>
        ))}
      </select>
    </div>
  );
}
