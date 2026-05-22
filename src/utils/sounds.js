// Utils de Áudio utilizando as URLs públicas do Lichess (livres)
const SOUND_URLS = {
  move: 'https://lichess1.org/assets/_2hB02w/sound/standard/Move.ogg',
  capture: 'https://lichess1.org/assets/_2hB02w/sound/standard/Capture.ogg',
  check: 'https://lichess1.org/assets/_2hB02w/sound/standard/Check.ogg',
  gameStart: 'https://lichess1.org/assets/_2hB02w/sound/standard/GenericNotify.ogg'
};

const audioCache = {};

// Preload dos sons
export const initSounds = () => {
  Object.keys(SOUND_URLS).forEach(key => {
    const audio = new Audio(SOUND_URLS[key]);
    audio.preload = 'auto';
    audioCache[key] = audio;
  });
};

export const playSound = (type) => {
  try {
    let audio = audioCache[type];
    if (!audio) {
      audio = new Audio(SOUND_URLS[type]);
      audioCache[type] = audio;
    }
    
    // Clona o nó para permitir tocar o mesmo som muito rápido
    const playPromise = audio.cloneNode().play();
    
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        // Erros de autoplay do navegador são normais, ignorar silenciosamente
        console.warn("Autoplay bloqueado pelo navegador:", error);
      });
    }
  } catch (err) {
    console.error("Erro ao tentar reproduzir áudio:", err);
  }
};
