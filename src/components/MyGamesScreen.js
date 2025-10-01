import { useEffect, useState } from 'react';

export default function MyGamesScreen({ username, setCurrentScreen, setCurrentGame, setGameOverData, onJoinGame }) {
  const [games, setGames] = useState([]);
  const [finishedGames, setFinishedGames] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'finished', 'invites'
  const [invites, setInvites] = useState([]);
  const [activeGames, setActiveGames] = useState([]);
  const [allGames, setAllGames] = useState([]);

  
  console.log('[ACTIVE GAMES RENDER] activeGames:', activeGames);
  
  const generateBoardHTML = (board) => {
  return board.map(row => `
    <div style="display: flex; justify-content: center; gap: 2px;">
      ${row.map(cell => `
        <div style="
          flex: 1;
          aspect-ratio: 1 / 1;
          max-width: 56px;
          border: 1px solid #ddd;
          background-color: ${cell ? '#fef9c3' : '#ffffff'};
          color: #333;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: clamp(14px, 4vw, 18px);
          border-radius: 8px;
        ">
          ${cell || ''}
        </div>
      `).join('')}
    </div>
  `).join('');
};


  const acceptInvite = (invite) => {
  console.log('[DEBUG] Davet kabul edildi:', invite);
  // ileride ws.send veya fetch ile sunucuya bildirilecek
};

const declineInvite = (invite) => {
  console.log('[DEBUG] Davet reddedildi:', invite);
  // ileride ws.send veya fetch ile sunucuya bildirilecek
};

// Aktif Oyunlar
useEffect(() => {
  if (!username) return;

  fetch(`/get-active-games?username=${encodeURIComponent(username)}`)
    .then(res => res.json())
    .then(data => {
      const filteredActive = data.filter(game => 
  game.phase !== 'finished' && 
  game.phase !== 'ended' && 
  game.status !== 'finished'
);
console.log('[FRONTEND ACTIVE GAMES]', data);  
console.log('[FRONTEND FILTERED ACTIVE]', filteredActive);
setActiveGames(filteredActive); 
    })
    .catch(err => console.error('Aktif oyunlar alınamadı:', err));
}, [username]);

// games oyunlar
  useEffect(() => {
  if (!username) return;

  fetch(`/get-games?username=${encodeURIComponent(username)}`)
    .then(res => res.json())
    .then(data => {
      console.log('[DEBUG] get-games verisi:', data);
      setAllGames(data);
    })
    .catch(err => console.error('Oyunlar alınamadı:', err));
}, [username]);

// Bitmiş oyunlar
  useEffect(() => {
    console.log('[DEBUG][MyGamesScreen] username:', username);
    if (!username) return;

    fetch(`/get-finished-games?username=${encodeURIComponent(username)}`)
      .then(res => res.json())
      .then(data => {
        console.log('[DEBUG] Bitmiş oyunlar:', data);
        setFinishedGames(data);
      })
      .catch(err => console.error('Biten oyunlar alınamadı:', err));
  }, [username]);
  
  useEffect(() => {
  if (!username) return;

  console.log('[FORCE REFRESH] username geldi:', username);
  setTimeout(() => {
    setActiveTab('active'); // biten oyunlar tabına zorla geç
  }, 0);
}, [username]);

// Davetler
  useEffect(() => {
    if (!username) return;

    fetch(`/get-invites?username=${encodeURIComponent(username)}`)
      .then(res => res.json())
      .then(data => setInvites(data))
      .catch(err => console.error('Davetler alınamadı:', err));
  }, [username]);
  
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center bg-[#f2f1f7] px-4">
      <h2 className="text-3xl font-bold text-indigo-600 mb-6">Oyunlarım</h2>

      <div className="space-y-4 w-full max-w-xs">
        <button
          onClick={() => setActiveTab('active')}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-xl shadow">
          Aktif Oyunlar
        </button>
        <button
          onClick={() => setActiveTab('finished')}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded-xl shadow">
          Biten Oyunlar
        </button>

        <button
          onClick={() => setActiveTab('invites')}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 rounded-xl shadow">
          Davetler
        </button>
        <button
          onClick={() => setCurrentScreen('start')}
          className="w-full bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 rounded-xl shadow">
          Geri Dön
        </button>
      </div>

      {/* Aktif Oyunlar */}
      {activeTab === 'active' && (
        <div className="mt-6 w-full max-w-md bg-white rounded-xl shadow p-4">
          <h3 className="text-lg font-bold text-indigo-600 mb-4">Aktif Oyunlar</h3>
          {console.log('[DEBUG] allGames:', allGames)}
    {console.log('[DEBUG] filteredActiveGames:', allGames.filter(game => game.phase && game.phase !== 'finished'))}

          {(allGames.filter(game => game.phase && game.phase !== 'finished').length === 0) ? (
            <p className="text-gray-500">Hiç aktif oyunun yok.</p>
          ) : (
            allGames
        .filter(game => game.phase && game.phase !== 'finished')
        .map((game, i) => {
  console.log('[ACTIVE GAMES ITEM]', game);
  const me = game.players.find(p => p.username === username);
  const opponent = game.players.find(p => p.username !== username);

  const opponentName = opponent?.username || 'Bilinmiyor';
  const myScore = me?.score ?? 0;
  const opponentScore = opponent?.score ?? 0;
  const isMyTurn = game.currentTurn === username;
 
  return (
    <div key={game.gameId || i} className="mb-3 p-3 bg-gray-50 rounded-md border border-gray-200">
      <p className="font-semibold text-gray-800">Rakip: {opponentName}</p>
      <p className="text-sm text-gray-600">
        Skor: {myScore} - {opponentScore} | {isMyTurn ? 'Sıra sende' : 'Rakipte'}
      </p>
      <button
        className="mt-2 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        onClick={() => onJoinGame(game)}
      >
        Oyuna Git
      </button>
    </div>
  );
})
          )}
        </div>
      )}

      {/* Bitmiş Oyunlar */}
      {activeTab === 'finished' && (
        <div className="mt-6 w-full max-w-md bg-white rounded-xl shadow p-4">
          <h3 className="text-lg font-bold text-indigo-600 mb-4">Biten Oyunlar</h3>
          {finishedGames.length === 0 ? (
            <p className="text-gray-500">Hiç bitmiş oyunun yok.</p>
          ) : (
            finishedGames.slice(-10).map((game, i) => {
              const player = username?.toLowerCase();
              const players = game.players?.map(p => p.toLowerCase()) || [];
              const opponent = players.find(p => p !== player) || 'Bilinmiyor';
              const myScore = game.finalScores?.[player] ?? 0;
              const opponentScore = game.finalScores?.[opponent] ?? 0;

              const result =
                game.winner === player
                ? 'Kazandın'
                : game.winner === opponent
                ? 'Kaybettin'
                : 'Beraberlik';

              return (
                <div key={game.gameId || i} className="mb-3 p-3 bg-gray-50 rounded-md border border-gray-200">
      <p className="font-semibold text-gray-800">Rakip: {opponent}</p>
      <p className="text-sm text-gray-600">
        Skor: {myScore} - {opponentScore} | Sonuç: {result}
      </p>
      <button
  className="mt-2 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
  onClick={() => {
    console.log('[DEBUG][Tahta Kontrolü] player board:', game.playerBoards?.[player]);
console.log('[DEBUG][Tahta Kontrolü] opponent board:', game.playerBoards?.[opponent]);

    const dataToSend = {
      playerScore: game.finalScores?.[player] ?? 0,
      opponentScore: game.finalScores?.[opponent] ?? 0,
      playerBoardHTML: generateBoardHTML(game.playerBoards?.[player] ?? []),
      opponentBoardHTML: generateBoardHTML(game.playerBoards?.[opponent] ?? []),
      opponentUsername: opponent,
      playerDetails: game.playerDetails?.[player] || [],
      opponentDetails: game.playerDetails?.[opponent] || [],
      resultText: result,
  myUsername: player,
  gameId: game.gameId,
  winner: game.winner,
  turnCount: game.totalTurns || 0,
  startTime: game.startTime || null,
  duration: game.duration || null
    };
    console.log('[DEBUG] gameover data (biten oyunlardan):', dataToSend);

    setGameOverData(dataToSend);
    setCurrentScreen('gameOver');
  }}
>
  Detayları Gör
</button>
    </div>
    
              );
           })
          )}
        </div>
      )}

      {/* Davetler */}
      {activeTab === 'invites' && (
        <div className="mt-6 w-full max-w-md bg-white rounded-xl shadow p-4">
          <h3 className="text-lg font-bold text-indigo-600 mb-4">Gelen Davetler</h3>
          {invites.length === 0 ? (
            <p className="text-gray-500">Şu anda bekleyen davetin yok.</p>
          ) : (
            invites.map((invite, i) => (
              <div key={invite.id || i} className="mb-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                <p className="font-semibold text-gray-800">Gönderen: {invite.from || 'Bilinmiyor'}</p>
                <button
                  className="mt-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  onClick={() => acceptInvite(invite)}
                >
                Kabul Et  
                </button>
                <button
                className="mt-2 ml-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                onClick={() => declineInvite(invite)}
                >
                Reddet
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}