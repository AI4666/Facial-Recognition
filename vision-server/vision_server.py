import base64
import io
import json
import time
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import httpx
from PIL import Image
from ultralytics import YOLO
import numpy as np

# Configuration
OLLAMA_URL = "http://localhost:11434/api/generate"
MOONDREAM_MODEL = "moondream"
PORT = 8000

# Initialize FastAPI
app = FastAPI(title="Vision Server", description="Local YOLOv8 + Ollama Vision Server")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models
models = {}

def load_models():
    """Load YOLOv8 models on startup"""
    try:
        print("Loading YOLOv8n (General)...")
        models['yolo'] = YOLO('models/yolov8n.pt')
        
        print("Loading YOLOv8n-face (Face)...")
        # Ensure the face model exists, fallback to general if not but we expect it from step 4
        models['face'] = YOLO('models/yolov8n-face.pt')
        print("Models loaded successfully.")
    except Exception as e:
        print(f"Error loading models: {e}")
        # Fallback if specific face model fails
        if 'yolo' in models and 'face' not in models:
            print("Using generic model for face detection fallback.")
            models['face'] = models['yolo']

# Models
class ImageRequest(BaseModel):
    image: str # Base64 string
    confidence_threshold: float = 0.5

class AnalysisRequest(BaseModel):
    image: str
    question: str = "Describe this image"

class QueryRequest(BaseModel):
    image: str
    question: str

# Helper functions
def decode_image(base64_string: str) -> Image.Image:
    try:
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        image_data = base64.b64decode(base64_string)
        return Image.open(io.BytesIO(image_data))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {e}")

@app.on_event("startup")
async def startup_event():
    load_models()

@app.get("/health")
async def health_check():
    yolo_status = "loaded" if 'yolo' in models else "error"
    face_status = "loaded" if 'face' in models else "error"
    
    # Check Ollama
    ollama_status = "unknown"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("http://localhost:11434/api/tags")
            if resp.status_code == 200:
                ollama_status = "connected"
            else:
                ollama_status = f"error_{resp.status_code}"
    except:
        ollama_status = "unreachable"

    return {
        "status": "running",
        "yolo_model": yolo_status,
        "face_model": face_status,
        "ollama_connection": ollama_status
    }

@app.post("/detect/faces")
async def detect_faces(request: ImageRequest):
    if 'face' not in models:
        raise HTTPException(status_code=503, detail="Face model not loaded")
    
    try:
        img = decode_image(request.image)
        # Run inference
        results = models['face'](img, conf=request.confidence_threshold)
        
        faces = []
        for r in results:
            boxes = r.boxes
            for box in boxes:
                # If using generic yolo, filter for person class (0)
                # But if using trained face model, it usually has only one class or face class
                # We'll return all detections for now assuming specific model
                
                # Bounding box
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                w = x2 - x1
                h = y2 - y1
                conf = float(box.conf[0])
                
                faces.append({
                    "bbox": [int(x1), int(y1), int(w), int(h)],
                    "confidence": conf
                })
        
        return {"faces": faces, "count": len(faces)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/objects")
async def detect_objects(request: ImageRequest):
    if 'yolo' not in models:
        raise HTTPException(status_code=503, detail="YOLO model not loaded")
    
    try:
        img = decode_image(request.image)
        results = models['yolo'](img, conf=request.confidence_threshold)
        
        objects = []
        for r in results:
            boxes = r.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                w = x2 - x1
                h = y2 - y1
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                label = models['yolo'].names[cls]
                
                objects.append({
                    "label": label,
                    "bbox": [int(x1), int(y1), int(w), int(h)],
                    "confidence": conf
                })
        
        return {"objects": objects, "count": len(objects)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
async def analyze_image(request: AnalysisRequest):
    try:
        # Pre-check valid image
        _ = decode_image(request.image)
        
        # Clean base64
        b64 = request.image
        if "," in b64:
            b64 = b64.split(",")[1]

        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "model": MOONDREAM_MODEL,
                "prompt": request.question,
                "images": [b64],
                "stream": False
            }
            response = await client.post(OLLAMA_URL, json=payload)
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Ollama Error")
            
            data = response.json()
            return {"answer": data.get("response", "").strip()}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/vision/query")
async def query_pipeline(request: QueryRequest):
    # Combined pipeline
    result = {
        "detections": [],
        "analysis": ""
    }
    
    try:
        img = decode_image(request.image)
        
        # 1. Run Object Detection
        if 'yolo' in models:
            yolo_results = models['yolo'](img, conf=0.5)
            for r in yolo_results:
                for box in r.boxes:
                    cls = int(box.cls[0])
                    label = models['yolo'].names[cls]
                    result["detections"].append(label)
            
            # Allow unique
            result["detections"] = list(set(result["detections"]))
        
        # 2. Run Moondream Analysis
        # Enhance prompt with detections if available? 
        # For now just run the user question.
        b64 = request.image
        if "," in b64:
            b64 = b64.split(",")[1]

        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "model": MOONDREAM_MODEL,
                "prompt": request.question,
                "images": [b64],
                "stream": False
            }
            response = await client.post(OLLAMA_URL, json=payload)
            if response.status_code == 200:
                data = response.json()
                result["analysis"] = data.get("response", "").strip()
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("vision_server:app", host="0.0.0.0", port=PORT, reload=True)
