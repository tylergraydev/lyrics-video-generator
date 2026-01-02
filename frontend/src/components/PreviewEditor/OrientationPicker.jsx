import React from 'react';

const ORIENTATIONS = [
  {
    value: 'horizontal',
    label: 'Horizontal',
    icon: (
      <svg className="w-5 h-3" viewBox="0 0 20 12" fill="currentColor">
        <rect x="0" y="0" width="20" height="12" rx="1" />
      </svg>
    ),
    description: '16:9'
  },
  {
    value: 'vertical',
    label: 'Vertical',
    icon: (
      <svg className="w-3 h-5" viewBox="0 0 12 20" fill="currentColor">
        <rect x="0" y="0" width="12" height="20" rx="1" />
      </svg>
    ),
    description: '9:16'
  }
];

// Resolution mappings for each orientation
export const ORIENTATION_RESOLUTIONS = {
  horizontal: {
    '720p': '1280x720',
    '1080p': '1920x1080',
    '4K': '3840x2160',
  },
  vertical: {
    '720p': '720x1280',
    '1080p': '1080x1920',
    '4K': '2160x3840',
  }
};

// Get quality level from resolution string
export function getQualityFromResolution(resolution) {
  for (const [orientation, resolutions] of Object.entries(ORIENTATION_RESOLUTIONS)) {
    for (const [quality, res] of Object.entries(resolutions)) {
      if (res === resolution) {
        return { quality, orientation };
      }
    }
  }
  return { quality: '1080p', orientation: 'horizontal' };
}

// Get resolution from quality and orientation
export function getResolutionFromQuality(quality, orientation) {
  return ORIENTATION_RESOLUTIONS[orientation]?.[quality] || '1920x1080';
}

export default function OrientationPicker({ value, onChange, resolution }) {
  const handleOrientationChange = (newOrientation) => {
    if (newOrientation === value) return;

    // Get current quality level
    const { quality } = getQualityFromResolution(resolution);

    // Get new resolution for the new orientation while preserving quality
    const newResolution = getResolutionFromQuality(quality, newOrientation);

    // Call onChange with both orientation and resolution together
    onChange(newOrientation, newResolution);
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-400 mr-1">Orientation</span>
      <div className="flex bg-gray-700 rounded-md p-0.5">
        {ORIENTATIONS.map((orientation) => (
          <button
            key={orientation.value}
            onClick={() => handleOrientationChange(orientation.value)}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors
              ${value === orientation.value
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-600'
              }
            `}
            title={`${orientation.label} (${orientation.description})`}
          >
            {orientation.icon}
            <span className="hidden sm:inline">{orientation.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
