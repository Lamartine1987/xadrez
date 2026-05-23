import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, functions, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ArrowLeft, Settings, Smartphone, RefreshCw, Play, MessageSquare, Save } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function AdminSettings({ user }) {
  const navigate = useNavigate();
  const [qrCode, setQrCode] = useState(null);
  const [botStatus, setBotStatus] = useState('Verificando...');
  const [loading, setLoading] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState('');
  const [savingMessage, setSavingMessage] = useState(false);
  const defaultTemplate = "🏆 Olá {{name}}! A sua partida de {{gameType}} do torneio já está pronta. Clique no link para jogar: {{link}}";

  const getWhatsappStatus = httpsCallable(functions, 'getWhatsappStatus');
  const createWhatsappInstance = httpsCallable(functions, 'createWhatsappInstance');

  const checkStatus = async () => {
    setLoading(true);
    try {
      const result = await getWhatsappStatus();
      if (result.data.success) {
         const data = result.data.data; // Retorno do backend do apiz
         setBotStatus(data.status || 'Desconhecido');
         setQrCode(data.qr || null);
      } else {
         setBotStatus(result.data.status === 'NOT_FOUND' ? 'Instância não existe' : 'Erro');
         setQrCode(null);
      }
    } catch(err) {
      console.error(err);
      setBotStatus('Erro de conexão');
      setQrCode(null);
    } finally {
      setLoading(false);
    }
  };

  const createInstance = async () => {
     setLoading(true);
     setBotStatus('Criando instância na Nuvem...');
     try {
       await createWhatsappInstance();
       // Aguarda um pouco e chama o status
       setTimeout(checkStatus, 3000);
     } catch(err) {
       console.error(err);
       setBotStatus('Erro ao criar instância');
       setLoading(false);
     }
  };

  const saveTemplate = async () => {
     setSavingMessage(true);
     try {
        await setDoc(doc(db, 'settings', 'whatsapp'), { template: messageTemplate });
        alert("Mensagem salva com sucesso!");
     } catch(err) {
        console.error(err);
        alert("Erro ao salvar mensagem.");
     } finally {
        setSavingMessage(false);
     }
  };

  useEffect(() => {
    const loadSettings = async () => {
       try {
          const snap = await getDoc(doc(db, 'settings', 'whatsapp'));
          if (snap.exists() && snap.data().template) {
             setMessageTemplate(snap.data().template);
          } else {
             setMessageTemplate(defaultTemplate);
          }
       } catch(e) { console.error(e); }
    };
    loadSettings();

    checkStatus();
    // Faz polling a cada 5 segundos para caso o usuário esteja escaneando o QR Code
    const interval = setInterval(() => {
       if (botStatus !== 'CONNECTED') {
          checkStatus();
       }
    }, 5000);

    return () => clearInterval(interval);
  }, [botStatus]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', color: 'var(--text-main)', paddingBottom: '90px' }}>
      <header style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--glass-border)' }}>
        <button onClick={() => navigate('/lobby')} className="btn" style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--glass-border)' }}>
          <ArrowLeft size={18} /> Voltar
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto', marginRight: 'auto' }}>
          <Settings size={24} color="#fbbf24" />
          <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'white' }}>Configurações de Admin</span>
        </div>
      </header>

      <main style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', textAlign: 'center', padding: '30px' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '10px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <Smartphone size={28} color="#25D366" /> Bot do WhatsApp
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            Conexão com a Nuvem de WhatsApp API para envio automático dos links dos torneios.
          </p>
          
          <div style={{ marginBottom: '20px', fontWeight: 'bold', color: botStatus === 'CONNECTED' ? 'var(--success-color)' : 'var(--accent-color)' }}>
            Status da Instância "xadrez": {botStatus}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            <button onClick={checkStatus} disabled={loading} className="btn" style={{ background: 'var(--bg-color-lighter)' }}>
               <RefreshCw size={16} className={loading ? "spin" : ""} /> Atualizar Status
            </button>
            {botStatus === 'Instância não existe' && (
              <button onClick={createInstance} disabled={loading} className="btn" style={{ background: 'var(--accent-color)' }}>
                 <Play size={16} /> Criar Instância
              </button>
            )}
          </div>

          {qrCode && botStatus === 'QR_READY' ? (
            <div style={{ background: 'white', padding: '20px', borderRadius: '12px', display: 'inline-block' }}>
               {qrCode.startsWith('data:image') ? (
                 <img src={qrCode} alt="WhatsApp QR Code" style={{ width: '250px', height: '250px' }} />
               ) : (
                 <div style={{ background: 'white', padding: '10px' }}>
                    <QRCodeSVG value={qrCode} size={250} />
                 </div>
               )}
               <p style={{ color: 'black', marginTop: '10px', fontWeight: 'bold' }}>Escaneie no seu WhatsApp</p>
            </div>
          ) : (
            <div style={{ width: '250px', height: '250px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', border: '1px dashed var(--glass-border)' }}>
              {botStatus === 'CONNECTED' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: 'var(--success-color)', fontWeight: 'bold', fontSize: '1.2rem' }}>Sessão Ativa!</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Bot pronto para enviar links.</span>
                </div>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>
                  {loading ? 'Carregando...' : (botStatus === 'QR_READY' ? 'Gerando imagem...' : 'Sem QR Code')}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', textAlign: 'center', padding: '30px' }}>
           <h2 style={{ fontSize: '1.5rem', marginBottom: '10px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
             <MessageSquare size={24} color="var(--accent-color)" /> Mensagem Automática
           </h2>
           <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
             Personalize a mensagem enviada aos jogadores. <br/>
             Use as tags <b>{`{{name}}`}</b>, <b>{`{{gameType}}`}</b> e <b>{`{{link}}`}</b>.
           </p>
           <textarea 
             value={messageTemplate}
             onChange={(e) => setMessageTemplate(e.target.value)}
             className="input-modern"
             style={{ minHeight: '120px', resize: 'vertical', textAlign: 'left', width: '100%', boxSizing: 'border-box' }}
           />
           <button onClick={saveTemplate} disabled={savingMessage} className="btn" style={{ width: '100%', marginTop: '15px', background: 'var(--success-color)', justifyContent: 'center', border: 'none' }}>
             {savingMessage ? 'Salvando...' : <><Save size={18} /> Salvar Mensagem</>}
           </button>
        </div>
      </main>
    </div>
  );
}
