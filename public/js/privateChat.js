document.addEventListener("DOMContentLoaded",()=>{
  const socket=io({auth:{token:localStorage.getItem("token")}});
  const urlParams=new URLSearchParams(window.location.search);
  const receiverId=urlParams.get("user");
  const receiverName=urlParams.get("name")||"Chat";

  const messageList=document.getElementById("messageList");
  const messageForm=document.getElementById("messageForm");
  const messageInput=document.getElementById("messageInput");
  const imageInput=document.getElementById("imageInput");
  const fileInput=document.getElementById("fileInput");
  const usernameEl=document.getElementById("username");
  const onlineStatusEl=document.getElementById("onlineStatus");
  const imageModal=document.getElementById("imageModal");
  const modalImg=document.getElementById("modalImg");
  const closeModal=document.getElementById("closeModal");

  const startVideoCallBtn=document.getElementById("startVideoCallBtn");
  const startVoiceCallBtn=document.getElementById("startVoiceCallBtn");
  const callContainer=document.getElementById("callContainer");
  const localVideo=document.getElementById("localVideo");
  const remoteVideo=document.getElementById("remoteVideo");
  const endCallBtn=document.getElementById("endCallBtn");

  if(!receiverId) window.location.href="/home";

  let myUserId=null,lastDateStr="";
  let localStream=null,pc=null,callAudioOnly=false;

  const token=localStorage.getItem("token");
  try{myUserId=JSON.parse(atob(token.split(".")[1])).id}catch{window.location.href="/login";}
  usernameEl.textContent=receiverName;

  socket.emit("joinPrivateRoom",{sender:myUserId,receiverId});

  // ---------- TYPING ----------
  let typingTimeout;
  messageInput.addEventListener("input",()=>{
    socket.emit("typing",{to:receiverId});
    clearTimeout(typingTimeout);
    typingTimeout=setTimeout(()=>socket.emit("stop typing",{to:receiverId}),1500);
  });
  socket.on("typing",()=>{if(!document.getElementById("typing")){const li=document.createElement("li");li.id="typing";li.className="typing";li.textContent="Typing...";messageList.appendChild(li);messageList.scrollTop=messageList.scrollHeight}});
  socket.on("stop typing",()=>{const li=document.getElementById("typing");if(li)li.remove()});

  // ---------- MESSAGES ----------
  function getDayString(date){const t=new Date(),y=new Date();y.setDate(t.getDate()-1);if(date.toDateString()===t.toDateString())return"Today";if(date.toDateString()===y.toDateString())return"Yesterday";return date.toLocaleDateString();}
  function appendMessage(msg,scroll=true){const d=new Date(msg.createdAt);const dayStr=getDayString(d);if(dayStr!==lastDateStr){const s=document.createElement("li");s.className="day-separator";s.textContent=dayStr;messageList.appendChild(s);lastDateStr=dayStr}const li=document.createElement("li");li.className="message "+(msg.sender._id===myUserId?"sent":"received");let content=msg.content||"";if(msg.fileType==="image"&&msg.fileUrl)content+=`<img src="${msg.fileUrl}" onclick="showModal(this.src)">`;if(msg.fileType==="file"&&msg.fileUrl)content+=`<a href="${msg.fileUrl}" target="_blank">File</a>`;content+=`<div class="timestamp">${d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>`;li.innerHTML=content;messageList.appendChild(li);if(scroll)messageList.scrollTop=messageList.scrollHeight}

  async function loadMessages(){try{const res=await fetch(`/api/messages/history/${receiverId}`,{headers:{Authorization:`Bearer ${token}`}});const data=await res.json();if(data.success){data.messages.forEach(msg=>appendMessage(msg,false));messageList.scrollTop=messageList.scrollHeight}}catch(err){console.error(err)}
  }
  loadMessages();

  messageForm.addEventListener("submit",async e=>{
    e.preventDefault();
    const content=messageInput.value.trim();
    if(!content)return;
    try{
      const res=await fetch("/api/messages/send",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({receiverId,content})});
      const data=await res.json();
      if(data.success){appendMessage(data.message);socket.emit("private message",data.message)}
    }catch(err){console.error(err)}
    messageInput.value="";
  });

  socket.on("private message",msg=>appendMessage(msg));

  async function sendFiles(files){if(!files.length)return;for(const f of files){const tempMsg={sender:{_id:myUserId},content:"",fileUrl:URL.createObjectURL(f),fileType:f.type.startsWith("image/")?"image":"file",createdAt:new Date()};appendMessage(tempMsg);const fd=new FormData();fd.append("file",f);fd.append("recipient",receiverId);try{const res=await fetch("/api/messages/file",{method:"POST",headers:{Authorization:`Bearer ${token}`},body:fd});const data=await res.json();appendMessage(data);socket.emit("private message",data)}catch(err){console.error(err)}}}
  imageInput.addEventListener("change",e=>sendFiles([...e.target.files]));
  fileInput.addEventListener("change",e=>sendFiles([...e.target.files]));

  socket.on("connect",()=>onlineStatusEl.textContent="Online");
  socket.on("disconnect",()=>onlineStatusEl.textContent="Offline");

  window.showModal=src=>{modalImg.src=src;imageModal.style.display="flex"};
  closeModal.addEventListener("click",()=>imageModal.style.display="none");
  imageModal.addEventListener("click",e=>{if(e.target===imageModal)imageModal.style.display="none"});

  // ---------- CALL ----------
  const configuration={iceServers:[{urls:"stun:stun.l.google.com:19302"}]};

  async function startCall(audioOnly=false){
    callAudioOnly=audioOnly;
    callContainer.style.display="flex";
    localStream=await navigator.mediaDevices.getUserMedia({video:!audioOnly,audio:true});
    localVideo.srcObject=localStream;
    pc=new RTCPeerConnection(configuration);
    localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
    pc.ontrack=e=>{remoteVideo.srcObject=e.streams[0]};
    pc.onicecandidate=e=>{if(e.candidate)socket.emit("ice-candidate",{to:receiverId,candidate:e.candidate})};

    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("call-user",{to:receiverId,offer});
  }

  socket.on("incoming-call",async({from,offer})=>{
    callContainer.style.display="flex";
    localStream=await navigator.mediaDevices.getUserMedia({video:!callAudioOnly,audio:true});
    localVideo.srcObject=localStream;
    pc=new RTCPeerConnection(configuration);
    localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
    pc.ontrack=e=>{remoteVideo.srcObject=e.streams[0]};
    pc.onicecandidate=e=>{if(e.candidate)socket.emit("ice-candidate",{to:from,candidate:e.candidate})};
    await pc.setRemoteDescription(offer);
    const answer=await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer-call",{to:from,answer});
  });

  socket.on("call-answered",async({answer})=>{await pc.setRemoteDescription(answer)});
  socket.on("ice-candidate",async({candidate})=>{try{await pc.addIceCandidate(candidate)}catch(e){console.error(e)}});

  endCallBtn.addEventListener("click",()=>endCall());
  socket.on("end-call",()=>endCall());

  function endCall(){
    if(pc) pc.close();
    if(localStream) localStream.getTracks().forEach(t=>t.stop());
    callContainer.style.display="none";
    pc=null;
    localStream=null;
  }

  startVideoCallBtn.addEventListener("click",()=>startCall(false));
  startVoiceCallBtn.addEventListener("click",()=>startCall(true));
});