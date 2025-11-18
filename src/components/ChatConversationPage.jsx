
// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { ThemeContext } from "../context/ThemeContext";

import { db, storage } from "../firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";

// COMPONENTS
import Header from "./Chat/Header";
import ThreeDotMenu from "./Chat/ThreeDotMenu";
import MessageList from "./Chat/MessageList";
import MessageInput from "./Chat/MessageInput";
import LongPressToolbar from "./Chat/LongPressToolbar";

import ImagePreview from "./Chat/ImagePreview";
import VoiceNotePlayer from "./Chat/VoiceNotePlayer";
import MessageDayDivider from "./Chat/MessageDayDivider";

import SearchBar from "./Chat/SearchBar";
import SearchMessages from "./Chat/SearchMessages";
import SearchResults from "./Chat/SearchResults";

import PinBanner from "./Chat/PinBanner";
import BlockedBanner from "./Chat/BlockedBanner";

// POPUPS
import MutePopup from "./Chat/MutePopup";
import BlockPopup from "./Chat/BlockPopup";
import DeletePopup from "./Chat/DeletePopup";
import ReportPopup from "./Chat/ReportPopup";
import ProfessionalPopup from "./Chat/ProfessionalPopup";
import ForwardPopup from "./Chat/ForwardPopup";
import ForwardMessagePopup from "./Chat/ForwardMessagePopup";
import UpdatePinPopup from "./Chat/UpdatePinPopup";
import ArchivePopup from "./Chat/ArchivePopup";
import ArchiveConfirmation from "./Chat/ArchiveConfirmation";
import DeleteMessagePopup from "./Chat/DeleteMessagePopup";
import ReportUserPopup from "./Chat/ReportUserPopup";

export default function ChatConversationPage({ chatId }) {
  const { theme } = useContext(ThemeContext);

  const [messages, setMessages] = useState([]);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [longPressMode, setLongPressMode] = useState(false);

  const [showMenu, setShowMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const [showMute, setShowMute] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showDeleteChat, setShowDeleteChat] = useState(false);
  const [showProfessional, setShowProfessional] = useState(false);

  const [showArchive, setShowArchive] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  const [showUpdatePin, setShowUpdatePin] = useState(false);
  const [showForwardOptions, setShowForwardOptions] = useState(false);
  const [showDeleteMessage, setShowDeleteMessage] = useState(false);
  const [showReportUser, setShowReportUser] = useState(false);

  const [uploading, setUploading] = useState({});
  const [imagePreview, setImagePreview] = useState(null);

  const scrollRef = useRef();

  // ✔ REALTIME FIREBASE MESSAGE READER
  useEffect(() => {
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp")
    );

    const unsub = onSnapshot(q, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setMessages(arr);

      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" });
      }, 50);
    });

    return () => unsub();
  }, [chatId]);

  // ✔ TEXT SENDER
  const sendText = async (text) => {
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text,
      type: "text",
      sender: "me",
      timestamp: Date.now(),
    });
  };

  // ✔ UNIVERSAL UPLOADER FIX (Image / Audio / Video)
  const uploadFileMessage = async (file, type) => {
    const placeholder = {
      type,
      sender: "me",
      timestamp: Date.now(),
      uploading: true,
      progress: 0,
    };

    // add placeholder
    const msgRef = await addDoc(
      collection(db, "chats", chatId, "messages"),
      placeholder
    );

    const storageRef = ref(storage, `uploads/${chatId}/${msgRef.id}`);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snap) => {
        const progress = Math.round(
          (snap.bytesTransferred / snap.totalBytes) * 100
        );

        setUploading((prev) => ({ ...prev, [msgRef.id]: progress }));

        updateDoc(doc(db, "chats", chatId, "messages", msgRef.id), {
          progress,
        });
      },

      (error) => {
        updateDoc(doc(db, "chats", chatId, "messages", msgRef.id), {
          uploading: false,
          error: true,
        });
      },

      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

        await updateDoc(
          doc(db, "chats", chatId, "messages", msgRef.id),
          {
            uploading: false,
            progress: null,
            url: downloadURL,
          }
        );
      }
    );
  };

  const sendImage = (file) => uploadFileMessage(file, "image");
  const sendVoice = (file) => uploadFileMessage(file, "voice");
  const sendVideo = (file) => uploadFileMessage(file, "video");

  // ✔ DELETE SELECTED
  const deleteSelectedMessages = async () => {
    for (const id of selectedMessages) {
      await deleteDoc(doc(db, "chats", chatId, "messages", id));
    }
    setSelectedMessages([]);
    setLongPressMode(false);
    setShowDeleteMessage(false);
  };

  // ✔ CALL HANDLERS
  const startVoiceCall = () => {
    window.location.href = `/call/voice/${chatId}`;
  };

  const startVideoCall = () => {
    window.location.href = `/call/video/${chatId}`;
  };

  return (
    <div className={`chat-page ${theme}`}>
      <Header
        onBack={() => window.history.back()}
        onSearch={() => setShowSearch(true)}
        onMenu={() => setShowMenu(true)}
        onVoiceCall={startVoiceCall}
        onVideoCall={startVideoCall}
      />

      <PinBanner chatId={chatId} />
      <BlockedBanner chatId={chatId} />

      {showSearch && (
        <>
          <SearchBar onClose={() => setShowSearch(false)} />
          <SearchResults chatId={chatId} />
        </>
      )}

      <div className="chat-scroll" ref={scrollRef}>
        <MessageList
          messages={messages}
          uploading={uploading}
          selectedIds={selectedMessages}
          onLongPress={(id) => {
            setLongPressMode(true);
            setSelectedMessages([id]);
          }}
          onImageClick={(img) => setImagePreview(img)}
        />
      </div>

      {longPressMode && (
        <LongPressToolbar
          count={selectedMessages.length}
          onCancel={() => {
            setLongPressMode(false);
            setSelectedMessages([]);
          }}
          onDelete={() => setShowDeleteMessage(true)}
          onForward={() => setShowForwardOptions(true)}
        />
      )}

      {!longPressMode && (
        <MessageInput
          onSend={sendText}
          onSendImage={sendImage}
          onSendVoice={sendVoice}
          onSendVideo={sendVideo}
        />
      )}

      {showMenu && (
        <ThreeDotMenu
          onClose={() => setShowMenu(false)}
          onMute={() => setShowMute(true)}
          onBlock={() => setShowBlock(true)}
          onReport={() => setShowReport(true)}
          onDeleteChat={() => setShowDeleteChat(true)}
          onProfessional={() => setShowProfessional(true)}
          onArchive={() => setShowArchive(true)}
          onUpdatePin={() => setShowUpdatePin(true)}
          onVoiceCall={startVoiceCall}
          onVideoCall={startVideoCall}
        />
      )}

      {showMute && <MutePopup onClose={() => setShowMute(false)} />}
      {showBlock && <BlockPopup onClose={() => setShowBlock(false)} />}
      {showReport && <ReportPopup onClose={() => setShowReport(false)} />}
      {showDeleteChat && <DeletePopup onClose={() => setShowDeleteChat(false)} />}
      {showProfessional && (
        <ProfessionalPopup onClose={() => setShowProfessional(false)} />
      )}

      {showArchive && (
        <ArchivePopup
          onClose={() => setShowArchive(false)}
          onConfirm={() => {
            setShowArchive(false);
            setShowArchiveConfirm(true);
          }}
        />
      )}

      {showArchiveConfirm && (
        <ArchiveConfirmation onClose={() => setShowArchiveConfirm(false)} />
      )}

      {showForwardOptions && (
        <ForwardPopup onClose={() => setShowForwardOptions(false)} />
      )}

      {showDeleteMessage && (
        <DeleteMessagePopup
          onClose={() => setShowDeleteMessage(false)}
          onDelete={deleteSelectedMessages}
        />
      )}

      {showReportUser && (
        <ReportUserPopup onClose={() => setShowReportUser(false)} />
      )}

      {imagePreview && (
        <ImagePreview
          image={imagePreview}
          onClose={() => setImagePreview(null)}
        />
      )}
    </div>
  );
}