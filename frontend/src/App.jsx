import React, { useState } from 'react';
import TimelineEditor from './components/TimelineEditor';
import FileUpload from './components/FileUpload';
import StylePanel from './components/StylePanel';
import VideoPreview from './components/VideoPreview';
import {
  uploadFiles,
  alignLyrics,
  updateTiming,
  generateVideo,
  getDownloadUrl,
  getAudioUrl,
  deleteJob,
} from './api';

const STEPS = {
  UPLOAD: 'upload',
  PROCESSING: 'processing',
  EDIT: 'edit',
  GENERATE: 'generate',
  DOWNLOAD: 'download',
};

function App() {
  const [currentStep, setCurrentStep] = useState(STEPS.UPLOAD);
  const [jobId, setJobId] = useState(null);
  const [timingData, setTimingData] = useState(null);
  const [settings, setSettings] = useState({
    fontSize: 60,
    textColor: '#ffffff',
    strokeColor: '#000000',
    position: 'center',
    resolution: '1920x1080',
  });
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const [processingStatus, setProcessingStatus] = useState('');

  const handleUploadComplete = async ({ audioFile, imageFile, lyrics }) => {
    setError(null);
    setCurrentStep(STEPS.PROCESSING);
    setProcessingStatus('Uploading files...');

    try {
      // Upload files
      const uploadResult = await uploadFiles(audioFile, imageFile, lyrics);
      setJobId(uploadResult.job_id);
      setProcessingStatus('Analyzing audio and aligning lyrics... This may take 30-120 seconds.');

      // Start alignment (synchronous - waits for completion)
      const alignResult = await alignLyrics(uploadResult.job_id);
      setTimingData(alignResult.timing);
      setCurrentStep(STEPS.EDIT);
    } catch (err) {
      setError(err.message || 'Failed to process files');
      setCurrentStep(STEPS.UPLOAD);
    }
  };

  const handleTimingUpdate = async (newTiming) => {
    setTimingData(newTiming);
    if (jobId) {
      try {
        await updateTiming(jobId, newTiming);
      } catch (err) {
        console.error('Failed to save timing:', err);
      }
    }
  };

  const handleGenerate = async () => {
    setError(null);
    setCurrentStep(STEPS.GENERATE);

    try {
      const result = await generateVideo(jobId, settings);
      setVideoUrl(result.download_url);
      setCurrentStep(STEPS.DOWNLOAD);
    } catch (err) {
      setError(err.message || 'Failed to generate video');
      setCurrentStep(STEPS.EDIT);
    }
  };

  const handleReset = async () => {
    if (jobId) {
      try {
        await deleteJob(jobId);
      } catch (err) {
        console.error('Failed to clean up job:', err);
      }
    }
    setCurrentStep(STEPS.UPLOAD);
    setJobId(null);
    setTimingData(null);
    setVideoUrl(null);
    setError(null);
  };

  const handleCancelProcessing = async () => {
    if (jobId) {
      try {
        await deleteJob(jobId);
      } catch (err) {
        console.error('Failed to cancel:', err);
      }
    }
    setJobId(null);
    setCurrentStep(STEPS.UPLOAD);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Lyrics Video Generator</h1>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 text-sm">
            {Object.values(STEPS).map((step, i) => (
              <React.Fragment key={step}>
                <span
                  className={`px-2 py-1 rounded ${
                    currentStep === step
                      ? 'bg-blue-600'
                      : Object.values(STEPS).indexOf(currentStep) > i
                      ? 'bg-green-600'
                      : 'bg-gray-700'
                  }`}
                >
                  {step.charAt(0).toUpperCase() + step.slice(1)}
                </span>
                {i < Object.values(STEPS).length - 1 && (
                  <span className="text-gray-600">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-800 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <span className="text-red-200">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-300 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {currentStep === STEPS.UPLOAD && (
          <FileUpload onUploadComplete={handleUploadComplete} />
        )}

        {currentStep === STEPS.PROCESSING && (
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md text-center p-8">
              <div className="bg-gray-800 rounded-lg p-8">
                <div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-6" />
                <h2 className="text-xl font-bold mb-2">Processing Audio...</h2>
                <p className="text-gray-400 mb-6">{processingStatus}</p>
                <button
                  onClick={handleCancelProcessing}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === STEPS.EDIT && (
          <div className="flex-1 flex flex-col">
            <StylePanel settings={settings} onChange={setSettings} />
            <div className="flex-1">
              <TimelineEditor
                initialData={timingData}
                onTimingChange={handleTimingUpdate}
                onGenerate={handleGenerate}
                audioUrl={jobId ? getAudioUrl(jobId) : null}
              />
            </div>
          </div>
        )}

        {currentStep === STEPS.GENERATE && (
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md text-center p-8">
              <div className="bg-gray-800 rounded-lg p-8">
                <div className="animate-spin w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-6" />
                <h2 className="text-xl font-bold mb-2">Generating Video...</h2>
                <p className="text-gray-400">
                  Rendering your lyrics video. This may take a minute.
                </p>
              </div>
            </div>
          </div>
        )}

        {currentStep === STEPS.DOWNLOAD && (
          <VideoPreview videoUrl={videoUrl} onReset={handleReset} />
        )}
      </main>
    </div>
  );
}

export default App;
