// src/components/VoiceRecorder.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * VoiceRecorder
 * Props:
 * - onStop(blob) -> called when recording stops with the audio Blob
 * - buttonLabel (optional)
 */
export default function VoiceRecorder({ onStop, buttonLabel = "Hold to Record", showControls = true }) {
  const mediaRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const longPressTimer = useRef(null);

  useEffect(() => {
    return () => {
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startVisual = (stream) => {
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    analyserRef.current = audioCtxRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    sourceRef.current = audioCtxRef.current.createMediaStreamSource(stream);
    sourceRef.current.connect(analyserRef.current);
    draw();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !analyserRef.current) return;
    const bufferLength = analyserRef.current.frequencyBinCount;
    const data = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(data);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f1f1f1";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0b84ff";
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = data[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    rafRef.current = requestAnimationFrame(draw);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;
      recorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      startVisual(stream);

      recorderRef.current.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        onStop && onStop(blob);
      };
      recorderRef.current.start();
      setRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
      alert("Unable to access microphone.");
    }
  };

  const stopRecording = () => {
    try {
      recorderRef.current?.stop();
    } catch (_) {}
    stopAll();
  };

  const stopAll = () => {
    setRecording(false);
    if (mediaRef.current) {
      mediaRef.current.getTracks().forEach(t => t.stop());
      mediaRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch (_) {}
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    sourceRef.current = null;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  // UI: hold-to-record or click-to-start depending on use-case
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 160 }}>
        <canvas ref={canvasRef} width={160} height={48} style={{ width: "100%", borderRadius: 6, background: "#fff" }} />
      </div>

      <div>
        {showControls ? (
          <>
            <button
              onMouseDown={() => { longPressTimer.current = setTimeout(startRecording, 250); }}
              onMouseUp={() => { clearTimeout(longPressTimer.current); if (recording) stopRecording(); }}
              onTouchStart={() => { longPressTimer.current = setTimeout(startRecording, 250); }}
              onTouchEnd={() => { clearTimeout(longPressTimer.current); if (recording) stopRecording(); }}
              style={{
                background: recording ? "#d32f2f" : "#0b93f6",
                color: "#fff",
                border: "none",
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {recording ? "Recording… release to stop" : buttonLabel}
            </button>
          </>
        ) : (
          <div>
            <button onClick={() => (recording ? stopRecording() : startRecording())}>{recording ? "Stop" : "Record"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
