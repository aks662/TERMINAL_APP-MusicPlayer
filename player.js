const fs = require('fs');
const process = require('process');
const { spawn } = require('child_process');
const readline = require('readline');

// Constants
const SONGS_DIR = './songs';

// State variables
let selectedIndex = 0;
let currentPlayer = null;
let isPaused = false;

// Load all MP3 files from the songs folder
const songFiles = fs
  .readdirSync(SONGS_DIR)
  .filter(file => file.toLowerCase().endsWith('.mp3'));

// If no songs found, exit
if (songFiles.length === 0) {
  console.log('❌ No MP3 files found in the songs folder.');
  process.exit(0);
}

// Clear terminal screen
function clearConsole() {
  process.stdout.write('\x1Bc');
}

// Stop the currently playing song (if any)
function stopCurrentPlayer() {
  if (!currentPlayer) return;

  const player = currentPlayer;

  try {
    // If paused, resume before terminating to avoid zombie process
    if (isPaused) {
      process.kill(player.pid, 'SIGCONT');
    }
    process.kill(player.pid, 'SIGTERM');
  } catch (err) {
    // Ignore if process already gone
  }

  if (currentPlayer === player) {
    currentPlayer = null;
    isPaused = false;
  }
}

// Exit the player gracefully
function exitPlayer() {
  stopCurrentPlayer();

  // Reset terminal settings
  process.stdin.setRawMode(false);
  process.stdin.pause();

  clearConsole();
  console.log('\n👋 Exiting the Music Player. Goodbye!\n');
  process.exit(0);
}

// Remove .mp3 extension to get display name
function getSongName(filename) {
  return filename.replace(/\.mp3$/i, '');
}

// Play a song by file path
function playSong(songPath, songName) {
  stopCurrentPlayer();

  clearConsole();
  console.log('\n🎶 MUSIC PLAYER 🎶');
  console.log('==================\n');
  console.log(`🎧 Now playing: ${songName}`);

  const player = spawn('afplay', [songPath]);
  currentPlayer = player;
  isPaused = false;

  console.log(`\n🎵 PID: ${player.pid}`);
  console.log('\n🎮 Controls:');
  console.log('⏸️  P → Pause');
  console.log('▶️  R → Resume');
  console.log('⏹️  S → Stop');
  console.log('❌ ESC → Exit');

  player.on('error', (err) => {
    console.log('\n❌ Error playing song:', err.message);
    if (currentPlayer === player) {
      currentPlayer = null;
      isPaused = false;
    }
    setTimeout(renderMenu, 1000);
  });

  player.on('close', (code) => {
    if (currentPlayer !== player) return;
    currentPlayer = null;
    isPaused = false;

    if (code === 0) {
      console.log('\n✅ Song finished.');
    }
    setTimeout(renderMenu, 500);
  });
}

// Pause current song
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
    console.log('\n⏸️ Song paused.');
  } catch (err) {
    console.log('\n❌ Unable to pause song:', err.message);
  }
}

// Resume paused song
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
    console.log('\n▶️ Song resumed.');
  } catch (err) {
    console.log('\n❌ Unable to resume song:', err.message);
  }
}

// Stop current song and return to menu
function stopSong() {
  if (!currentPlayer) {
    console.log('\n❌ No song is currently playing.');
    return;
  }

  stopCurrentPlayer();
  console.log('\n⏹️ Song stopped.');
  renderMenu();
}

// Display the playlist menu
function renderMenu() {
  clearConsole();

  console.log('\n🎶 Welcome to the Music Player! 🎶');
  console.log('===================================\n');
  console.log('Use ↑ ↓ to select a song');
  console.log('Press ENTER to play\n');

  songFiles.forEach((file, index) => {
    const songName = getSongName(file);
    if (index === selectedIndex) {
      // Highlight selected song with inverted colors
      process.stdout.write(`\x1b[7m  ❯ ${index + 1}. ${songName}  \x1b[0m\n`);
    } else {
      console.log(`    ${index + 1}. ${songName}`);
    }
  });

  console.log('\n===================================');
  console.log('🎮 Controls:');
  console.log('↑ ↓ → Select song');
  console.log('ENTER → Play selected song');
  console.log('P → Pause');
  console.log('R → Resume');
  console.log('S → Stop');
  console.log('ESC → Exit');
  console.log('===================================');
}

// Handle key presses using readline's keypress events
function handleKeyPress(str, key) {
  // Ctrl+C to exit
  if (key.ctrl && key.name === 'c') {
    exitPlayer();
    return;
  }

  // Escape key to exit
  if (key.name === 'escape') {
    exitPlayer();
    return;
  }

  // Arrow Up
  if (key.name === 'up') {
    selectedIndex = (selectedIndex - 1 + songFiles.length) % songFiles.length;
    renderMenu();
    return;
  }

  // Arrow Down
  if (key.name === 'down') {
    selectedIndex = (selectedIndex + 1) % songFiles.length;
    renderMenu();
    return;
  }

  // Enter key
  if (key.name === 'return' || key.name === 'enter') {
    const selectedSong = songFiles[selectedIndex];
    const songPath = `${SONGS_DIR}/${selectedSong}`;
    playSong(songPath, getSongName(selectedSong));
    return;
  }

  // Letter commands (p, r, s)
  const input = key.name || str;
  if (input === 'p') {
    pauseSong();
    return;
  }
  if (input === 'r') {
    resumeSong();
    return;
  }
  if (input === 's') {
    stopSong();
    return;
  }

  // Number selection (1-9, possibly more)
  const numericIndex = Number(str);
  if (
    Number.isInteger(numericIndex) &&
    numericIndex >= 1 &&
    numericIndex <= songFiles.length
  ) {
    selectedIndex = numericIndex - 1;
    const selectedSong = songFiles[selectedIndex];
    const songPath = `${SONGS_DIR}/${selectedSong}`;
    playSong(songPath, getSongName(selectedSong));
  }
}

// Initialize terminal input
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

// Use readline to emit keypress events (handles arrow keys correctly)
readline.emitKeypressEvents(process.stdin);
process.stdin.on('keypress', handleKeyPress);

// Handle SIGINT (Ctrl+C) as fallback
process.on('SIGINT', () => {
  exitPlayer();
});

// Show menu on start
renderMenu();