const videoPlayer = document.getElementById('videoPlayer');
const videoPreview = document.getElementById('videoPreview');
const placeholder = document.getElementById('placeholder');
const recordingIndicator = document.getElementById('recordingIndicator');
const recordingTime = document.getElementById('recordingTime');
const playbackControls = document.getElementById('playbackControls');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const progressHandle = document.getElementById('progressHandle');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const volumeControl = document.getElementById('volumeControl');
const volumeSlider = document.getElementById('volumeSlider');
const volumeIcon = document.getElementById('volumeIcon');
const muteIcon = document.getElementById('muteIcon');

const btnOpen = document.getElementById('btnOpen');
const btnRecord = document.getElementById('btnRecord');
const btnScreenRecord = document.getElementById('btnScreenRecord');
const btnPlay = document.getElementById('btnPlay');
const btnStop = document.getElementById('btnStop');
const btnSave = document.getElementById('btnSave');
const btnMute = document.getElementById('btnMute');
const btnFullscreen = document.getElementById('btnFullscreen');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const playBtnText = document.getElementById('playBtnText');

const sourcePickerModal = document.getElementById('sourcePickerModal');
const sourceList = document.getElementById('sourceList');
const closeModal = document.getElementById('closeModal');
const includeAudio = document.getElementById('includeAudio');

let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = null;
let recordingTimer = null;
let currentMode = 'idle'; // 'idle', 'recording', 'preview', 'playback'
let stream = null;
let recordingType = 'camera'; // 'camera' or 'screen'
let selectedSourceId = null;

// Initialize
async function init() {
  setupEventListeners();
  setupIpcListeners();
}

function setupEventListeners() {
  btnOpen.addEventListener('click', openFile);
  btnRecord.addEventListener('click', toggleRecording);
  btnScreenRecord.addEventListener('click', showSourcePicker);
  btnPlay.addEventListener('click', togglePlayPause);
  btnStop.addEventListener('click', stopRecording);
  btnSave.addEventListener('click', saveRecording);
  btnMute.addEventListener('click', toggleMute);
  btnFullscreen.addEventListener('click', toggleFullscreen);
  volumeSlider.addEventListener('input', handleVolumeChange);
  
  closeModal.addEventListener('click', hideSourcePicker);
  sourcePickerModal.addEventListener('click', (e) => {
    if (e.target === sourcePickerModal) hideSourcePicker();
  });
  
  progressBar.addEventListener('click', handleProgressClick);
  progressBar.addEventListener('mousedown', startProgressDrag);
  
  videoPlayer.addEventListener('timeupdate', updateProgress);
  videoPlayer.addEventListener('loadedmetadata', handleVideoLoaded);
  videoPlayer.addEventListener('ended', handleVideoEnded);
  videoPlayer.addEventListener('play', updatePlayButton);
  videoPlayer.addEventListener('pause', updatePlayButton);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

function setupIpcListeners() {
  window.electronAPI.onOpenVideo((path) => {
    loadVideo(path);
  });
  
  window.electronAPI.onSaveRecording(() => {
    if (recordedChunks.length > 0) {
      saveRecording();
    }
  });
}

async function openFile() {
  const filePath = await window.electronAPI.openFileDialog();
  if (filePath) {
    loadVideo(filePath);
  }
}

function loadVideo(filePath) {
  stopCurrentActivity();
  
  videoPlayer.src = `file://${filePath}`;
  videoPlayer.classList.remove('hidden');
  videoPreview.classList.add('hidden');
  placeholder.classList.add('hidden');
  
  currentMode = 'playback';
  updateUIForMode();
}

async function toggleRecording() {
  if (currentMode === 'recording') {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  try {
    stopCurrentActivity();
    recordingType = 'camera';
    
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: true
    });
    
    videoPreview.srcObject = stream;
    videoPreview.classList.remove('hidden');
    videoPlayer.classList.add('hidden');
    placeholder.classList.add('hidden');
    
    startMediaRecorder();
    
  } catch (err) {
    console.error('Error accessing camera:', err);
    alert('Could not access camera/microphone. Please ensure permissions are granted.');
  }
}

async function showSourcePicker() {
  // On Linux, directly use getDisplayMedia which shows native picker
  // This bypasses Electron's desktopCapturer which has permission issues
  startScreenRecording();
}

function hideSourcePicker() {
  sourcePickerModal.classList.add('hidden');
  selectedSourceId = null;
}

function selectSource(sourceId, element) {
  document.querySelectorAll('.source-item').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
  selectedSourceId = sourceId;
  startScreenRecording();
}

async function startScreenRecording() {
  hideSourcePicker();
  stopCurrentActivity();
  recordingType = 'screen';
  
  try {
    // Use getDisplayMedia for better Linux/Wayland compatibility
    // This triggers the native system screen picker
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always',
        displaySurface: 'monitor'
      },
      audio: includeAudio.checked
    });
    
    videoPreview.srcObject = stream;
    videoPreview.classList.remove('hidden');
    videoPlayer.classList.add('hidden');
    placeholder.classList.add('hidden');
    
    // Handle stream ending (user stops sharing)
    stream.getVideoTracks()[0].onended = () => {
      if (currentMode === 'recording') {
        stopRecording();
      }
    };
    
    startMediaRecorder();
    
  } catch (err) {
    console.error('Error accessing screen:', err);
    if (err.name === 'NotAllowedError') {
      alert('Screen recording permission denied.\n\nPlease allow screen sharing when prompted.');
    } else {
      alert('Could not access screen: ' + err.message);
    }
  }
}

function startMediaRecorder() {
  recordedChunks = [];
  
  const options = { mimeType: 'video/webm;codecs=vp9,opus' };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options.mimeType = 'video/webm;codecs=vp8,opus';
  }
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options.mimeType = 'video/webm';
  }
  
  mediaRecorder = new MediaRecorder(stream, options);
  
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };
  
  mediaRecorder.onstop = () => {
    showRecordedPreview();
  };
  
  mediaRecorder.start(1000);
  currentMode = 'recording';
  recordingStartTime = Date.now();
  startRecordingTimer();
  updateUIForMode();
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  
  stopRecordingTimer();
  
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  
  currentMode = 'preview';
  updateUIForMode();
}

function showRecordedPreview() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  
  videoPlayer.src = url;
  videoPlayer.classList.remove('hidden');
  videoPreview.classList.add('hidden');
  videoPreview.srcObject = null;
  
  currentMode = 'preview';
  updateUIForMode();
}

async function saveRecording() {
  if (recordedChunks.length === 0) return;
  
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const buffer = await blob.arrayBuffer();
  
  const result = await window.electronAPI.saveVideo(buffer);
  if (result.success) {
    console.log('Video saved to:', result.path);
  }
}

function togglePlayPause() {
  if (videoPlayer.paused) {
    videoPlayer.play();
  } else {
    videoPlayer.pause();
  }
}

function updatePlayButton() {
  if (videoPlayer.paused) {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    playBtnText.textContent = 'Play';
  } else {
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    playBtnText.textContent = 'Pause';
  }
}

function toggleMute() {
  videoPlayer.muted = !videoPlayer.muted;
  updateVolumeIcon();
}

function handleVolumeChange() {
  videoPlayer.volume = volumeSlider.value;
  videoPlayer.muted = volumeSlider.value === '0';
  updateVolumeIcon();
}

function updateVolumeIcon() {
  if (videoPlayer.muted || videoPlayer.volume === 0) {
    volumeIcon.classList.add('hidden');
    muteIcon.classList.remove('hidden');
  } else {
    volumeIcon.classList.remove('hidden');
    muteIcon.classList.add('hidden');
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
}

function handleProgressClick(e) {
  const rect = progressBar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  videoPlayer.currentTime = percent * videoPlayer.duration;
}

let isDragging = false;

function startProgressDrag(e) {
  isDragging = true;
  document.addEventListener('mousemove', handleProgressDrag);
  document.addEventListener('mouseup', stopProgressDrag);
}

function handleProgressDrag(e) {
  if (!isDragging) return;
  const rect = progressBar.getBoundingClientRect();
  let percent = (e.clientX - rect.left) / rect.width;
  percent = Math.max(0, Math.min(1, percent));
  videoPlayer.currentTime = percent * videoPlayer.duration;
}

function stopProgressDrag() {
  isDragging = false;
  document.removeEventListener('mousemove', handleProgressDrag);
  document.removeEventListener('mouseup', stopProgressDrag);
}

function updateProgress() {
  if (!videoPlayer.duration) return;
  
  const percent = (videoPlayer.currentTime / videoPlayer.duration) * 100;
  progressFill.style.width = `${percent}%`;
  progressHandle.style.left = `${percent}%`;
  currentTimeEl.textContent = formatTime(videoPlayer.currentTime);
}

function handleVideoLoaded() {
  durationEl.textContent = formatTime(videoPlayer.duration);
}

function handleVideoEnded() {
  updatePlayButton();
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function startRecordingTimer() {
  recordingTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');
    recordingTime.textContent = `${mins}:${secs}`;
  }, 1000);
}

function stopRecordingTimer() {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
}

function stopCurrentActivity() {
  if (currentMode === 'recording') {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    stopRecordingTimer();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
  }
  
  videoPlayer.pause();
  videoPlayer.src = '';
  videoPreview.srcObject = null;
}

function updateUIForMode() {
  // Reset all buttons
  btnRecord.classList.remove('hidden');
  btnScreenRecord.classList.remove('hidden');
  btnOpen.classList.remove('hidden');
  btnPlay.classList.add('hidden');
  btnStop.classList.add('hidden');
  btnSave.classList.add('hidden');
  playbackControls.classList.add('hidden');
  recordingIndicator.classList.add('hidden');
  volumeControl.classList.add('hidden');
  
  switch (currentMode) {
    case 'idle':
      placeholder.classList.remove('hidden');
      videoPlayer.classList.add('hidden');
      videoPreview.classList.add('hidden');
      break;
      
    case 'recording':
      recordingIndicator.classList.remove('hidden');
      btnStop.classList.remove('hidden');
      btnRecord.classList.add('hidden');
      btnScreenRecord.classList.add('hidden');
      btnOpen.classList.add('hidden');
      break;
      
    case 'preview':
      btnPlay.classList.remove('hidden');
      btnSave.classList.remove('hidden');
      playbackControls.classList.remove('hidden');
      volumeControl.classList.remove('hidden');
      break;
      
    case 'playback':
      btnPlay.classList.remove('hidden');
      playbackControls.classList.remove('hidden');
      volumeControl.classList.remove('hidden');
      break;
  }
}

function handleKeyboard(e) {
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (currentMode === 'preview' || currentMode === 'playback') {
        togglePlayPause();
      } else if (currentMode === 'idle') {
        toggleRecording();
      }
      break;
    case 'KeyR':
      if (e.metaKey || e.ctrlKey) return;
      if (currentMode === 'idle' || currentMode === 'preview' || currentMode === 'playback') {
        toggleRecording();
      }
      break;
    case 'KeyS':
      if (e.metaKey || e.ctrlKey) return;
      if (currentMode === 'idle' || currentMode === 'preview' || currentMode === 'playback') {
        showSourcePicker();
      }
      break;
    case 'Escape':
      if (currentMode === 'recording') {
        stopRecording();
      }
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      break;
    case 'KeyM':
      toggleMute();
      break;
    case 'KeyF':
      toggleFullscreen();
      break;
    case 'ArrowLeft':
      if (currentMode === 'preview' || currentMode === 'playback') {
        videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5);
      }
      break;
    case 'ArrowRight':
      if (currentMode === 'preview' || currentMode === 'playback') {
        videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 5);
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      videoPlayer.volume = Math.min(1, videoPlayer.volume + 0.1);
      volumeSlider.value = videoPlayer.volume;
      break;
    case 'ArrowDown':
      e.preventDefault();
      videoPlayer.volume = Math.max(0, videoPlayer.volume - 0.1);
      volumeSlider.value = videoPlayer.volume;
      break;
  }
}

// Initialize the app
init();
