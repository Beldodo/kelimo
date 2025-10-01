// === 📁 server/server.js ===
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'http://192.168.5.15:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
let waitingPlayersQueue = [];

const gamesPath = path.join(__dirname, '../data/games.json');
let games = [];

function loadGamesFromDisk() {
  try {
    if (fs.existsSync(gamesPath)) {
      const raw = fs.readFileSync(gamesPath, 'utf-8');
      const parsed = JSON.parse(raw);

      games = Array.isArray(parsed) ? parsed : Object.values(parsed);

    games = games.map(gameData => {
        const players = Array.isArray(gameData.players) ? gameData.players.map(p => ({
          ...p,
          ws: null,
          opponent: null
        })) : [];

        return {
          ...gameData,
          players,
          gameId: gameData.gameId || gameData.id,
          status: typeof gameData.status === 'string' ? gameData.status : 'ongoing'
        };
      });

      console.log(`[LOAD] games.json'dan ${games.length} oyun RAM'e yüklendi.`);
    }
  } catch (err) {
    console.error('[ERROR] games.json okunamadı veya bozuk:', err);
  }
}

loadGamesFromDisk();

function saveGamesToDisk() {
  try {const serializableGames = games.map(game => ({
  gameId: game.gameId || game.id,
  players: game.players.map(p => ({
    username: p.username,
    board: p.board,
    score: p.score,
    movesMade: p.movesMade,
    myTurn: p.myTurn,
    turnPhase: p.turnPhase,
    letterToPlace: p.letterToPlace,
    tempLetterPlacement: p.tempLetterPlacement,
    gameId: p.gameId,
  })),
  currentTurn: game.currentTurn,
  phase: game.phase,
  startTime: game.startTime,
  boardStates: game.boardStates
}));

    fs.writeFileSync(gamesPath, JSON.stringify(serializableGames, null, 2), 'utf-8');
    console.log('[SAVE] games.json güncellendi.');

    console.log('SAVE GAMES: Güncel oyunların phase durumları:', games.map(g => ({ gameId: g.gameId, phase: g.phase })));

  } catch (err) {
    console.error('[ERROR] games.json yazılamadı:', err);
  }
}

loadGamesFromDisk();

const finishedGamesPath = path.join(__dirname, '../data/finishedGames.json');
if (!fs.existsSync(finishedGamesPath)) {
  fs.writeFileSync(finishedGamesPath, '[]', 'utf-8');
  console.log('[SERVER] 📁 finishedGames.json oluşturuldu (boş liste).');
}

const multer = require('multer');
const uploadPath = path.join(__dirname, 'uploads/avatars');
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => {
  const ext = path.extname(file.originalname);
  const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '');
  cb(null, `${base}-${Date.now()}${ext}`);
}

});


const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // max 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    cb(null, allowed.includes(file.mimetype));
  }
});


app.post('/upload-avatar', upload.single('avatar'), (req, res) => {
  console.log('[UPLOAD AVATAR] Endpoint çağrıldı, username:', req.body.username);
  
  if (!req.file) {
    console.error('[UPLOAD] ❌ req.file yok');
    return res.status(400).json({ error: 'Dosya alınamadı' });
  }
  const username = req.body.username;
  if (!username) {
    console.error('[UPLOAD] ❌ username yok');
    return res.status(400).json({ error: 'Kullanıcı adı eksik' });
  }
  const imagePath = `/uploads/avatars/${req.file.filename}`;

  console.log('[UPLOAD] ✅ Dosya kaydedildi:', imagePath);

  const usersPath = path.join(__dirname, '../data/users.json');
  
  fs.readFile(usersPath, 'utf-8', (err, json) => {
    if (err) {
      console.error('[UPLOAD] ❌ users.json okunamadı:', err.message);
      return res.status(500).json({ message: 'Kullanıcı verisi okunamadı.' });
    }

    let users = [];
    try {
      users = JSON.parse(json);
    } catch (e) {
      console.error('[UPLOAD] ❌ JSON parse hatası:', e.message);
      return res.status(500).json({ message: 'Veri hatalı.' });
    }

   const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      console.error('[UPLOAD] ❌ Kullanıcı bulunamadı:', username);
      return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }

    user.profileImage = imagePath;
    
    for (const game of Object.values(games)) {
      for (const player of game.players) {
        if (player.username === username) {
          player.profileImage = imagePath;
          console.log(`[AVATAR GÜNCELLE] GameId: ${game.gameId}, Player: ${player.username}, NewAvatar: ${player.profileImage}`);
        }
      }
    }
    fs.writeFile(usersPath, JSON.stringify(users, null, 2), (err) => {
      if (err) {
        console.error('[UPLOAD] ❌ Yazma hatası:', err.message);
        return res.status(500).json({ error: 'Veri yazılamadı' });
      }

      console.log('[UPLOAD] ✅ Kullanıcı avatarı güncellendi:', username);
      return res.json({ profileImage: imagePath });
    });
  });
});
// server.js içinde en üste yakın bir yerde tanımla
const writeLocks = {};

function safeWriteJSON(filePath, data, callback) {
  if (writeLocks[filePath]) {
    // Hâlihazırda bu dosyaya yazılıyorsa, kısa süre sonra tekrar dene
    return setTimeout(() => safeWriteJSON(filePath, data, callback), 50);
  }

  writeLocks[filePath] = true;

  let jsonString = '';
  try {
    jsonString = JSON.stringify(data, null, 2);
    JSON.parse(jsonString); // Ekstra doğrulama
  } catch (e) {
    writeLocks[filePath] = false;
    console.error(`[SERVER] ❌ JSON verisi bozuk, yazım iptal (${filePath}):`, e);
    console.error('[SERVER] ❌ Yazılmak istenen veri:', data);
    if (callback) callback(e);
    return;
  }

  try {
    // Yazmadan önce yedek al
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, filePath + '.bak');
    }
  
  // Yazım işlemi: sync ile garanti
    fs.writeFileSync(filePath, jsonString);
    console.log(`[SERVER] ✅ Dosya başarıyla yazıldı: ${filePath}`);
    if (callback) callback(null);
  } catch (err) {
    console.error(`[SERVER] ❌ Yazma hatası:`, err);
    if (callback) callback(err);
  } finally {
    writeLocks[filePath] = false;
  }
}
const generateUniqueId = () => {
  return 'game_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
};

const saveGameResult = (username, score, won, opponent, gameId, gameType = 'random', isForfeit = false, isDraw = false) => {
    if (!username) {
  console.warn('[SERVER] ⚠️ saveGameResult çağrıldı ama username eksik:', { score, won });
  return;
}

const gamesPath = path.join(__dirname, '../data/games.json');
  fs.readFile(gamesPath, 'utf-8', (err, json) => {
    let games = [];

    if (!err) {
      try {
        games = JSON.parse(json);
      } catch (e) {
        console.error('[SERVER] games.json parse hatası:', e);
      }
    }

    const gameRecord = {
      gameId,
      username,
      opponent,
      score,
      won,
      isForfeit,
      isDraw,
      gameType,
      status: 'finished',
      timestamp: new Date().toISOString()
    };

    games.push(gameRecord);

    safeWriteJSON(gamesPath, games, (err) => {
      if (err) console.error('[SERVER] games.json yazılamadı:', err);
      else console.log(`[SERVER] ✅ Oyun sonucu kaydedildi: ${username} ${score} ${won}`);
    });
    updateUserStats(username, score, won);
  });
};
const updateUserStats = async (username, score, won) => {

  const usersPath = path.join(__dirname, '../data/users.json');
  try {
    const json = await fs.promises.readFile(usersPath, 'utf-8');
    const users = JSON.parse(json);

    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user || !user.stats) {
      console.warn('[SERVER] Kullanıcı bulunamadı veya stats eksik:', username);
      return;
    }

    user.stats.totalGames += 1;
    if (won) user.stats.wins += 1;
    else user.stats.losses += 1;

    user.stats.recentGames.unshift({
      score,
      result: won ? 'Win' : 'Loss',
      date: new Date().toISOString()
    });

    user.stats.recentGames = user.stats.recentGames.slice(0, 10);

    await new Promise((resolve, reject) => {
  safeWriteJSON(usersPath, users, (err) => {
    if (err) reject(err);
    else resolve();
  });
});
    console.log(`[SERVER] ✅ İstatistik güncellendi: ${username}`);

  } catch (err) {
    console.error('[SERVER] ❌ updateUserStats hatası:', err);
  }
};

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client('743732871650-pbckifuebt6q7sm8vde172pvlsh5e3mp.apps.googleusercontent.com'); // ← buraya kendi Client ID'ni yaz

app.get('/get-user', (req, res) => {
  const username = req.query.username;
  const filePath = path.join(__dirname, '../data/users.json');

  let users = [];
  
  try {
const raw = fs.readFileSync(filePath, 'utf-8');
    users = JSON.parse(raw);
  } catch (err) {
    console.error('[SERVER] /get-user JSON parse hatası:', err.message);
    return res.status(500).json({ error: 'Kullanıcı verileri bozuk veya okunamadı' });
  }
    const user = users.find(u => u.username === username);

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    res.json(user);
});
function checkGamesData() {
  games.forEach(game => {
    if (!game.gameId && !game.id) {
      console.warn('[DEBUG] ID yok oyun objesi:', game);
    }
    if (!game.phase || !game.status) {
      console.warn(`[DEBUG] Eksik durum alanı → gameId: ${game.gameId || game.id}, phase: ${game.phase}, status: ${game.status}`);
    }
  });
}
app.get('/get-active-games', (req, res) => {
  const username = req.query.username?.toLowerCase();
  checkGamesData();
  
  if (!username) {
    return res.status(400).json({ error: 'Kullanıcı adı eksik.' });
  }
  const activeGames = games.filter(game => game.phase !== 'finished' && game.phase !== 'ended' && game.status !== 'finished');

  const active = [];
  console.log('[DEBUG] Tüm oyunlar durumu:');
  activeGames.forEach(game => {
    console.log(`gameId: ${game.gameId || game.id}, phase: ${game.phase}, status: ${game.status}`);
    const players = game.players || [];
    const me = players.find(p => p.username?.toLowerCase() === username);
    const opponent = players.find(p => p.username?.toLowerCase() !== username);

    if (!me || !opponent) return;

    console.log(`[ACTIVE GAMES LOG] gameId: ${game.gameId || game.id}`);
  console.log(`  phase: ${game.phase}, status: ${game.status}`);
  console.log(`  players: ${players.map(p => p.username).join(', ')}`);
  console.log(`  scores: me(${me.username}): ${me.score}, opponent(${opponent.username}): ${opponent.score}`);
  console.log(`  turn info: isMyTurn: ${me.myTurn}, turnPhase: ${me.turnPhase}`);

  players.forEach(player => {
    console.log(`[AVATAR KONTROL] GameID: ${game.gameId || game.id}, Player: ${player.username}, Avatar: ${player.profileImage}`);
  });
  active.push({
      gameId: game.gameId || game.id,
      opponent: opponent.username,
      opponentImage: opponent.profileImage || `https://i.pravatar.cc/100?u=${opponent.username}`,
      myScore: me.score,
      opponentScore: opponent.score,
      isMyTurn: me.myTurn,
      turnPhase: me.turnPhase,
      remainingTime:
        me.turnStartTime && me.turnDuration
          ? Math.max(0, me.turnDuration - (Date.now() - me.turnStartTime))
          : null,
      board: me.board,
      status: game.status,
      phase: game.phase
    });
    console.log(`[GET-ACTIVE-GAMES] gameId: ${game.gameId || game.id}, opponentImage: ${opponent.profileImage}`);
  });
  
  res.json(active);
});


app.get('/get-games', (req, res) => {
  const username = req.query.username;
  const gamesPath = path.join(__dirname, '../data/games.json');

  if (!username) {
    return res.status(400).json({ error: 'Kullanıcı adı eksik.' });
  }

  fs.readFile(gamesPath, 'utf-8', (err, json) => {
    if (err) {
      console.error('[SERVER] games.json okunamadı:', err);
      return res.status(500).json({ error: 'Sunucu hatası.' });
    }

    try {
      const allGames = JSON.parse(json);
const userGames = allGames.filter(game =>
  game.players?.some(p => p.username?.toLowerCase() === username.toLowerCase())
);

      res.json(userGames);
    } catch (e) {
      console.error('[SERVER] games.json parse hatası:', e);
      res.status(500).json({ error: 'Veri hatası.' });
    }
  });
});

app.get('/get-finished-games', (req, res) => {
  const username = req.query.username?.toLowerCase();
  console.log('[DEBUG][FINISHED GAMES] username sorgusu:', username);

  const filePath = path.join(__dirname, '../data/finishedGames.json');

  if (!username) {
    return res.status(400).json({ error: 'Kullanıcı adı eksik.' });
  }

  fs.readFile(filePath, 'utf-8', (err, content) => {
    if (err) {
      console.error('[SERVER] finishedGames.json okunamadı:', err.message);
      return res.status(500).json({ error: 'Sunucu hatası.' });
    }


    let allGames = [];
    
    try {
      allGames = JSON.parse(content);
      console.log('[DEBUG][FINISHED GAMES] finishedGames.json toplam oyun:', allGames.length);
    } catch (e) {
      console.error('[SERVER] finishedGames.json parse hatası:', e.message);
      return res.status(500).json({ error: 'Veri hatası.' });
    }

    const userGames = allGames.filter(game =>
  game.players.map(p => p.toLowerCase()).includes(username?.toLowerCase())
);
console.log('[DEBUG][FINISHED GAMES] Kullanıcıya ait oyunlar:', userGames.length);


    res.json(userGames.slice(-10));
  });
});


app.post('/google-login', async (req, res) => {
  const { token } = req.body; // access_token geldi

  try {
    const googleUserResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const userData = await googleUserResponse.json();

    if (!userData || !userData.email) {
      throw new Error('Kullanıcı verisi alınamadı');
    }

    console.log('✅ Giriş başarılı:', userData.email);
    res.json({ success: true, email: userData.email });
  } catch (err) {
    console.error('❌ Google kullanıcı bilgisi alınamadı:', err);
    res.status(401).json({ success: false });
  }
});

app.post('/facebook-login', (req, res) => {
    const { id, name, email } = req.body;

    if (!id || !name || !email) {
        console.warn('❌ Eksik Facebook verisi alındı:', req.body);
        return res.status(400).json({ success: false, message: 'Eksik veri' });
    }
    console.log('📩 Facebook kullanıcı bilgisi alındı:');
    console.log('ID:', id);
    console.log('İsim:', name);
    console.log('Email:', email);
    console.log(`✅ Facebook giriş: ${name} (${email})`);
    res.json({ success: true });
});

app.post('/register', (req, res) => {
  const username = req.body.username?.trim().toLowerCase();
const password = req.body.password;

  const usersPath = path.join(__dirname, '../data/users.json');

  if (!username) {
    return res.status(400).json({ message: 'Kullanıcı adı zorunludur.' });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ message: 'Geçerli bir şifre zorunludur.' });
  }

  fs.readFile(usersPath, 'utf-8', (err, data) => {
    if (err) {
      console.error('[SERVER] Kullanıcı verisi okunamadı:', err);
      return res.status(500).json({ message: 'Sunucu hatası' });
    }

    let users = [];
    try {
      users = JSON.parse(data);
    } catch (parseErr) {
      console.error('[SERVER] users.json parse hatası:', parseErr);
      return res.status(500).json({ message: 'Veri okunamadı' });
    }

    const existing = users.find(u => u.username.toLowerCase() === username);

    if (existing) {
      return res.status(409).json({ message: 'Kullanıcı adı zaten kayıtlı.' });
    }
const newUser = {
      username: username.toLowerCase(),
      password,
      profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random&bold=true`,
      stats: { wins: 0, losses: 0 }
    };

    if (typeof newUser.username === 'string' && typeof newUser.password === 'string') {
      users.push(newUser);
    } else {
      console.warn('[SERVER] ❌ Geçersiz kullanıcı objesi push edilmek isteniyor:', newUser);
      return res.status(400).json({ message: 'Kayıt verisi geçersiz.' });
    }

    safeWriteJSON(usersPath, users, (writeErr) => {
      if (writeErr) {
        console.error('[SERVER] Kullanıcı yazılamadı:', writeErr);
        return res.status(500).json({ message: 'Kayıt yapılamadı' });
      }

      console.log(`[SERVER] ✅ Kayıt tamamlandı: ${username}`);
      return res.status(201).json({ username });
    });
  });
});

app.use(express.static(path.join(__dirname, '../public')));

app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads/avatars')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// users.json dosyasının yolu
const usersPath = path.join(__dirname, '../data/users.json');

let dictionary = new Set();
try {
    const data = fs.readFileSync(path.join(__dirname, '../data/dictionary.json'), 'utf-8');
    dictionary = new Set(JSON.parse(data).map(word => word.toLocaleLowerCase('tr-TR')));
    console.log(`[SERVER] Sözlükte ${dictionary.size} kelime yüklendi.`);
} catch (err) {
    console.error('[SERVER ERROR] dictionary.json yüklenemedi. Lütfen data/dictionary.json dosyasının varlığını ve formatını kontrol edin:', err);
}

let waitingPlayer = null;

const OPPONENT_LETTER_TURN_TIME_MS = 20 * 1000;
const OWN_LETTER_TURN_TIME_MS = 30 * 1000;
const MAX_CONSECUTIVE_TIMEOUTS = 2;

function createNewPlayer(ws) {
  return {
    username: ws.username,
    ws,
    board: Array.from({ length: 5 }, () => Array(5).fill('')),
    score: 0,
    letterToPlace: null,
    myTurn: false,
    opponent: null,
    movesMade: 0,
    turnStartTime: 0,
    turnDuration: 0,
    turnPhase: null,
    tempLetterPlacement: null,
    consecutiveTimeouts: 0,
    gameId: null,
    lastSentLetter: null
  };
}

function sendScoresToAllPlayers(player1, player2) {
    if (!player1 || !player2 || player1.readyState !== WebSocket.OPEN || player2.readyState !== WebSocket.OPEN) {
        console.warn("[SERVER] Tüm oyuncular bağlı değil veya bağlantı açık değil, skorlar gönderilemiyor.");
        return;
    }

    player1.ws.send(JSON.stringify({
        type: 'updateScores',
        playerScore: player1.score, 
        opponentScore: player2.score 
    }));

    player2.ws.send(JSON.stringify({
        type: 'updateScores',
        playerScore: player2.score, 
        opponentScore: player1.score 
    }));
}

const sendTurnInfo = (player) => {
  console.log('[RECONNECT DEBUG] sendTurnInfo çağrıldı');
console.log('[RECONNECT DEBUG] player.username:', player.username);
console.log('[RECONNECT DEBUG] player.letterToPlace:', player.letterToPlace);
console.log('[RECONNECT DEBUG] player.turnPhase:', player.turnPhase);
console.log('[RECONNECT DEBUG] player.myTurn:', player.myTurn);

  if (!player.ws) {
    console.error('[ERROR] sendTurnInfo: player.ws tanımsız!');
    return;
  }

  if (player.ws.readyState !== WebSocket.OPEN) {
    console.error('[ERROR] sendTurnInfo: player.ws kapalı!');
    return;
  }
  
  
  if (player.disconnected) {
    console.log(`[SERVER] ${player.username} disconnected, turn mesajı gönderilmiyor.`);
    return;
  }
const remainingTime = player.turnStartTime && player.turnDuration 
  ? Math.max(0, player.turnDuration - (Date.now() - player.turnStartTime)) 
  : 0;
  
const letterToPlaceToSend = player.letterToPlace || null; 

player.ws.send(JSON.stringify({
  type: 'turn',
  yourTurn: player.myTurn,
  letterToPlace: player.letterToPlace,
  turnDuration: player.turnDuration,
  remainingTime: remainingTime
}));
console.log('[DEBUG] sendTurnInfo gönderildi:', player.username);
};

const handleTurnTimeout = (player, player1, player2) => {
  clearTurnTimer(player);

  const phase = player.turnPhase;
  console.log(`[SERVER] ⏰ Süre doldu. Phase: ${phase}`);

  let moveLost = false; 

  if (phase === 'opponentLetterPlacement') {
    if (player.letterToPlace !== null) { 
      player.ws.send(JSON.stringify({ type: 'status', message: 'Süren doldu, rakibin harfini yerleştiremedin. Hamle yandı!' }));
      player.ws.send(JSON.stringify({
        type: 'removeOpponentLetterPrompt',
        letter: player.letterToPlace // Kaldırılacak harfi de gönderebiliriz
      }));    
      player.letterToPlace = null; 
      moveLost = true; 
    } 
    
    player.myTurn = true;
    player.opponent.myTurn = false;
    player.turnPhase = 'ownLetterPlacement';
    player.letterToPlace = null;
    
    sendTurnInfo(player);
    //startTurnTimer(player, OWN_LETTER_TURN_TIME_MS, 'ownLetterPlacement');
    if (typeof player.opponent.turnStartTime !== 'number') {
  player.opponent.turnStartTime = Date.now();
  player.opponent.turnDuration = 6 * 60 * 60 * 1000;
}
    player.opponent.turnPhase = 'opponentLetterPlacement';
    sendTurnInfo(player.opponent);

  } else if (phase === 'ownLetterPlacement') {
    if (player.tempLetterPlacement && player.tempLetterPlacement.letter !== '') { 
    const { letter, row, col } = player.tempLetterPlacement;
            
    player.board[row][col] = letter;
    player.opponent.letterToPlace = letter;
    player.lastSentLetter = letter; 
    player.movesMade++;
    player.consecutiveTimeouts = 0;
    player.opponent.letterToPlace = letter;
        
    player.opponent.ws.send(JSON.stringify({
      type: 'promptOpponentLetter',
      letter: letter,
    }));
        
    player.ws.send(JSON.stringify({ type: 'boardState', board: player.board })); 
    player.ws.send(JSON.stringify({ type: 'status', message: 'Süren doldu, harfin otomatik olarak kesinleşti!' }));
            
    const currentScoreResult = calculateScore(player.board);
    player.score = currentScoreResult.totalScore;
    sendScoresToAllPlayers(player1, player2);

    } else {
    player.ws.send(JSON.stringify({ type: 'status', message: 'Süren doldu, harf girmediğin için hamlen yandı!' }));
    moveLost = true; 
    }
            
    player.myTurn = false;
    player.opponent.myTurn = true;
    player.turnPhase = 'opponentLetterPlacement';
    player.letterToPlace = null;
    player.opponent.letterToPlace = null;
    player.tempLetterPlacement = null;

    sendTurnInfo(player.opponent);
    startTurnTimer(player.opponent, OPPONENT_LETTER_TURN_TIME_MS, 'opponentLetterPlacement');

    } else {
      console.log(`[SERVER] ⏰ Süresi dolan oyuncu ${player === player1 ? '1' : '2'} kendi sırasında değildi. Normal akış devam.`);
    }

    if (moveLost) {
      player.consecutiveTimeouts++; // Hamle kaybedildiği için ardışık timeout'ı artır
    }
    
    if (player1.consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS && player2.consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
        console.log("[SERVER] 🚨 Her iki oyuncu da ardışık sürelerini doldurdu. Oyun otomatik olarak sonlandırılıyor.");
        endGame(player1, player2);
        return; 
    }
    const gameId = player.gameId;
const game = games.find(g => g.gameId === gameId || g.id === gameId);



if (game) {
  game.currentTurn = player.opponent.myTurn ? player.opponent.username : player.username;
  saveGamesToDisk();
}

    
    player.ws.send(JSON.stringify({
        type: 'turn',
        yourTurn: false, 
        letterToPlace: null, 
        turnDuration: 0,
        remainingTime: 0,
        message: 'Süren doldu, sıra rakibe geçti.' 
    }));

    if (moveLost) {
    player.ws.send(JSON.stringify({ type: 'removeOpponentLetterPrompt', letter: player.letterToPlace })); // Rakip harfi bekliyorsa UI'dan kaldır
    }

    const isGameOver = checkGameOver(player, player.opponent); 
    if (isGameOver) return;
};

const checkBoardFull = (board) => {
  return board.flat().every(cell => typeof cell === 'string' && cell.trim() !== '');
};

const calculateScore = (board) => {
  const getWordScore = (word) => {
    const len = word.length;
    if (len < 2) return 0;
    if (len === 5) return 7;
    return len;
  };

  const extractMaxScoringWords = (line, lineType, lineIndex) => {
    const candidates = [];

     for (let start = 0; start < line.length; start++) {
      for (let end = start + 2; end <= line.length; end++) {
        const subWord = line.substring(start, end).toLocaleLowerCase('tr-TR');
        if (dictionary.has(subWord)) {
          candidates.push({
            word: subWord,
            start,
            end,
            score: getWordScore(subWord),
            type: `${lineType} ${lineIndex + 1} (${start + 1}-${end})`
          });
        }
      }
    }
    
    const getNonOverlappingCombos = (words, start = 0, used = []) => {
     const results = [];

     for (let i = start; i < words.length; i++) {
      const current = words[i];
      const overlap = used.some(u => !(u.end <= current.start || u.start >= current.end));
      if (!overlap) {
       results.push(...getNonOverlappingCombos(words, i + 1, [...used, current]));
      }
     }

    results.push(used); // mevcut kombinasyonu da dahil et
    return results;
    };

    const allCombos = getNonOverlappingCombos(candidates);
    let bestCombo = [];
    let maxScore = 0;

    for (const combo of allCombos) {
      const score = combo.reduce((sum, w) => sum + w.score, 0);
      if (score > maxScore) {
        maxScore = score;
        bestCombo = combo;
      }
    }

    return bestCombo;
};

  let totalScore = 0;
  const scoreDetails = [];

  for (let i = 0; i < 5; i++) {
    const rowString = board[i].join('');
    const rowWords = extractMaxScoringWords(rowString, 'satır', i);
    rowWords.forEach(obj => {
      totalScore += obj.score;
      scoreDetails.push(obj);
    });
  }

  for (let j = 0; j < 5; j++) {
    let colString = '';
    for (let i = 0; i < 5; i++) {
      colString += board[i][j];
    }
    const colWords = extractMaxScoringWords(colString, 'sütun', j);
    colWords.forEach(obj => {
      totalScore += obj.score;
      scoreDetails.push(obj);
    });
  }

  return { totalScore, details: scoreDetails };
};

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
          ${cell}
        </div>
      `).join('')}
    </div>
  `).join('');
};

const endGame = (player1, player2, gameId) => {
  if (!gameId) {
    gameId = player1.gameId || player2.gameId;
  }
const game = games.find(g => g.gameId === gameId || g.id === gameId);

console.log('[ENDGAME] Güncellenecek oyun:', game);  // <- BURAYA EKLE

  if (game) {
    game.phase = 'finished';
    game.status = 'finished';
    console.log(`[ENDGAME] game.phase güncellendi: gameId=${game.gameId}, phase=${game.phase}`);
  } else {
    console.log('[ENDGAME] game bulunamadı:', gameId);
  }

console.log('[FORFEIT][ENDGAME] game.id:', gameId);
console.log('[FORFEIT][ENDGAME] forfeitingPlayer:', player1?.username);
console.log('[FORFEIT][ENDGAME] Rakip:', player2?.username);
console.log('[FORFEIT][ENDGAME] Rakip WS:', player2?.ws?.readyState);
console.log('[FORFEIT][ENDGAME] game.players:', game?.players?.map(p => p.username));

  if (!player1?.ws || player1.ws.readyState !== WebSocket.OPEN) {
  console.warn(`[endGame] ⚠️ player1.ws geçersiz: ${player1?.username}`);
}
if (!player2?.ws || player2.ws.readyState !== WebSocket.OPEN) {
  console.warn(`[endGame] ⚠️ player2.ws geçersiz: ${player2?.username}`);
}

  clearTurnTimer(player1);
  clearTurnTimer(player2);

  player1.consecutiveTimeouts = 0;
  player2.consecutiveTimeouts = 0;
  player1.gameInProgress = false;
  player2.gameInProgress = false;

  const result1 = calculateScore(player1.board);
  const result2 = calculateScore(player2.board);

  const snapshotBoard1 = JSON.parse(JSON.stringify(player1.board));
  const snapshotBoard2 = JSON.parse(JSON.stringify(player2.board));


  const player1BoardHTML = generateBoardHTML(snapshotBoard1);
  const player2BoardHTML = generateBoardHTML(snapshotBoard2);


  const generateUniqueId = () => {
  return 'game_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  };
  
  
  saveGameResult(player1.username, result1.totalScore, result1.totalScore > result2.totalScore, player2.username, gameId);
  setTimeout(() => {
  saveGameResult(player2.username, result2.totalScore, result2.totalScore > result1.totalScore, player1.username, gameId);
  }, 100);

  player1.movesMade = 0;
  player2.movesMade = 0;
  player1.finalTurnTriggered = false;
  player2.finalTurnTriggered = false;
  player1.myTurn = false;
  player2.myTurn = false;
  player1.letterToPlace = null;
  player2.letterToPlace = null;

  const gameOverMessageForplayer1 = { // Yeni bir değişken oluştur
    type: 'gameOver',
    playerScore: result1.totalScore,
    opponentScore: result2.totalScore,
    playerDetails: result1.details,
    opponentDetails: result2.details,
    playerBoardHTML: player1BoardHTML,
    opponentBoardHTML: player2BoardHTML,
    username: player1.username,
    opponentUsername: player2.username // player2'nin kullanıcı adı
  };
  
  player1.ws.send(JSON.stringify(gameOverMessageForplayer1));
  
  const gameOverMessageForplayer2 = {
    type: 'gameOver',
    playerScore: result2.totalScore,
    opponentScore: result1.totalScore,
    playerDetails: result2.details,
    opponentDetails: result1.details,
    playerBoardHTML: player2BoardHTML,
    opponentBoardHTML: player1BoardHTML,
    username: player2.username,
    opponentUsername: player1.username
  };
  
    player2.ws.send(JSON.stringify(gameOverMessageForplayer2));
    const winner =
  player1.score > player2.score
    ? player1.username
    : player2.score > player1.score
    ? player2.username
    : null; // beraberlik

const finishedGame = {
  gameId: player1.gameId,
  players: [player1.username, player2.username],
  boardStates: games[player1.gameId]?.boardStates || {},
  finalScores: {
    [player1.username]: player1.score,
    [player2.username]: player2.score,
  },
  playerDetails: {
    [player1.username]: result1.details,
    [player2.username]: result2.details
  },
  playerBoards: {
  [player1.username]: snapshotBoard1,
  [player2.username]: snapshotBoard2
  },
  endedAt: Date.now(),
  winner,
  startTime: game?.startTime || null,
  totalTurns: game?.totalTurns || null
};

fs.readFile(finishedGamesPath, 'utf-8', (err, content) => {
  let existing = [];
  if (!err) {
    try {
      existing = JSON.parse(content);
    } catch (e) {
      console.error('[SERVER] finishedGames.json parse hatası:', e);
    }
  }

  existing.unshift(finishedGame);

if (existing.length > 100) {
  console.log(`[LIMIT] Bitmiş oyun limiti aşıldı. En eski oyunlar siliniyor. Önceki uzunluk: ${existing.length}`);
  existing.splice(100);
}

  fs.writeFile(
    finishedGamesPath,
    JSON.stringify(existing, null, 2),
    (err) => {
      if (err) console.error('[SERVER] finishedGames.json yazılamadı:', err);
      else console.log(`[SERVER] ✅ Oyun ${finishedGame.gameId} finishedGames.json dosyasına kaydedildi.`);
      const index = games.findIndex(g => g.gameId === gameId || g.id === gameId);
    if (index !== -1) {
  games[index].phase = 'finished';
  games[index].status = 'finished';
  console.log(`[ENDGAME] game.phase güncellendi: gameId=${games[index].gameId}, phase=${games[index].phase}`);
  
  games.splice(index, 1);
  console.log(`[ENDGAME] games dizisinden oyun silindi: ${gameId}`);
}
    }
  );
const game = games.find(g => g.gameId === gameId || g.id === gameId);

// Oyun objesi bulunduysa phase ve status güncelle
if (game) {
  game.phase = 'finished';
  game.status = 'finished'; 
  console.log(`[ENDGAME] game.phase güncellendi: gameId=${game.gameId}, phase=${game.phase}`);
} else {
  console.log('[ENDGAME] game bulunamadı:', gameId);
}


  saveGamesToDisk();
});

};

const startTurnTimer = (player, duration, turnPhase) => {
    clearTurnTimer(player);
    // Eğer turnStartTime hiç atanmadıysa (yeni turun başıysa), başlat
  if (typeof player.turnStartTime !== 'number') {
    player.turnStartTime = Date.now();
    player.turnDuration = duration;
  }

  player.turnPhase = turnPhase;

  const elapsed = Date.now() - player.turnStartTime;
  const remaining = Math.max(0, player.turnDuration - elapsed);

    sendTurnInfo(player);

    // ✅ timeout'u sadece kalan süreye göre ayarla
  player.turnTimeout = setTimeout(() => {
    // ✅ buradan sonra artık faz geçişi handleTurnTimeout içinde yapılmalı
    handleTurnTimeout(player, player, player.opponent);
  }, remaining);
  
};

const clearTurnTimer = (player) => {
  if (player.turnTimeout) {
    clearTimeout(player.turnTimeout);
    player.turnTimeout = null;
    //player.turnStartTime = null;
    //player.turnDuration = null;
  }
};
const checkGameOver = (playerWhoJustActed, opponentPlayer) => {
  console.log('[CHECKGAMEOVER] çağrıldı:', playerWhoJustActed.username);
  const fullMoverBoard = checkBoardFull(playerWhoJustActed.board);
  const fullOpponentBoard = checkBoardFull(opponentPlayer.board);

  if (
    playerWhoJustActed.isStartingPlayer && 
    playerWhoJustActed.movesMade >= 25 && 
    !opponentPlayer.finalTurnTriggered
  ) {
    opponentPlayer.finalTurnTriggered = true; 
    clearTurnTimer(playerWhoJustActed);
    clearTurnTimer(opponentPlayer); 
    playerWhoJustActed.myTurn = false;
    opponentPlayer.myTurn = true;
    opponentPlayer.letterToPlace = playerWhoJustActed.lastSentLetter;

    const finalTurnDuration = OPPONENT_LETTER_TURN_TIME_MS;
    sendTurnInfo(playerWhoJustActed); 
    sendTurnInfo(opponentPlayer);         
    startTurnTimer(opponentPlayer, OPPONENT_LETTER_TURN_TIME_MS, 'opponentLetterPlacement');
    return false; 
  }
    
  if (
    playerWhoJustActed.isStartingPlayer && 
    playerWhoJustActed.movesMade >= 25 && 
    opponentPlayer.finalTurnTriggered
  ) {
    endGame(playerWhoJustActed, opponentPlayer);
    return true; 
  }

  if (fullMoverBoard && fullOpponentBoard) {
    endGame(playerWhoJustActed, opponentPlayer);
    return true;
  }

  return false; // Oyun devam ediyor
};

function setupPlayerListeners(player1, player2) {
[player1, player2].forEach((player) => {
  if (!player || !player.ws) {
      console.warn('[Listeners] player.ws tanımsız, listener atanamadı.');
      return;
    }
player.ws.on('message', async (msg) => {
console.log('[SERVER] Yeni mesaj geldi:', msg.toString());
let data;
try {
  data = JSON.parse(msg);
} catch (e) {
    console.error('[WS][PARSE ERROR]', e, msg);
    return player.ws.send(JSON.stringify({ code: -32700, message: 'Parse error' }));
}

try{

if (data.type === 'reportScore') {
  (async () => {
    try {
      await updateUserStats(data.username, data.score, data.won);
    } catch (err) {
    console.error('[SERVER] ❌ updateUserStats hatası:', err);
    }
  })();
}
if (data.type === 'placeOpponentLetter') { 
    if (!player.myTurn || player.letterToPlace === null) {
      if (player?.ws?.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify({ type: 'status', message: 'Geçersiz hamle! Sıra sende değil veya yerleştirilecek harf yok.' }));
      return;
    }
  }
    clearTurnTimer(player); 
  
    const { row, col } = data;
    const letter = player.letterToPlace; 
  
    if (
      typeof row === 'number' && typeof col === 'number' &&
      row >= 0 && row < 5 && col >= 0 && col < 5 &&
      player.board[row][col] === '' 
    ) {
      player.board[row][col] = letter.toLocaleUpperCase('tr-TR');
      player.letterToPlace = null; 
      player.movesMade++; 
      player.consecutiveTimeouts = 0;
      player.consecutiveTimeouts = 0; 
                       
      const currentScoreResult = calculateScore(player.board);
      player.score = currentScoreResult.totalScore; 
      sendScoresToAllPlayers(player1, player2); 
if (player?.ws?.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify({ type: 'boardState', board: player.board }));
} else {
  console.warn('[WARN] player.ws boardState gönderilemedi:', player?.username);
}
if (player?.ws?.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify({
        type: 'updateScores', 
        playerScore: player.score,
        opponentScore: player.opponent.score 
      }));
      } else {
  console.warn('[WARN] player.ws updateScores gönderilemedi:', player?.username);
}
if (player?.opponent?.ws?.readyState === WebSocket.OPEN) {
      player.opponent.ws.send(JSON.stringify({ 
        type: 'updateScores',
        playerScore: player.opponent.score,
        opponentScore: player.score
      }));
      } else {
  console.warn('[WARN] opponent.ws updateScores gönderilemedi:', player?.opponent?.username);
}
      saveGamesToDisk();

      const isGameOver = checkGameOver(player, player.opponent);
      if (isGameOver) {
      return;
      }

      player.myTurn = true;
      player.opponent.myTurn = false;
      player.letterToPlace = null;
                       
      const gameId = player.gameId;
const game = games.find(g => g.gameId === gameId || g.id === gameId);


if (game) {
  game.currentTurn = player.opponent.myTurn ? player.opponent.username : player.username;
}

if (player?.opponent?.ws?.readyState === WebSocket.OPEN) {
    player.opponent.ws.send(JSON.stringify({
      type: 'turn',
      yourTurn: false,
      letterToPlace: null,
      turnDuration: 0,
      remainingTime: 0,
      message: 'Rakibin harfini yerleştirdin, sıra tekrar sende.' 
    }));
    } else {
  console.warn('[WARN] opponent.ws turn mesajı gönderilemedi:', player?.opponent?.username);
}
    player.turnPhase = 'ownLetterPlacement';
    sendTurnInfo(player); 
    //startTurnTimer(player, OWN_LETTER_TURN_TIME_MS, 'ownLetterPlacement');

  } else {
    if (!(player?.ws?.readyState === WebSocket.OPEN)) {
  console.warn('[WARN] player.ws status gönderilemedi');
}
    player.ws.send(JSON.stringify({ 
      type: 'status', 
      message: 'Geçersiz konum! Bu hücre dolu veya geçersiz.' 
    }));
    sendTurnInfo(player);
    //startTurnTimer(player, OWN_LETTER_TURN_TIME_MS - (Date.now() - player.turnStartTime), 'ownLetterPlacement');
  }
}
else if (data.type === 'updateOwnLetterPlacement') { 
      if (!player.myTurn || player.letterToPlace !== null) { 
        if (player?.ws?.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify({ type: 'status', message: 'Geçersiz hamle! Sıra sende değil veya rakip harf bekliyorsun.' }));
        return;
      }}

    const { letter, row, col, oldRow, oldCol } = data; 
      if (player.tempLetterPlacement && 
       (player.tempLetterPlacement.row !== row || player.tempLetterPlacement.col !== col)) {
                    
         if (player.board[player.tempLetterPlacement.row][player.tempLetterPlacement.col] === '') {
          if (player?.opponent?.ws?.readyState === WebSocket.OPEN) {
            player.opponent.ws.send(JSON.stringify({
            type: 'opponentPlacedLetter',
            letter: '', 
            row: player.tempLetterPlacement.row,
            col: player.tempLetterPlacement.col
         }));
       } else {
    console.warn('[WARN] opponent.ws mesaj gönderilemedi: opponentPlacedLetter', player?.opponent?.username);
  }
  }}
                    
      if (letter === '') {
        if (player.tempLetterPlacement && 
          player.tempLetterPlacement.row === row && player.tempLetterPlacement.col === col) { 
                     
          player.tempLetterPlacement = null; 
          if (player?.opponent?.ws?.readyState === WebSocket.OPEN) {
          player.opponent.ws.send(JSON.stringify({
            type: 'opponentPlacedLetter',
            letter: '', 
            row: row,
            col: col
          }));
      } else {
      console.warn('[WARN] opponent.ws mesaj gönderilemedi: opponentPlacedLetter', player?.opponent?.username);
    }
  } 
} else { 
      if (player.board[row][col] === '') {
          player.tempLetterPlacement = { letter: letter.toLocaleUpperCase('tr-TR'), row, col };
          
          if (player.opponent?.ws?.readyState === WebSocket.OPEN) {  
          player.opponent.ws.send(JSON.stringify({
            type: 'turn',
            yourTurn: true,
            letterToPlace: letter.toLocaleUpperCase('tr-TR'),
            turnDuration: 30000,
            remainingTime: 30000
          }));
      } else {
    console.warn('[WARN] Rakip ws tanımsız veya kapalı:', player.opponent?.username);
  }
  saveGamesToDisk();
} else {
  if (player?.ws?.readyState === WebSocket.OPEN) {
          player.ws.send(JSON.stringify({type: 'status', message: 'Bu hücre dolu, başka bir hücreye taşı veya sil.'}));
  }
          const elapsedTime = Date.now() - player.turnStartTime;
          const remaining = player.turnDuration - elapsedTime;
          startTurnTimer(player, Math.max(0, remaining), 'opponentLetterPlacement');
          return; 
          }
        }
   if (player?.ws?.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify({ type: 'boardState', board: player.board }));
      }

        if (player?.opponent?.inBackground && player?.opponent?.ws?.readyState === WebSocket.OPEN) {
        
          player.opponent.ws.send(JSON.stringify({
          type: 'status',
          message: 'Devam eden oyunda rakibin hamlesi geldi!'
        }));
  }
}
else if (data.type === 'placeOwnLetter') { 

const gameId = player.gameId;
const game = games.find(g => g.gameId === gameId || g.id === gameId);


if (!game) {
  console.warn('[PLACE_OWN_LETTER] Oyuncuya ait oyun games içinde bulunamadı.');
  return;
}
if (!player?.opponent) {
  console.error('[TURN ERROR] player.opponent yok:', player?.username);
  return;
}
game.currentTurn = player.opponent.username;
game.phase = 'opponentLetterPlacement';

        if (!player.myTurn || player.letterToPlace !== null || !player.tempLetterPlacement || player.tempLetterPlacement.letter === '') {
         if (player?.ws?.readyState === WebSocket.OPEN) {
          player.ws.send(JSON.stringify({ type: 'status', message: 'Hamle Süreniz Doldu!' }));
         } else {
    console.warn('[WARN] player.ws mesaj gönderilemedi: Hamle Süreniz Doldu!', player?.username);
  }

         const elapsedTime = Date.now() - player.turnStartTime;
         const remaining = player.turnDuration - elapsedTime;
         startTurnTimer(player, Math.max(0, remaining), 'opponentLetterPlacement');
         return;
        }
        clearTurnTimer(player); 
        const { letter, row, col } = player.tempLetterPlacement; 
        const forbiddenLetters = ['x', 'w', 'q'];

if (forbiddenLetters.includes(letter.toLowerCase())) {
  if (player?.ws?.readyState === WebSocket.OPEN) {
  player.ws.send(JSON.stringify({
    type: 'status',
    message: 'Bu harf kullanılamaz. Lütfen geçerli bir harf seçin.'
  }));
  } else {
    console.warn('[WARN] player.ws mesaj gönderilemedi: geçersiz harf', player?.username, letter);
  }
  player.tempLetterPlacement = null; // Seçimi temizle
  startTurnTimer(player, player.turnDuration, 'ownLetterPlacement'); // Timer'ı yeniden başlat
  return; // Hamleyi iptal et
}

        if (player.board[row][col] === '') {
          player.board[row][col] = letter; 
                       
          player.consecutiveTimeouts = 0;
                       
          if (player.opponent.ws && player.opponent.ws.readyState === WebSocket.OPEN) {
  player.opponent.ws.send(JSON.stringify({
            type: 'opponentPlacedLetter', 
            letter: letter, 
            row,
            col
          }));
          } else {
  console.warn(`[SEND] player.opponent.ws not open for ${player.opponent.username}`);
}
if (player.ws && player.ws.readyState === WebSocket.OPEN) {
          player.ws.send(JSON.stringify({ type: 'boardState', board: player.board }));
} else {
  console.warn(`[SEND] player.ws not open for ${player.username}`);
}
          player.myTurn = false;
          player.opponent.myTurn = true;
          player.opponent.letterToPlace = letter; 
          player.lastSentLetter = letter; 
          player.tempLetterPlacement = null; 
          player.movesMade++; 
          player.consecutiveTimeouts = 0; 

          const currentScoreResult = calculateScore(player.board);
          player.score = currentScoreResult.totalScore; 
          sendScoresToAllPlayers(player1, player2);

          saveGamesToDisk();
          
          const isGameOver = checkGameOver(player, player.opponent);
          if (!isGameOver) {
            if (player?.ws?.readyState === WebSocket.OPEN) {
          player.ws.send(JSON.stringify({
            type: 'updateScores',
            playerScore: player.score,
            opponentScore: player.opponent.score
          }));
          } else {
    console.warn(`[SEND] player.ws not open for ${player.username}`);
  }
if (player?.opponent?.ws?.readyState === WebSocket.OPEN) {
          player.opponent.ws.send(JSON.stringify({
            type: 'updateScores',
            playerScore: player.opponent.score,
            opponentScore: player.score
          }));
          } else {
    console.warn(`[SEND] player.opponent.ws not open for ${player.opponent?.username}`);
  }
  if (player?.ws?.readyState === WebSocket.OPEN) {
          player.ws.send(JSON.stringify({ 
            type: 'turn', 
            yourTurn: false, 
            letterToPlace: null, 
            turnDuration: 0, 
            remainingTime: 0,
            message: 'Hamlen tamamlandı, sıra rakibe geçti.'
          }));
          } else {
    console.warn(`[SEND] player.ws not open for ${player.username}`);
  }
          sendTurnInfo(player.opponent);
          //startTurnTimer(player.opponent, OPPONENT_LETTER_TURN_TIME_MS, 'opponentLetterPlacement');
          player.opponent.turnStartTime = Date.now();
          player.opponent.turnDuration = 6 * 60 * 60 * 1000;
          player.opponent.turnPhase = 'opponentLetterPlacement';
          
                    // 👇 BURAYA EKLE
console.log('[DEBUG][SEND_TURN_INFO]', {
  to: player.opponent.username,
  myTurn: player.opponent.myTurn,
  letterToPlace: player.opponent.letterToPlace,
  turnDuration: player.opponent.turnDuration,
  turnStartTime: player.opponent.turnStartTime
});
         sendTurnInfo(player.opponent);

          if (player.opponent && player.opponent.inBackground) {
          player.opponent.ws.send(JSON.stringify({
            type: 'status',
            message: 'Sıra sende! Rakibin hamlesini yaptı.'
          }));
        }
      }
    } else {
          player.ws.send(JSON.stringify({type: 'status', message: 'Geçersiz hamle! Hedef hücre dolu.'}));
          const elapsedTime = Date.now() - player.turnStartTime;
          const remaining = player.turnDuration - elapsedTime;
          startTurnTimer(player, Math.max(0, remaining), 'ownLetterPlacement');
        }
}
await handleRPC(data, player.ws);
} catch (err) {
  console.error('[WS][RPC ERROR]', err);
  if (player?.ws?.readyState === WebSocket.OPEN) {
  player.ws.send(JSON.stringify({ code: -32603, message: 'Internal JSON-RPC error', details: err.message }));
  }
}
  console.log('[WS] Gelen mesaj işleniyor:', data);
  });

player.ws.on('close', () => {
    console.log('[SERVER] Bir oyuncu bağlantıyı kesti.');
      clearTurnTimer(player);
      if (player.tempLetterPlacement && player.opponent?.ws?.readyState === WebSocket.OPEN) {
      
        player.opponent.ws.send(JSON.stringify({
        type: 'opponentPlacedLetter',
        letter: '', 
        row: player.tempLetterPlacement.row,
        col: player.tempLetterPlacement.col
      }));
      } else if (player.tempLetterPlacement) {
  console.warn('[SEND] player.opponent.ws kapalı veya tanımsız, mesaj gönderilemedi');

    }
      player.tempLetterPlacement = null; 
      if (player.opponent?.ws?.readyState === WebSocket.OPEN) {
       player.opponent.ws.send(JSON.stringify({ type: 'status', message: 'Rakibin oyundan ayrıldı. Yeni bir oyun başlatmak için sayfayı yenile.' }));
       clearTurnTimer(player.opponent); 
       player.opponent.ws.close(); 
      } else {
  console.warn('[SEND] player.opponent.ws kapalı veya tanımsız, mesaj gönderilemedi');
}
      if (waitingPlayer === player) {
       waitingPlayer = null;
      }
      });
});

}
// 🔹 handleRPC buraya geliyor
async function handleRPC(data, ws) {
  if (data.type === 'startGame') {
    await startGame(data, ws);
  } else if (data.type === 'login') {
    await loginUser(data, ws);
  }
}

function setupListenersForPlayer(player) {
  if (!player || !player.ws) return;

  player.ws.on('message', (msg) => {
    console.log('[SERVER][RECEIVED]', msg);

   let data;
  try {
    data = JSON.parse(msg);
  } catch (err) {
    console.error('[SERVER] ❌ Geçersiz JSON alındı:', msg, err);
    return; // hatalı mesaj işlenmez
  }

  console.log('[SERVER] Gelen mesaj:', data);

    if (data.type === 'reportScore') {
      (async () => {
        try {
          await updateUserStats(data.username, data.score, data.won);
        } catch (err) {
          console.error('[SERVER] ❌ updateUserStats hatası:', err);
        }
      })();
    }

    else if (data.type === 'placeOpponentLetter') {
      if (!player.myTurn || player.letterToPlace === null) {
        try {
    player.ws.send(JSON.stringify({
      type: 'status',
      message: 'Geçersiz hamle! Sıra sende değil veya yerleştirilecek harf yok.'
    }));
    console.log('[SERVER] Geçersiz hamle mesajı gönderildi:', player.username);
  } catch (err) {
    console.error('[SERVER] ❌ player.ws.send hatası:', err, player.username);
  }
  return;
}

      clearTurnTimer(player);
      const { row, col } = data;
      const letter = player.letterToPlace;

      if (
        typeof row === 'number' && typeof col === 'number' &&
        row >= 0 && row < 5 && col >= 0 && col < 5 &&
        player.board[row][col] === ''
      ) {
        player.board[row][col] = letter.toLocaleUpperCase('tr-TR');
        player.letterToPlace = null;
        player.movesMade++;
        player.consecutiveTimeouts = 0;

        const currentScoreResult = calculateScore(player.board);
        player.score = currentScoreResult.totalScore;
        sendScoresToAllPlayers(player, player.opponent);

        try {
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify({ type: 'boardState', board: player.board }));

        player.ws.send(JSON.stringify({
          type: 'updateScores',
          playerScore: player.score,
          opponentScore: player.opponent.score
        }));}
  } catch (err) {
    console.error('[SERVER] ❌ player.ws.send hatası:', err, player.username);
  }
try {
    if (player.opponent?.ws && player.opponent.ws.readyState === WebSocket.OPEN) {
        player.opponent.ws.send(JSON.stringify({
          type: 'updateScores',
          playerScore: player.opponent.score,
          opponentScore: player.score
        }));
}
  } catch (err) {
    console.error('[SERVER] ❌ player.opponent.ws.send hatası:', err, player.opponent?.username);
  }
        const isGameOver = checkGameOver(player, player.opponent);
        if (isGameOver) return;

        player.myTurn = true;
        player.opponent.myTurn = false;
        player.letterToPlace = null;

        const gameId = player.gameId;
        const game = games.find(g => g.gameId === gameId || g.id === gameId);


        if (game) {
          game.currentTurn = player.opponent.myTurn ? player.opponent.username : player.username;
        }

        try {
    if (player.opponent?.ws && player.opponent.ws.readyState === WebSocket.OPEN) {
        player.opponent.ws.send(JSON.stringify({
          type: 'turn',
          yourTurn: false,
          letterToPlace: null,
          turnDuration: 0,
          remainingTime: 0,
          message: 'Rakibin harfini yerleştirdin, sıra tekrar sende.'
        }));
}
  } catch (err) {
    console.error('[SERVER] ❌ player.opponent.ws.send hatası:', err, player.opponent?.username);
  }

        player.turnPhase = 'ownLetterPlacement';
        sendTurnInfo(player);
      } else {
         try {
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify({
          type: 'status',
          message: 'Geçersiz konum! Bu hücre dolu veya geçersiz.'
        }));
         }
  } catch (err) {
    console.error('[SERVER] ❌ player.ws.send hatası:', err, player.username);
  }
        sendTurnInfo(player);
      }
    }

    else if (data.type === 'updateOwnLetterPlacement') {
      if (!player.myTurn || player.letterToPlace !== null) {
        player.ws.send(JSON.stringify({ type: 'status', message: 'Geçersiz hamle! Sıra sende değil veya rakip harf bekliyorsun.' }));
        return;
      }

      const { letter, row, col } = data;

      if (player.tempLetterPlacement &&
        (player.tempLetterPlacement.row !== row || player.tempLetterPlacement.col !== col)) {
        if (player.board[player.tempLetterPlacement.row][player.tempLetterPlacement.col] === '') {
          player.opponent.ws.send(JSON.stringify({
            type: 'opponentPlacedLetter',
            letter: '',
            row: player.tempLetterPlacement.row,
            col: player.tempLetterPlacement.col
          }));
        }
      }

      if (letter === '') {
        if (player.tempLetterPlacement &&
          player.tempLetterPlacement.row === row &&
          player.tempLetterPlacement.col === col) {
          player.tempLetterPlacement = null;
          player.opponent.ws.send(JSON.stringify({
            type: 'opponentPlacedLetter',
            letter: '',
            row,
            col
          }));
        }
      } else {
        if (player.board[row][col] === '') {
          player.tempLetterPlacement = { letter: letter.toLocaleUpperCase('tr-TR'), row, col };
          player.opponent.ws.send(JSON.stringify({
            type: 'turn',
            yourTurn: true,
            letterToPlace: letter.toLocaleUpperCase('tr-TR'),
            turnDuration: 30000,
            remainingTime: 30000
          }));
        } else {
          player.ws.send(JSON.stringify({ type: 'status', message: 'Bu hücre dolu, başka bir hücreye taşı veya sil.' }));
          const elapsedTime = Date.now() - player.turnStartTime;
          const remaining = player.turnDuration - elapsedTime;
          startTurnTimer(player, Math.max(0, remaining), 'opponentLetterPlacement');
          return;
        }
      }

      player.ws.send(JSON.stringify({ type: 'boardState', board: player.board }));
      if (player.opponent && player.opponent.inBackground) {
        player.opponent.ws.send(JSON.stringify({
          type: 'status',
          message: 'Devam eden oyunda rakibin hamlesi geldi!'
        }));
      }
    }

    else if (data.type === 'placeOwnLetter') {
      const gameId = player.gameId;
      const game = games.find(g => g.gameId === gameId || g.id === gameId);


      if (!game) {
        console.warn('[PLACE_OWN_LETTER] Oyuncuya ait oyun games içinde bulunamadı.');
        return;
      }

      game.currentTurn = player.opponent.username;
      game.phase = 'opponentLetterPlacement';

      if (!player.myTurn || player.letterToPlace !== null || !player.tempLetterPlacement || player.tempLetterPlacement.letter === '') {
        player.ws.send(JSON.stringify({ type: 'status', message: 'Hamle Süreniz Doldu!' }));
        const elapsedTime = Date.now() - player.turnStartTime;
        const remaining = player.turnDuration - elapsedTime;
        startTurnTimer(player, Math.max(0, remaining), 'opponentLetterPlacement');
        return;
      }

      clearTurnTimer(player);
      const { letter, row, col } = player.tempLetterPlacement;

      if (player.board[row][col] === '') {
        player.board[row][col] = letter;
        player.consecutiveTimeouts = 0;

        player.opponent.ws.send(JSON.stringify({
          type: 'opponentPlacedLetter',
          letter,
          row,
          col
        }));

        player.ws.send(JSON.stringify({ type: 'boardState', board: player.board }));

        player.myTurn = false;
        player.opponent.myTurn = true;
        player.opponent.letterToPlace = letter;

        player.lastSentLetter = letter;
        player.tempLetterPlacement = null;
        player.movesMade++;

        const currentScoreResult = calculateScore(player.board);
        player.score = currentScoreResult.totalScore;
        sendScoresToAllPlayers(player, player.opponent);

        const isGameOver = checkGameOver(player, player.opponent);
        if (!isGameOver) {
          player.ws.send(JSON.stringify({
            type: 'updateScores',
            playerScore: player.score,
            opponentScore: player.opponent.score
          }));
          player.opponent.ws.send(JSON.stringify({
            type: 'updateScores',
            playerScore: player.opponent.score,
            opponentScore: player.score
          }));
          player.ws.send(JSON.stringify({
            type: 'turn',
            yourTurn: false,
            letterToPlace: null,
            turnDuration: 0,
            remainingTime: 0,
            message: 'Hamlen tamamlandı, sıra rakibe geçti.'
          }));

          player.opponent.turnStartTime = Date.now();
          player.opponent.turnDuration = 6 * 60 * 60 * 1000;
          player.opponent.turnPhase = 'opponentLetterPlacement';
          sendTurnInfo(player.opponent);

          if (player.opponent && player.opponent.inBackground) {
            player.opponent.ws.send(JSON.stringify({
              type: 'status',
              message: 'Sıra sende! Rakibin hamlesini yaptı.'
            }));
          }
        }
      } else {
        player.ws.send(JSON.stringify({ type: 'status', message: 'Geçersiz hamle! Hedef hücre dolu.' }));
        const elapsedTime = Date.now() - player.turnStartTime;
        const remaining = player.turnDuration - elapsedTime;
        startTurnTimer(player, Math.max(0, remaining), 'ownLetterPlacement');
      }
    }
  });

  // ⛔ on('close') reconnectte atanmaz, sadece startGame sırasında tanımlanır
}

function resetPlayerState(player) {
  if (!player) return;

  player.myTurn = false;
  player.letterToPlace = null;
  player.movesMade = 0;
  player.finalTurnTriggered = false;
  player.tempLetterPlacement = null;

  if (player.turnTimeout) clearTimeout(player.turnTimeout);
  
  player.turnTimeout = null;
  player.turnStartTime = null;
  player.turnDuration = null;
  player.score = 0;
  player.opponent = null;
  player.gameInProgress = false;
  player.board = Array.from({ length: 5 }, () => Array(5).fill(''));
  player.consecutiveTimeouts = 0;
  player.lastSentLetter = null;
}

function cleanUpPlayerState(ws) {
  if (!ws) return;

  ws.gameInProgress = false;
  ws.myTurn = false;
  ws.letterToPlace = null;
  ws.movesMade = 0;
  ws.finalTurnTriggered = false;
  ws.tempLetterPlacement = null;
  
  if (ws.turnTimeout) clearTimeout(ws.turnTimeout);
  ws.turnTimeout = null;
  ws.turnStartTime = null;
  ws.turnDuration = null;
  ws.score = 0;

  if (ws.opponent) {
    const opponent = ws.opponent;

    opponent.gameInProgress = false;
    opponent.myTurn = false;
    opponent.letterToPlace = null;
    opponent.movesMade = 0;
    opponent.finalTurnTriggered = false;
    opponent.tempLetterPlacement = null;
  
  if (opponent.turnTimeout) clearTimeout(opponent.turnTimeout);
    opponent.turnTimeout = null;
    opponent.turnStartTime = null;
    opponent.turnDuration = null;
    opponent.score = 0;

    opponent.opponent = null;
    ws.opponent = null;

    console.log(`[SERVER] Rakip oyuncu ${opponent.username} için de state temizlendi.`);
  } else {
    ws.opponent = null;
  }



  // waitingPlayersQueue listesinden çıkar
  waitingPlayersQueue = waitingPlayersQueue.filter(p => p !== ws);
}

function startGame(player1, player2, isRematch = false) {
  console.log('player1.ws.profileImage:', player1.ws?.profileImage);
  console.log('player2.ws.profileImage:', player2.ws?.profileImage);
  if (!player1.ws || !player2.ws) {
  console.error('[startGame] ❌ player1 veya player2 içinde ws tanımlı değil.');
  console.log('player1:', player1);
  console.log('player2:', player2);
  return;
}
// === Rematch başlatılmadan önce aynı oyuncuların önceki oyununu RAM'den temizle ===
for (let i = games.length - 1; i >= 0; i--) {
  const g = games[i];
  const usernames = g.players.map(p => p.username);

  if (
    usernames.includes(player1.username) &&
    usernames.includes(player2.username) &&
  g.status !== 'ongoing'  // sadece aktif olmayan oyunları temizle
  ) {
    console.log(`[CLEANUP] Eski oyun siliniyor → GameID: ${g.gameId || g.id}`);

    games.splice(i, 1);
  }
}

  const gameId = `${Date.now()}_${player1.username}_${player2.username}`;
  console.log(`[REMATCH] Yeni gameId oluşturuluyor: ${gameId}`); // <== BUNU EKLE
  player1.profileImage = player1.ws?.profileImage || `https://i.pravatar.cc/100?u=${player1.username}`;
  player2.profileImage = player2.ws?.profileImage || `https://i.pravatar.cc/100?u=${player2.username}`;
  
  player1.gameId = gameId;
  player2.gameId = gameId;

  const newGame = {
    gameId: gameId,
    players: [player1, player2],
    currentTurn: player1.username,
    phase: 'opponentLetterPlacement',
    startTime: Date.now(),
    boardStates: {
      [player1.username]: Array.from({ length: 5 }, () => Array(5).fill('')),
      [player2.username]: Array.from({ length: 5 }, () => Array(5).fill('')),
    }
  };
  
  games.push(newGame);

  // --- Aktif oyun limiti kontrolü ---
const activeGames = games.filter(g => g.status === 'ongoing');
if (activeGames.length > 25) {
  activeGames.sort((a, b) => a.startTime - b.startTime);
  const oldestActiveGame = activeGames[0];
  console.log(`[LIMIT] Aktif oyun limiti aşıldı. En eski oyun siliniyor: ${oldestActiveGame.gameId}`);
  const index = games.findIndex(g => g.gameId === oldestActiveGame.gameId);
  if (index !== -1) games.splice(index, 1);
}

  newGame.players.forEach(player => {
  console.log(`[STARTGAME] player: ${player.username}, profileImage: ${player.profileImage}`);
});

const gameIds = games.map(g => g.gameId || g.id);
console.log('[DEBUG][startGame] Yeni oyun oluşturuldu. games ids:', gameIds);

saveGamesToDisk();

  resetPlayerState(player1);
  resetPlayerState(player2);

  console.log(`[SERVER] startGame çağrıldı: ${player1.username} vs ${player2.username}, rematch: ${isRematch}`);
  
  player1.opponent = player2;
  player2.opponent = player1;

  player1.ws.opponent = player2;
  player2.ws.opponent = player1;

  player1.ws.player = player1;
  player2.ws.player = player2;

  player1.myTurn = true; 
  player2.myTurn = false;

  player1.board = Array.from({ length: 5 }, () => Array(5).fill('')); 
  player2.board = Array.from({ length: 5 }, () => Array(5).fill('')); 

  player1.letterToPlace = null; 
  player2.letterToPlace = null;

  player1.finalTurnTriggered = false; 
  player2.finalTurnTriggered = false; 
        
  player1.movesMade = 0; 
  player2.movesMade = 0; 
        
  player1.isStartingPlayer = true; 
  player2.isStartingPlayer = false;

  player1.consecutiveTimeouts = 0; 
  player2.consecutiveTimeouts = 0; 

  player1.tempLetterPlacement = null; 
  player2.tempLetterPlacement = null;
  
  player1.turnTimeout = null;
  player1.score = 0;

  player2.turnTimeout = null;
  player2.score = 0;

  
  setupPlayerListeners(player1, player2);
  
  
  player1.gameInProgress = true;
  player2.gameInProgress = true;
    
  const messageType = isRematch ? 'rematchStart' : 'start';

  const payload1 = {
    type: messageType,
    yourTurn: true,
    letterToPlace: null,
    message: isRematch ? 'Tekrar oyun başlatıldı.' : 'Oyun başlatıldı.',
    opponentUsername: player2.username,
    opponentImage: player2.profileImage || '/default-avatar.png',
    invite: !isRematch,       
    fromRematch: isRematch
  };

  const payload2 = {
    ...payload1,
    yourTurn: false,
    opponentUsername: player1.username,
    opponentImage: player1.profileImage || '/default-avatar.png'
  };

  payload1.gameId = gameId;
  payload2.gameId = gameId;

console.log('[DEBUG][START] start mesajı gönderiliyor (player1):', {
  to: player1.username,
  opponentUsername: payload1.opponentUsername,
  opponentImage: payload1.opponentImage,
  myAvatar: player1.profileImage || '/default-avatar.png'
});



  player1.ws.send(JSON.stringify(payload1));

  console.log('[DEBUG][START] start mesajı gönderiliyor (player2):', {
  to: player2.username,
  opponentUsername: payload2.opponentUsername,
  opponentImage: payload2.opponentImage,
  myAvatar: player2.profileImage || '/default-avatar.png'
});

  player2.ws.send(JSON.stringify(payload2));

  clearTurnTimer(player1);
  clearTurnTimer(player2);

  //startTurnTimer(player1, OPPONENT_LETTER_TURN_TIME_MS, 'opponentLetterPlacement');

  sendScoresToAllPlayers(player1, player2);

  
if (player1.myTurn) {
  player1.turnStartTime = Date.now();
  player1.turnDuration = 6 * 60 * 60 * 1000;
  player1.turnPhase = 'opponentLetterPlacement';
  player2.turnPhase = null;
  
} else if (player2.myTurn) {
  player2.turnStartTime = Date.now();
  player2.turnDuration = 6 * 60 * 60 * 1000;
  player2.turnPhase = 'opponentLetterPlacement';
  player1.turnPhase = null;
}
if (player1.myTurn) {
  sendTurnInfo(player1);
} else {
  sendTurnInfo(player2);
}

console.log(`[START_GAME] Başlangıç movesMade player1: ${player1.movesMade}, player2: ${player2.movesMade}`);
console.log(`[START_GAME] Başlangıç myTurn player1: ${player1.myTurn}, player2: ${player2.myTurn}`);

}

const broadcastOnlineCount = () => {
  const count = Array.from(wss.clients).filter(ws => ws.readyState === WebSocket.OPEN && ws.loggedIn).length;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'onlineCount',
        count
      }));
    }
  });

  console.log(`[SERVER] 👥 Online kullanıcı sayısı yayınlandı: ${count}`);
};
wss.on('connection', (ws) => {
console.log('WS client connected');
ws.on('message', (msg) => {

  let data;
  try {
    data = JSON.parse(msg);
  } catch (err) {
    console.error('[SERVER] JSON parse hatası:', err);
    return;
  }

if (data.type === 'setUsername') {
  ws.username = data.username;
  console.log(`[SERVER] Kullanıcı adı ayarlandı: ${ws.username}`);

  // ✉️ Client'a onay mesajı gönder
  ws.send(JSON.stringify({ type: 'setUsernameAck' }));

  return;
}

if (data.type === 'invite') {
  const targetUsername = data.to;
  const isRematch = data.fromRematch === true;
  
  console.log(`[SERVER] Davet isteği geldi: ${ws.username} -> ${targetUsername}`);
  
  // 🛑 Kendine davet göndermeyi engelle
  if (targetUsername === ws.username) {
    ws.send(JSON.stringify({
      type: 'status',
      message: 'Kendine davet gönderemezsin.'
    }));  
    return;
  }
       
  const targetPlayer = Array.from(wss.clients).find(
    (p) => p.readyState === WebSocket.OPEN && p.username === targetUsername
  );

  if (targetPlayer) {
    console.log(`[SERVER] Hedef oyuncu bulundu: ${targetUsername}`); 
    
    ws.opponent = targetPlayer;
    targetPlayer.opponent = ws;

    // 🔁 Rematch flag'i her iki oyuncuda da işaretlensin
    if (isRematch) {
      ws.pendingRematch = true;
      targetPlayer.pendingRematch = true;
    
      // 🧹 Temizlik: Oyun bitmişse gameInProgress flag’lerini sıfırla
      ws.gameInProgress = false;
      targetPlayer.gameInProgress = false;
    }

    targetPlayer.send(JSON.stringify({
      type: 'invite',
      from: ws.username
    }));
  } else {
    console.log(`[SERVER] Hedef oyuncu bulunamadı: ${targetUsername}`); // 🌟 BURAYI EKLE
    
    ws.send(JSON.stringify({
      type: 'status',
      message: `Kullanıcı bulunamadı: ${targetUsername}`
    }));
  }
  return;
}

if (data.type === 'acceptInvite') {
  const opponent = ws.opponent;

  if (!opponent) {
    console.warn('[SERVER] ❌ acceptInvite geldi ama opponent null.');
    ws.send(JSON.stringify({
      type: 'status',
      message: 'Rakip bulunamadı. Oyun başlatılamadı.'
    }));
    return;
  }

  // 🔒 Oyun gerçekten devam ediyor olabilir mi? Zaman kontrolü yap
  if (ws.gameInProgress || opponent.gameInProgress) {
    const lastTurn = Math.max(ws.turnStartTime || 0, opponent.turnStartTime || 0);
    const timeSinceLastMove = Date.now() - (ws.turnStartTime || 0);
    
    if (timeSinceLastMove < 10000) { // Son hamleden bu yana 10 saniyeden az geçtiyse oyun hâlâ aktif olabilir
    console.warn('[SERVER] ❌ acceptInvite geldi ama oyun aktif görünüyor. Gerçekten aktifse ignore ediliyor.');
    return;
    } else {
    console.warn('[SERVER] ⚠️ Oyun flag true ama süreye göre artık aktif değil, devam ediliyor.');
    ws.gameInProgress = false;
    opponent.gameInProgress = false;
    }
  }
  // ✅ Eksik olan: bağlantıyı kesinleştir
  ws.opponent = opponent;
  opponent.opponent = ws;

  // pendingRematch bayraklarını temizle
  const isRematch = opponent.pendingRematch === true;
  opponent.pendingRematch = false;
  ws.pendingRematch = false;

  // 🎯 Oyun şimdi başlatılacak
  console.log(`[SERVER] ✅ ${ws.username} ve ${opponent.username} için startGame() çağrılıyor.`);
  const player1 = createNewPlayer(opponent);
const player2 = createNewPlayer(ws);
startGame(player1, player2, isRematch);
 // 🧠 DİKKAT: gameInProgress bu fonksiyonda ayarlanmalı
}
if (data.type === 'rejectInvite') {
  const opponent = ws.opponent;

  if (opponent) {
    console.log(`[SERVER] ${ws.username} daveti reddetti.`);

    opponent.send(JSON.stringify({
      type: 'status',
      message: `${ws.username} daveti reddetti.`
    }));

    // İki taraf da birbirini eşleşmiş olarak tutmasın
    ws.opponent = null;
    opponent.opponent = null;
  }
  return;
}
if (data.type === 'forfeit') {
  console.log('\n[FORFEIT DEBUG] === Forfeit isteği alındı ===');
  console.log('[FORFEIT DEBUG] ws.username:', ws.username);
  console.log('[FORFEIT DEBUG] ws.opponent:', ws.opponent);
  console.log('[FORFEIT DEBUG] ws.opponent?.username:', ws.opponent?.username);
  console.log('[FORFEIT DEBUG] ws.opponent?.ws:', ws.opponent?.ws);
  console.log('[FORFEIT DEBUG] ws.opponent?.ws?.readyState:', ws.opponent?.ws?.readyState);

    const opponent = ws.opponent;

    

  if (opponent && opponent.ws && opponent.ws.readyState === WebSocket.OPEN) {
    console.log(`[SERVER] ${ws.username} pes etti, endGame() çağrılıyor.`);

    // Opsiyonel olarak skorları sıfırlayabilirsin ama gerek yoksa bırak
    ws.board = ws.board || Array(5).fill().map(() => Array(5).fill(''));
    opponent.board = opponent.board || Array(5).fill().map(() => Array(5).fill(''));


endGame(opponent, opponent.opponent, ws.gameId);

    ws.opponent = null;
    opponent.opponent = null;
  } else {
    console.log('[SERVER] Pes edenin rakibi yok, sadece kendisine gameOver mesajı gönderiliyor.');
    ws.board = ws.board || Array(5).fill().map(() => Array(5).fill(''));

    const result = calculateScore(ws.board);
    const boardHTML = generateBoardHTML(ws.board);

    ws.send(JSON.stringify({
      type: 'gameOver',
      playerScore: result.totalScore,
      opponentScore: 0,
      playerDetails: result.details,
      opponentDetails: [],
      playerBoardHTML: boardHTML,
      opponentBoardHTML: '<p>Rakip bulunamadı.</p>',
      opponentUsername: null
    }));
  }

  ws.opponent = null;

  return;
}
if (['exitGame', 'minimizeGame', 'returnToHome', 'someOtherType'].includes(data.type)) {
  console.log(`[SERVER] ${ws.username} tarafından ${data.type} mesajı alındı, oyun durumu sıfırlanıyor.`);
  cleanUpPlayerState(ws);
  return;
}
if (data.type === 'login') {
const username = data.username?.toLowerCase();
for (const client of wss.clients) {
  if (client !== ws && client.username === username && client.readyState === WebSocket.OPEN) {
    console.log(`[SERVER] 🔁 Aynı kullanıcıdan eski bağlantı bulundu. Kapatılıyor: ${username}`);
    client.send(JSON.stringify({
      type: 'status',
      message: 'Başka bir cihazdan giriş yapıldı. Bu oturum sonlandırılıyor.'
    }));
    client.close();
  }
}
  const usersPath = path.join(__dirname, '../data/users.json');
   fs.readFile(usersPath, 'utf-8', (err, json) => {
      if (err) {
        console.error('[SERVER] Kullanıcı dosyası okunamadı:', err);
        ws.send(JSON.stringify({ type: 'loginFailure', message: 'Kullanıcı verisi bulunamadı.' }));
        return;
      }

      let users;
      try {
      users = JSON.parse(json);
    } catch (e) {
      console.error('[SERVER] users.json parse hatası:', e);
      ws.send(JSON.stringify({ type: 'loginFailure', message: 'Kullanıcı verisi okunamadı.' }));
      return;
    }

  const isReconnect = data.isReconnect === true;
  const user = users.find(
  u => u.username.toLowerCase() === username && (isReconnect || u.password === data.password)
);

  if (user) {
    ws.username = username;
    ws.profileImage = user.profileImage || `https://i.pravatar.cc/100?u=${user.username}`;
    ws.loggedIn = true;
    
    console.log('[AVATAR DEBUG][LOGIN]', {
    username: ws.username,
    profileImage: ws.profileImage});
       
    broadcastOnlineCount();
    console.log('[DEBUG] Yüklenen oyun sayısı:', games.length);
    for (const game of games) {
      
  const gameId = game.gameId || game.id;
  console.log(`[DEBUG] Oyun ID: ${gameId} | status: ${game.status}`);
  const player = game.players.find(p => p.username === username);
  if (player) {
    console.log(`[SERVER] 🆕 ${username} için websocket güncelleniyor (gameId: ${gameId}).`);
    player.ws = ws;
    break;
  }
}
    
    const gamesPath = path.join(__dirname, '../data/games.json');
    
    fs.readFile(gamesPath, 'utf-8', (gErr, gamesJson) => {
    let winRate = 0;
    let averageScore = 0;

    if (!gErr) {
      try {
        const allGames = JSON.parse(gamesJson);
        const userGames = allGames.filter(g => g.username === user.username);
        const totalGames = userGames.length;
        const totalWins = userGames.filter(g => g.won).length;
        const totalScore = userGames.reduce((sum, g) => sum + g.score, 0);

        if (totalGames > 0) {
          winRate = Math.round((totalWins / totalGames) * 100);
          averageScore = Math.round(totalScore / totalGames);
        }
      } catch (e) {
        console.error('[SERVER] games.json parse hatası:', e);
      }
    }        
   
    // 🔍 Aktif oyunları bulalım
const activeGamesList = [];
console.log('[DEBUG] RAM\'deki games sayısı:', Object.values(games).length);
for (const game of Object.values(games)) {
  console.log('[DEBUG] Oyun inceleniyor:', game.gameId, '→ status:', game.status);
  if (
    game.phase !== 'finished' && 
    game.phase !== 'ended' && 
    game.status !== 'finished'
  ) {
    const player = game.players.find(p => p.username === username);
    const opponent = game.players.find(p => p.username !== username);

    if (player && opponent) {
      console.log(`[Avatar Kontrol] Oyun: ${game.gameId}, Rakip: ${opponent.username}, Avatar: ${opponent.profileImage}`);
      const remainingTime = player.turnDuration - (Date.now() - player.turnStartTime);

      console.log('[AVATAR DEBUG][ACTIVE GAME]', {
  gameId: game.gameId || game.id,
  opponent: opponent.username,
  opponentImage: opponent.profileImage
});

      activeGamesList.push({
        gameId: game.gameId || game.id,
        opponent: opponent.username,
        opponentImage: opponent.profileImage || `https://i.pravatar.cc/100?u=${opponent.username}`,
        isMyTurn: game.currentTurn === player.username,
        myScore: player.score || 0,
        opponentScore: opponent.score || 0,
        remainingTime: Math.max(remainingTime, 0),
        status: game.status
      });
    }
  }
}
console.log('[BACKEND] activeGames listesi:', JSON.stringify(activeGamesList, null, 2));

    ws.send(JSON.stringify({
    type: 'loginSuccess',
    username: user.username,
    profileImage: user.profileImage || `https://i.pravatar.cc/100?u=${user.username}`,
    winRate,
    averageScore,
    wins: user.stats.wins,
    losses: user.stats.losses,
    activeGames: activeGamesList
}));
if (isReconnect) {
const existingGame = games.find(g => g.gameId === data.gameId);
if (!existingGame) {
  console.warn('[SERVER] Reconnect: gameId ile oyun bulunamadı:', data.gameId);
  ws.send(JSON.stringify({ 
                    type: 'reconnectFailure', 
                    message: 'Oyun bulunamadı veya sona erdi. Lütfen tekrar deneyin.' 
                }));
  return;
}
console.log('[DEBUG][RECONNECT] Bulunan oyun:', existingGame?.gameId || 'Bulunamadı');

if (existingGame) {
  console.log(`[RECONNECT] 🔄 Reconnect başlatıldı - Username: ${username}, GameID: ${existingGame.gameId}`);

  const player = existingGame.players.find(p => p.username === username);
  const opponent = existingGame.players.find(p => p.username !== username);
  console.log(`[RECONNECT] 👤 Player: ${player.username}, Opponent: ${opponent.username}`);
console.log('[RECONNECT] 🧩 Player.board içeriği:', JSON.stringify(player.board));

  if (!opponent || !player) {
  console.warn(`[SERVER] Reconnect HATASI - player: ${JSON.stringify(player)}, opponent: ${JSON.stringify(opponent)}`);
  return;
  }

  player.myTurn = (existingGame.currentTurn === player.username);
  player.ws = ws;
  player.disconnected = false;
  saveGamesToDisk()

  player.opponent = opponent;
  opponent.opponent = player;

  setupPlayerListeners(player, player.opponent);
  
  ws.player = player;
  ws.opponent = opponent;
  console.log(`[RECONNECT] ✅ Rakip bilgisi bağlandı: ${player.username} ↔ ${opponent.username}`);

  console.log('[RECONNECT DEBUG] player:', player.username);
console.log('[RECONNECT DEBUG] player.ws:', player.ws ? 'OK' : 'undefined');
console.log('[RECONNECT DEBUG] player.opponent:', player.opponent ? player.opponent.username : 'undefined');
console.log('[RECONNECT DEBUG] player.opponent.ws:', player.opponent && player.opponent.ws ? 'OK' : 'undefined');
console.log('[AVATAR DEBUG][START GAME]', {
  player: player.username,
  opponent: opponent.username,
  opponentImage: opponent.profileImage
});
  ws.send(JSON.stringify({
    type: 'start',
    opponentUsername: opponent.username,
    opponentImage: opponent.profileImage || `https://i.pravatar.cc/100?u=${opponent.username}`,
    yourTurn: player.myTurn,
    letterToPlace: player.letterToPlace,
    invite: false,        
    fromRematch: false,
    gameId: existingGame.gameId,
  }));
  
  const playerBoard = existingGame.players.find(p => p.username === username)?.board;
  const adjustedBoard = JSON.parse(JSON.stringify(playerBoard || existingGame.boardStates[username] || Array.from({ length: 5 }, () => Array(5).fill(''))));

  console.log('[RECONNECT] Gönderilen boardState:', JSON.stringify(adjustedBoard));
  ws.send(JSON.stringify({
    type: 'boardState',
    board: adjustedBoard
  }));

  if (typeof existingGame.phase !== 'string' || !['opponentLetterPlacement', 'ownLetterPlacement'].includes(existingGame.phase)) {
    existingGame.phase = player.letterToPlace ? 'opponentLetterPlacement' : 'ownLetterPlacement';
  }

  const remainingTime = player.turnDuration - (Date.now() - player.turnStartTime);

  ws.send(JSON.stringify({
    type: 'turn',
    currentPlayer: existingGame.currentTurn,
    remainingTime:  Math.max(remainingTime, 0),
    phase: existingGame.phase,
    turnStartTime: player.turnStartTime,
    turnDuration: player.turnDuration,
    letterToPlace: player.letterToPlace,
    yourTurn: (existingGame.currentTurn === player.username),
  }));

console.log('[RECONNECT][TURN SENT]', {
  currentPlayer: existingGame.currentTurn,
  remainingTime: Math.max(remainingTime, 0),
  turnStartTime: player.turnStartTime,
  turnDuration: player.turnDuration,
  letterToPlace: player.letterToPlace,
  yourTurn: (existingGame.currentTurn === player.username),
  phase: existingGame.phase
});
}
} 
});
  
return;  
} else {
      ws.send(JSON.stringify({ type: 'loginFailure', message: 'Geçersiz kullanıcı adı veya şifre.' }));
    }
  }); // fs.readFile (users.json) BİTTİ
  return;
}
else if (data.type === 'joinGame') {
  console.log('[SERVER] joinGame mesajı alındı:', data.gameId);
  const gameId = data.gameId;
  const username = ws.username;

  const game = games.find(g => (g.gameId || g.id) === gameId);
  if (!game) {
    ws.send(JSON.stringify({ type: 'status', message: 'Oyun bulunamadı.' }));
    return;
  }

  const player = game.players.find(p => p.username === username);
  const opponent = game.players.find(p => p.username !== username);
  if (!player || !opponent) {
    ws.send(JSON.stringify({ type: 'status', message: 'Oyuncu veya rakip bulunamadı.' }));
    return;
  }

  player.myTurn = (game.currentTurn === player.username);
  player.ws = ws;
  player.disconnected = false;
  setupPlayerListeners(player);

  player.opponent = opponent;
  opponent.opponent = player;

  ws.player = player;
  ws.opponent = opponent;

  console.log(`[JOIN GAME] ✅ Bağlantı kuruldu: ${player.username} ↔ ${opponent.username}`);

  ws.send(JSON.stringify({
    type: 'start',
    opponentUsername: opponent.username,
    opponentImage: opponent.profileImage || `https://i.pravatar.cc/100?u=${opponent.username}`,
    yourTurn: player.myTurn,
    letterToPlace: player.letterToPlace,
    invite: false,
    fromRematch: false,
    gameId: game.gameId,
    isReconnect: true
  }));

  const playerBoard = player.board || game.boardStates?.[username] || Array.from({ length: 5 }, () => Array(5).fill(''));
  ws.send(JSON.stringify({
    type: 'boardState',
    board: playerBoard
  }));

  if (typeof game.phase !== 'string' || !['opponentLetterPlacement', 'ownLetterPlacement'].includes(game.phase)) {
    game.phase = player.letterToPlace ? 'opponentLetterPlacement' : 'ownLetterPlacement';
  }

  const remainingTime = player.turnDuration - (Date.now() - player.turnStartTime);
  ws.send(JSON.stringify({
    type: 'turn',
    currentPlayer: game.currentTurn,
    remainingTime: Math.max(remainingTime, 0),
    phase: game.phase,
    turnStartTime: player.turnStartTime,
    turnDuration: player.turnDuration,
    letterToPlace: player.letterToPlace,
    yourTurn: (game.currentTurn === player.username)
  }));
}

else if (data.type === 'startGame') {
  ws.readyToPlay = true;

  if (waitingPlayersQueue.includes(ws)) {
    waitingPlayersQueue = waitingPlayersQueue.filter(p => p !== ws);
  }

  waitingPlayersQueue.push(ws);

  if (waitingPlayersQueue.length >= 2) {
    let player1 = waitingPlayersQueue.shift();
    let player2 = waitingPlayersQueue.shift();

    waitingPlayersQueue = waitingPlayersQueue.filter(p =>
      p.username !== player1.username && p.username !== player2.username
    );

   // Oyuncuları resetle ve başlat
    resetPlayerState(player1);
    resetPlayerState(player2);

    if (player1.readyToPlay && player2.readyToPlay) {
      
      player1 = createNewPlayer(player1);
      player2 = createNewPlayer(player2);
      console.log(`[SERVER] startGame çağrılıyor: ${player1.username} vs ${player2.username}`);
      startGame(player1, player2);
      player1.ws.player = player1;
      player2.ws.player = player2;


    }
  } else {
    ws.send(JSON.stringify({ type: 'status', message: 'Rakip bekleniyor...' }));
  }
  return;
}

});
ws.on('close', () => {
  console.log(`[SERVER] WebSocket bağlantısı kapandı: ${ws.username || 'Bilinmeyen kullanıcı'}`);
// Eğer oyuncu waitingPlayersQueue'daysa çıkar
  if (waitingPlayersQueue.includes(ws)) {
    waitingPlayersQueue = waitingPlayersQueue.filter(p => p !== ws);
    console.log(`[SERVER] ${ws.username} waitingPlayersQueue'dan çıkarıldı (close event).`);
  }
  if (waitingPlayer === ws) {
    waitingPlayer = null;
    console.log('[SERVER] waitingPlayer bağlantı kapandığı için sıfırlandı.');
  }
  console.log('[DEBUG] Yüklenen oyun sayısı:', games.length);
  for (const game of games) {
    
  const gameId = game.gameId || game.id;
  console.log(`[DEBUG] Oyun ID: ${gameId} | status: ${game.status}`);
  const player = game.players.find(p => p.username === ws.username);
  if (player) {
    player.disconnected = true;
    player.ws = null;

    const opponent = game.players.find(p => p.username !== ws.username);
    if (opponent && opponent.ws?.readyState === WebSocket.OPEN) {
      opponent.ws.send(JSON.stringify({
        type: 'opponentDisconnected',
        message: `${ws.username} bağlantısı kesildi.`
      }));
    }
    break;
  }
}

  
  broadcastOnlineCount(); // online sayısını güncelle
});
ws.on('error', (error) => {
  console.error(`[SERVER] WebSocket hata: ${error.message}`);
});

});

server.listen(3001, '0.0.0.0', () => {
  console.log('Sunucu http://localhost:3001 adresinde çalışıyor');
});