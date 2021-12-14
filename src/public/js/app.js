const socket = io();
// phnoe call code
const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName; // 현재 있는 방의 room name
let myPeerConnection;

async function getCameras(){ // 카메라 자동으로 가져오는 코드
    try{
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind ==="videoinput")
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach((camera) => {
            const option = document.createElement("option");
            option.value = camera.deviceId
            option.innerText =camera.label;
            if(currentCamera.label === camera.label){
                option.selected = true;
            }
            camerasSelect.appendChild(option);
        })
        console.log(cameras);
    }catch(e){
        console.log(e)
    }
}

// * getuserMedia: 유저의 카메라와 오디오를 가져온다. 
async function getMedia(deviceId){
    const initialConstrains ={
        audio: true,
        video: {facingMode: "user"},
    };
    const cameraConstrains = {
        audio: true,
        video: {deviceId: {exact: deviceId}},      
    };
    try{
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId? cameraConstrains : initialConstrains 
        );
        myFace.srcObject = myStream;
        if(!deviceId){
            await getCameras();
        }

    }catch(e){
        console.log(e)
    }
}

//getMedia(); 
// 모든걸 시작시키는 함수

function handleMuteClick(){
    myStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
    if(!muted){
        muteBtn.innerText = "Unmute";
        muted = true;
    }else{
        muteBtn.innerText = "Mute";
        muted = false;
    }
}

function handleCameraClick(){
    myStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
    if(cameraOff){
        cameraBtn.innerText = "Turn Camera Off";
        cameraOff = false;
    }else{
        cameraBtn.innerText = "Turn Camera On";
        cameraOff = true;
    }
}

async function handleCameraChange() {
    await getMedia(camerasSelect.value);
    if (myPeerConnection) {
      const videoTrack = myStream.getVideoTracks()[0];
      const videoSender = myPeerConnection
        .getSenders()
        .find((sender) => sender.track.kind === "video");
      videoSender.replaceTrack(videoTrack);
    }
  }
 
muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);


// welcome from (Join a room)

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");


// * 양쪽 브라우저에서 돌아가는 코드 
async function initCall() {
    welcome.hidden = true;
    call.hidden = false;
    await getMedia();
    makeConnection();
  }
  

async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    await initCall();
    socket.emit("join_room", input.value);
    roomName = input.value;
    input.value = "";
  }

  welcomeForm.addEventListener("submit", handleWelcomeSubmit);
  


  // socket code
// Peer A의 코드: offer 생성
socket.on("welcome", async () => {
  const offer = await myPeerConnection.createOffer(); //sdp 생성
  myPeerConnection.setLocalDescription(offer);
  console.log("sent the offer");
  socket.emit("offer", offer, roomName);
});

// Peer B의 코드 
  socket.on("offer", async(offer) =>{
      console.log("received the offer");
      // offer 받아서 remoteDescripttion 설정, 
      // 즉 내 peer의 description을 뜻 한다.
      myPeerConnection.setRemoteDescription(offer); 
      const answer =  await myPeerConnection.createAnswer();
      // console.log(answer);
      myPeerConnection.setLocalDescription(answer);
      socket.emit("answer", answer, roomName);
      console.log("sent the answer");
  } )

  socket.on("answer", answer =>{
      console.log("received the answer");
      myPeerConnection.setRemoteDescription(answer);


  })

  socket.on("ice", (ice)=>{
      console.log("received candidate");
      myPeerConnection.addIceCandidate(ice);
  });

  // RTC code
  function makeConnection() {
    //  ** 이 연결을 모든 곳에 다 공유하고 싶다.
    // 영상과 오디오 데이터를 주고 받고 할, 그 영상의 오디오와
    // 영상 데이터 들을 peer connection에 넣어야 한다.
    myPeerConnection = new RTCPeerConnection({  // 양쪽 브라우저에서 peer-to-peer connection
      iceServers: [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
            "stun:stun3.l.google.com:19302",
            "stun:stun4.l.google.com:19302",
          ],
        },
      ],
    });
    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("addstream", handleAddStream);
    myStream
      .getTracks()
      .forEach((track) => myPeerConnection.addTrack(track, myStream));
  // 양 쪽 브러우저에서 카메라와 마이크의 데이터 stream을 받아서 그것들을 연결안에 집어 넣었다.
    }

  function handleIce(data){
      console.log("sent candidate");
      socket.emit("ice", data.candidate, roomName);
  }

  function handleAddStream(data){
      const peerFace = document.getElementById("peerFace")
      //console.log("got an event from my peer");
      //console.log("Peer's stream", data.stream);
      //console.log("My stream", myStream);
      peerFace.srcObject = data.stream;
  }