// /src/components/VoiceRecorder.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * VoiceRecorder
 *
 * Props:
 *  - onSend: async (Blob) => { }   // called when user taps "Send"
 *  - maxDurationSec: number (optional) // optional max recording length
 *
 * Features:
 *  - Record via MediaRecorder
 *  - Draw waveform preview on canvas (uses AudioContext.decodeAudioData)
 *  - Playback recorded audio (Audio element)
 *  - Send recorded audio via onSend(blob)
 *  - Cancel / Clear recording
 *
 * Usage:
 *  <VoiceRecorder onSend={async (blob) => { await sendVoiceMessage(blob); }} />
 */

export default function VoiceRecorder({ onSend, maxDurationSec = 300 }) {
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

  useEffect(() => {
    return () => {
      // cleanup on unmount
      stopTracks();
      if (audioURL) URL.revokeObjectURL(audioURL);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const stopTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  // start recording
  const start = async () => {
    setPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        setIsProcessing(true);
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);

        // get duration and waveform
        try {
          await decodeAndDrawWaveform(blob);
        } catch (err) {
          // fallback: no waveform
          console.warn("Waveform decode failed", err);
        }

        // determine duration from audio element after loadmetadata
        setIsProcessing(false);
      };

      mr.start();
      setIsRecording(true);

      // auto-stop if exceeds maxDurationSec
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

  // stop recording
  const stop = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    } catch (err) {
      console.warn("stop error", err);
    }
    setIsRecording(false);
  };

  // clear recorded audio
  const clear = () => {
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
      setAudioURL(null);
    }
    setDuration(0);
    setPermissionError(null);
    // clear canvas
    const c = canvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
    }
  };

  // send recorded blob via onSend
  const handleSend = async () => {
    if (!audioURL || !onSend) return;
    setIsProcessing(true);
    try {
      // convert audioURL back to blob
      const resp = await fetch(audioURL);
      const blob = await resp.blob();
      await onSend(blob); // user's handler (uploads + database)
      clear();
    } catch (err) {
      console.error("Send failed", err);
      alert("Failed to send voice message.");
    } finally {
      setIsProcessing(false);
    }
  };

  // decode audio and draw waveform
  const decodeAndDrawWaveform = async (blob) => {
    // use AudioContext to decode as arrayBuffer
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const raw = audioBuffer.getChannelData(0); // mono (first channel)
    setDuration(Math.round(audioBuffer.duration));

    // downsample for canvas width
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(canvas.clientWidth * dpr);
    const height = Math.floor(canvas.clientHeight * dpr);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // clear
    ctx.clearRect(0, 0, width, height);

    const samples = raw.length;
    const step = Math.ceil(samples / width);
    const amp = height / 2;

    ctx.fillStyle = "#efefef";
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 1;
    ctx.strokeStyle = "#4b5563"; // gray-600
    ctx.beginPath();

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
      // draw vertical bar
      ctx.fillStyle = "#374151"; // darker
      const barHeight = Math.max(1, Math.round(y * 0.9));
      ctx.fillRect(i, (height / 2) - barHeight / 2, 1, barHeight);
    }
    ctx.closePath();

    // close audio context
    audioCtx.close();
  };

  // when audio element loads, set duration
  const handleAudioLoaded = () => {
    if (audioRef.current) {
      setDuration(Math.round(audioRef.current.duration || 0));
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="space-y-2">
        {/* recorder controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={isRecording ? stop : start}
            className={`px-3 py-2 rounded-md text-white ${isRecording ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
            aria-pressed={isRecording}
          >
            {isRecording ? "Stop" : "Record"}
          </button>

          <button
            onClick={clear}
            className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800"
            disabled={isRecording || !audioURL}
          >
            Clear
          </button>

          <button
            onClick={handleSend}
            className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!audioURL || isProcessing}
          >
            {isProcessing ? "Sending..." : "Send"}
          </button>

          <div className="ml-auto text-sm text-gray-600">
            {isRecording ? "Recording…" : audioURL ? `${duration}s` : "Ready"}
          </div>
        </div>

        {/* waveform canvas */}
        <div className="w-full h-24 bg-white rounded-md shadow-inner overflow-hidden">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>

        {/* playback */}
        {audioURL && (
          <div className="flex items-center gap-3 mt-2">
            <audio
              ref={audioRef}
              src={audioURL}
              controls
              onLoadedMetadata={handleAudioLoaded}
              className="w-full"
            />
          </div>
        )}

        {permissionError && (
          <div className="text-sm text-red-600 mt-2">{permissionError}</div>
        )}
      </div>
    </div>
  );
}