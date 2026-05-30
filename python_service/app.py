import os
os.environ["TF_USE_LEGACY_KERAS"] = "1"
import cv2
import numpy as np
import base64
import requests
from flask import Flask, request, jsonify
from deepface import DeepFace

app = Flask(__name__)

# Constants
MODEL_NAME = "Facenet512"
DISTANCE_METRIC = "cosine"
# Threshold for Facenet512 with cosine similarity is generally around 0.30
THRESHOLD = 0.30

def base64_to_cv2(base64_str):
    if "base64," in base64_str:
        base64_str = base64_str.split("base64,")[1]
    img_data = base64.b64decode(base64_str)
    nparr = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

def url_to_cv2(url):
    response = requests.get(url)
    nparr = np.frombuffer(response.content, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

def extract_embedding(img):
    try:
        results = DeepFace.represent(img_path=img, model_name=MODEL_NAME, enforce_detection=True)
        if len(results) > 1:
            return None, "Multiple faces detected"
        if len(results) == 0:
            return None, "No face detected"
        return results[0]["embedding"], None
    except Exception as e:
        error_msg = str(e)
        if "Face could not be detected" in error_msg:
            return None, "Face not detected. Please ensure good lighting, look directly at the camera, and remove anything covering your face."
        return None, error_msg

def find_cosine_distance(source_rep, test_rep):
    a = np.matmul(np.transpose(source_rep), test_rep)
    b = np.sum(np.multiply(source_rep, source_rep))
    c = np.sum(np.multiply(test_rep, test_rep))
    return 1 - (a / (np.sqrt(b) * np.sqrt(c)))

@app.route('/register-face', methods=['POST'])
def register_face():
    data = request.json
    if 'image_url' in data:
        img = url_to_cv2(data['image_url'])
    elif 'image_base64' in data:
        img = base64_to_cv2(data['image_base64'])
    else:
        return jsonify({"error": "No image data provided"}), 400

    embedding, err = extract_embedding(img)
    if err:
        return jsonify({"error": err}), 400

    return jsonify({"embedding": embedding, "model": MODEL_NAME})

@app.route('/verify-face', methods=['POST'])
def verify_face():
    data = request.json
    live_image_base64 = data.get('live_image_base64')
    reference_embeddings = data.get('reference_embeddings', [])
    
    if not live_image_base64 or not reference_embeddings:
        return jsonify({"error": "Missing image or embeddings"}), 400

    img = base64_to_cv2(live_image_base64)
    live_embedding, err = extract_embedding(img)
    if err:
        return jsonify({"error": err}), 400

    min_distance = float('inf')
    for ref_emb in reference_embeddings:
        distance = find_cosine_distance(live_embedding, ref_emb)
        if distance < min_distance:
            min_distance = distance

    verified = bool(min_distance <= THRESHOLD)
    # Convert distance to confidence intuitively (0 distance = 100% confidence, threshold = 0% confidence)
    confidence = max(0, 1 - (min_distance / THRESHOLD)) if min_distance <= THRESHOLD else 0

    return jsonify({
        "verified": verified,
        "distance": float(min_distance),
        "confidence": float(confidence)
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
