import React, { useState } from 'react';
import ProfilePopup from '../components/ProfilePopup';
import { Users } from 'lucide-react';
import { Trophy, BarChart2 } from 'lucide-react';
import { Menu, X } from 'lucide-react';
import { useRef, useEffect } from 'react';

const StartScreen = ({
  setCurrentScreen,
  onRandomGame, 
  onInvite, 
  onLogout, 
  username = 'Misafir',
  profileImage,
  setProfileImage,
  onMyGames,
  winRate,
  averageScore,
  totalGames,        
  wins,              
  losses,
  onAvatarChange,
  recentGames = [],
  onlineCount = 0 }) => {
  console.log('[StartScreen] Prop olarak gelen onlineCount:', onlineCount);
  const [invitee, setInvitee] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=Anon&background=random&bold=true';

  const menuRef = useRef(null);

  useEffect(() => {
  const handleClickOutside = (event) => {
    if (menuRef.current && !menuRef.current.contains(event.target)) {
      setMenuOpen(false);
    }
  };

  if (menuOpen) {
    document.addEventListener('mousedown', handleClickOutside);
  } else {
    document.removeEventListener('mousedown', handleClickOutside);
  }

  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [menuOpen]);

  return (
    <div className="w-full min-h-screen relative overflow-hidden flex flex-col items-center justify-center bg-[#f2f1f7] px-4">

      {/* Menü */}
      <div className="fixed top-4 right-4 z-50">
        <button
  onClick={() => setMenuOpen(!menuOpen)}
  className="p-2 rounded-md bg-white/80 backdrop-blur-md shadow-md border border-gray-300 hover:bg-white transition"
>
  {menuOpen ? <X className="w-5 h-5 text-gray-800" /> : <Menu className="w-5 h-5 text-gray-800" />}
</button>
{menuOpen && (
  <div 
  ref={menuRef}
  className="absolute right-0 mt-2 w-44 bg-white/90 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl shadow-indigo-100 py-2 z-50 animate-slideDown fade-in">
    <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition">Ayarlar</button>
    <button
      onClick={() => setShowProfile(true)}
      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
    >
      Profil
    </button>
    <hr className="my-1 border-t border-gray-100" />
    <button
      onClick={onLogout}
      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition"
    >
      Çıkış
    </button>
  </div>
)}
      </div>

      {/* Başlık */}
      <h1 className="text-4xl sm:text-5xl font-display font-black text-indigo-600 tracking-tight leading-tight drop-shadow-sm">
  Kelimo
</h1>

      {/* Orta Profil Bloğu */}
      <div className="flex flex-col items-center mt-6 mb-6">
        <img
          src={profileImage || DEFAULT_AVATAR}
          alt="Avatar"
          className="w-20 h-20 rounded-full border-2 border-indigo-400 shadow-sm object-cover mb-2"

        />
        <span className="text-xl font-semibold text-gray-900">{username}</span>
        {/* Online Kullanıcı Sayısı - buraya eklendi */}
  <div className="text-sm text-gray-700 flex items-center gap-1 mt-1">
  <Users className="w-4 h-4 text-gray-500" />
  <span>{onlineCount} online</span>
</div>
      </div>
      


      {/* Butonlar */}
      <div className="space-y-4 w-full max-w-xs">

<button
  onClick={() => setCurrentScreen('newMatch')}
  className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 active:shadow-inner text-white font-semibold py-2 rounded-xl shadow-lg transition-transform duration-150"
>
  Yeni Oyun
</button>
<button
  onClick={() => setCurrentScreen('myGames')}
  className="w-full bg-gray-500 hover:bg-gray-600 active:scale-95 active:shadow-inner text-white font-semibold py-2 rounded-xl shadow-lg transition-transform duration-150"
>
  Oyunlarım
</button>

        <button
          onClick={onRandomGame}
          className="w-full bg-indigo-500 hover:bg-indigo-600 active:scale-95 active:shadow-inner text-white font-semibold py-2 rounded-xl shadow-lg transition-transform duration-150"
        >
          Rastgele Rakiple Oyna
        </button>

        <input
          type="text"
          placeholder="Kullanıcı adı gir"
          value={invitee}
          onChange={(e) => setInvitee(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          className="w-full border-2 border-gray-300 px-4 py-2 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />

        <button
          onClick={() => {
            if (invitee.trim()) {
              onInvite(invitee.trim());
            }
          }}
          className="w-full bg-yellow-400 hover:bg-yellow-500 active:scale-95 active:shadow-inner text-gray-800 font-semibold py-2 rounded-xl shadow-lg transition-transform duration-150"
>
          Arkadaşını Davet Et
        </button>
      </div>
      {/* İstatistikler */}
      <div className="text-center mt-6 space-y-2">
  <div className="flex items-center justify-center gap-2 text-gray-700">
    <Trophy className="w-5 h-5 text-yellow-500" />
    <span className="text-base">Başarı: <span className="font-semibold text-indigo-700">{winRate}%</span></span>
  </div>
  <div className="flex items-center justify-center gap-2 text-gray-700">
    <BarChart2 className="w-5 h-5 text-green-500" />
    <span className="text-base">Ortalama Puan: <span className="font-semibold text-indigo-700">{averageScore}</span></span>
  </div>
</div>
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    
  <ProfilePopup
    username={username}
    profileImage={profileImage}
    onUpdateProfileImage={onAvatarChange}
    winRate={winRate}
    averageScore={averageScore}
    totalGames={totalGames}
    wins={wins}
    losses={losses}
    recentGames={recentGames}
    onClose={() => setShowProfile(false)}
  />
  </div>
)}

    </div>
  );
};

export default StartScreen;