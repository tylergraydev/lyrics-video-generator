import React from 'react';

export default function VideoPreview({ videoUrl, onReset }) {
  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="bg-gray-800 rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">Your Video is Ready!</h2>

        {/* Video Player */}
        <div className="bg-black rounded-lg overflow-hidden mb-6">
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              className="w-full aspect-video"
            >
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="w-full aspect-video flex items-center justify-center text-gray-500">
              No video available
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={videoUrl}
            download="lyrics_video.mp4"
            className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-green-600 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Video
          </a>

          <button
            onClick={onReset}
            className="px-8 py-3 bg-gray-700 rounded-lg font-medium hover:bg-gray-600 transition-colors"
          >
            Create Another Video
          </button>
        </div>

        {/* Tips */}
        <div className="mt-8 p-4 bg-gray-700/50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Tips</h3>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Right-click the video to save or copy</li>
            <li>• The video is optimized for social media sharing</li>
            <li>• Upload to YouTube, TikTok, or Instagram</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
