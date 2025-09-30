document.addEventListener("DOMContentLoaded",()=>{
  const socket=io({auth:{token:localStorage.getItem("token")}});
  const urlParams=new URLSearchParams(window.location.search);
  const receiverId=urlParams.get("user");
  const startCallBtn=document.getElementById("startCallBtn");
  const endCallBtn=document.getElementById("endCallBtn");
  const callContainer=document.getElementById("callContainer");
  const localVideo=document.getElementById("localVideo");
  const remoteVideo=document.getElementById("remoteVideo");

  let localStream,pc;
  const configuration={iceServers:[{urls:"stun:stun.l.google.com:19302"}]};

  startCallBtn.addEventListener("click",async()=>{
    callContainer.style.display="flex";
    localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    localVideo.srcObject=localStream;
    pc=new RTCPeerConnection(configuration);
    localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
    pc.ontrack=e=>{remoteVideo.srcObject=e.streams[0]};
    pc.onicecandidate=e=>{if(e.candidate)socket.emit("ice-candidate",{to:receiverId,candidate:e.candidate})};
    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("call-user",{to:receiverId,offer});
  });

  socket.on("incoming-call",async({from,offer})=>{
    callContainer.style.display="flex";
    localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
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

  endCallBtn.addEventListener("click",()=>{
    if(pc) pc.close();
    if(localStream) localStream.getTracks().forEach(t=>t.stop());
    callContainer.style.display="none";
    pc=null;
    localStream=null;
    socket.emit("end-call",{to:receiverId});
  });

  socket.on("end-call",()=>{
    if(pc) pc.close();
    if(localStream) localStream.getTracks().forEach(t=>t.stop());
    callContainer.style.display="none";
    pc=null;
    localStream=null;
  });
});