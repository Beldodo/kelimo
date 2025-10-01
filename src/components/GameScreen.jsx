import React, { useEffect, useRef, useState, } from 'react';
import { Check, Undo2, XCircle } from 'lucide-react';
import GameOverScreen from './GameOverScreen';
import { Home } from 'lucide-react';

export default function GameScreen({

  socket,
  turnData,
  board,
  setBoard,
  scores,
  statusMessage,
  showGameOver,
  gameOverData,
  gameEnded,
  onGameOver,
  rematchPending,
  username,
  profileImage,
  opponentImage,
  opponentUsername,
  setRematchPending,
  setCurrentScreen,
  onRematch,
  isReconnect
}) {
  console.log('[GameScreen] 💡 isReconnect prop:', isReconnect);

const [selectedCell, setSelectedCell] = useState(null);
const [enteredLetter, setEnteredLetter] = useState('');
const [tempPosition, setTempPosition] = useState(null);
const [message, setMessage] = useState('');
const [canForfeit, setCanForfeit] = useState(true);

useEffect(() => {
  console.log('[GameScreen] isReconnect:', isReconnect);
    if (isReconnect) {
      setMessage('⏪ Kaldığın yerden devam ediyorsun.');
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [isReconnect]);

const [turnInfo, setTurnInfo] = useState('');
const [timer, setTimer] = useState('');
const [remainingTime, setRemainingTime] = useState(0);
const [confirmDisabled, setConfirmDisabled] = useState(false);
const [lastOpponentUsername, setLastOpponentUsername] = useState('');
const timerRef = useRef(null);
const [isMyTurn, setIsMyTurn] = useState(false);
const [letterToPlace, setLetterToPlace] = useState(null);
const buttonsDisabled = !isMyTurn || letterToPlace !== null;

const [gameStartedBefore, setGameStartedBefore] = useState(false);
const [selectedLetter, setSelectedLetter] = useState(null);
// useState'leri component üstüne ekle
const [previewLetter, setPreviewLetter] = useState(null);         // Basılan harf
const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 }); // Parmağın ekran pozisyonu
const letterRefs = useRef([]); // Tüm harf kutularını takip etmek için ref dizisi
const isMenuButtonDisabled = false;
console.log('[DEBUG] profileImage:', profileImage);
console.log('[DEBUG] opponentImage:', opponentImage);

console.log('[DEBUG] GameScreen açıldı');
console.log('[DEBUG] gameOverData:', gameOverData);
console.log('[DEBUG] lastOpponentUsername:', lastOpponentUsername);
const [activeGames, setActiveGames] = useState([]);
const [storedOpponentImage, setStoredOpponentImage] = useState(() => {
    return localStorage.getItem('opponentAvatar') || '/default-avatar.png';
  });
console.log('storedOpponentImage:', storedOpponentImage);
useEffect(() => {
  console.log('activeGames değişti, yeni avatar:', activeGames?.[0]?.opponentImage);
    if (activeGames && activeGames.length > 0) {
      const currentOpponentAvatar = activeGames[0].opponentImage;
      if (currentOpponentAvatar && currentOpponentAvatar !== storedOpponentImage) {
        setStoredOpponentImage(currentOpponentAvatar);
        localStorage.setItem('opponentAvatar', currentOpponentAvatar);
      }
    }
  }, [activeGames]);

const fullProfileImage = profileImage
  ? (profileImage.startsWith('http') ? profileImage : window.location.origin + profileImage)
  : '/default-avatar.png';

  const fullOpponentImage = storedOpponentImage
    ? (storedOpponentImage.startsWith('http') ? storedOpponentImage : window.location.origin + storedOpponentImage)
    : '/default-avatar.png';

const startTimer = (duration) => {
  if (timerRef.current) clearInterval(timerRef.current);

  let timeLeft = duration;

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (totalSeconds <= 0) return '⏰ Süre doldu';
    
     // Saatlik gösterim (1 saatten fazla ise)
  if (totalSeconds >= 3600) {
    // Örneğin 5 saat 15 dakika varsa → "6 saat" göstermeliyiz
    const roundedHour = Math.ceil(totalSeconds / 3600);
    return `${roundedHour} saat`;
  }

  // 1 dakika ile 59 dakika arası
  if (totalSeconds >= 60) {
    return `${minutes} dakika`;
  }

  // Son dakika: Dakika:saniye formatı
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
  // İlk gösterim
  setTimer(formatTime(timeLeft));

  timerRef.current = setInterval(() => {
    timeLeft -= 1000;

    setTimer(formatTime(timeLeft));

    if (timeLeft <= 0) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setTimer('⏰ Süre doldu');
      setMessage('⏰ Hamle süresi sona erdi.');
      setTurnInfo('');
    }
  }, 1000);
};
const stopTimer = () => {
  if (timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  setTimer(''); // ⬅️ DOM'a değil, state'e yazıyoruz
};


const handleCellClick = (row, col) => {
    if (gameEnded) {
  return;
}

// 🛑 Eğer sıra sende değilse ve rakipten gelen harf de yoksa, tıklama iptal
if (!isMyTurn && !letterToPlace) {
  setMessage('Şu an hamle sırası sende değil!');
  return;
}

    const cellValue = board[row][col];

    if (cellValue !== '') {
      setMessage('Bu hücre dolu ve kalıcı, değiştiremezsin!');
      return;
    }

    const clicked = { row, col };

    if (letterToPlace) {
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = letterToPlace;
    setBoard(newBoard);
    socket.send(JSON.stringify({ type: 'placeOpponentLetter', row, col }));
    setMessage(`Rakibin harfi "${letterToPlace}" konumuna yerleştirildi.`);
    setCanForfeit(true); 
    setLetterToPlace(null);
    setEnteredLetter('');
    setTempPosition(null);
    return;
  }
  // 1️⃣ Önce eski preview’i sil
    const newBoard = board.map(r => [...r]);
    if (tempPosition) {
        newBoard[tempPosition.row][tempPosition.col] = '';
    }

  if (selectedLetter) {
    setEnteredLetter(selectedLetter);
    setTempPosition(clicked);
    setSelectedCell(clicked);

    newBoard[row][col] = selectedLetter; // yeni preview
    setBoard(newBoard);

    setMessage(`"${selectedLetter}" harfi seçilen kutuya yerleştirildi.`);
    return;
  }

    if (tempPosition && enteredLetter) {
      if (tempPosition.row !== row || tempPosition.col !== col) {
        setSelectedCell(clicked);
        setTempPosition(clicked);
        setMessage(`Harf (${enteredLetter}) yeni konuma taşındı.`);


        newBoard[row][col] = enteredLetter; // yeni preview
        setBoard(newBoard);
      }
    } else {
      setSelectedCell(clicked);
      setEnteredLetter(board[row][col] || '');
      setMessage('Hücre seçildi. Klavyeden harf girin.');
    }
};

useEffect(() => {
    if (opponentImage) {
      setStoredOpponentImage(opponentImage);
      localStorage.setItem('opponentAvatar', opponentImage);
    }
  }, [opponentImage]);


// 🧠 Klavye dinleyici
useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedCell || letterToPlace || gameEnded) return;

      const rawKey = e.key;
      const letter = e.key.toLocaleUpperCase('tr-TR');
      if (forbiddenLetters.includes(letter)) {
      e.preventDefault();
      setMessage(`"${letter}" harfi kullanılamaz.`);
      return;
    }
      if (!/^[A-ZÇĞİÖŞÜ]$/.test(letter)) return;

      // Önceki preview’i sil
        if (tempPosition) {
            const newBoard = board.map(r => [...r]);
            const { row: prevRow, col: prevCol } = tempPosition;
            newBoard[prevRow][prevCol] = '';
            setBoard(newBoard);
        }

      setEnteredLetter(letter);
      setTempPosition({ row: selectedCell.row, col: selectedCell.col });

      const newBoard = board.map(r => [...r]);
      newBoard[selectedCell.row][selectedCell.col] = letter;
      setBoard(newBoard);

      setMessage(`"${letter}" harfi geçici olarak seçilen kutuya yerleştirildi.`);

      if (e.key === 'Enter') {
  e.preventDefault();
  confirmOwnLetter(); // 👈 Enter’a basıldığında harfi sunucuya gönder
}

    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedCell, tempPosition, enteredLetter, gameEnded, board, socket]);

// ⬇️ State'lerin altına ekle (örn. const [message, setMessage] = useState(''); varsa onun altı)
const updateTurnMessages = (yourTurn, letterToPlace) => {
  console.log('[DEBUG] updateTurnMessages çağrıldı:', { yourTurn, letterToPlace });
  if (yourTurn && letterToPlace) {
    setMessage('Harfi klavyeden girip boş bir hücreye yerleştir.');
    setTurnInfo('Rakipten gelen harfi yerleştir.');
  } else if (yourTurn && !letterToPlace) {
    setMessage('');
    setTurnInfo('Kendi harfini girip yerleştir.');
  } else if (!yourTurn && letterToPlace) {
    setMessage(`Rakibin gönderdiği harf: "${letterToPlace}"`);
    setTurnInfo('Bu harfi uygun kutuya yerleştir.');
  } else {
    setMessage('');
    setTurnInfo('Rakibin hamlesi bekleniyor...');
  }
};
const handleCellDrop = (row, col, e) => {
  e.preventDefault();
  const letter = e.dataTransfer.getData('text/plain');

  if (!letter || !isMyTurn) {
    setMessage('Sıra sende değil ya da geçersiz harf.');
    return;
  }

  if (letterToPlace) {
    // Rakipten gelen harfi yerleştiriyoruz
    const newBoard = board.map(r => [...r]);
    if (newBoard[row][col] !== '') {
      setMessage('Bu kutu dolu!');
      return;
    }

    newBoard[row][col] = letter;
    setBoard(newBoard);

    socket.send(JSON.stringify({ type: 'placeOpponentLetter', row, col }));
    setLetterToPlace(null);
    setMessage(`Rakip harfi "${letter}" konumuna yerleştirildi.`);
    return;
  } else {
    // Kendi seçtiğimiz harf
    const newBoard = board.map(r => [...r]);
    if (newBoard[row][col] !== '') {
      setMessage('Bu kutu dolu!');
      return;
    }

    newBoard[row][col] = letter;
    setBoard(newBoard);
    setEnteredLetter(letter);
    setTempPosition({ row, col });
    setSelectedCell({ row, col });
    setMessage(`"${letter}" harfi seçilen kutuya yerleştirildi.`);
  }
};

const handleLetterClick = (letter) => {
  if (letterToPlace === null) {
    setSelectedLetter(letter);
  }
};


// 💬 [YENİ] İlk render'da mesajları önceden göster
useEffect(() => {
  if (!turnData) {
    setMessage('Oyun başlıyor...');
    setTurnInfo('Rakibin hamlesi bekleniyor...');
  }
}, []);

useEffect(() => {

  if (isMyTurn && !letterToPlace && tempPosition && enteredLetter) {
    setBoard(prev => {
      const newBoard = prev.map(r => [...r]);
      newBoard[tempPosition.row][tempPosition.col] = enteredLetter;
      return newBoard;
    });
  }
}, [isMyTurn, letterToPlace, tempPosition, enteredLetter]);

useEffect(() => {
  
if (!turnData) return;
console.log('[CLIENT] turnData güncellendi:', turnData);

const yourTurn = turnData.yourTurn ?? false;
const letterToPlace = turnData.letterToPlace ?? null;

setIsMyTurn(yourTurn);
setLetterToPlace(letterToPlace);

updateTurnMessages(yourTurn, letterToPlace);

stopTimer(); // Önceki süreyi temizle

if (turnData.turnDuration) {
    startTimer(turnData.turnDuration);
  }

if (turnData.remainingTime) {
    setRemainingTime(Math.floor(turnData.remainingTime / 1000)); // saniyeye çevir
  }

return () => {
  stopTimer(); // Component unmount edildiğinde de timer'ı durdur
 };
}, [turnData]);

useEffect(() => {
    console.log(`[CLIENT] isMyTurn: ${isMyTurn}, letterToPlace: ${letterToPlace}`);
    updateTurnMessages(isMyTurn, letterToPlace);
  }, [isMyTurn, letterToPlace]);

useEffect(() => {
  if (turnData) {
    setSelectedCell(null);
    setEnteredLetter('');
    setTempPosition(null);
  }
}, [turnData]);

useEffect(() => {
  console.log('[DEBUG] useEffect [gameOverData] tetiklendi', gameOverData);
  if (gameOverData?.opponentUsername) {
    console.log('[DEBUG] opponentUsername yüklendi:', gameOverData.opponentUsername);
    setLastOpponentUsername(gameOverData.opponentUsername);
  } else {
    console.log('[DEBUG] Rakip adı yok, set edilmeyecek.');
  }
}, [gameOverData]);

const forbiddenLetters = ['X', 'W', 'Q'];

const confirmOwnLetter = () => {
  console.log('[DEBUG] confirmOwnLetter çalıştı');
  console.log('[DEBUG] turnData:', turnData);
  console.log('[DEBUG] letterToPlace:', letterToPlace);
  console.log('[DEBUG] enteredLetter:', enteredLetter);
  console.log('[DEBUG] tempPosition:', tempPosition);
  console.log('[DEBUG] selectedCell:', selectedCell);
  if (!turnData?.yourTurn || letterToPlace !== null) {
    setMessage('Sıra sende değil ya da hala rakip harfini yerleştirmedin.');
    return;
  }

  if (!selectedCell || !enteredLetter || !tempPosition) {
    setMessage('Harf girişi eksik.');
    return;
  }

  if (forbiddenLetters.includes(enteredLetter.toUpperCase())) {
    setMessage(`"${enteredLetter.toUpperCase()}" harfi kullanılamaz.`);
    return;
  }
setCanForfeit(false);
console.log('[DEBUG] Sunucuya harf gönderiliyor...');
  // 🛑 Süreyi durdur
  stopTimer();

  // 🔧 ŞU ŞEKİLDE GÖNDER:
  socket.send(JSON.stringify({
    type: 'updateOwnLetterPlacement',
    letter: enteredLetter,
    row: tempPosition.row,
    col: tempPosition.col
  }));

  socket.send(JSON.stringify({
    type: 'placeOwnLetter', 
    }));

  setMessage(`Harf yerleştirildi: ${enteredLetter.toUpperCase()} (${tempPosition.row}, ${tempPosition.col})`);
  setEnteredLetter('');
  setTempPosition(null);
  setSelectedCell(null);
  setSelectedLetter(null);
  updateTurnMessages(false, null);
};

console.log('[DEBUG] GameScreen render', {
    gameEnded,
    lastOpponentUsername,
    gameOverData
  });
const secondsLeft = parseInt(timer);
useEffect(() => {
  if (!turnData && !gameStartedBefore) {
    setMessage('🎯 İlk harfler geliyor... Hazır ol!');
    setGameStartedBefore(true);
  }
}, [turnData, gameStartedBefore]);

useEffect(() => {
  letterRefs.current = []; // Her render'da sıfırlanmalı
}, [/* harf havuzu değiştiğinde (genellikle sabit olduğu için boş bırakabilirsin) */]);






return (
<>
<div className="fixed inset-0 flex flex-col items-center bg-[#f2f1f7] px-2 pt-[120px] pb-8 w-full min-h-screen overflow-hidden sm:relative sm:overflow-auto sm:h-auto sm:min-h-screen">

{previewLetter && (
  <div
    className="fixed z-50 pointer-events-none"
    style={{
      top: previewPosition.y - 90, // ⬅️ -60 yerine -90 veya -100 yap
  left: previewPosition.x - 30,
    }}
  >
    <div className="min-w-[60px] px-4 h-16 rounded-xl bg-white border border-gray-300 shadow-xl flex items-center justify-center text-4xl font-extrabold text-gray-900 scale-110 transition transform duration-75 ease-out">
      {previewLetter}
    </div>
  </div>
)}

{/* Üst Bilgi Barı */}
<div className="w-full fixed top-0 left-0 z-50 px-4 py-2 sm:py-3 bg-white/90 backdrop-blur-md shadow-sm flex items-center justify-between border-b border-gray-200">
  <div className="flex items-center space-x-2">
    <img
      src={fullProfileImage}
      alt="Sen"
      className="w-8 h-8 rounded-full border border-indigo-400 object-cover"
    />
    <div className="flex flex-col text-left">
      <p className="text-sm sm:text-base font-semibold text-gray-600 text-center w-full">{username || 'Sen'}</p>
      <p className="text-sm sm:text-base font-bold text-indigo-700">{scores.myScore}</p>
    </div>
  </div>

  {/* Rakip */}
  <div className="flex items-center space-x-2 justify-end">
    <div className="flex flex-col text-right">
      <p className="text-xs sm:text-sm font-medium text-gray-700 truncate">{opponentUsername || 'Rakip'}</p>
      <p className="text-sm sm:text-base font-bold text-indigo-700">{scores.opponentScore}</p>
    </div>
    <img
      src={fullOpponentImage}
      alt="Rakip"
      className="w-8 h-8 rounded-full border border-gray-400 object-cover"
    />
  </div>
</div>

<div className="fixed top-[56px] left-0 w-full z-40 px-4 py-2 sm:py-3 bg-white/90 backdrop-blur-md shadow-md border-b border-gray-200">
<div className="flex items-center justify-between w-full max-w-[720px] mx-auto">
  {/* Sol: Süre kutusu */}
  <div className="flex flex-col items-start w-24 sm:w-28">
    <p className="text-sm sm:text-base font-semibold text-gray-600 text-center w-full">Süre</p>
    <div
      className={`flex items-center justify-center text-lg font-bold rounded-xl shadow text-center w-24 sm:w-28 h-10 sm:h-12 border
        ${timer.includes('saat')
        ? 'bg-green-100 text-green-700 border-green-200'
        : timer.includes('dakika')
        ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
        : timer.includes(':')
        ? 'bg-red-100 text-red-600 border-red-200 animate-pulse'
        : 'bg-gray-200 text-gray-500 border-gray-300'}
    `}
    >
      {timer || '-'}
    </div>
  </div>

  {/* Orta: Oyun adı */}
  <div className="text-4xl sm:text-5xl font-display font-black text-indigo-600 tracking-tight leading-tight drop-shadow-sm">
    Kelimo
  </div>

  {/* Sağ: Gelen harf kutusu */}
  <div className="flex flex-col items-end w-24 sm:w-28">
    <p className="text-sm sm:text-base font-semibold text-gray-600 text-center w-full">Gelen Harf</p>
    <div className="flex items-center justify-center text-lg font-bold text-indigo-800 rounded-xl shadow text-center w-24 sm:w-28 h-10 sm:h-12 border bg-indigo-50 border-indigo-200">
      {letterToPlace ? (
        <span className="leading-none">
          {letterToPlace}
          </span>
      ) : (
        <span className="text-gray-400 text-xl">-</span>
      )}
    </div>
  </div>
</div>
</div>

    {/* Mesaj Alanı */}
{/* Mesaj Alanı */}
<div className="w-full text-center mt-4 sm:mt-10 mb-2 sm:mb-2 px-4 space-y-1 sm:space-y-2">
  
  {/* Bilgilendirici Mesaj */}
  <div className="min-h-[20px]">
    <p className={`text-sm text-gray-500 italic transition-opacity duration-300 ${message ? 'opacity-100' : 'opacity-0'}`}>
      {message || '.'}
    </p>
  </div>

  {/* Hamle Yönlendirme Mesajı */}
  <div className="min-h-[28px]">
    <p className={`text-lg font-bold text-blue-700 transition-opacity duration-300 ${turnInfo ? 'opacity-100' : 'opacity-0'}`}>
      {turnInfo || '.'}
    </p>
  </div>

</div>


    {/* Tahta Başlığı */}
    <div className="text-center">

      {/* Oyun Tahtası */}
<div className="w-[70vw] max-w-[340px] relative mx-auto">
  {/* Kare oran yaratıcı div */}
  <div className="pt-[100%]"></div>

  {/* Dış çerçeve - eski görünüm */}
  <div className="absolute inset-0 bg-gray-200 border-2 border-gray-600 rounded-lg p-1 sm:p-1.5 md:p-2">
    <div className={`h-full w-full grid grid-cols-5 gap-[2.5%]`}>
      {board.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const isSelected =
            selectedCell &&
            selectedCell.row === rowIndex &&
            selectedCell.col === colIndex;
// ① Board'daki kalıcı harf veya preview
    const displayLetter =
      cell || (tempPosition?.row === rowIndex && tempPosition?.col === colIndex ? enteredLetter : '');

          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              onClick={() => handleCellClick(rowIndex, colIndex)}
              className={`
  aspect-square
  w-full
  border border-gray-300 rounded-lg
  flex items-center justify-center 
  font-bold text-base sm:text-lg md:text-xl
  cursor-pointer transition-all duration-150
  ${cell ? 'bg-yellow-200 text-gray-900' : 'bg-white text-gray-600'}
  ${isSelected ? 'ring-2 ring-yellow-300' : ''}
  hover:bg-yellow-100
  overflow-hidden
  leading-none
  text-center
`}
 >
              {displayLetter}
            </div>
          );
        })
      )}
    </div>
  </div>
</div>



{/* 👉 Onayla Butonu tam buraya geliyor */}

<div className="flex justify-center space-x-2 sm:space-x-4 mt-3 sm:mt-6">

  <button
    title="Girdiğin harfi onayla"
    onClick={confirmOwnLetter}
    disabled={
    buttonsDisabled ||
  !selectedCell ||
  !enteredLetter ||
  !tempPosition
  }
    className={`flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-xl font-semibold text-white transition-all duration-150
  ${buttonsDisabled || !selectedCell || !enteredLetter || !tempPosition
    ? 'bg-green-200 text-gray-400 cursor-not-allowed'
    : 'bg-green-400 hover:bg-green-500 active:scale-95 shadow-md active:shadow-inner cursor-pointer'
  }`}
  >
    <Check className="w-5 h-5 sm:w-6 sm:h-6 mb-1" />
    <span className="text-xs font-semibold">Onayla</span>
  </button>
  <button
  title="Girdiğin harfi geri al"
  onClick={() => {
    if (!tempPosition) {
      setMessage('Geri alınacak hamle yok.');
      return;
    }

    const newBoard = board.map(r => [...r]);
    newBoard[tempPosition.row][tempPosition.col] = '';
    setBoard(newBoard);

    setEnteredLetter('');
    setTempPosition(null);
    setSelectedCell(null);

    socket.send(JSON.stringify({
      type: 'updateOwnLetterPlacement',
      letter: '',
      row: tempPosition.row,
      col: tempPosition.col,
      oldRow: tempPosition.row,
      oldCol: tempPosition.col
    }));

    setMessage('Son harf geri alındı.');
  }}
  disabled={buttonsDisabled || !tempPosition}
  className={`flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-xl font-semibold transition-all duration-150

    bg-yellow-300 hover:bg-yellow-400 active:scale-95 text-gray-800 shadow-md active:shadow-inner cursor-pointer
    
    disabled:opacity-50 disabled:cursor-not-allowed    
    `}
>
  <Undo2 className="w-5 h-5 sm:w-6 sm:h-6 mb-1" />
  <span className="text-xs font-semibold">Geri Al</span>
</button>
<button
  title="Oyunu terk et"
  onClick={() => {
    socket.send(JSON.stringify({ type: 'forfeit' }));
    setMessage('Oyundan çekildiniz.');
  }}
  disabled={buttonsDisabled || !canForfeit}
  className={`flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-xl font-semibold transition-all duration-150
  ${buttonsDisabled || !canForfeit
    // Pasif stili (Onayla butonu ile tutarlı gri flulaşma)
    ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
    
    // Aktif stili (Orijinal kırmızı renk)
    : 'bg-red-500 hover:bg-red-600 active:scale-95 text-white shadow-md active:shadow-inner cursor-pointer'
  }`}
>
  <XCircle className="w-5 h-5 sm:w-6 sm:h-6 mb-1" />
  <span className="text-xs font-semibold">Pes Et</span>
</button>
<button
  title="Ana menüye dön"
  onClick={() => {
    setCurrentScreen('start');
    socket.send(JSON.stringify({ type: 'minimizeGame' }));
  }}
  disabled={false}
  className="flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gray-400 hover:bg-gray-500 active:scale-95 text-white rounded-xl shadow-md active:shadow-inner transition-all duration-150"
>
  <Home className="w-5 h-5 sm:w-6 sm:h-6 mb-1" />
  <span className="text-xs font-semibold">Ana Menü</span>
</button>



{showGameOver && gameOverData && (
  <GameOverScreen
    data={gameOverData}
    username={gameOverData.username}
    playerScore={gameOverData.playerScore}
    opponentScore={gameOverData.opponentScore}
    playerDetails={gameOverData.playerDetails}
    opponentDetails={gameOverData.opponentDetails}
    playerBoardHTML={gameOverData.playerBoardHTML}
    opponentBoardHTML={gameOverData.opponentBoardHTML}
    onRematch={handleRematch}
    rematchPending={rematchPending}
    setRematchPending={setRematchPending}
    socket={socket}
  />
)}

</div>
{/* Mobilde klavye ile butonlar arasında boşluk bırakmak için görünmez boşluk */}
<div className="block sm:hidden h-3" />


    </div>
    
{/* Harf Havuzu - Q Klavye 3 Satır */}
<div className="block sm:hidden w-full px-2 flex flex-col items-center space-y-1">
 {[
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç']
  ].map((row, rowIndex) => (
    
    <div key={`row-${rowIndex}`}
  className="flex justify-center gap-[1px] sm:gap-[1px]">
   {row.map((letter, i) => {
    const isInactive = ['Q', 'W', 'X'].includes(letter);
    return (
        <div
          key={`letter-${rowIndex}-${i}`}
          ref={(el) => {
  if (el) letterRefs.current.push(el);
}}  // ⬅️ Bu kutuyu refs listesine ekliyoruz
  data-letter={letter}                       // ⬅️ Bu kutunun hangi harf olduğunu belirtiyoruz


          onClick={() => {
              if (!isInactive) handleLetterClick(letter);
            }}
            onTouchStart={(e) => {
    if (!isInactive) {
      const touch = e.touches[0];
      setPreviewLetter(letter);                                // Harfi göster
      setPreviewPosition({ x: touch.clientX, y: touch.clientY }); // Parmağın konumu
    }
  }}
  onTouchEnd={(e) => {
  const touch = e.changedTouches[0]; // 🟡 Parmağın bırakıldığı pozisyonu al
  setPreviewLetter(null); // 🟡 Önizlemeyi kaldır

  const hoveredLetter = letterRefs.current.find(el => {
    const rect = el.getBoundingClientRect();
    return (
      touch.clientX >= rect.left &&
      touch.clientX <= rect.right &&
      touch.clientY >= rect.top &&
      touch.clientY <= rect.bottom
    );
  });

  if (hoveredLetter) {
    const selected = hoveredLetter.getAttribute('data-letter');
    if (!['Q', 'W', 'X'].includes(selected)) {
      handleLetterClick(selected); // 🟢 Bırakıldığında o harfi gerçek seçim yap
      setSelectedLetter(selected); // 🟢 UI'da da göster
    }
  }
}}
  onTouchMove={(e) => {
  const touch = e.touches[0];
  setPreviewPosition({ x: touch.clientX, y: touch.clientY }); // ⬅️ Parmağın pozisyonunu güncelle
// ⬇️ Şu anki parmak konumunun altında bir harf kutusu var mı kontrol et
  const hoveredLetter = letterRefs.current.find(el => {
    const rect = el.getBoundingClientRect();
    return (
      touch.clientX >= rect.left &&
      touch.clientX <= rect.right &&
      touch.clientY >= rect.top &&
      touch.clientY <= rect.bottom
    );
  });

  // ⬇️ Eğer farklı bir harf altına geldiysek, önizleme harfini güncelle
  if (hoveredLetter) {
    const newLetter = hoveredLetter.getAttribute('data-letter');
    if (newLetter !== previewLetter) {
      setPreviewLetter(newLetter);
    }
  }
}}
            className={`
              w-[7.7vw] h-[10vw] sm:w-[6vw] sm:h-[7.6vw] md:w-[4.4vw] md:h-[6.2vw]
              flex items-center justify-center
              font-bold text-sm sm:text-base md:text-lg
              rounded-xl border transition-all duration-150 ease-in-out
              ${isInactive
                ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
                : `bg-white text-indigo-900 border-indigo-300 shadow cursor-pointer
                   ${selectedLetter === letter ? 'ring-2 ring-indigo-500 bg-indigo-100 scale-110 -translate-y-1' : ''
                   }`
              }
            `}
          >
            {letter}
          </div>
          );
})}
</div>
))}
</div>
</div>
</>
);
}
