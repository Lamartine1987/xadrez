import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Send, Smile } from 'lucide-react';

export default function LiveChat({ gameId, user, gameData, myName }) {
  const [text, setText] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const chatContainerRef = useRef(null);

  const chat = gameData?.chat || [];

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chat.length]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;

    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      chat: arrayUnion({
        sender: user.uid,
        name: myName,
        text: text.trim(),
        timestamp: Date.now()
      })
    });
    setText('');
    setShowEmojis(false);
  };

  const handleEmoji = async (emoji) => {
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      chat: arrayUnion({
        sender: user.uid,
        name: myName,
        text: emoji,
        timestamp: Date.now()
      })
    });
    setShowEmojis(false);
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '250px', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 15px', background: 'rgba(255,255,255,0.05)', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        Chat da Partida
      </div>
      
      <div ref={chatContainerRef} style={{ flex: 1, padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {chat.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '20px' }}>
            Nenhuma mensagem. Diga olá!
          </div>
        )}
        {chat.map((msg, idx) => {
          const isMe = msg.sender === user.uid;
          return (
            <div key={idx} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', textAlign: isMe ? 'right' : 'left' }}>
                {isMe ? 'Você' : msg.name}
              </div>
              <div style={{ 
                background: isMe ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)', 
                color: 'white', 
                padding: '6px 12px', 
                borderRadius: '12px', 
                borderTopRightRadius: isMe ? '2px' : '12px',
                borderTopLeftRadius: !isMe ? '2px' : '12px',
                fontSize: '0.9rem',
                wordBreak: 'break-word'
              }}>
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ position: 'relative' }}>
        {showEmojis && (
          <div style={{ position: 'absolute', bottom: '100%', left: '10px', background: '#1e293b', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px', display: 'flex', gap: '10px', zIndex: 10, boxShadow: '0 -4px 10px rgba(0,0,0,0.5)' }}>
            {['👋', '🤔', '👏', '😅', '🔥', '😠', 'GG'].map(emoji => (
              <button 
                key={emoji}
                onClick={() => handleEmoji(emoji)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseOver={e => e.target.style.transform = 'scale(1.2)'}
                onMouseOut={e => e.target.style.transform = 'scale(1)'}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleSend} style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '8px' }}>
          <button 
            type="button" 
            onClick={() => setShowEmojis(!showEmojis)}
            style={{ background: 'none', border: 'none', color: showEmojis ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer', padding: '8px' }}
          >
            <Smile size={20} />
          </button>
          <input 
            type="text" 
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Mensagem..." 
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', padding: '8px', outline: 'none' }}
          />
          <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', padding: '8px' }}>
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
