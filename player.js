const fs = require('fs');
const { spawn } = require('child_process');
const readline = require('readline');

const progressBar = require('./progressbar');

// ---------- Configuration ----------
const SONGS_DIR = './songs';

// ---------- State ----------
let selectedIndex = 0;
let currentPlayer = null;
let isPaused = false;
let currentSong = null;

let currentProgress = {
  bar: '[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0%',
  elapsed: '00:00',
  duration: '00:00'
};

// ---------- Load songs ----------
let allFiles;
try {
  allFiles = fs
    .readdirSync(SONGS_DIR)
    .filter(file => file.toLowerCase().endsWith('.mp3'));
} catch (err) {
  console.log(`❌ Cannot read "${SONGS_DIR}" folder.`);
  console.log('   Create it and put some .mp3 files inside.');
  process.exit(1);
}

if (allFiles.length === 0) {
  console.log('❌ No MP3 files found inside the songs folder.');
  process.exit(0);
}

// Scan each file and tag it as playable or silent
const songs = allFiles.map(file => {
  const songPath = `${SONGS_DIR}/${file}`;
  const duration = progressBar.getDuration(songPath);

  return {
    file,
    songName: file.replace(/\.mp3$/i, ''),
    path: songPath,
    duration,
    valid: duration > 0
  };
});

const playableCount = songs.filter(s => s.valid).length;
const silentCount = songs.length - playableCount;

if (playableCount === 0) {
  console.log('❌ All MP3 files in ./songs have no sound / are invalid.');
  process.exit(0);
}

// ---------- Helpers ----------
function clearConsole() {
  process.stdout.write('\x1Bc');
}

function updateProgress(progress) {
  currentProgress = progress;
  if (!currentPlayer) return;
  renderPlayer();
}

function showMessage(msg) {
  clearConsole();
  console.log(`\n${msg}\n`);
  console.log('Returning to menu...');
  setTimeout(renderMenu, 1200);
}

// ---------- Stop / Exit ----------
function killCurrentPlayer() {
  if (!currentPlayer) return;

  const player = currentPlayer;

  try {
    if (isPaused) process.kill(player.pid, 'SIGCONT');
    process.kill(player.pid, 'SIGTERM');
  } catch (err) {
    // already gone — ignore
  }

  if (currentPlayer === player) {
    currentPlayer = null;
    isPaused = false;
    currentSong = null;

    progressBar.stopProgress();

    currentProgress = {
      bar: '[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0%',
      elapsed: '00:00',
      duration: '00:00'
    };
  }
}

function exitPlayer() {
  killCurrentPlayer();

  process.stdin.setRawMode(false);
  process.stdin.pause();

  clearConsole();
  console.log('\n👋 Exiting the Music Player. Goodbye!\n');
  process.exit(0);
}

// ---------- Play ----------
function playSelected(song) {
  if (!song.valid) {
    showMessage(`🔇 "${song.songName}" has no sound available.`);
    return;
  }

  killCurrentPlayer();

  currentSong = song.songName;
  isPaused = false;

  progressBar.startProgress(song.path, updateProgress);

  const player = spawn('afplay', [song.path]);
  currentPlayer = player;

  renderPlayer();

  player.on('error', (err) => {
    progressBar.stopProgress();
    console.log('\n❌ Error playing song:', err.message);

    if (currentPlayer === player) {
      currentPlayer = null;
      isPaused = false;
    }

    setTimeout(renderMenu, 1000);
  });

  player.on('close', (code) => {
    if (currentPlayer !== player) return;

    progressBar.stopProgress();
    currentPlayer = null;
    isPaused = false;

    if (code === 0) console.log('\n\n✅ Song finished.');

    setTimeout(renderMenu, 1000);
  });
}

// ---------- Render: Now Playing ----------
function renderPlayer() {
  clearConsole();

  console.log('\n🎶 MUSIC PLAYER 🎶');
  console.log('==================\n');
  console.log(`🎧 Now playing: ${currentSong}\n`);
  console.log(`🎵 ${currentProgress.bar}`);
  console.log(`   ${currentProgress.elapsed} / ${currentProgress.duration}`);
  console.log('\n');
  console.log(isPaused ? '⏸️  PAUSED' : '▶️  PLAYING');
  console.log('\n==================');
  console.log('🎮 Controls:');
  console.log('P → Pause');
  console.log('R → Resume');
  console.log('S → Stop');
  console.log('ESC → Exit');
  console.log('==================');
}

// ---------- Pause / Resume / Stop ----------
function pauseSong() {
  if (!currentPlayer) {
    console.log('\n❌ No song is currently playing.');
    return;
  }
  if (isPaused) {
    console.log('\n⚠️ Song is already paused.');
    return;
  }

  try {
    process.kill(currentPlayer.pid, 'SIGSTOP');
    isPaused = true;
    progressBar.pauseProgress();
    renderPlayer();
  } catch (err) {
    console.log('\n❌ Unable to pause song:', err.message);
  }
}

function resumeSong() {
  if (!currentPlayer) {
    console.log('\n❌ No song is currently playing.');
    return;
  }
  if (!isPaused) {
    console.log('\n⚠️ Song is already playing.');
    return;
  }

  try {
    process.kill(currentPlayer.pid, 'SIGCONT');
    isPaused = false;
    progressBar.resumeProgress(updateProgress);
    renderPlayer();
  } catch (err) {
    console.log('\n❌ Unable to resume song:', err.message);
  }
}

function stopSong() {
  if (!currentPlayer) {
    console.log('\n❌ No song is currently playing.');
    return;
  }
  killCurrentPlayer();
  renderMenu();
}

// ---------- Render: Menu ----------
function renderMenu() {
  clearConsole();

  console.log('\n🎶 Welcome to the Music Player! 🎶');
  console.log('===================================\n');
  console.log('Use ↑ ↓ to select a song');
  console.log('Press ENTER to play\n');

  songs.forEach((song, index) => {
    const isSelected = index === selectedIndex;
    const tag = song.valid ? '' : '  🔇 (no sound)';
    const label = `    ${index + 1}. ${song.songName}${tag}`;

    if (isSelected) {
      process.stdout.write(`\x1b[7m  ❯ ${index + 1}. ${song.songName}${tag}  \x1b[0m\n`);
    } else if (!song.valid) {
      // Dim invalid songs
      process.stdout.write(`\x1b[2m${label}\x1b[0m\n`);
    } else {
      console.log(label);
    }
  });

  console.log('\n===================================');
  if (silentCount > 0) {
    console.log(`🔇 ${silentCount} file(s) have no sound and cannot be played.`);
    console.log('===================================');
  }
  console.log('🎮 Controls:');
  console.log('↑ ↓ → Select song');
  console.log('ENTER → Play selected song');
  console.log('P → Pause');
  console.log('R → Resume');
  console.log('S → Stop');
  console.log('ESC → Exit');
  console.log('===================================');
}

// ---------- Input handling ----------
function handleKeyPress(str, key) {
  if (key.ctrl && key.name === 'c') { exitPlayer(); return; }
  if (key.name === 'escape') { exitPlayer(); return; }

  if (key.name === 'up') {
    selectedIndex = (selectedIndex - 1 + songs.length) % songs.length;
    renderMenu();
    return;
  }

  if (key.name === 'down') {
    selectedIndex = (selectedIndex + 1) % songs.length;
    renderMenu();
    return;
  }

  if (key.name === 'return' || key.name === 'enter') {
    playSelected(songs[selectedIndex]);
    return;
  }

  const input = key.name || str;
  if (input === 'p') { pauseSong(); return; }
  if (input === 'r') { resumeSong(); return; }
  if (input === 's') { stopSong(); return; }

  const num = Number(str);
  if (Number.isInteger(num) && num >= 1 && num <= songs.length) {
    selectedIndex = num - 1;
    playSelected(songs[selectedIndex]);
  }
}

// ---------- Init ----------
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

readline.emitKeypressEvents(process.stdin);
process.stdin.on('keypress', handleKeyPress);

process.on('SIGINT', () => exitPlayer());

renderMenu();