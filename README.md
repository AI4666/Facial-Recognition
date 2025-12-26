# 🎭 Facial Recognition with Voice Assistant

Real-time facial recognition application using **YOLOv8** for detection, **Moondream** for scene analysis, and **voice commands** for hands-free operation.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-18%2B-green.svg)
![Python](https://img.shields.io/badge/python-3.9%2B-blue.svg)

---

## ✨ Features

- 🔍 **Real-time Face Detection** — YOLOv8 running in-browser (ONNX) or via local Python server
- 🧠 **AI Scene Analysis** — Moondream model describes scenes, detects emotions, and answers questions
- 🎤 **Voice Commands** — Hands-free operation with natural language commands
- 🔒 **Fully Offline** — All processing happens locally, no data leaves your machine
- ⚡ **Dual Processing Modes** — Browser-based ONNX or GPU-accelerated Python backend

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React, TypeScript, Vite |
| **Vision (Browser)** | ONNX Runtime Web, YOLOv8n-face |
| **Vision (Server)** | Python, Ultralytics YOLOv8, FastAPI |
| **AI Analysis** | Ollama + Moondream |
| **Voice** | Web Speech API |

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ — [Download](https://nodejs.org/)
- **Python** 3.9+ — [Download](https://python.org/)
- **Ollama** — [Download](https://ollama.ai/)

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/[username]/Facial-Recognition.git
cd Facial-Recognition
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Download Models

#### Browser ONNX Model
Download `yolov8n-face.onnx` and place it in:
```
public/models/yolov8n-face.onnx
```

> 📥 Download from: [YOLOv8-face ONNX](https://github.com/akanametov/yolov8-face) or export using Ultralytics

#### Python YOLOv8 Model
The `yolov8n.pt` model will auto-download when you first run the vision server via Ultralytics.

### 4. Set Up Python Vision Server

```bash
cd vision-server

# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows)
venv\Scripts\activate

# Activate virtual environment (macOS/Linux)
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 5. Install Ollama and Moondream

```bash
# Pull the Moondream vision model
ollama pull moondream
```

---

## ▶️ Running the Application

You'll need **3 terminals** running simultaneously:

### Terminal 1 — Ollama Server

```bash
ollama serve
```

> Runs on `http://localhost:11434`

### Terminal 2 — Python Vision Server

```bash
cd vision-server
venv\Scripts\activate
python vision_server.py
```

> Runs on `http://localhost:8000`

### Terminal 3 — React Frontend

```bash
npm run dev
```

> Open **http://localhost:3001** in your browser

---

## 🎤 Voice Commands

| Command | Action |
|---------|--------|
| `"Begin detections"` | Starts YOLOv8 face scanning |
| `"Stop detections"` | Stops the scanning process |
| `"What do you see?"` | Describes the current scene |
| `"How many people?"` | Counts detected faces |
| `"Is anyone smiling?"` | Analyzes emotions in frame |
| `"Describe the person"` | Detailed description of detected face |

---

## 📡 API Endpoints (Vision Server)

### Health Check
```http
GET /health
```
Returns server status and available models.

### Face Detection
```http
POST /detect/faces
Content-Type: multipart/form-data

file: <image>
```
Returns bounding boxes and confidence scores for detected faces.

### Object Detection
```http
POST /detect/objects
Content-Type: multipart/form-data

file: <image>
```
Returns detected objects with labels and bounding boxes.

### Moondream Analysis
```http
POST /analyze
Content-Type: multipart/form-data

file: <image>
prompt: "What do you see in this image?"
```
Returns AI-generated scene description.

### Combined Vision Query
```http
POST /vision/query
Content-Type: multipart/form-data

file: <image>
query: "How many people are there and what are they doing?"
```
Combines YOLOv8 detection with Moondream analysis.

---

## 🏗️ Project Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Frontend                          │
│                   (TypeScript + Vite + Voice)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │  visionService  │    │ localVisionSvc  │    │ ollamaService│ │
│  │  (Browser ONNX) │    │ (Python Server) │    │ (Moondream) │ │
│  └────────┬────────┘    └────────┬────────┘    └──────┬──────┘ │
│           │                      │                     │        │
└───────────┼──────────────────────┼─────────────────────┼────────┘
            │                      │                     │
            ▼                      ▼                     ▼
    ┌───────────────┐      ┌───────────────┐     ┌───────────────┐
    │  ONNX Runtime │      │ Python Vision │     │    Ollama     │
    │     (Web)     │      │    Server     │     │    Server     │
    │               │      │   (FastAPI)   │     │  (Moondream)  │
    │ yolov8n-face  │      │   YOLOv8n.pt  │     │               │
    └───────────────┘      └───────────────┘     └───────────────┘
         Browser              :8000                  :11434
```

### Data Flow

1. **Camera Feed** → Captured via browser MediaDevices API
2. **Frame Processing** → Sent to either browser ONNX or Python server
3. **Face Detection** → YOLOv8 returns bounding boxes
4. **Scene Analysis** → Cropped faces/frames sent to Moondream
5. **Voice Output** → Results spoken via Web Speech API

---

## 📁 Project Structure

```
Facial-Recognition/
├── src/                          # React TypeScript frontend
│   ├── services/
│   │   ├── visionService.ts      # Browser ONNX YOLOv8
│   │   ├── localVisionService.ts # Calls Python server
│   │   ├── ollamaService.ts      # Ollama/Moondream integration
│   │   └── moondreamService.ts   # Moondream analysis
│   ├── components/               # React components
│   └── App.tsx
├── public/
│   └── models/
│       └── yolov8n-face.onnx     # Browser ONNX model
├── vision-server/                # Python backend
│   ├── venv/                     # Python virtual environment
│   ├── vision_server.py          # FastAPI server
│   └── requirements.txt          # Python dependencies
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🔧 Configuration

### Frontend Environment Variables

Create a `.env.local` file in the project root:

```env
VITE_VISION_SERVER_URL=http://localhost:8000
VITE_OLLAMA_URL=http://localhost:11434
```

### Vision Server Configuration

Edit `vision_server.py` to adjust:
- Model paths
- Confidence thresholds
- CORS settings

---

## 🐛 Troubleshooting

### "Cannot connect to Ollama"
```bash
# Ensure Ollama is running
ollama serve

# Verify Moondream is installed
ollama list
```

### "ONNX model not loading"
- Verify `public/models/yolov8n-face.onnx` exists
- Check browser console for CORS errors

### "Python server won't start"
```bash
# Ensure virtual environment is activated
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux

# Reinstall dependencies
pip install -r requirements.txt
```

### "Voice commands not working"
- Use Chrome or Edge (best Web Speech API support)
- Allow microphone permissions
- Speak clearly and wait for the listening indicator

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📬 Contact

For questions or support, please open an issue on GitHub.

---

<p align="center">
  Made with ❤️ using YOLOv8, Moondream, and React
</p>
