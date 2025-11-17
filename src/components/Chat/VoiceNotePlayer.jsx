import React, { useRef, useState, useEffect } from "react";

export default function VoiceNotePlayer({ url, duration }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      const p = (audio.currentTime / audio.duration) * 100;
      setProgress(p);
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("ended", () => {
      setPlaying(false);
      setProgress(0);
    });

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
    };
  }, []);

  return (
    <div className="voice-note">
      <audio ref={audioRef} src={url} preload="metadata" />

      <div onClick={togglePlay} style={{ cursor: "pointer" }}>
        {playing ? (
          <span style={{ fontSize: 22 }}>⏸️</span>
        ) : (
          <span style={{ fontSize: 22 }}>▶️</span>
        )}
      </div>

      <div className="audio-wave">
        <div className="audio-wave-inner" style={{ width: `${progress}%` }} />
      </div>

      <div style={{ fontSize: 12, width: 45, textAlign: "right" }}>
        {duration || "0:05"}
      </div>
    </div>
  );
}