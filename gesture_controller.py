import asyncio
import websockets
import json
import pyautogui
import ctypes
import time

# Enable Windows High-DPI Scaling Awareness so pyautogui coordinates match physical screen pixels exactly
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2) # Per-monitor DPI awareness
except Exception:
    try:
        ctypes.windll.user32.SetProcessDPIAware() # Fallback for older Windows systems
    except Exception:
        pass

# Disable PyAutoGUI pause delay for instant mouse response
pyautogui.PAUSE = 0.001
pyautogui.FAILSAFE = False  # Disabled to prevent crash when hand moves near screen edges

# Get primary monitor screen dimensions
SCREEN_WIDTH, SCREEN_HEIGHT = pyautogui.size()

# Mouse Cursor LERP State
curr_x, curr_y = SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2
LERP_FACTOR = 0.75 # Increased to 0.75 for ultra-fast, near-instant tracking

# Mouse Drag-and-drop state for Hand 1 (Cyan)
last_pinch_state = False

# Gesture time tracking variables for Hand 2 (Red/Pink)
last_pinch_time = 0.0
last_open_time = 0.0
hand2_last_pinch = False

async def handle_mouse_stream(websocket, path=None):
    global curr_x, curr_y, last_pinch_state
    global last_pinch_time, last_open_time, hand2_last_pinch
    
    print("[MOUSE] Virtual Mouse Active - Connected to browser socket.")
    
    try:
        async for message in websocket:
            data = json.loads(message)
            hands = data.get("hands", [])
            
            # Find Hand 1 (Cyan, id == 0) and Hand 2 (Red/Pink, id == 1)
            h1 = next((h for h in hands if h.get("id") == 0), None)
            h2 = next((h for h in hands if h.get("id") == 1), None)
            
            # 1. Cursor Movement & Drag (via Hand 1 - Cyan)
            if h1:
                target_x_norm = h1.get("x")
                target_y_norm = h1.get("y")
                is_pinching_h1 = h1.get("pinch", False)
                
                # Guard against null/NaN coordinates from browser
                if target_x_norm is not None and target_y_norm is not None:
                    # Apply 2.0x Sensitivity Multiplier (centered around 0.5) to double mouse speed relative to hand movement
                    SENSITIVITY = 2.0
                    target_x_norm = 0.5 + (target_x_norm - 0.5) * SENSITIVITY
                    target_y_norm = 0.5 + (target_y_norm - 0.5) * SENSITIVITY
                    
                    # Clamp scaled coordinates to screen bounds [0.0, 1.0]
                    target_x_norm = max(0.0, min(1.0, target_x_norm))
                    target_y_norm = max(0.0, min(1.0, target_y_norm))
                    
                    # Map normalized coordinates to screen dimensions
                    target_x = int(target_x_norm * SCREEN_WIDTH)
                    target_y = int(target_y_norm * SCREEN_HEIGHT)
                    
                    # Apply LERP smoothing filter to remove hand jitter
                    curr_x += (target_x - curr_x) * LERP_FACTOR
                    curr_y += (target_y - curr_y) * LERP_FACTOR
                    
                    # Ensure coordinates are within screen boundaries
                    curr_x = max(0, min(SCREEN_WIDTH, int(curr_x)))
                    curr_y = max(0, min(SCREEN_HEIGHT, int(curr_y)))
                    
                    # Move the system cursor
                    pyautogui.moveTo(curr_x, curr_y)
                
                # Hand 1 Click/Drag gesture mapping
                if is_pinching_h1 and not last_pinch_state:
                    pyautogui.mouseDown()
                elif not is_pinching_h1 and last_pinch_state:
                    pyautogui.mouseUp()
                
                last_pinch_state = is_pinching_h1

            # 2. Advanced Clicking & Menu Actions (via Hand 2 - Red)
            if h2:
                is_pinching_h2 = h2.get("pinch", False)
                current_time = time.time()
                
                # Check for Pinch start (False -> True) -> Double Click / Single Click
                if is_pinching_h2 and not hand2_last_pinch:
                    dt = current_time - last_pinch_time
                    if dt < 0.4:
                        print("[ACTION] Hand 2 (Red) Double Pinch -> DOUBLE CLICK")
                        pyautogui.doubleClick()
                        last_pinch_time = 0.0  # Reset
                    else:
                        print("[ACTION] Hand 2 (Red) Single Pinch -> SINGLE CLICK")
                        pyautogui.click()
                        last_pinch_time = current_time
                        
                # Check for Release/Open start (True -> False) -> Right Click
                elif not is_pinching_h2 and hand2_last_pinch:
                    dt = current_time - last_open_time
                    if dt < 0.4:
                        print("[ACTION] Hand 2 (Red) Double Open -> RIGHT CLICK")
                        pyautogui.rightClick()
                        last_open_time = 0.0  # Reset
                    else:
                        last_open_time = current_time
                        
                hand2_last_pinch = is_pinching_h2

    except websockets.exceptions.ConnectionClosed:
        print("[MOUSE] Connection closed by browser.")
        # Ensure mouse is released if connection drops during a pinch
        if last_pinch_state:
            pyautogui.mouseUp()
            last_pinch_state = False
    except Exception as e:
        print(f"[ERROR] Mouse control error: {e}")
        if last_pinch_state:
            pyautogui.mouseUp()
            last_pinch_state = False

async def main():
    print(f"==================================================")
    print(f"GESTURE MOUSE SERVER ACTIVE")
    print(f"Screen Resolution: {SCREEN_WIDTH}x{SCREEN_HEIGHT}")
    print(f"WebSocket Port: 8082")
    print(f"Move hand to screen corners to emergency abort script.")
    print(f"==================================================")
    
    server = None
    retry_count = 0
    while server is None:
        try:
            # Attempt to bind to port 8082
            server = await websockets.serve(handle_mouse_stream, "127.0.0.1", 8082)
        except OSError as e:
            # WinError 10048 (Address already in use / TIME_WAIT)
            if e.errno == 10048 or "10048" in str(e):
                retry_count += 1
                print(f"[RETRY {retry_count}] Port 8082 is busy (TIME_WAIT). Retrying in 2 seconds...")
                await asyncio.sleep(2)
                if retry_count > 15: # Timeout after 30 seconds
                    print("[ERROR] Port remains occupied. Please close any other running scripts.")
                    raise e
            else:
                raise e

    print("[MOUSE] Server successfully bound to port 8082.")
    await server.wait_closed()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[MOUSE] Virtual Mouse server shut down by user.")
