import React, { createContext, useContext, useState, useEffect } from 'react';

// Theme definitions
export const themes = {
  purple: {
    name: 'Purple Dream',
    id: 'purple',
    // Background gradient
    background: 'linear-gradient(135deg, #0f0c29 0%, #1a1333 50%, #24243e 100%)',
    // Primary gradient (buttons, accents)
    primary: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #6366f1 100%)',
    primaryHover: 'linear-gradient(135deg, #f472b6 0%, #a78bfa 50%, #818cf8 100%)',
    // Accent colors
    accent1: '#ec4899', // pink-500
    accent2: '#8b5cf6', // purple-500
    accent3: '#6366f1', // indigo-500
    // Text gradient
    textGradient: 'linear-gradient(to right, #f472b6, #a78bfa)',
    // Glow colors
    glow1: 'rgba(236, 72, 153, 0.1)', // pink
    glow2: 'rgba(139, 92, 246, 0.1)', // purple
    glow3: 'rgba(99, 102, 241, 0.1)', // indigo
    // Border/highlight colors
    borderAccent: 'rgba(236, 72, 153, 0.3)',
    bgAccent: 'rgba(236, 72, 153, 0.2)',
    bgAccent2: 'rgba(139, 92, 246, 0.2)',
    // Pulse dot
    pulseDot: '#f472b6',
    // Upload zone hover colors
    uploadHover1: 'rgba(236, 72, 153, 0.5)',
    uploadHover2: 'rgba(139, 92, 246, 0.5)',
    uploadIcon1: '#f472b6',
    uploadIcon2: '#a78bfa',
  },
  sage: {
    name: 'Sage Garden',
    id: 'sage',
    // Background gradient - deep forest greens
    background: 'linear-gradient(135deg, #0f1c14 0%, #1a2e1f 50%, #243524 100%)',
    // Primary gradient (buttons, accents) - darker greens for white text contrast
    primary: 'linear-gradient(135deg, #166534 0%, #15803d 50%, #14532d 100%)',
    primaryHover: 'linear-gradient(135deg, #15803d 0%, #166534 50%, #14532d 100%)',
    // Accent colors
    accent1: '#86efac', // green-300 (for glows/highlights)
    accent2: '#4ade80', // green-400
    accent3: '#22c55e', // green-500
    // Text gradient
    textGradient: 'linear-gradient(to right, #86efac, #4ade80)',
    // Glow colors
    glow1: 'rgba(134, 239, 172, 0.15)', // light green
    glow2: 'rgba(74, 222, 128, 0.15)', // green
    glow3: 'rgba(34, 197, 94, 0.15)', // darker green
    // Border/highlight colors
    borderAccent: 'rgba(134, 239, 172, 0.4)',
    bgAccent: 'rgba(134, 239, 172, 0.2)',
    bgAccent2: 'rgba(74, 222, 128, 0.2)',
    // Pulse dot
    pulseDot: '#86efac',
    // Upload zone hover colors
    uploadHover1: 'rgba(134, 239, 172, 0.5)',
    uploadHover2: 'rgba(74, 222, 128, 0.5)',
    uploadIcon1: '#86efac',
    uploadIcon2: '#4ade80',
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    // Load from localStorage or default to purple
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lyrics-video-theme') || 'purple';
    }
    return 'purple';
  });

  const theme = themes[themeId] || themes.purple;

  useEffect(() => {
    localStorage.setItem('lyrics-video-theme', themeId);
  }, [themeId]);

  const setTheme = (id) => {
    if (themes[id]) {
      setThemeId(id);
    }
  };

  const toggleTheme = () => {
    setThemeId((current) => (current === 'purple' ? 'sage' : 'purple'));
  };

  return (
    <ThemeContext.Provider value={{ theme, themeId, setTheme, toggleTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
