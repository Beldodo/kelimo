import { useState } from 'react';
import { UserPlus } from 'lucide-react';

export default function RegisterScreen({ onRegister, onBackToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [registerMessage, setRegisterMessage] = useState('');

  const handleRegister = async () => {
    if (!username) {
      setError('Kullanıcı adı zorunludur.');
      return;
    }

    try {
      const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Kayıt başarılı:', result);

        setRegisterMessage('✅ Kayıt başarılı! Giriş ekranına yönlendiriliyorsunuz...');
        setError('');
        
        setTimeout(() => {
        onRegister(result);
        }, 2000);
      } else {
        setError(result.message || 'Kayıt başarısız.');
        setRegisterMessage(''); // varsa önceki başarı mesajı temizlensin
      }
    } catch (err) {
      console.error('❌ Kayıt hatası:', err);
      setError('Sunucu hatası.');
      setRegisterMessage('');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f2f1f7] px-4">
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl shadow-indigo-100 p-6 w-full max-w-sm space-y-4">
        <UserPlus className="w-8 h-8 text-indigo-500 mx-auto mb-2" />

        <h1 className="text-3xl font-display font-black text-indigo-600 text-center tracking-tight drop-shadow-sm">Kayıt Ol</h1>


        <input
          type="text"
          placeholder="Kullanıcı Adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="px-4 py-2 border-2 border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full text-sm"

        />

        <input
          type="password"
          placeholder="Şifre (isteğe bağlı)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="px-4 py-2 border-2 border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full text-sm"

        />
        {/* ❗ HATA MESAJI */}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {/* ✅ BAŞARI MESAJI */}
        {registerMessage && <p className="text-green-600 text-sm mt-2">{registerMessage}</p>}

        <button
          onClick={handleRegister}
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 rounded-xl shadow-md transition"
        >
          Kayıt Ol
        </button>

        <div className="text-center text-sm text-gray-600">
          Zaten hesabın var mı?{" "}
        <span
          className="text-indigo-600 font-semibold underline cursor-pointer hover:text-indigo-800 transition"
          onClick={onBackToLogin}
        >
          Giriş Yap
        </span>
        </div>
      </div>
    </div>
  );
}
