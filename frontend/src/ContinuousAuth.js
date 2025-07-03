// ContinuousAuth.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import * as faceapi from "face-api.js";
import Webcam from "react-webcam";
import "./ContinuousAuth.css";
import axios from "axios";

const ContinuousAuth = () => {
  const webcamRef = useRef(null);
  const referenceDescriptorRef = useRef(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [soundDetected, setSoundDetected] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [examTerminated, setExamTerminated] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [showPermissionMessage, setShowPermissionMessage] = useState(true);
  const [noFaceDuration, setNoFaceDuration] = useState(0);
  const [violationCount, setViolationCount] = useState(0);
  const [referenceDescriptor, setReferenceDescriptor] = useState(null);
  const [capturedImages, setCapturedImages] = useState([]);
  const [faceAbsenceCount, setFaceAbsenceCount] = useState(0);

  // Play sound using Web Audio API
  const playAlertSound = (level = "normal") => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = "square";

  if (level === "warning") {
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  } else if (level === "critical") {
    oscillator.frequency.setValueAtTime(1500, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
  } else {
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
  }

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  setTimeout(() => oscillator.stop(), 600);
};

  // Load required models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
        await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
        console.log("All required models loaded successfully");
      } catch (error) {
        setTimeout(() => {
          playAlertSound();
          alert(
            "Failed to load face recognition models. Please check the model files are in the correct path."
          );
        }, 0);
      }
    };
    loadModels();
  }, []);

  const getPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);
      setPermissionsGranted(true);
      setShowPermissionMessage(false);
    } catch (error) {
      setTimeout(() => {
        playAlertSound();
        alert("Please allow access to camera and microphone.");
      }, 0);
      setShowPermissionMessage(true);
    }
  };

  const detectFace = async () => {
    if (webcamRef.current && webcamRef.current.video.readyState === 4) {
      const video = webcamRef.current.video;
      const detections = await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options());
      const isFacePresent = detections.length > 0;
      setFaceDetected(isFacePresent);
      if (!isFacePresent) {
        setNoFaceDuration((prev) => prev + 1);
      } else {
        setNoFaceDuration(0);
        setFaceAbsenceCount(0);
      }
    }
  };

  useEffect(() => {
    if (permissionsGranted) {
      const interval = setInterval(detectFace, 1000);
      return () => clearInterval(interval);
    }
  }, [permissionsGranted]);

  useEffect(() => {
    if (noFaceDuration >= 5) {
      setFaceAbsenceCount((prev) => {
        const count = prev + 1;
        if (count === 4) {
          setTimeout(() => {
            playAlertSound("warning");
            alert("⚠ You have been absent for 5 seconds four times. Next time you will be removed from the exam.");
          }, 0);
        } else if (count >= 5) {
          setTimeout(() => {
            playAlertSound("critical");
            alert("✖ You have been absent for 5 seconds five times. Exam will be terminated.");
          }, 0);
          terminateExam();
        } else {
          setTimeout(() => {
            playAlertSound("normal");
            alert(`⚠ Face not detected for 5 seconds. This is your ${count}th absence.`);
          }, 0);
        }
        return count;
      });
      setNoFaceDuration(0);
    }
  }, [noFaceDuration]);

  const detectSound = useCallback(() => {
    if (!mediaStream) return;
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(mediaStream);
    source.connect(analyser);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const checkSound = () => {
      analyser.getByteFrequencyData(dataArray);
      const volume = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      setSoundDetected(volume > 10);
      requestAnimationFrame(checkSound);
    };
    checkSound();
  }, [mediaStream]);

  useEffect(() => {
    if (permissionsGranted) {
      detectSound();
    }
  }, [permissionsGranted, detectSound]);

  const captureAndSendImage = async (violationType = "faceMismatch") => {
  if (!webcamRef.current) return;
  const imageSrc = webcamRef.current.getScreenshot();
  setCurrentImage(imageSrc);

  try {
    const img = await faceapi.fetchImage(imageSrc);
    const detection = await faceapi
      .detectSingleFace(img, new faceapi.SsdMobilenetv1Options())
      .withFaceLandmarks()
      .withFaceDescriptor();

    // لو نوع المخالفة "absence" مش هنحتاج نحلل الوجه، فقط نحفظ الصورة كدليل
    if (violationType === "absence" || !detection) {
      console.log("Sending absence violation...");
      const violationData = {
        studentId: "86",
        examId: "exam_1",
        image: imageSrc,
        timestamp: new Date().toISOString(),
        type: "absence", 
      };

      await axios.post("http://localhost:5000/api/violation", violationData);
      return;
    }

    // تحقق من تطابق الوجه
    if (!referenceDescriptorRef.current) {
      referenceDescriptorRef.current = detection.descriptor;
      console.log("First face detected and set as reference");
      return;
    }

    const distance = faceapi.euclideanDistance(referenceDescriptorRef.current, detection.descriptor);
    const similarity = (1 - distance) * 100;
    console.log(`Euclidean Distance: ${distance.toFixed(4)}`);
    console.log(`Similarity Score: ${similarity.toFixed(2)}%`);

    const threshold = 0.7;
    const similarityThreshold = 55;

    if (distance <= threshold && similarity >= similarityThreshold) {
      console.log("Face matched successfully (based on distance and similarity)");
      return;
    }

    console.log("⚠️ Different person detected! Sending violation.");
    setTimeout(() => {
      playAlertSound("warning");
      alert("⚠️ Different person detected!");
    }, 0);

    const violationData = {
      studentId: "86",
      examId: "exam_1",
      image: imageSrc,
      timestamp: new Date().toISOString(),
      type: "faceMismatch", 
    };

    await axios.post("http://localhost:5000/api/violation", violationData);
    setViolationCount((prev) => {
      const newCount = prev + 1;
      if (newCount >= 3) {
        setTimeout(() => {
          playAlertSound("critical");
          alert("Exam terminated due to multiple violations.");
        }, 0);
        terminateExam();
      }
      return newCount;
    });

  } catch (err) {
    console.error("Error analyzing face", err);
  }
};

  useEffect(() => {
    if (permissionsGranted && !examTerminated) {
      const interval = setInterval(captureAndSendImage, 30000);
      return () => clearInterval(interval);
    }
  }, [permissionsGranted, examTerminated]);

  const terminateExam = () => {
    setExamTerminated(true);
    setTimeout(() => {
      playAlertSound();
      alert("Exam has been terminated due to multiple violations!");
    }, 0);
    window.location.replace("/exam-ended");
  };

  return (
    <div className="continuous-auth-container">
      <h2>Exam Proctoring System</h2>
      {showPermissionMessage && (
        <div className="permission-message">
          <h3>Exam Proctoring Setup</h3>
          <p>This exam requires camera and microphone access for proctoring purposes.</p>
          <div className="permission-requirements">
            <p>✓ Face detection must be enabled</p>
            <p>✓ Microphone must be active</p>
          </div>
          <button className="permission-button" onClick={getPermissions}>
            Enable Camera & Microphone
          </button>
        </div>
      )}
      {permissionsGranted && !examTerminated && (
        <div className="monitoring-container">
          {/* Video Section */}
          <div className="video-section">
            <Webcam
              audio={true}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="webcam"
              videoConstraints={{
                facingMode: "user",
                width: 480,
                height: 360,
              }}
            />
            <div className="status-indicators">
              <div className={`status-indicator ${faceDetected ? "active" : ""}`}>
                {faceDetected ? "Face Detected" : "No Face Detected"}
              </div>
              <div className={`status-indicator ${soundDetected ? "active" : ""}`}>
                {soundDetected ? "Sound Detected" : "No Sound Detected"}
              </div>
            </div>
            {currentImage && (
              <div className="captured-image-section">
                <h4>Captured Image</h4>
                <img src={currentImage} alt="Last captured face" className="captured-image" />
              </div>
            )}
          </div>
        </div>
      )}
      {examTerminated && (
        <div className="termination-message">
          <h3>✖ Exam Terminated</h3>
          <p>Due to multiple violations detected. Please contact your instructor.</p>
        </div>
      )}
    </div>
  );
};

export default ContinuousAuth;
