// 📁 components/App.jsx
import { useEffect, useRef, useState } from 'react';

// Context
import { SocketProvider } from './context/SocketContext';

// Screens
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import StartScreen from './components/StartScreen';
import MyGamesScreen from './components/MyGamesScreen';
import NewMatchScreen from './components/NewMatchScreen';
import GameScreen from './components/GameScreen';
import GameOverScreen from './components/GameOverScreen';

// Popups
import InvitePopup from './components/InvitePopup';

// Hooks / Utils
import { useTimer } from './hooks/useTimer';

export default function App() {
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

//Kullanıcı Bilgileri ve Giriş
const [username, setUsername] = useState(() => {
  return sessionStorage.getItem('username') || '';
});
const [userData, setUserData] = useState(null);
const [loginError, setLoginError] = useState('');
// Sabitler
const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=Anon&background=random&bold=true';
//Kullanıcı Bilgileri devam
const [profileImage, setProfileImage] = useState(() => {
  const saved = sessionStorage.getItem(`profileImage_${username}`);
  return saved || DEFAULT_AVATAR;
});
const [infoMessage, setInfoMessage] = useState('');
//Ekran ve geçiş yönetimi
const [currentGame, setCurrentGame] = useState(null);
const [currentScreen, setCurrentScreen] = useState(() => {
  const saved = sessionStorage.getItem('currentScreen');
  const savedGameOverData = sessionStorage.getItem('gameOverData');
  const validScreens = ['login', 'register', 'start', 'game', 'gameOver', 'newMatch', 'myGames'];

  if (saved === 'game' && savedGameOverData) {
    console.warn('[INIT] Oyun bitmişti, gameOver ekranına dönülüyor.');
    return 'gameOver';
  }

  return validScreens.includes(saved) ? saved : 'login';
});
const [gameKey, setGameKey] = useState(0);

//Oyun verileri
const [board, setBoard] = useState(Array(7).fill(null).map(() => Array(7).fill('')));
const [turnData, setTurnData] = useState(null);
const [scores, setScores] = useState({ myScore: 0, opponentScore: 0 });
const [isMyTurn, setIsMyTurn] = useState(false);
const [letterToPlace, setLetterToPlace] = useState(null);
const [confirmDisabled, setConfirmDisabled] = useState(false);
const [enteredLetter, setEnteredLetter] = useState(''); 
const [tempPosition, setTempPosition] = useState(null); 
const [selectedCell, setSelectedCell] = useState(null);
const [selectedLetter, setSelectedLetter] = useState(null);
const [statusMessage, setStatusMessage] = useState('');
const [message, setMessage] = useState(''); 
const [gameEnded, setGameEnded] = useState(false);
const [gameId, setGameId] = useState(null);
const [isReconnect, setIsReconnect] = useState(false);
const [activeGamesState, _setActiveGamesState] = useState([]);

const setActiveGames = (data) => {
  console.log('[GLOBAL SET activeGames] çağrısı, stack:', new Error().stack);
  console.log('[GLOBAL SET activeGames] data:', data);
  _setActiveGamesState(data);
};


// Oyun sonu
const [gameOverData, setGameOverData] = useState(() => {
  let savedGameOver = null;
  try {
    const saved = sessionStorage.getItem('gameOverData');
    savedGameOver = saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.warn('[WARN] Bozuk gameOverData JSON:', e);
    savedGameOver = null;
  }
  return savedGameOver;
});
const [showGameOver, setShowGameOver] = useState(false);
const [rematchPending, setRematchPending] = useState(false);
const [acceptSent, setAcceptSent] = useState(false);

//Rakip verileri
const [opponentUsername, setOpponentUsername] = useState('');
const [opponentImage, setOpponentImage] = useState('');
const [lastOpponentUsername, setLastOpponentUsername] = useState('');

//İstatistik ve Geçmiş
const [totalGames, setTotalGames] = useState(() => {
const saved = sessionStorage.getItem('totalGames');
  return saved ? parseInt(saved, 10) : 0;
});
const [wins, setWins] = useState(() => {
  const saved = sessionStorage.getItem('wins');
  return saved ? parseInt(saved, 10) : 0;
});
const [losses, setLosses] = useState(() => {
  const saved = sessionStorage.getItem('losses');
  return saved ? parseInt(saved, 10) : 0;
});
const [averageScore, setAverageScore] = useState(0);
const [recentGames, setRecentGames] = useState([]);

//Davet
const [invitePopup, setInvitePopup] = useState({ visible: false, from: null });

//Sistem, Socket ve Bağlantı
const [onlineCount, setOnlineCount] = useState(0);
const socketRef = useRef(null);
const reconnectAttemptsRef = useRef(0);
const reconnectTimeoutRef = useRef(null);
const MAX_RECONNECT_ATTEMPTS = 5;

//Zamanlayıcı Sistemi
const { timer, startTimer, stopTimer } = useTimer();

const calculatedWinRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

const formatScore = (value) => {
  const num = parseFloat(value);
  return num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);
};

const calculatedAverageScore = recentGames.length > 0
  ? formatScore(recentGames.reduce((sum, g) => sum + (g.score || 0), 0) / recentGames.length)
  : "0.0";

// 👤 Profil / Avatar işlemleri
function handleAvatarChange(imgUrl) {
  setProfileImage(imgUrl);
  sessionStorage.setItem(`profileImage_${username}`, imgUrl);

  if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
    console.log('[WS SEND] updateProfileImage', { profileImage: imgUrl });

    socketRef.current.send(JSON.stringify({
      type: 'updateProfileImage',
      profileImage: imgUrl,
    }));
  }
}

// 🔐 Kullanıcı login işlemi
function handleLogin(u, p) {
  if (!socketRef.current || socketRef.current.readyState !== 1) {
    console.warn('WebSocket bağlantısı henüz hazır değil.');
    return;
  }
  console.log('[App.js] onLogin çağrılıyor, gönderilen veri:', {
  type: 'login',
  username: u,
  password: p,
  isReconnect: false
});

  console.log('[App.js] onLogin çağrıldı:', u, p);
  setUsername(u);
  sessionStorage.setItem('username', u);
  socketRef.current.send(JSON.stringify({
  type: 'login',
  username: u,
  password: p,
  isReconnect: false // 🔐 manuel giriş → reconnect değil
}));
}
function joinGame(game) {
  if (!game) {
    console.warn('[WARN] joinGame null veya undefined game aldı');
    return; // game yoksa fonksiyon burada durur
  }

  console.log('[App.js] joinGame çağrıldı:', game.gameId);

  if (socketRef.current && socketRef.current.readyState === 1) {
    console.log('[App.js] socketRef.current.readyState:', socketRef.current.readyState);

    console.log('[CLIENT][JOIN] joinGame mesajı gönderiliyor:', game.gameId);
    
    socketRef.current.send(JSON.stringify({
      type: 'joinGame',
      gameId: game.gameId
    }));
    console.log('[joinGame] game objesi içeriği:', game);

    setCurrentGame({
      gameId: game.gameId || null,
      opponentUsername: game.opponentUsername || '',
      opponentImage: game.opponentImage || DEFAULT_AVATAR,
      yourTurn: game.yourTurn ?? false,
    });
    
  } else {
    console.warn('WebSocket bağlı değil.');
  }
}

// ♻️ Oyun sıfırlama
const resetGameState = () => {
  console.log('--- resetGameState başlatıldı ---');
  setBoard(Array(5).fill(null).map(() => Array(5).fill('')));
  setScores({ myScore: 0, opponentScore: 0 });
  setTurnData(null);
  setGameEnded(false);
  setGameOverData(null);
  setLetterToPlace(null);
  setStatusMessage('');
  setConfirmDisabled(false);
  setEnteredLetter('');
  setTempPosition(null);
  setSelectedCell(null);
setSelectedLetter(null);
setLastOpponentUsername('');
sessionStorage.removeItem('gameOverData');

  setMessage('');
  setIsMyTurn(false);
  setGameKey(prevKey => prevKey + 1); // Her sıfırlamada key'i artır
        console.log(`GameScreen key güncellendi: ${gameKey + 1}`);
};

// 🔁 Rematch
const handleRematch = (opponentUsername) => {
  if (!opponentUsername) {
    console.warn('[WARN] opponentUsername bilinmiyor, rematch gönderilemez.');
    return;
  }

  console.log('[DEBUG] Rematch isteği gönderiliyor:', opponentUsername);

  socketRef.current.send(JSON.stringify({
    type: 'invite',
    to: opponentUsername,
    fromRematch: true
  }));

  setRematchPending(true); // ✅ App.js içinde tanımlı olan state
};
function safeSend(message) {
  if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
    console.log('[WS SEND] Gönderilen mesaj:', message);
    socketRef.current.send(JSON.stringify(message));
  } else {
    console.warn('WebSocket bağlantısı açık değil, mesaj gönderilemiyor:', message);
    // Burada istersen mesajı bir kuyrukta tutup bağlantı açılınca gönderebilirsin
  }
}
function fetchActiveGames() {
  debugger; // <-- BURAYA
  fetch(`/get-active-games?username=${encodeURIComponent(username)}`)
    .then(res => {
      if (!res.ok) { // Yanıt başarılı değilse
        throw new Error(`HTTP hatası! Status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      // Eğer backend doğrudan dizi döndürüyorsa:
      // const gamesList = Array.isArray(data) ? data : data.activeGames || [];
      // Sonra filtrele
      const gamesList = (data && Array.isArray(data.activeGames) ? data.activeGames : Array.isArray(data) ? data : []);
      setActiveGames(gamesList.filter(g => g.status === 'ongoing'));
    })
    .catch(err => console.error('Aktif oyunlar alınamadı:', err));
}

// 🌐 WebSocket bağlantısını başlat
function initializeWebSocket() {
  debugger; // <-- Buraya ekleyin
 const socket = new WebSocket('ws://192.168.5.15:3001');
  socketRef.current = socket;

  socket.onopen = () => {
    
    console.log('✅ WebSocket bağlantısı kuruldu.');
  reconnectAttemptsRef.current = 0;
  const storedUsername = sessionStorage.getItem('username');
  if (storedUsername) {
    console.log('[Reconnect] Otomatik login atılıyor:', storedUsername);
    const storedGameId = sessionStorage.getItem('gameId');
    safeSend({  // veya socket.send(...) — hangisini kullanıyorsan
      type: 'login',
      username: storedUsername,
      isReconnect: true,
      gameId: storedGameId || null
    });
  }
};
socket.onmessage = (event) => {
  console.log('[WS] Gelen ham veri:', event.data);
if (!event.data) {
    console.warn('[WS] Boş mesaj geldi, işlenmiyor.');
    return;
  }  
let data;
try {
  data = JSON.parse(event.data);
} catch (e) {
  console.error('[WS] JSON parse hatası, gelen ham veri:', event.data);
  return;
}
 if (!data.type) {
    console.warn('[WS] Tipi olmayan mesaj alındı:', data);
    return;
  }


// 🔍 Tüm gelen mesajı logla
  console.log('[WS] Gelen mesaj:', data);

  // Eğer JSON-RPC hatası varsa
  try {
  if (data.error) {
    console.error('[WS] JSON-RPC Hatası:', data.error);
  }
} catch (err) {
  console.error('[WS] Error loglanırken patladı:', err);
}

switch (data.type) {

  case 'loginSuccess':
  console.log('loginSuccess alındı, startScreen açılıyor...');
  const lowerUsername = data.username.toLowerCase();
  setUsername(lowerUsername);
  console.log('[DEBUG] setUsername loginSuccess ile çağrıldı:', lowerUsername);
  sessionStorage.setItem('username', lowerUsername); // yeni satır

  setUserData({
    username: lowerUsername,
    winRate: data.winRate ?? 0,
    averageScore: data.averageScore ?? 0,
    wins: data.wins ?? 0,
    losses: data.losses ?? 0
  });

const gamesList = Array.isArray(data.activeGames) ? data.activeGames : [];
setActiveGames(gamesList.filter(g => g?.status === 'ongoing'));

  setCurrentScreen('start');
  break;

  case 'loginFailure':
setLoginError(data.message || 'Geçersiz kullanıcı adı veya şifre.');
break;
case 'setUsernameAck':
console.log("✅ Kullanıcı adı sunucu tarafından onaylandı.");
break;
case 'status':
  console.log('[App.js] Status mesajı:', data.message);
  setStatusMessage(data.message);
  break;
case 'invite':
  console.log('[CLIENT DEBUG] Gelen davet kimden:', data.from);
  console.log('[CLIENT DEBUG] Benim kullanıcı adım:', username);

  if (!data.from) {
    console.warn('[CLIENT] 🚫 Gelen davet geçersiz, gönderici yok.');
    return;
  }

  
  if (!username) {
    console.warn('[CLIENT] ⚠️ Kullanıcı adı henüz gelmemiş, davet işlenemedi. Bekletiliyor...');
    setTimeout(() => {
      if (data.from !== username) {
        console.log('[CLIENT] 🔁 Bekletilen davet şimdi işleniyor.');
        setInvitePopup({ visible: true, from: data.from });
      } else {
        console.log('[CLIENT] ⛔ Bekletilen davet kendinden geldi, işlenmedi.');
      }
    }, 100);
    return;
  }

  if (data.from === username) {
    console.warn('[CLIENT] 🚫 Kendi gönderdiğim davet, işlenmeyecek.');
    return;
  }

  console.log('[App.js] ✅ Davet geldi, popup açılıyor:', data);
  setInvitePopup({ visible: true, from: data.from });
  break;
case 'onlineCount':
console.log('[WS] 🔢 Online kullanıcı sayısı mesajı alındı:', data.count);
setOnlineCount(data.count);
console.log('[App.js] 🔢 Online kullanıcı sayısı (state sonrası):', data.count);
break;

case 'start':
  console.log('[CLIENT] Yeni gameId alındı:', data.gameId); // <== BURAYA
  console.log('[CLIENT][RECONNECT] start mesajı geldi');
  console.log('[CLIENT][RECONNECT] yourTurn:', data.yourTurn);
  console.log('[CLIENT][RECONNECT] letterToPlace:', data.letterToPlace);

  console.log('[CLIENT][START] Gelen start verisi:', JSON.stringify(data, null, 2)); 

  if (data.gameId) {
    setGameId(data.gameId); // ✅ burada state'e yazılıyor
    sessionStorage.setItem('gameId', data.gameId);
  }

  if (!(gameOverData && currentScreen === 'gameOver')) {
    if (currentScreen !== 'game') {
      console.log('[TRACE] setCurrentScreen("game") çağrıldı — DOSYA içinde tam yer: X satırı');

      setCurrentScreen('game');
    }
  }

  setOpponentImage(data?.opponentImage || DEFAULT_AVATAR);
  setOpponentUsername(data?.opponentUsername || '');
  
  setCurrentGame({
    gameId: data.gameId || null,
    opponentUsername: data.opponentUsername || '',
    opponentImage: data.opponentImage || DEFAULT_AVATAR,
    yourTurn: data.yourTurn ?? false,
    letterToPlace: data.letterToPlace ?? null,
    turnStartTime: data.turnStartTime ?? null,
    turnDuration: data.turnDuration ?? null
  });
  
  const reconnect = !data.invite && !data.fromRematch;
  console.log('[CLIENT][APP] reconnect değeri:', reconnect);
  setIsReconnect(reconnect);

  if (!reconnect) {
    resetGameState();
  }
  
  setLetterToPlace(data.letterToPlace ?? null);
  setTurnData({
  letterToPlace: data.letterToPlace ?? null,
  turnStartTime: data.turnStartTime,
  turnDuration: data.turnDuration,
});

  break;

case 'boardState':
  setBoard(data.board);
  break;

case 'turn':
  console.log('[CLIENT] Gelen turn mesajı:', data);
  if (gameOverData) {
    console.log('[turn] Oyun bitti, turn mesajı yoksayılıyor.');
    break;
  }
  setTurnData(data);
  console.log('[TRACE] setCurrentScreen("game") çağrıldı — DOSYA içinde tam yer: X satırı');

  setCurrentScreen('game');
  
  const isMyTurnNow = data.currentPlayer === username;
console.log('[CLIENT] Hesaplanan yourTurn:', isMyTurnNow);
setIsMyTurn(isMyTurnNow);



  if (typeof data.remainingTime === 'number' && data.yourTurn === true) {

    const remainingSeconds = Math.floor(data.remainingTime / 1000);
    console.log('[CLIENT] ⏱ Timer başlatılıyor (zorla):', remainingSeconds);
    startTimer(remainingSeconds);
  }
  break;

  case 'promptOwnLetter':
  setMessage('Rakibin harfi yerleştirildi. Şimdi kendi harfini gir.');
  break;

case 'promptOpponentLetter':
  setLetterToPlace(data.letter);
  setStatusMessage(`Rakip harfi "${data.letter}" geldi. Yerleştirmek için bir hücre seç.`);
  break;

case 'opponentPlacedLetter':
  setStatusMessage(`Rakip oyuncu "${data.letter}" harfini gönderdi. Yerleştirmeni bekliyor.`);
  setLetterToPlace(data.letter);
  break;

case 'updateScores':
  setScores({
    myScore: data.playerScore,
    opponentScore: data.opponentScore
  });
  break;
case 'gameOver':
  console.log('[CLIENT][DEBUG] gameOver mesajı alındı. Gelen data:', data); 
  console.log('[CLIENT][DEBUG] data.opponentUsername:', data.opponentUsername); 
  
  const currentUsername = userData?.username || username || sessionStorage.getItem('username') || '';
  console.log('[DEBUG] reportScore gönderiliyor:', {
    username: currentUsername,
    score: data.playerScore,
    won: data.playerScore > data.opponentScore
  });


  setGameEnded(true);
  setStatusMessage('Oyun Bitti!');
  setConfirmDisabled(true); // bu state varsa
  setGameOverData({
  playerScore: data.playerScore ?? 0,
  opponentScore: data.opponentScore ?? 0,
  playerDetails: data.playerDetails || {},
  opponentDetails: data.opponentDetails || {},
  playerBoardHTML: data.playerBoardHTML || '',
  opponentBoardHTML: data.opponentBoardHTML || '',
  opponentUsername: data.opponentUsername || '',
  username: currentUsername
  });
  sessionStorage.setItem('gameOverData', JSON.stringify({
  playerScore: data.playerScore,
  opponentScore: data.opponentScore,
  playerDetails: data.playerDetails,
  opponentDetails: data.opponentDetails,
  playerBoardHTML: data.playerBoardHTML,
  opponentBoardHTML: data.opponentBoardHTML,
  opponentUsername: data.opponentUsername,
  username: currentUsername
}));
  setCurrentScreen('gameOver');  
  setShowGameOver(true); // oyun sonu ekranını göster

  
  safeSend({
    type: 'reportScore',
    username: currentUsername,
    score: data.playerScore,
    won: data.playerScore > data.opponentScore
  });
  fetchActiveGames();
break;
case 'rematchStart':
  console.log('[CLIENT] rematchStart alındı.');
  resetGameState();
  setGameEnded(false);
  setTurnData(null);
  setGameOverData(null);
  setBoard(Array(5).fill(null).map(() => Array(5).fill('')));
  console.log('[TRACE] setCurrentScreen("game") çağrıldı — DOSYA içinde tam yer: X satırı');

  setCurrentScreen('game');
  console.log('[CLIENT][DEBUG] Ekran "game" olarak ayarlandı. GameScreen yeniden yüklenecek.');
  setEnteredLetter('');
  setTempPosition(null);
  setRematchPending(false);
  setMessage('Yeni oyun başladı. Hamleni yap.');
  setShowGameOver(false);
  setOpponentUsername(data.opponentUsername);
  setOpponentImage(data.opponentImage);
  break;


default:
console.warn('[WS] Bilinmeyen mesaj tipi:', data.type);
}
};

socket.onclose = () => {
    console.log('❌ WebSocket bağlantısı kapandı.');
    setStatusMessage('Bağlantı kesildi, tekrar bağlanılıyor...');
     if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
    const delay = 1000 * Math.pow(2, reconnectAttemptsRef.current ); // exponential backoff
    console.log(`[Reconnect] ${delay}ms içinde yeniden bağlanacak...`);

    reconnectTimeoutRef.current = setTimeout(() => {
  reconnectAttemptsRef.current += 1;
  initializeWebSocket(); // Tüm event handler'ları burada tanımladığın için yeniden çağır
}, delay);

  } else {
    console.error('[Reconnect] Maksimum deneme sayısına ulaşıldı.');
    setStatusMessage('Bağlantı kesildi. Lütfen sayfayı yenileyin.');
    setGameEnded(true);
  }
};

socket.onerror = (err) => {
      console.error('🔥 WebSocket hatası:', err);
  setStatusMessage('Bir hata oluştu. Bağlantı sorunu olabilir.');
  setGameEnded(true);
};
}

//SessionStorage Kaydetme ve Okuma
useEffect(() => {
  sessionStorage.setItem('currentScreen', currentScreen);
}, [currentScreen]);



useEffect(() => {
  if (username) {
    sessionStorage.setItem(`profileImage_${username}`, profileImage);
  }
}, [profileImage, username]);

useEffect(() => {
  sessionStorage.setItem('totalGames', totalGames);
}, [totalGames]);

useEffect(() => {
  sessionStorage.setItem('wins', wins);
}, [wins]);

useEffect(() => {
  sessionStorage.setItem('losses', losses);
}, [losses]);

//App Açılışında Session’dan Yükleme ve Yönlendirme
useEffect(() => {
  const savedScreen = sessionStorage.getItem('currentScreen');
  const savedUsername = sessionStorage.getItem('username');
  const savedGameOverData = sessionStorage.getItem('gameOverData');

  if (savedGameOverData && savedScreen === 'game') {
    console.log('[SAFELOAD] Oyun bitmişti, gameOver ekranına dönülüyor.');
    setCurrentScreen('gameOver');
    return;
  }

  if (savedScreen === 'game') {
    if (!savedUsername) {
      console.warn('[SAFELOAD] Username yok, login ekranına dönülüyor.');
      setCurrentScreen('login');
    } else {
      console.log('[SAFELOAD] Game ekranı yüklenecek. Username mevcut:', savedUsername);
    }
  } else if (savedScreen === 'start') {
    if (!savedUsername) {
      console.warn('[SAFELOAD] Start için username yok, login ekranına dönülüyor.');
      setCurrentScreen('login');
    } else {
      setCurrentScreen('start');
    }
  }
}, []);

//Kullanıcı Verisi Fetch Etme
useEffect(() => {
  console.log('[FETCH DEBUG] Kullanıcı istatistikleri yükleniyor:', username);
  if (!username) return;
debugger; // BURAYA
  fetch(`/get-user?username=${username}`)
    .then(res => {
      if (!res.ok) { // Yanıt başarılı değilse
        throw new Error(`HTTP hatası! Status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      console.log('[DEBUG] /get-user cevabı:', data);
      const stats = data.stats || {};
      const recentGames = stats.recentGames || [];
  
  const totalScore = recentGames.reduce((sum, g) => sum + g.score, 0);
    const avgScore = recentGames.length > 0
      ? (totalScore / recentGames.length).toFixed(1)
      : "0.0";

  setTotalGames(stats.totalGames || 0);
  setWins(stats.wins || 0);
  setLosses(stats.losses || 0);
  setProfileImage(data.profileImage || DEFAULT_AVATAR);
  setRecentGames(recentGames);
  setAverageScore(parseFloat(avgScore));
  
if (data.profileImage) {
        console.log('[Avatar] Sunucudan avatar geldi:', data.profileImage);
        setProfileImage(data.profileImage);
        sessionStorage.setItem(`profileImage_${username}`, data.profileImage);
      } else {
        const saved = sessionStorage.getItem(`profileImage_${username}`);
        if (saved) {
          console.log('[Avatar] sessionStorage avatarı kullanılıyor:', saved);
          setProfileImage(saved);
        } else {
          console.log('[Avatar] Hiçbir şey yok, default atanıyor.');
          setProfileImage(DEFAULT_AVATAR);
        }
      }

    })
    .catch(err => {
      console.error('İstatistik yükleme hatası:', err);
    });
}, [username]);



//Oyun Sonunda İstatistik Güncelle
useEffect(() => {
  if (gameOverData) {
    setTotalGames(prev => prev + 1);

    const playerScore = gameOverData.playerScore;
    const opponentScore = gameOverData.opponentScore;

    if (playerScore > opponentScore) {
      setWins(prev => prev + 1);
    } else if (playerScore < opponentScore) {
      setLosses(prev => prev + 1);
    }
  }
}, [gameOverData]);

//GameOver Olursa Ekranı Değiştir
useEffect(() => {
    if (gameOverData && currentScreen !== 'gameOver') {
      setCurrentScreen('gameOver');
    }
  }, [gameOverData, currentScreen]);

//Zamanlayıcı Başlatma (turnData değişince)
useEffect(() => {
  if (turnData) {
    const { turnStartTime, turnDuration } = turnData;
    if (turnStartTime && turnDuration) {
      const elapsed = Date.now() - turnStartTime;
      const remaining = turnDuration - elapsed;
      startTimer(Math.max(remaining, 0)); 
    }
  }
}, [turnData, startTimer]);

//Popup Açıldığında Accept Flag Sıfırla

useEffect(() => {
    if (invitePopup.visible) {
      setAcceptSent(false); 
    }
  }, [invitePopup.visible]);


useEffect(() => {
  if (invitePopup.visible) {
    console.log("[DEBUG] Popup açıldı. username:", username, "from:", invitePopup.from);

    // Eğer kendinden gelen bir davetse, otomatik kapat
    if (invitePopup.from === username) {
      console.warn("[CLIENT] 🚫 Kendi gönderdiğim davet. Popup kapatılıyor.");
      setInvitePopup({ visible: false, from: null });
    } else {
      setAcceptSent(false); // sadece farklıysa sıfırla
    }
  }
}, [invitePopup.visible, invitePopup.from, username]);

//WebSocket Cleanup (componentWillUnmount gibi)
useEffect(() => {
    initializeWebSocket();
return () => {
  if (socketRef.current) socketRef.current.close();
  if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
};
}, []);
//Debug Loglar (En Alta)
useEffect(() => {
    console.log('[DEBUG] gameOverData değişti:', gameOverData);
  }, [gameOverData]);

useEffect(() => {
  console.log('[DEBUG] recentGames state:', recentGames);
  if (recentGames.length > 0) {
    window.recentGames = recentGames;
    console.log('🧪 recentGames window üzerinden erişilebilir hale geldi.');
  }
}, [recentGames]);

const onGoogleLogin = () => {
  if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
    console.error('❌ Google OAuth2 SDK tanımsız.');
    return;
  }

  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: '743732871650-pbckifuebt6q7sm8vde172pvlsh5e3mp.apps.googleusercontent.com',
    scope: 'openid email profile',
    callback: (response) => {
      if (!response || !response.access_token) {
        console.error('❌ Token alınamadı.');
        return;
      }

      const token = response.access_token;

      fetch('http://192.168.5.15:3001/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }), // backend verifyIdToken ile değilse burayı ID token olarak güncelle
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            console.log('✅ Giriş başarılı:', data.email);
            // Giriş sonrası işlemler:
            // setUsername(data.email.split('@')[0]);
            // setCurrentScreen('start');
          } else {
            console.error('❌ Backend doğrulaması başarısız.');
          }
        })
        .catch(err => {
          console.error('❌ Hata:', err);
        });
    }
  });

  client.requestAccessToken();
};


  const handleCredentialResponse = (response) => {
    const idToken = response.credential;

    fetch('/google-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: idToken }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('✅ Giriş başarılı:', data.email);
          // Burada kullanıcıyı oyuna alabilirsin:
          // setUsername(data.email.split('@')[0]);
          // setCurrentScreen('start');
        } else {
          console.error('❌ Token doğrulama başarısız.');
        }
      })
      .catch(err => {
        console.error('❌ Hata:', err);
      });
  };
if (currentScreen === 'game') {
  console.log('GameScreen props:', currentGame, gameOverData);
}

 console.log('[App] render JSX return öncesi');

return (
  <SocketProvider>
  <>
  {currentScreen === 'login' && (
    <LoginScreen
      infoMessage={infoMessage}
      onLogin={handleLogin}
      onGoogleLogin={() => console.log('[App.js] Google login tıklanma testi')}
      onFacebookLogin={() => console.log('[App.js] Facebook login tıklanma testi')}
      onNavigateToRegister={() => setCurrentScreen('register')} 
    />
  )}
  {currentScreen === 'register' && (
  <RegisterScreen
    onRegister={() => {
      setInfoMessage('✅ Kayıt başarılı! Şimdi giriş yapabilirsin.');
      setCurrentScreen('login');
  }}
  onBackToLogin={() => setCurrentScreen('login')}
  />
)}
  {currentScreen === 'start' && (
    <StartScreen
    setCurrentScreen={setCurrentScreen}
  onRandomGame={() => {
  console.log('[App.js] Rastgele eşleşme istendi');
  if (statusMessage.includes('bekleniyor')) {
  console.log('Zaten rakip bekleniyor.');
  return;
  }
  const msg = { type: 'startGame' };
  console.log('[WS SEND] Gönderilen mesaj:', msg);
  socketRef.current.send(JSON.stringify(msg));
}}
  onInvite={(targetUsername) => {
    console.log('[App.js] Davet gönderiliyor:', targetUsername);
    const msg = { type: 'invite', to: targetUsername };
  console.log('[WS SEND] Gönderilen mesaj:', msg);
  socketRef.current.send(JSON.stringify(msg));
}}
  onLogout={() => {
    setGameOverData(null);
  sessionStorage.removeItem('gameOverData');

  setUsername('');
  sessionStorage.removeItem('username');

  sessionStorage.removeItem('currentScreen');
  setCurrentScreen('login');
    }}
  username={userData?.username || username}
  profileImage={profileImage}
  setProfileImage={setProfileImage}
  onlineCount={onlineCount}
  totalGames={totalGames}
  winRate={calculatedWinRate}            
  averageScore={calculatedAverageScore}
  wins={wins}
  losses={losses}
  onAvatarChange={handleAvatarChange}
  
  />
  )}
  {currentScreen === 'newMatch' && (
  <NewMatchScreen
    onBack={() => setCurrentScreen('start')}
    onRandomGame={() => {
      const msg = { type: 'startGame' };
  console.log('[Yeni Oyun] Rastgele rakip başlatılıyor, gönderilen mesaj:', msg);
  socketRef.current.send(JSON.stringify(msg));
}}
    onInvite={(targetUsername) => {
      const msg = { type: 'invite', to: targetUsername };
  console.log('[Yeni Oyun] Davet gönderiliyor, gönderilen mesaj:', msg);
  socketRef.current.send(JSON.stringify(msg));
}}
    onComputerMatch={() => {
      console.log('[Yeni Oyun] Bilgisayara karşı mod (placeholder)');
      // İleride AI maçı eklenecekse burada handle edilecek
    }}
  />
)}

{currentScreen === 'myGames' && (
  <MyGamesScreen
    username={username}
    setCurrentScreen={setCurrentScreen}
    setGameOverData={setGameOverData}
    setCurrentGame={setCurrentGame}
    
    onJoinGame={joinGame}
  />
)}



  {invitePopup.visible && (
    <InvitePopup
      from={invitePopup.from}
      onAccept={() => {
      if (!acceptSent && invitePopup.from !== username) {
      setAcceptSent(true);
      const msg = { type: 'acceptInvite' };
  console.log('[CLIENT] acceptInvite gönderiliyor:', msg);
  socketRef.current.send(JSON.stringify(msg));
    }
    setInvitePopup({ visible: false, from: null });
  }}
      onReject={() => {
      const msg = { type: 'rejectInvite' };
  console.log('[CLIENT] rejectInvite gönderiliyor:', msg);
  socketRef.current.send(JSON.stringify(msg));
  setInvitePopup({ visible: false, from: null });
}}
    />
  )}
  
  {currentScreen === 'game' && (
    <GameScreen
      key={gameId || 'default'}
      socket={socketRef.current}
      turnData={turnData}
      scores={scores}
      board={board}
      setBoard={setBoard}
      gameId={gameId}
      statusMessage={statusMessage}
      gameEnded={false}
      showGameOver={showGameOver}
      gameOverData={gameOverData}
      confirmDisabled={confirmDisabled}
      setConfirmDisabled={setConfirmDisabled}
      rematchPending={rematchPending}
      setRematchPending={setRematchPending}
      username={username}
      profileImage={profileImage}
      opponentImage={opponentImage}                       
      opponentUsername={opponentUsername}
      onGameOver={(data) => {
      setGameOverData(data);          
      setCurrentScreen('gameOver'); 
      }}
      setCurrentScreen={setCurrentScreen}
      isReconnect={isReconnect}
    />
  )}
  {currentScreen === 'gameOver' && (gameOverData || currentGame) && (
  <GameOverScreen
    data={gameOverData || currentGame}
    username={username}                 
    onExit={() => {
      console.log('[CLIENT] exitGame mesajı gönderiliyor...');
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
    const msg = { type: 'exitGame' };
  console.log('[CLIENT] exitGame mesajı gönderiliyor:', msg);
  socketRef.current.send(JSON.stringify(msg));
}
      resetGameState();
      setGameOverData(null);
      sessionStorage.removeItem('currentScreen');
      sessionStorage.removeItem('gameOverData');
      setCurrentScreen('start');       
    }}
    onRematch={(opponentUsername) => {
      console.log('[CLIENT] Rematch isteği gönderiliyor:', opponentUsername);
      socketRef.current.send(JSON.stringify({
        type: 'invite',
        to: opponentUsername,
        fromRematch: true
      }));
      setRematchPending(true);
    }}
    rematchPending={rematchPending}
    setRematchPending={setRematchPending}  
  />
)}
</>
</SocketProvider>
    
);
}