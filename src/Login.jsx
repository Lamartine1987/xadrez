import { useState } from 'react';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, provider, db } from './firebase';
import { LogIn, UserPlus, Mail, Lock, Phone, User } from 'lucide-react';

export default function Login() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  
  // New fields for registration
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');

  const initUser = async (user, additionalData = {}) => {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        displayName: additionalData.fullName || user.displayName || user.email.split('@')[0],
        email: user.email,
        phone: additionalData.phone || '',
        elo: 1200,
        stars: 0,
        gamesPlayed: 0
      });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setErrorMsg('');
      const res = await signInWithPopup(auth, provider);
      await initUser(res.user);
    } catch (error) {
      console.error("Erro ao fazer login com Google", error);
      setErrorMsg("Erro ao fazer login com o Google.");
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      let res;
      if (isLoginMode) {
        res = await signInWithEmailAndPassword(auth, emailOrPhone, password);
        await initUser(res.user);
      } else {
        if (!fullName || !phone || !email) {
          setErrorMsg("Todos os campos são obrigatórios.");
          return;
        }
        
        const cleanPhone = phone.replace(/\D/g, '');
        res = await createUserWithEmailAndPassword(auth, email, password);
        await initUser(res.user, { fullName, phone: cleanPhone });
      }
    } catch (error) {
      console.error("Erro na autenticação", error);
      if (error.code === 'auth/email-already-in-use') {
        setErrorMsg("Este usuário (ou telefone) já está cadastrado.");
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        setErrorMsg("Credenciais incorretas.");
      } else if (error.code === 'auth/weak-password') {
        setErrorMsg("A senha deve ter pelo menos 6 caracteres.");
      } else {
        setErrorMsg("Ocorreu um erro na autenticação.");
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100%', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '10px', fontSize: '2.5rem', color: 'var(--accent-color)', textShadow: '0 0 10px var(--accent-glow)' }}>
          Lama Games
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '30px' }}>
          Jogue xadrez e damas online com seus amigos em uma interface moderna.
        </p>

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
          
          {isLoginMode ? (
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="email" 
                placeholder="Seu Email" 
                className="input-modern" 
                style={{ paddingLeft: '40px' }}
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                required
              />
            </div>
          ) : (
            <>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Nome Completo" 
                  className="input-modern" 
                  style={{ paddingLeft: '40px' }}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div style={{ position: 'relative' }}>
                <Phone size={18} style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="tel" 
                  placeholder="Telefone (WhatsApp)" 
                  className="input-modern" 
                  style={{ paddingLeft: '40px' }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  placeholder="Seu Email" 
                  className="input-modern" 
                  style={{ paddingLeft: '40px' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="password" 
              placeholder="Sua Senha" 
              className="input-modern" 
              style={{ paddingLeft: '40px' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {errorMsg && <div style={{ color: 'var(--danger-color)', fontSize: '0.9rem', textAlign: 'center' }}>{errorMsg}</div>}

          <button type="submit" className="btn" style={{ width: '100%', justifyContent: 'center' }}>
            {isLoginMode ? <LogIn size={20} /> : <UserPlus size={20} />}
            {isLoginMode ? "Entrar" : "Criar Conta"}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <button 
            type="button" 
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setErrorMsg('');
            }}
            style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isLoginMode ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça Login"}
          </button>
        </div>

        <div style={{ position: 'relative', margin: '20px 0', textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--glass-border)', transform: 'translateY(-50%)' }}></div>
          <span style={{ background: 'var(--glass-bg)', padding: '0 10px', position: 'relative', color: 'var(--text-muted)', fontSize: '0.9rem' }}>OU</span>
        </div>
        
        <button type="button" onClick={handleGoogleLogin} className="btn" style={{ width: '100%', justifyContent: 'center', background: 'white', color: '#333' }}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '20px', marginRight: '8px' }} />
          Entrar com o Google
        </button>
      </div>
    </div>
  );
}
