import React, { useEffect } from 'react';
import { Home, RotateCcw } from 'lucide-react';

export default function GameOverScreen({ data, username, onExit, onRematch, rematchPending, setRematchPending, playerDetails, opponentDetails }) {
  console.log('[DEBUG][GameOverScreen] gelen data:', data);
  
  console.log('[DEBUG][GameOverScreen] gelen data.username:', data?.username);


  if (!data) return null;

  useEffect(() => {
  console.log('[GameOverScreen] rematchPending:', rematchPending);
}, [rematchPending]);

  const {
    playerScore,
    opponentScore,
    playerBoardHTML,
    opponentBoardHTML,
    opponentUsername,
    playerDetails: playerDetailList,
    opponentDetails: opponentDetailList
  } = data;

  const resultMessage =
    playerScore > opponentScore
      ? 'Kazandın!'
      : playerScore < opponentScore
      ? 'Kaybettin!'
      : 'Berabere!';

  return (
    <>
      {/* 🔔 Rematch Popup */}
      {rematchPending && (
        <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center space-y-4 max-w-xs">
            <p className="text-lg font-semibold text-gray-800">
              Rakibe tekrar oynama isteği gönderildi.
            </p>
            <p className="text-sm text-gray-500">Rakip onayladığında oyun başlayacak.</p>
          </div>
        </div>
      )}
      
      <div className="flex flex-col items-center justify-start min-h-screen bg-[#f2f1f7] px-4 pt-[96px] pb-10 space-y-10 overflow-y-auto">

      <h1 className="text-4xl sm:text-5xl font-display font-black text-indigo-600 tracking-tight drop-shadow-sm text-center">
  {resultMessage}
</h1>
{/* Butonlar */}
      <div className="flex justify-center items-center gap-4 mt-4 flex-row flex-nowrap">

        <button
    onClick={onExit}
    className="flex flex-col items-center justify-center w-20 h-20 bg-gray-400 hover:bg-gray-500 active:scale-95 shadow-md active:shadow-inner text-white rounded-xl transition-all duration-150"
>
    <Home className="w-6 h-6 mb-1" />
    <span className="text-xs font-semibold">Ana Menü</span>
  </button>
        <button
    onClick={() => {
      if (!opponentUsername) {
        console.warn('[WARN] Rakip adı bilinmiyor, tekrar oyun başlatılamaz.');
        return;
      }
      console.log('[DEBUG] Tekrar Oyna tıklanınca rakip:', opponentUsername);
      onRematch(opponentUsername);
    }}
    className="flex flex-col items-center justify-center w-20 h-20 bg-indigo-400 hover:bg-indigo-500 active:scale-95 shadow-md active:shadow-inner text-white rounded-xl transition-all duration-150"
>
    <RotateCcw className="w-6 h-6 mb-1" />
    <span className="text-xs font-semibold">Tekrar Oyna</span>
  </button>
</div>


<div className="flex flex-row justify-center items-start flex-wrap gap-2 w-full px-2">


        {/* Oyuncu Kartı */}
        <div className="bg-white rounded-xl shadow-md w-[48%] min-w-[140px] max-w-[240px] p-2 sm:p-4 space-y-4 border border-gray-200">

          <h2 className="text-xl sm:text-2xl font-bold text-indigo-700 text-center">{username}</h2>
<div className="w-full flex justify-center">
  <div
    className="max-w-full"
    style={{ width: '100%' }}
    dangerouslySetInnerHTML={{ __html: playerBoardHTML }}
  />
</div>

          <p className="text-center text-lg font-bold text-gray-700">{playerScore} puan</p>
          <ul className="text-sm space-y-1">
            {playerDetailList?.length ? (
              playerDetailList.map((word, idx) => (
                <li key={idx} className="text-gray-600">
                  {word.word} ({word.type}): <span className="font-semibold">{word.score} puan</span>
                </li>
              ))
            ) : (
              <li className="italic text-gray-400">Kelime bulunamadı.</li>
            )}
          </ul>
        </div>

        {/* Rakip Kartı */}
       <div className="bg-white rounded-xl shadow-md w-[48%] min-w-[140px] max-w-[240px] p-2 sm:p-4 space-y-4 border border-gray-200">

          <h2 className="text-xl sm:text-2xl font-bold text-indigo-700 text-center">{opponentUsername || 'Rakip'}</h2>
<div className="w-full flex justify-center">
  <div
    className="max-w-full"
    style={{ width: '100%' }}
    dangerouslySetInnerHTML={{ __html: opponentBoardHTML }}
  />
</div>
          <p className="text-center text-lg font-bold text-gray-700">{opponentScore} puan</p>
          <ul className="text-sm space-y-1 px-2">
            {opponentDetailList?.length ? (
              opponentDetailList.map((word, idx) => (
                <li key={idx} className="text-gray-600">
                  {word.word} ({word.type}): <span className="font-semibold">{word.score} puan</span>
                </li>
              ))
            ) : (
              <li className="italic text-gray-400">Kelime bulunamadı.</li>
            )}
          </ul>
        </div>
      </div>

      
    </div>
    </>
  );
}
