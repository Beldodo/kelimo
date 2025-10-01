import React, { useState } from 'react';

const NewMatchScreen = ({ onBack, onRandomGame, onInvite }) => {
  const [invitee, setInvitee] = useState('');

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center bg-[#f2f1f7] px-4">
      {/* Başlık */}
      <h2 className="text-3xl sm:text-4xl font-display font-bold text-indigo-600 mb-6">Yeni Oyun</h2>

      {/* Rastgele Oyun Butonu */}
      <div className="w-full max-w-xs space-y-4">
        <button
          onClick={onRandomGame}
          className="w-full bg-indigo-500 hover:bg-indigo-600 active:scale-95 active:shadow-inner text-white font-semibold py-2 rounded-xl shadow-lg transition-transform duration-150"
        >
          Rastgele Rakiple Oyna
        </button>

        {/* Davet Etme Alanı */}
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

        <button
          onClick={onBack}
          className="w-full mt-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 rounded-xl shadow-md"
        >
          ⬅ Ana Menüye Dön
        </button>
      </div>
    </div>
  );
};

export default NewMatchScreen;