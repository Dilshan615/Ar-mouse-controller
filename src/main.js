
// --- Terminal Log Helper ---
const terminalBody = document.getElementById('terminal-logs');
window.addTerminalLog = function(tag, message, typeClass = 'sys') {
  if (!terminalBody) return;
  
  const now = new Date();
  const timeString = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  
  const timeSpan = document.createElement('span');
  timeSpan.className = 'log-time';
  timeSpan.innerText = `[${timeString}]`;
  
  const tagSpan = document.createElement('span');
  tagSpan.className = `log-tag log-${typeClass}`;
  tagSpan.innerText = `[${tag}]`;
  
  const msgSpan = document.createElement('span');
  msgSpan.innerText = message;
  
  logEntry.appendChild(timeSpan);
  logEntry.appendChild(tagSpan);
  logEntry.appendChild(msgSpan);
  
  terminalBody.appendChild(logEntry);
  
  // Limit to 40 logs to prevent scrolling issues
  while (terminalBody.childNodes.length > 40) {
    terminalBody.removeChild(terminalBody.firstChild);
  }
  
  // Scroll to bottom
  terminalBody.scrollTop = terminalBody.scrollHeight;
};

// Initial Logs
window.addTerminalLog('SYS', 'System Core Initialized', 'sys');
window.addTerminalLog('SYS', 'Loading MediaPipe Hand SDK...', 'sys');

// --- Connect to Virtual Mouse Controller ---
let mouseSocket = null;
function connectToMouseController() {
  mouseSocket = new WebSocket('ws://127.0.0.1:8082');
  
  mouseSocket.onopen = () => {
    window.addTerminalLog('SYS', 'Virtual Mouse service connected', 'sys');
  };
  
  mouseSocket.onclose = () => {
    // Reconnect loop every 5 seconds
    setTimeout(connectToMouseController, 5000);
  };
  
  mouseSocket.onerror = () => {
    // Fail silently, reconnect will trigger automatically on close
  };
}
connectToMouseController();

// FPS Counter
const fpsCounter = document.getElementById('fps-counter');
let frames = 0;
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  
  frames++;
  const time = performance.now();
  if (time >= lastTime + 1000) {
    fpsCounter.innerText = Math.round((frames * 1000) / (time - lastTime));
    frames = 0;
    lastTime = time;
  }
}
animate();

// --- MediaPipe Hand Tracking Setup ---
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('webcam-preview');
const canvasCtx = canvasElement.getContext('2d');
const statusText = document.querySelector('.status');

// Set canvas dimensions dynamically to fill the screen
function resizeCanvas() {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let prevHandCount = -1;
let lastPositionLogTime = 0;

function onResults(results) {
  // Clear canvas
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  // Calculate aspect ratio crop (object-fit: cover logic with fallback properties)
  const imgWidth = results.image.width || results.image.videoWidth || 1280;
  const imgHeight = results.image.height || results.image.videoHeight || 720;
  const canvasWidth = canvasElement.width;
  const canvasHeight = canvasElement.height;

  const imgRatio = imgWidth / imgHeight;
  const canvasRatio = canvasWidth / canvasHeight;

  let drawWidth = canvasWidth;
  let drawHeight = canvasHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (imgRatio > canvasRatio) {
    drawWidth = canvasHeight * imgRatio;
    offsetX = (canvasWidth - drawWidth) / 2;
  } else {
    drawHeight = canvasWidth / imgRatio;
    offsetY = (canvasHeight - drawHeight) / 2;
  }

  // Mirror the drawing context for hand skeleton rendering (Webcam feed is hidden for Dark HUD)
  canvasCtx.translate(canvasWidth, 0);
  canvasCtx.scale(-1, 1);
  // canvasCtx.drawImage(results.image, offsetX, offsetY, drawWidth, drawHeight);

  let trackingActive = false;
  const handsDataArray = [];
  const handCount = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;

  // Log hand count changes
  if (handCount !== prevHandCount) {
    if (handCount === 0) {
      window.addTerminalLog('SYS', 'Tracking lost. No active hands.', 'sys');
    } else {
      window.addTerminalLog('SYS', `Tracking active: ${handCount} hand(s) detected`, 'sys');
    }
    prevHandCount = handCount;
  }

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    trackingActive = true;
    
    for (let h = 0; h < results.multiHandLandmarks.length; h++) {
      const landmarks = results.multiHandLandmarks[h];
      
      const thumb = landmarks[4];
      const index = landmarks[8];

      const centerX = (thumb.x + index.x) / 2;
      const centerY = (thumb.y + index.y) / 2;
      const centerZ = (thumb.z + index.z) / 2;
      
      const distance = Math.sqrt(
        Math.pow(thumb.x - index.x, 2) +
        Math.pow(thumb.y - index.y, 2) +
        Math.pow(thumb.z - index.z, 2)
      );

      // Map to screen-space coordinates (0 to 1) and mirror it so left is left, right is right
      const x_screen_mirrored = 1 - (centerX * drawWidth + offsetX) / canvasWidth;
      const y_screen = (centerY * drawHeight + offsetY) / canvasHeight;

      const handData = {
        id: h, // 0 for Hand 1 (Cyan), 1 for Hand 2 (Red)
        centerX: x_screen_mirrored, 
        centerY: y_screen,
        centerZ: centerZ,
        pinchDistance: distance,
        isPinching: distance < 0.08
      };
      handsDataArray.push(handData);

      // Throttled logging for coordinate positions to keep terminal moving
      const now = performance.now();
      if (now - lastPositionLogTime > 400) {
        window.addTerminalLog(
          `H${h}`, 
          `X: ${x_screen_mirrored.toFixed(2)} | Y: ${y_screen.toFixed(2)} | D: ${distance.toFixed(3)}`, 
          h === 0 ? 'hand0' : 'hand1'
        );
        if (h === results.multiHandLandmarks.length - 1) {
          lastPositionLogTime = now;
        }
      }

      // --- Draw Full Hand Connections ---
      const HAND_CONNECTIONS = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // Index
        [5, 9], [9, 10], [10, 11], [11, 12], // Middle
        [9, 13], [13, 14], [14, 15], [15, 16], // Ring
        [13, 17], [0, 17], [17, 18], [18, 19], [19, 20] // Pinky
      ];

      // Use cyan for Hand 1, hot pink for Hand 2
      const themeColor = h === 0 ? 'rgba(0, 255, 204, 0.5)' : 'rgba(255, 0, 85, 0.5)';
      const tipColor = h === 0 ? '#ff0055' : '#00ffcc';
      const jointColor = h === 0 ? '#00ffcc' : '#ff0055';
      const fillOverlayColor = h === 0 ? 'rgba(0, 255, 204, 0.15)' : 'rgba(255, 0, 85, 0.15)';
      const strokeOverlayColor = h === 0 ? 'rgba(0, 255, 204, 0.4)' : 'rgba(255, 0, 85, 0.4)';

      // Draw skeleton bones
      canvasCtx.strokeStyle = themeColor;
      canvasCtx.lineWidth = 3;
      for (const connection of HAND_CONNECTIONS) {
        const from = landmarks[connection[0]];
        const to = landmarks[connection[1]];
        
        const fx = from.x * drawWidth + offsetX;
        const fy = from.y * drawHeight + offsetY;
        const tx = to.x * drawWidth + offsetX;
        const ty = to.y * drawHeight + offsetY;

        canvasCtx.beginPath();
        canvasCtx.moveTo(fx, fy);
        canvasCtx.lineTo(tx, ty);
        canvasCtx.stroke();
      }

      // Draw all 21 joints
      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        const lx = lm.x * drawWidth + offsetX;
        const ly = lm.y * drawHeight + offsetY;

        canvasCtx.beginPath();
        if ([4, 8, 12, 16, 20].includes(i)) {
          canvasCtx.fillStyle = tipColor;
          canvasCtx.arc(lx, ly, 6, 0, 2 * Math.PI);
        } else {
          canvasCtx.fillStyle = jointColor;
          canvasCtx.arc(lx, ly, 4, 0, 2 * Math.PI);
        }
        canvasCtx.fill();
      }

      // (Pinch indicator overlay circles removed per user request)
    }
  }

  // Restore context (mirror state cleared)
  canvasCtx.restore();

  // Stream coordinates for all active hands to Virtual Mouse Controller
  if (mouseSocket && mouseSocket.readyState === WebSocket.OPEN) {
    const handsPayload = handsDataArray.map(hand => ({
      id: hand.id,
      x: hand.centerX,
      y: hand.centerY,
      pinch: hand.isPinching
    }));
    mouseSocket.send(JSON.stringify({ hands: handsPayload }));
  }

  // Update UI Status
  if (trackingActive) {
    statusText.innerHTML = `<span class="dot"></span> TRACKING ACTIVE (${results.multiHandLandmarks.length} HANDS)`;
    statusText.style.color = '#00ffcc';
  } else {
    statusText.innerHTML = '<span class="dot" style="background-color: #ff3333; box-shadow: 0 0 8px #ff3333;"></span> NO HAND DETECTED';
    statusText.style.color = '#ff3333';
  }
}

// Initialize MediaPipe Hands
const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  }
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults(onResults);

// --- Dynamic Clock Panel Update ---
const clockTime = document.getElementById('sys-time');
const clockDate = document.getElementById('sys-date');

function updateSystemClock() {
  if (!clockTime || !clockDate) return;
  const now = new Date();
  
  // Format Time: HH:MM:SS
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  clockTime.innerText = `${hh}:${mm}:${ss}`;

  // Format Date: YYYY-MM-DD
  const yyyy = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  clockDate.innerText = `${yyyy}-${m}-${d}`;
}
setInterval(updateSystemClock, 1000);
updateSystemClock(); // run immediately

// Setup Web Camera (HD 720p 16:9 aspect ratio)
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 1280,
  height: 720
});

// Start tracking once camera is allowed
camera.start()
  .then(() => {
    window.addTerminalLog('CAM', 'Webcam source linked successfully (1280x720 HD)', 'cam');
  })
  .catch(err => {
    console.error("Camera access failed:", err);
    window.addTerminalLog('CAM', `Connection failed: ${err.message}`, 'cam');
    statusText.innerHTML = '<span class="dot" style="background-color: #ff3333; box-shadow: 0 0 8px #ff3333;"></span> CAMERA ERROR';
    statusText.style.color = '#ff3333';
  });
