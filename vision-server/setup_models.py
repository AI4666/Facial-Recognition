from ultralytics import YOLO
import shutil
import os
import requests

# Create models directory
if not os.path.exists('models'):
    os.makedirs('models')

print("Downloading yolov8n.pt...")
model = YOLO('yolov8n.pt')
# It downloads to current dir usually. Move it.
if os.path.exists('yolov8n.pt'):
    shutil.move('yolov8n.pt', 'models/yolov8n.pt')
    print("Moved yolov8n.pt to models/")

print("Downloading yolov8n-face.pt...")
# Trying to download a known yolov8 face model
# Using a specific release asset from a distinct repo if possible, or just skip clearly.
# Since I cannot guarantee a stable URL for a custom 'yolov8n-face.pt' without risk,
# I will download the general model. 
# BUT, I found a common link often used for examples. 
# Let's try to download from a reliable source or just use the standard model.
# Re-reading prompt: "yolov8n-face.pt or appropriate face detection model"
# I'll try to download widely used weight file.
face_model_url = "https://github.com/akanametov/yolo-face/releases/download/v0.0.0/yolov8n-face.pt"
try:
    response = requests.get(face_model_url, stream=True)
    if response.status_code == 200:
        with open('models/yolov8n-face.pt', 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print("Downloaded yolov8n-face.pt successfully.")
    else:
        print(f"Failed to download face model. Status: {response.status_code}")
except Exception as e:
    print(f"Error downloading face model: {e}")
