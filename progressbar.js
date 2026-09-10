const { spawnSync } = require('child_process');

// ---------- State ----------
let duration = 0;
let pausedElapsed = 0;    // seconds accumulated before current play segment
let startTimestamp = 0;   // timestamp when current play segment began
let timer = null;
let onUpdateCallback = null;

const isMac = process.platform === 'darwin';

// ---------- Duration lookup ----------
// Uses macOS `afinfo` to read song duration. Returns 0 if unavailable.
function getDuration(songPath) {
  if (!isMac) return 0;

  try {
    const result = spawnSync('afinfo', [songPath]);

    if (!result.stdout) return 0;

    const output = result.stdout.toString();
    const match = output.match(/estimated duration:\s*([\d.]+)\s*sec/);

    if (!match) return 0;

    const value = parseFloat(match[1]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch (err) {
    return 0;
  }
}

// ---------- Time formatting ----------
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    seconds = 0;
  }

  seconds = Math.floor(seconds);

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ---------- Elapsed calculation ----------
// Real-time based so the bar doesn't drift over long songs.
function currentElapsed() {
  if (startTimestamp === 0) return pausedElapsed;
  return pausedElapsed + Math.floor((Date.now() - startTimestamp) / 1000);
}

// ---------- Progress bar string ----------
function createProgressBar() {
  const barLength = 30;
  const elapsed = currentElapsed();

  let progress = 0;
  if (duration > 0) {
    progress = elapsed / duration;
    if (progress > 1) progress = 1;
    if (progress < 0) progress = 0;
  }

  const filled = Math.floor(progress * barLength);
  const empty = barLength - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percent = Math.floor(progress * 100);

  return `[${bar}] ${percent}%`;
}

function getProgress() {
  return {
    bar: createProgressBar(),
    elapsed: formatTime(currentElapsed()),
    duration: formatTime(duration)
  };
}

function emit() {
  if (typeof onUpdateCallback === 'function') {
    onUpdateCallback(getProgress());
  }
}

// ---------- Public API ----------
function startProgress(songPath, onUpdate) {
  stopProgress();

  onUpdateCallback = onUpdate;
  duration = getDuration(songPath);
  pausedElapsed = 0;
  startTimestamp = Date.now();

  emit();

  timer = setInterval(emit, 1000);
}

function pauseProgress() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (startTimestamp !== 0) {
    pausedElapsed = currentElapsed();
    startTimestamp = 0;
  }
}

function resumeProgress(onUpdate) {
  if (typeof onUpdate === 'function') {
    onUpdateCallback = onUpdate;
  }

  if (timer || startTimestamp !== 0) return;

  startTimestamp = Date.now();
  emit();

  timer = setInterval(emit, 1000);
}

function stopProgress() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  duration = 0;
  pausedElapsed = 0;
  startTimestamp = 0;
}

module.exports = {
  getProgress,
  startProgress,
  pauseProgress,
  resumeProgress,
  stopProgress
};