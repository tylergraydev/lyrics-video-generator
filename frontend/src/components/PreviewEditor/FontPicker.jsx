import React, { useState, useEffect } from 'react';

// Fallback fonts if system font detection isn't available
const FALLBACK_FONTS = [
  { name: 'Arial', family: 'Arial, sans-serif', path: '/System/Library/Fonts/Supplemental/Arial Bold.ttf' },
  { name: 'Arial Black', family: '"Arial Black", sans-serif', path: '/System/Library/Fonts/Supplemental/Arial Black.ttf' },
  { name: 'Comic Sans MS', family: '"Comic Sans MS", cursive', path: '/System/Library/Fonts/Supplemental/Comic Sans MS Bold.ttf' },
  { name: 'Courier New', family: '"Courier New", monospace', path: '/System/Library/Fonts/Courier New Bold.ttf' },
  { name: 'Georgia', family: 'Georgia, serif', path: '/System/Library/Fonts/Supplemental/Georgia Bold.ttf' },
  { name: 'Helvetica', family: 'Helvetica, sans-serif', path: '/System/Library/Fonts/Helvetica.ttc' },
  { name: 'Helvetica Neue', family: '"Helvetica Neue", sans-serif', path: '/System/Library/Fonts/HelveticaNeue.ttc' },
  { name: 'Impact', family: 'Impact, sans-serif', path: '/System/Library/Fonts/Supplemental/Impact.ttf' },
  { name: 'Lucida Grande', family: '"Lucida Grande", sans-serif', path: '/System/Library/Fonts/LucidaGrande.ttc' },
  { name: 'Menlo', family: 'Menlo, monospace', path: '/System/Library/Fonts/Menlo.ttc' },
  { name: 'Monaco', family: 'Monaco, monospace', path: '/System/Library/Fonts/Monaco.ttf' },
  { name: 'Palatino', family: 'Palatino, serif', path: '/System/Library/Fonts/Palatino.ttc' },
  { name: 'Tahoma', family: 'Tahoma, sans-serif', path: '/System/Library/Fonts/Supplemental/Tahoma Bold.ttf' },
  { name: 'Times New Roman', family: '"Times New Roman", serif', path: '/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf' },
  { name: 'Trebuchet MS', family: '"Trebuchet MS", sans-serif', path: '/System/Library/Fonts/Supplemental/Trebuchet MS Bold.ttf' },
  { name: 'Verdana', family: 'Verdana, sans-serif', path: '/System/Library/Fonts/Supplemental/Verdana Bold.ttf' },
];

// Store detected fonts globally so they persist
let cachedFonts = null;

// Get font path from font name (best guess for macOS)
export function getFontPath(fontName) {
  const fallbackFont = FALLBACK_FONTS.find(f => f.name === fontName);
  if (fallbackFont?.path) return fallbackFont.path;

  // Generate a reasonable path guess for system fonts
  const sanitized = fontName.replace(/\s+/g, '');
  return `/System/Library/Fonts/${sanitized}.ttf`;
}

// Get CSS font family from font name
export function getFontFamily(fontName) {
  const fallbackFont = FALLBACK_FONTS.find(f => f.name === fontName);
  if (fallbackFont?.family) return fallbackFont.family;
  return `"${fontName}", sans-serif`;
}

// Export for other components
export const AVAILABLE_FONTS = FALLBACK_FONTS;

export default function FontPicker({ value, onChange }) {
  const [fonts, setFonts] = useState(cachedFonts || FALLBACK_FONTS);
  const [loading, setLoading] = useState(!cachedFonts);

  useEffect(() => {
    if (cachedFonts) return;

    async function loadFonts() {
      try {
        // Try the Local Font Access API (Chrome/Edge 103+)
        if ('queryLocalFonts' in window) {
          const localFonts = await window.queryLocalFonts();

          // Get unique font families
          const fontFamilies = new Map();
          for (const font of localFonts) {
            if (!fontFamilies.has(font.family)) {
              fontFamilies.set(font.family, {
                name: font.family,
                family: `"${font.family}", sans-serif`,
                fullName: font.fullName,
                postscriptName: font.postscriptName
              });
            }
          }

          // Sort alphabetically
          const sortedFonts = Array.from(fontFamilies.values())
            .sort((a, b) => a.name.localeCompare(b.name));

          if (sortedFonts.length > 0) {
            cachedFonts = sortedFonts;
            setFonts(sortedFonts);
          }
        }
      } catch (err) {
        // Permission denied or API not available, use fallback
        console.log('Local font access not available, using fallback fonts');
      }
      setLoading(false);
    }

    loadFonts();
  }, []);

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-400">Font</label>
      <select
        value={value || 'Arial'}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white min-w-[140px] max-w-[180px]"
        style={{ fontFamily: getFontFamily(value) }}
      >
        {fonts.map((font) => (
          <option
            key={font.name}
            value={font.name}
            style={{ fontFamily: font.family }}
          >
            {font.name}
          </option>
        ))}
      </select>
      {loading && <span className="text-xs text-gray-500">Loading...</span>}
    </div>
  );
}
