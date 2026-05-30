import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import api from '@/lib/api';
import { Camera, CheckCircle, XCircle } from 'lucide-react';

export default function FaceRegistration({ onComplete }) {
    const webcamRef = useRef(null);
    const [images, setImages] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState(null);

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc && images.length < 3) {
            setImages((prev) => [...prev, imageSrc]);
        }
    }, [webcamRef, images]);

    const registerFaces = async () => {
        if (images.length === 0) return;
        setUploading(true);
        setMessage({ type: 'info', text: 'Uploading reference images...' });

        try {
            for (let i = 0; i < images.length; i++) {
                await api.post('/attendance/register-face', { image_base64: images[i] });
            }
            setMessage({ type: 'success', text: 'Facial registration complete!' });
            if (onComplete) {
                setTimeout(onComplete, 1500);
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Registration failed' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl max-w-md w-full mx-auto">
            <h3 className="text-xl font-bold text-white mb-4">Biometric Registration</h3>
            <p className="text-slate-400 text-sm mb-6">
                Please capture up to 3 reference selfies to register your identity for attendance verification.
            </p>

            <div className="relative rounded-xl overflow-hidden mb-4 bg-slate-900 border border-slate-700">
                <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "user" }}
                    className="w-full h-auto"
                />
            </div>

            <div className="flex gap-2 mb-6">
                {images.map((img, idx) => (
                    <img key={idx} src={img} alt={`Ref ${idx+1}`} className="w-16 h-16 rounded-lg border-2 border-emerald-500 object-cover" />
                ))}
                {Array.from({ length: 3 - images.length }).map((_, idx) => (
                    <div key={idx} className="w-16 h-16 rounded-lg border-2 border-slate-600 border-dashed flex items-center justify-center text-slate-500">
                        <Camera size={20} />
                    </div>
                ))}
            </div>

            {message && (
                <div className={`p-3 rounded-lg mb-4 text-sm font-medium flex items-center gap-2 ${
                    message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                    message.type === 'error' ? 'bg-rose-500/10 text-rose-400' :
                    'bg-blue-500/10 text-blue-400'
                }`}>
                    {message.type === 'success' ? <CheckCircle size={16}/> : message.type === 'error' ? <XCircle size={16}/> : null}
                    {message.text}
                </div>
            )}

            <div className="flex gap-3">
                <button
                    onClick={capture}
                    disabled={images.length >= 3 || uploading}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                    Capture
                </button>
                <button
                    onClick={registerFaces}
                    disabled={images.length === 0 || uploading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                    {uploading ? 'Registering...' : 'Submit'}
                </button>
            </div>
        </div>
    );
}
