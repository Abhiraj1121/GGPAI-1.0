document.addEventListener('DOMContentLoaded', () => {
  // 🔧 DOM Elements
  const chat = document.getElementById('chat');
  const msg = document.getElementById('msg');
  const send = document.getElementById('send');
  const mic = document.getElementById('mic');
  const micStatus = document.getElementById('mic-status');
  const themeToggle = document.getElementById('themeToggle');
  const muteToggle = document.getElementById('muteToggle');
  const voiceOnlyToggle = document.getElementById('voiceOnlyToggle');
  const languageToggle = document.getElementById('languageToggle');
  const chips = document.querySelectorAll('.chip');
  const avatar = document.querySelector('.avatar');
  const listeningAnimation = document.getElementById('listeningAnimation');

  // 🔁 State
  let isMuted = false;
  let voiceOnly = false;
  let currentSpeech = null;
  let typingBubble = null;

  // 🖋 Typing Animation
  function typeText(text, element, speed = 40, callback = null) {
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        element.innerHTML += text.charAt(i);
        i++;
      } else {
        clearInterval(interval);
        if (callback) callback();
      }
    }, speed);
  }

  // 💬 Chat Bubble
  function addBubble(text, who = 'bot', meta = '', animate = false) {
    if (voiceOnly) return;
    const b = document.createElement('div');
    b.className = `bubble ${who}`;
    const content = document.createElement('div');
    content.className = 'ai-text';
    b.appendChild(content);

    if (animate && who === 'bot') {
      typeText(text, content, 40, () => {
        if (meta) {
          const metaDiv = document.createElement('div');
          metaDiv.className = 'meta';
          metaDiv.innerHTML = meta;
          b.appendChild(metaDiv);
        }
      });
    } else {
      content.innerHTML = text;
      if (meta) {
        const metaDiv = document.createElement('div');
        metaDiv.className = 'meta';
        metaDiv.innerHTML = meta;
        b.appendChild(metaDiv);
      }
    }

    chat.appendChild(b);
    autoScroll();
    chat.scrollTop = chat.scrollHeight;
  }

  function addTyping() {
    if (voiceOnly) return;
    typingBubble = document.createElement('div');
    typingBubble.className = 'bubble bot typing';
    typingBubble.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
      <div class="dot"></div><div class="dot"></div><div class="dot"></div>
      </div>`;
      chat.appendChild(typingBubble);

  // ✅ This ensures it scrolls *after* DOM update
  requestAnimationFrame(() => {
    chat.scrollTop = chat.scrollHeight;
  });
}


  function removeTyping() {
    if (typingBubble) {
      typingBubble.remove();
      typingBubble = null;
    }
  }

  // 📤 Send Message
  async function sendMessage(text) {
    const cleaned = text.trim();
    if (!cleaned) {
      addBubble('GURUBot: Please enter a valid question.', 'bot');
      return;
    }

    window.speechSynthesis.cancel();
    removeTyping();

    addBubble(`You: ${cleaned}`, 'user', new Date().toLocaleTimeString());
    msg.value = '';
    addTyping();

    try {
      const res = await fetch('https://ggpai-1-0.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: cleaned })
      }).then(r => r.json());

      removeTyping();
      const isHindi = /[\u0900-\u097F]/.test(res.reply);

      setTimeout(() => {
        addBubble(`GURUBot: ${res.reply}`, 'bot', isHindi ? '🗣️ Spoken in Hindi' : '🗣️ Spoken in English', true);
        speak(res.reply);
      }, 500);
    } catch (err) {
      removeTyping();
      addBubble('GURUBot: Sorry, something went wrong. Try again.', 'bot');
      console.error("Error sending message:", err);
    }
  }

  // 🔊 Speak Response
  function speak(text) {
    if (!text || !('speechSynthesis' in window) || isMuted) return;

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.2;

    const selectedLang = languageToggle?.value || 'auto';
    const isHindi = /[\u0900-\u097F]/.test(text);
    utter.lang = selectedLang === 'en' ? 'en-GB' :
                 selectedLang === 'hi' ? 'hi-IN' :
                 isHindi ? 'hi-IN' : 'en-GB';

    const setVoice = () => {
      const voices = speechSynthesis.getVoices();
      const preferred = voices.find(v =>
        utter.lang === 'hi-IN'
          ? v.lang === 'hi-IN' || v.name.includes('Hindi')
          : v.name === 'Google UK English Female'
      );
      if (preferred) utter.voice = preferred;

      avatar?.classList.add('voice-anim');
      listeningAnimation.style.display = 'block';
      speechSynthesis.cancel();
      speechSynthesis.speak(utter);
      currentSpeech = utter;

      utter.onend = () => {
        avatar?.classList.remove('voice-anim');
        listeningAnimation.style.display = 'none';
        if (voiceOnly && recognition) recognition.start();
      };
    };

    if (speechSynthesis.getVoices().length === 0) {
      speechSynthesis.onvoiceschanged = setVoice;
    } else {
      setVoice();
    }
  }

  // 🎤 Voice Recognition
  let recognition;
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;

    recognition.onstart = () => {
      mic.classList.add('mic-active');
      micStatus.textContent = '🎤 Listening...';
      listeningAnimation.style.display = 'block';
    };

    recognition.onresult = e => {
      const transcript = e.results[0][0].transcript;
      msg.value = transcript;
      sendMessage(transcript);
    };

    recognition.onend = () => {
      mic.classList.remove('mic-active');
      micStatus.textContent = '';
      listeningAnimation.style.display = 'none';
    };

    recognition.onerror = () => {
      mic.classList.remove('mic-active');
      micStatus.textContent = '';
      listeningAnimation.style.display = 'none';
      addBubble('GURUBot: Voice input failed. Try typing instead.', 'bot');
    };

    mic.addEventListener('click', () => recognition.start());
  } else {
    mic.style.opacity = 0.45;
    mic.title = 'Voice input not supported';
  }

  // 🧠 UI Event Listeners
  send.addEventListener('click', () => sendMessage(msg.value));
  msg.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendMessage(msg.value);
  });

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    themeToggle.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
  });

  muteToggle.addEventListener('click', () => {
    isMuted = !isMuted;
    muteToggle.textContent = isMuted ? '🔇' : '🔊';
  });

  voiceOnlyToggle.addEventListener('click', () => {
    voiceOnly = !voiceOnly;
    document.body.classList.toggle('voice-only', voiceOnly);

    if (voiceOnly && recognition) {
      listeningAnimation.style.display = 'block';
      speak("Hello, I’m GURUBot. I’m listening.");
    }
  });

  chips.forEach(c => c.addEventListener('click', () => {
    const q = c.dataset.q;
    msg.value = q;
    sendMessage(q);
  }));

  // 🌞 Initial Theme
  themeToggle.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';

  // 👋 Welcome Message
  addBubble('GURUBot: Hello. I am GURUBot, your assistant for Guru Gobind Singh Public School, Sector 5, Bokaro Steel City, Jharkhand, India.', 'bot', '', true);
  speak("नमस्ते! मैं GURUBot हूँ, आपका स्कूल सहायक। आप मुझसे कुछ भी पूछ सकते हैं।");
});
function autoScroll() {
  const chat = document.getElementById('chat');
  requestAnimationFrame(() => {
    chat.scrollTop = chat.scrollHeight;
  });
}

window.addEventListener('load', () => {
  listeningAnimation.style.display = 'none';
});
