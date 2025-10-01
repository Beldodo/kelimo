import React, { useState, useEffect, useRef } from 'react';
import { Trophy, BarChart2, X, Check, CircleDot } from 'lucide-react';


const ProfilePopup = ({ username, profileImage, winRate, averageScore, recentGames = [], totalGames = 0, wins = 0,
  losses = 0, onUpdateProfileImage, onClose }) => {

const fileInputRef = useRef(null);
const [justUploaded, setJustUploaded] = useState(false);
const handleImageClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
const handleFileChange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('avatar', file);
  formData.append('username', username);

  try {
    const res = await fetch('/upload-avatar', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('Yükleme başarısız');

    const data = await res.json();
    onUpdateProfileImage(data.profileImage); // ✅ App.js'e iletir
    setJustUploaded(true);
  } catch (err) {
    console.error('Avatar yükleme hatası:', err);
    alert('Resim yüklenemedi. Lütfen tekrar deneyin.');
  }
};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center"
  onClick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-96 relative">

        <button
  onClick={onClose}
  className="absolute top-2 right-2 text-gray-400 hover:text-indigo-700 text-xl font-bold"
>
  ×
</button>

        <div className="flex flex-col items-center">
          <img
  src={profileImage}
  alt="Avatar"
  className="w-20 h-20 rounded-full border-2 border-indigo-400 shadow-sm object-cover mb-2 cursor-pointer"
  onClick={handleImageClick}
/>
          
            <input
              type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            />
            <h2 className="text-xl font-semibold">{username}</h2>

    {justUploaded && (
      <p className="text-sm text-green-600">Yeni profil resmi yüklendi ✅</p>
    )}
    </div>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 mt-4">
  <div className="flex items-center gap-1"><CircleDot className="w-4 h-4 text-indigo-500" /> Toplam: <strong>{totalGames}</strong></div>
  <div className="flex items-center gap-1"><Check className="w-4 h-4 text-green-600" /> Kazanılan: <strong>{wins}</strong></div>
  <div className="flex items-center gap-1"><X className="w-4 h-4 text-red-600" /> Kaybedilen: <strong>{losses}</strong></div>
  <div className="flex items-center gap-1"><Trophy className="w-4 h-4 text-yellow-500" /> Başarı: <strong>{winRate}%</strong></div>
  <div className="flex items-center gap-1 col-span-2"><BarChart2 className="w-4 h-4 text-green-500" /> Ortalama Puan: <strong>{averageScore}</strong></div>
</div>

        <div className="mt-6">
          <h3 className="text-md font-bold mb-2 text-gray-800">🎮 Son Oyunlar</h3>
          <ul className="space-y-2 max-h-48 overflow-y-auto mt-2">
            {recentGames.length === 0 && (
              <li className="text-sm text-gray-500">Henüz veri yok.</li>
            )}
            {recentGames.map((game, index) => (
              <li
                key={index}
                className={`flex justify-between text-sm px-3 py-1 rounded 
                ${game.result === 'Win' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
  >
                <span className="text-xs text-gray-500">{new Date(game.date).toLocaleDateString()}</span>
    <span>{game.score} puan</span>
    <span>{game.result === 'Win' ? 'Kazandı' : 'Kaybetti'}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ProfilePopup;
