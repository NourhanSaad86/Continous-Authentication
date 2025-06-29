import React, { useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';

const VideoDetection = () => {
  const videoRef = useRef();
  const canvasRef = useRef();

  useEffect(() => {
    // Load models and start video on mount
    const loadModels = async () => {
      try {
        // Load models from public/models
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        console.log('Models loaded successfully');
        
        // Start the video stream
        startVideo();
      } catch (error) {
        console.error('Error loading models:', error);
      }
    };

    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error starting video stream:', error);
      }
    };

    loadModels();
  }, []);

  const handleVideoPlay = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas) {
      // Adjust canvas to video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const options = new faceapi.TinyFaceDetectorOptions();

      setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video, options);

        // Clear and redraw canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, detections);
      }, 100);
    }
  };

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        muted
        onPlay={handleVideoPlay}
        style={{ width: '100%' }}
      />
      <canvas ref={canvasRef} style={{ position: 'absolute' }} />
    </div>
  );
};

export default VideoDetection;
