// src/components/VoiceNotePlayer.jsx
import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

export default function VoiceNotePlayer({ url, isMine = false, width = 260 }) {
  const containerRef = useRef(null);
  const waveRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    // create wavesurfer instance
    waveRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: isMine ? "#ffffff" : "#222222",
      progressColor: isMine ? "#87CEFA" : "#1877F2",
      cursorColor: "transparent",
      barWidth: 2,
      barGap: 2,
      height: 36,
      responsive: true,
      normalize: true,
    });

    waveRef.current.load(url);

    const ws = waveRef.current;

    const onReady = () => {
      setDuration(ws.getDuration());
      setReady(true);
    };
    const onAudioprocess = () => {
      try {
        setCurrent(ws.getCurrentTime());
      } catch (_) {}
    };
    const onFinish = () => setPlaying(false);

    ws.on("ready", onReady);
    ws.on("audioprocess", onAudioprocess);
    ws.on("finish", onFinish);

    return () => {
      ws.un("ready", onReady);
      ws.un("audioprocess", onAudioprocess);
      ws.un("finish", onFinish);
      ws.destroy();
    };
  }, [url, isMine]);

  const toggle = () => {
    if (!waveRef.current) return;
    waveRef.current.playPause();
    setPlaying(!playing);
  };

  const seekTo = (ev) => {
    if (!waveRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (ev.clientX ?? ev.touches?.[0]?.clientX) - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    waveRef.current.seekTo(ratio);
  };

  const format = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? "0" + sec : sec}`;
  };

  const download = () => {
    fetch(url)
      .then((r) => r.blob())
      .then((b) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `voice_note_${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((e) => console.error("Download failed", e));
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width }}>
      <button
        onClick={toggle}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          border: "none",
          cursor: "pointer",
          background: isMine ? "#fff" : "#1877F2",
          color: isMine ? "#000" : "#fff",
          fontSize: 16,
        }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? "⏸" : "▶"}
      </button>

      <div style={{ flex: 1 }}>
        <div
          ref={containerRef}
          onClick={seekTo}
          style={{ cursor: "pointer", width: "100%", height: 36, borderRadius: 8, overflow: "hidden" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.8, marginTop: 6 }}>
          <span>{format(current)}</span>
          <span>{format(duration)}</span>
        </div>
      </div>

      <button onClick={download} style={{ border: "none", background: "transparent", cursor: "pointer" }} title="Download">
        ⤓
      </button>
    </div>
  );
}
