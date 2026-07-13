# Interactive AR Gesture Mouse Controller

This project is an Augmented Reality (AR) application that allows you to control your computer's mouse cursor using hand tracking via a webcam. It uses the MediaPipe SDK to track hand gestures and a Python backend script to control the mouse system-wide. The application features a futuristic, sci-fi inspired user interface.

## Project Summary
The system consists of two main components:
1. **Frontend (Web UI):** Uses your webcam to detect hand movements (via MediaPipe) and sends the coordinates and gesture data to a Python server via WebSockets.
2. **Backend (Python Script):** Receives the gesture data from the frontend and uses the `pyautogui` library to move the system's mouse cursor and execute clicks.

### Gestures & Controls
* **Hand 1 (Cyan):** Used for moving the mouse cursor and dragging (Pinch to drag & drop).
* **Hand 2 (Red):** Used for clicking actions.
  * Single Pinch: Left Click
  * Double Pinch: Double Click
  * Double Open (Release): Right Click

---

## Installation Guide

To run this project, you need to have both **Node.js** and **Python** installed on your computer.

### 1. Frontend Setup (Node.js)
Open your terminal or command prompt, navigate to the `frontend` folder, and run the following command to install the required packages:
```bash
npm install
```
*(This will install dependencies like Three.js, Socket.io, and Vite from the package.json file.)*

### 2. Backend Setup (Python)
Ensure Python is installed, then run the following command to install the necessary Python libraries:
```bash
pip install websockets pyautogui
```

---

## How to Run

To make the system work, both the Python backend server and the frontend web application must be running simultaneously.

**Step 1: Start the Python Server**
Open a terminal and run the backend script:
```bash
python gesture_controller.py
```
*(The terminal should display "GESTURE MOUSE SERVER ACTIVE", indicating it is listening on port 8082.)*

**Step 2: Start the Frontend Application**
Open a new terminal window and start the Vite development server:
```bash
npm run dev
```
*(Open the Localhost URL provided in the terminal (e.g., `http://localhost:5173`) in your web browser. Make sure to allow camera permissions when prompted.)*

---

## File Structure & Details

* **`index.html`**: The main entry point for the web application. It contains the HTML structure for the webcam preview, the futuristic UI overlay, and loads the MediaPipe SDKs.
* **`style.css`**: Contains the CSS styling that gives the application its futuristic, sci-fi terminal appearance.
* **`gesture_controller.py`**: The core Python backend script. It creates a local WebSocket server to receive hand tracking data and uses `pyautogui` to perform actual mouse movements and clicks on your operating system.
* **`package.json` & `package-lock.json`**: Configuration files for npm (Node Package Manager). They list the required JavaScript libraries (Vite, Three.js, Socket.io) and their specific versions.
* **`src/` folder (e.g., `main.js`)**: Contains the main JavaScript logic. It handles camera access, processes hand tracking via MediaPipe, updates the UI, and sends WebSocket messages to the Python server.
* **`node_modules/` folder**: Contains all the installed JavaScript dependencies. It is generated automatically after running `npm install`.
* **`dist/` folder**: The output folder generated when you build the project for production (`npm run build`). It contains optimized files ready for web hosting.
