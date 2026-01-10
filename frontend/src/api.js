/**
 * API Client for Lyrics Video Generator Backend
 * 
 * TODO: Implement these functions to connect to Flask backend
 */

const API_BASE = '/api';

/**
 * Upload files for processing
 * @param {File} audioFile - Audio file (mp3, wav, etc.)
 * @param {File} imageFile - Background image (jpg, png)
 * @param {string} lyrics - Lyrics text
 * @returns {Promise<{job_id: string, files: object}>}
 */
export async function uploadFiles(audioFile, imageFile, lyrics) {
  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('image', imageFile);
  formData.append('lyrics', lyrics);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Start lyrics alignment with WhisperX
 * @param {string} jobId - Job ID from upload
 * @param {string} modelSize - Whisper model size (tiny, base, small, medium, large-v3)
 * @returns {Promise<{success: boolean, timing: object}>}
 */
export async function alignLyrics(jobId, modelSize = 'large-v2') {
  const response = await fetch(`${API_BASE}/align`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId, model_size: modelSize }),
  });

  if (!response.ok) {
    throw new Error(`Alignment failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get timing data for a job
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} Timing JSON
 */
export async function getTiming(jobId) {
  const response = await fetch(`${API_BASE}/timing/${jobId}`);

  if (!response.ok) {
    throw new Error(`Failed to get timing: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Update timing data
 * @param {string} jobId - Job ID
 * @param {object} timingData - Updated timing data
 * @returns {Promise<{success: boolean}>}
 */
export async function updateTiming(jobId, timingData) {
  const response = await fetch(`${API_BASE}/timing/${jobId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(timingData),
  });

  if (!response.ok) {
    throw new Error(`Failed to update timing: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Generate video from timing data
 * @param {string} jobId - Job ID
 * @param {object} settings - Video generation settings
 * @returns {Promise<{success: boolean, download_url: string}>}
 */
export async function generateVideo(jobId, settings = {}) {
  // Transform frontend settings format to backend format
  const backendSettings = {
    font_size: settings.fontSize || 60,
    font: settings.font || 'Arial',
    text_color: settings.textColor || 'white',
    stroke_color: settings.strokeColor || 'black',
    stroke_width: settings.strokeWidth || 3,
    resolution: settings.resolution || '1920x1080',
    text_box: settings.textBox || null, // { x, y, width, height } normalized 0-1
    fps: settings.fps || 24,
  };

  const response = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId, settings: backendSettings }),
  });

  if (!response.ok) {
    throw new Error(`Video generation failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get download URL for generated video
 * @param {string} jobId - Job ID
 * @param {string} filename - File name (usually 'output.mp4')
 * @returns {string} Download URL
 */
export function getDownloadUrl(jobId, filename = 'output.mp4') {
  return `${API_BASE}/download/${jobId}/${filename}`;
}

/**
 * Get audio URL for a job
 * @param {string} jobId - Job ID
 * @returns {string} Audio URL
 */
export function getAudioUrl(jobId) {
  return `${API_BASE}/audio/${jobId}`;
}

/**
 * Get waveform data for a job
 * @param {string} jobId - Job ID
 * @returns {Promise<{peaks: number[], duration: number, sample_rate: number}>}
 */
export async function getWaveform(jobId) {
  const response = await fetch(`${API_BASE}/waveform/${jobId}`);

  if (!response.ok) {
    throw new Error(`Failed to get waveform: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete a job and its files
 * @param {string} jobId - Job ID
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteJob(jobId) {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete job: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Import timing JSON with audio and image files (skips alignment)
 * @param {File} audioFile - Audio file (mp3, wav, etc.)
 * @param {File} imageFile - Background image (jpg, png)
 * @param {File} timingFile - Timing JSON file
 * @returns {Promise<{job_id: string, files: object, timing: object}>}
 */
export async function importTimingFiles(audioFile, imageFile, timingFile) {
  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('image', imageFile);
  formData.append('timing', timingFile);

  const response = await fetch(`${API_BASE}/import-timing`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Import failed: ${response.statusText}`);
  }

  return response.json();
}
