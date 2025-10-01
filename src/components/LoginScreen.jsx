import { useState } from 'react';
import { LogIn } from 'lucide-react';


export default function LoginScreen({ infoMessage, onLogin, onGoogleLogin, onFacebookLogin, onNavigateToRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!username || !password) {
      setError('Kullanıcı adı ve şifre zorunludur.');
      return;
    }
    setError('');
    onLogin(username, password);
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-[#f2f1f7] overflow-hidden px-4 animate-slideUp">
      <div className="bg-white/90 backdrop-blur-md shadow-xl shadow-indigo-100 rounded-2xl p-6 w-full max-w-sm space-y-4
">      <LogIn className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
        <h1 className="text-3xl font-display font-black text-indigo-600 text-center tracking-tight drop-shadow-sm">Kelimo</h1>
          {infoMessage && (
            <p className="text-green-600 text-sm text-center mt-2">{infoMessage}</p>
          )}
        <button
          onClick={onGoogleLogin}
          className="w-full bg-white border-2 border-gray-300 rounded-xl flex items-center justify-center gap-2 py-2 shadow-sm hover:bg-gray-50 hover:brightness-110 transition-all duration-150"
>
          <img src="/icons/google.svg" alt="Google" className="h-5 w-5" />
  <span className="text-sm text-gray-700 font-medium">Google ile Giriş Yap</span>
</button>

        <button
  onClick={onFacebookLogin}
  className="w-full bg-blue-600 text-white rounded-xl flex items-center justify-center gap-2 py-2 shadow-md hover:bg-blue-700 hover:brightness-110 active:scale-95 transition-all duration-150"
>
  <img src="/icons/facebook.svg" alt="Facebook" className="h-5 w-5 bg-white rounded-full p-0.5" />
  <span className="text-sm font-medium">Facebook ile Giriş Yap</span>
</button>

        <div className="text-center text-gray-500 text-sm">veya kullanıcı adıyla giriş</div>

        <input
          type="text"
          placeholder="Kullanıcı Adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="px-4 py-2 border-2 border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full text-sm"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
        />

        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="px-4 py-2 border-2 border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full text-sm"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
  onClick={handleLogin}
  className="w-full bg-indigo-500 hover:bg-indigo-600 active:scale-95 active:shadow-inner text-white font-semibold py-2 rounded-xl shadow-lg transition-transform duration-150 ease-out"
>
  Giriş Yap
</button>

        <div className="text-center text-sm text-gray-600">
  Hesabın yok mu?{" "}
  <span
    className="text-indigo-600 font-semibold underline cursor-pointer hover:text-indigo-800 transition"
    onClick={onNavigateToRegister}
  >
    Kayıt Ol
  </span>
</div>
      </div>
    </div>
  );
}
