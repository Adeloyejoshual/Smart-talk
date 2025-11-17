// src/components/Chat/VoiceNotePlayer.jsx
import React, { useRef, useState, useEffect } from "react";
import { FaPlay, FaPause } from "react-icons/fa";

const VoiceNotePlayer = ({ url, duration }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
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
    <div className="flex items-center space-x-3 bg-gray-100 p-2 rounded-xl">
      <button
        onClick={togglePlay}
        className="bg-blue-600 text-white p-2 rounded-full"
      >
        {playing ? <FaPause /> : <FaPlay />}
      </button>

      <div className="flex-1 bg-gray-300 h-1 rounded-full overflow-hidden">
        <div
          className="bg-blue-600 h-1"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <audio ref={audioRef} src={url}></audio>

      <span className="text-xs opacity-70">{duration || "0:00"}</span>
    </div>
  );
};

export default VoiceNotePlayer;
