import React, { useEffect, useRef, useState } from "react";

export default function VoiceRecorder({ onSend, onCancel, maxDurationSec = 300 }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [duration, setDuration] = useState(0);
  const [permissionError, setPermissionError] = useState(null);
  const chunksRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopTracks();
      if (audioURL) URL.revokeObjectURL(audioURL);
      cancelAnimationFrame(animationRef.current);
      clearInterval(timerRef.current);
    };
  }, [audioURL]);

  const stopTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  const start = async () => {
    setPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      setDuration(0);

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        setIsProcessing(true);
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);

        try {
          await decodeAndDrawWaveform(blob);
        } catch (err) {
          console.warn("Waveform decode failed", err);
          // Clear canvas if failed
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
        setIsProcessing(false);
      };

      mr.start();
      setIsRecording(true);

      // Keep track of recording time
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      // Auto-stop on maxDurationSec
      if (maxDurationSec && maxDurationSec > 0) {
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
          }
        }, maxDurationSec * 1000);
      }
    } catch (err) {
      console.error("Microphone permission denied or error:", err);
      setPermissionError("Microphone access denied. Please allow microphone permission in your browser.");
    }
  };

  const stop = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    } catch (err) {
      console.warn("Stop recording error:", err);
    }
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  const clear = () => {
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
      setAudioURL(null);
    }
    setDuration(0);
    setPermissionError(null);
    clearInterval(timerRef.current);
    const c = canvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
    }
  };

  const handleSend = async () => {
    if (!audioURL || !onSend) return;
    setIsProcessing(true);
    try {
      const resp = await fetch(audioURL);
      const blob = await resp.blob();
      await onSend(blob);
      clear();
    } catch (err) {
      console.error("Send failed", err);
      alert("Failed to send voice message.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    stop();
    clear();
    if (onCancel) onCancel();
  };

  // decode audio blob and draw waveform on canvas
  const decodeAndDrawWaveform = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const raw = audioBuffer.getChannelData(0); // mono channel
    setDuration(Math.round(audioBuffer.duration));

    const canvas = canvasRef.current;
    if (!canvas) {
      audioCtx.close();
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(canvas.clientWidth * dpr);
    const height = Math.floor(canvas.clientHeight * dpr);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#efefef";
    ctx.fillRect(0, 0, width, height);

    const samples = raw.length;
    const step = Math.ceil(samples / width);
    const amp = height / 2;

    ctx.fillStyle = "#374151"; // dark gray for waveform bars
    for (let i = 0; i < width; i++) {
      const start = i * step;
      let sum = 0;
      let count = 0;
      for (let j = 0; j < step && start + j < samples; j++) {
        sum += Math.abs(raw[start + j]);
        count++;
      }
      const avg = count === 0 ? 0 : sum / count;
      const y = avg * amp;
      const barHeight = Math.max(1, Math.round(y * 0.9));
      ctx.fillRect(i, (height / 2) - barHeight / 2, 1, barHeight);
    }

    audioCtx.close();
  };

  // When audio element metadata loads, sync duration if less than current state (fallback)
  const handleAudioLoaded = () => {
    if (audioRef.current) {
      const audioDuration = Math.round(audioRef.current.duration || 0);
      if (audioDuration > 0 && audioDuration !== duration) setDuration(audioDuration);
    }
  };

  return (
    <div
      style={{
        background: "#111",
        color: "#fff",
        padding: 16,
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        width: "100%",
        maxWidth: 320,
        margin: "auto",
      }}
    >
      <div style={{ display: "flex", gap: 12, width: "100%", alignItems: "center" }}>
        <button
          onClick={isRecording ? stop : start}
          aria-pressed={isRecording}
          style={{
            background: isRecording ? "red" : "#007bff",
            border: "none",
            borderRadius: "50%",
            width: 60,
            height: 60,
            fontSize: 24,
            color: "#fff",
            cursor: "pointer",
          }}
          disabled={isProcessing}
          title={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? "⏹️" : "🎤"}
        </button>

        <button
          onClick={clear}
          disabled={isRecording || !audioURL || isProcessing}
          style={{
            background: "#555",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            color: "#fff",
            cursor: isRecording || !audioURL || isProcessing ? "default" : "pointer",
            opacity: isRecording || !audioURL || isProcessing ? 0.5 : 1,
          }}
          title="Clear recording"
        >
          Clear
        </button>

        <button
          onClick={handleSend}
          disabled={!audioURL || isProcessing}
          style={{
            background: "#007bff",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            color: "#fff",
            cursor: !audioURL || isProcessing ? "default" : "pointer",
            opacity: !audioURL || isProcessing ? 0.5 : 1,
          }}
          title="Send recording"
        >
          {isProcessing ? "Sending..." : "Send"}
        </button>

        <button
          onClick={handleCancel}
          disabled={isProcessing}
          style={{
            background: "#777",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            color: "#fff",
            cursor: isProcessing ? "default" : "pointer",
          }}
          title="Cancel recording"
        >
          Cancel
        </button>
      </div>

      <div style={{ width: "100%", height: 96, marginTop: 16, background: "#222", borderRadius: 8, overflow: "hidden" }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      </div>

      {audioURL && (
        <audio
          ref={audioRef}
          src={audioURL}
          controls
          onLoadedMetadata={handleAudioLoaded}
          style={{ width: "100%", marginTop: 8, borderRadius: 8, outline: "none" }}
        />
      )}

      <div style={{ marginTop: 8, fontSize: 14, color: "#aaa" }}>
        {isRecording ? `Recording... ${duration}s` : audioURL ? `${duration}s recorded` : "Ready"}
      </div>

      {permissionError && (
        <div style={{ marginTop: 12, color: "red", fontSize: 12, textAlign: "center" }}>
          {permissionError}
        </div>
      )}
    </div>
  );
}