import React from 'react';
import { Check, X } from 'lucide-react';

export default function InvitePopup({ from, onAccept, onReject }) {
  const isRandom = from === 'Rastgele Eşleşme';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">

      <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xl shadow-indigo-100 text-center space-y-4 w-80">

        <h2 className="text-lg font-semibold text-gray-800">
  {isRandom ? (
    <span className="text-indigo-600">Rastgele bir rakiple eşleştirildin!</span>
  ) : (
    <>
      <span className="font-bold text-indigo-600">{from}</span> seni oyuna davet etti.
    </>
  )}
</h2>


        {!isRandom && (
          <div className="flex justify-center gap-4">
  <button
    onClick={onAccept}
    className="flex items-center gap-1 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold shadow-md transition"
  >
    <Check className="w-4 h-4" /> Kabul Et
  </button>

  <button
    onClick={onReject}
    className="flex items-center gap-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-xl font-semibold transition"
  >
    <X className="w-4 h-4" /> Reddet
  </button>
</div>
        )}
      </div>
    </div>
  );
}
