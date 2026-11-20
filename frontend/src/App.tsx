import { useEffect, useState } from "react";

type Page = "Home" | "Messages" | "Volunteer rooms" | "Peer support" | "Community" | "Settings";

type Message = {
  id: number;
  author: string;
  text: string;
  time: string;
  mine?: boolean;
};

const initialMessages: Message[] = [
  { id: 1, author: "Ananya", text: "Hello everyone! How is everyone doing today?", time: "10:30 AM" },
  { id: 2, author: "Rahul", text: "Doing well, thank you. Happy to help with today's volunteer activities.", time: "10:32 AM" },
  { id: 3, author: "Meera", text: "We have a few community members who need assistance with grocery delivery.", time: "10:35 AM" },
];

const rooms = [
  { name: "Volunteer Dispatch", members: "24 members", icon: "🤝", status: "Active", color: "blue" },
  { name: "Senior Care Circle", members: "18 members", icon: "💙", status: "Active", color: "purple" },
  { name: "Community Help", members: "32 members", icon: "🏡", status: "Active", color: "green" },
];

function App() {
  const [page, setPage] = useState<Page>("Home");
  const [largeFont, setLargeFont] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState("Volunteer Dispatch");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("large-font", largeFont);
    document.documentElement.classList.toggle("dark-mode", darkMode);
  }, [largeFont, darkMode]);

  function announce(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3000);
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) {
      announce("Text-to-speech is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  function startVoiceInput() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      announce("Voice typing is not supported in this browser. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      setMessage((old) => old + event.results[0][0].transcript);
    };
    recognition.onerror = () => announce("Voice input could not be completed.");
    recognition.start();
    announce("Listening. Please speak now.");
  }

  function sendMessage() {
    const text = message.trim();
    if (!text) return;

    setMessages((old) => [
      ...old,
      {
        id: Date.now(),
        author: "You",
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mine: true,
      },
    ]);
    setMessage("");
  }

  const navItems: { name: Page; icon: string }[] = [
    { name: "Home", icon: "⌂" },
    { name: "Messages", icon: "▤" },
    { name: "Volunteer rooms", icon: "♧" },
    { name: "Peer support", icon: "♡" },
    { name: "Community", icon: "◎" },
    { name: "Settings", icon: "⚙" },
  ];

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">♡</div>
          <div>
            <strong>Humanity Connect</strong>
            <span>Community together</span>
          </div>
        </div>

        <div className="nav-label">MENU</div>
        <nav aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${page === item.name ? "active" : ""}`}
              onClick={() => setPage(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
              {item.name === "Messages" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">💙</div>
            <strong>Need a helping hand?</strong>
            <p>Our community is here for you.</p>
            <button onClick={() => setPage("Peer support")}>Get support →</button>
          </div>
          <div className="profile">
            <div className="avatar avatar-blue">HC</div>
            <div className="profile-info">
              <strong>Guest member</strong>
              <span>Preview mode</span>
            </div>
            <span className="profile-menu">•••</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Humanity Connect <span>/</span> {page}</div>
          <div className="top-actions">
            <button className="accessibility-button" onClick={() => setLargeFont(!largeFont)}>
              Aa <span>{largeFont ? "Normal text" : "Large text"}</span>
            </button>
            <button className="icon-button" title="Toggle dark mode" onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? "☀" : "◐"}
            </button>
            <div className="top-avatar">HC</div>
          </div>
        </header>

        {page === "Home" && (
          <div className="page-content">
            <section className="welcome-banner">
              <div className="welcome-copy">
                <div className="eyebrow"><span className="live-dot" /> A COMMUNITY THAT CARES</div>
                <h1>Good day! <span>Let's make a difference.</span></h1>
                <p>Small acts of kindness create a stronger, more connected community.</p>
                <button className="primary-button" onClick={() => setPage("Volunteer rooms")}>
                  Explore volunteer rooms <span>→</span>
                </button>
              </div>
              <div className="welcome-art" aria-hidden="true">
                <div className="art-circle">♡</div>
                <div className="art-person">🤝</div>
                <div className="art-caption">Together, we care.</div>
              </div>
            </section>

            <div className="section-heading">
              <div><h2>Your community at a glance</h2><p>Stay connected and see what's happening.</p></div>
            </div>

            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon blue-bg">👥</div>
                <span>Community members</span><strong>Welcome!</strong>
                <small>Every person matters</small>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange-bg">🤝</div>
                <span>Volunteer spaces</span><strong>3 rooms</strong>
                <small>Find ways to help</small>
              </div>
              <div className="stat-card">
                <div className="stat-icon purple-bg">💬</div>
                <span>Conversations</span><strong>Get connected</strong>
                <small>Reach out to someone</small>
              </div>
              <div className="stat-card">
                <div className="stat-icon green-bg">💚</div>
                <span>Community spirit</span><strong>Growing together</strong>
                <small>One kind act at a time</small>
              </div>
            </section>

            <section className="home-columns">
              <div className="panel">
                <div className="panel-heading"><div><h2>Community rooms</h2><p>Places where people come together.</p></div><button className="text-button" onClick={() => setPage("Volunteer rooms")}>View all →</button></div>
                {rooms.map((room) => (
                  <button className="room-row" key={room.name} onClick={() => { setSelectedRoom(room.name); setPage("Messages"); }}>
                    <div className={`room-icon ${room.color}`}>{room.icon}</div>
                    <div className="room-detail"><strong>{room.name}</strong><span>{room.members}</span></div>
                    <span className="status"><i /> {room.status}</span>
                    <span className="row-arrow">›</span>
                  </button>
                ))}
              </div>

              <div className="panel kindness-panel">
                <div className="kindness-illustration">💙</div>
                <div className="eyebrow">A LITTLE REMINDER</div>
                <h2>You belong here.</h2>
                <p>Whether you need help, want to offer support, or simply wish to connect, there is a place for you.</p>
                <button className="secondary-button" onClick={() => setPage("Peer support")}>Find peer support →</button>
              </div>
            </section>

            <div className="accessibility-strip">
              <span>♿</span>
              <div><strong>Communication should be accessible to everyone.</strong><p>Use large text, voice input and read-aloud features whenever you need them.</p></div>
              <button onClick={() => setLargeFont(!largeFont)}>Try accessibility →</button>
            </div>
          </div>
        )}

        {page === "Messages" && (
          <div className="page-content chat-page">
            <div className="section-heading"><div><h1>Your conversations</h1><p>Connect with your community.</p></div></div>
            <div className="chat-layout">
              <section className="panel chat-room-list">
                <h2>Community rooms</h2>
                <input className="search-input" placeholder="Search rooms..." value={search} onChange={(e) => setSearch(e.target.value)} />
                {filteredRooms.map((room) => (
                  <button key={room.name} className={`chat-room-option ${selectedRoom === room.name ? "selected" : ""}`} onClick={() => setSelectedRoom(room.name)}>
                    <span className={`room-icon ${room.color}`}>{room.icon}</span>
                    <span><strong>{room.name}</strong><small>{room.members}</small></span>
                  </button>
                ))}
              </section>
              <section className="panel chat-window">
                <div className="chat-header">
                  <div className="room-icon blue">{rooms.find(r => r.name === selectedRoom)?.icon || "💬"}</div>
                  <div><strong>{selectedRoom}</strong><small>Preview conversation · SDK connection pending</small></div>
                  <span className="secure-label">Community room</span>
                </div>
                <div className="message-list">
                  <div className="date-divider">TODAY</div>
                  {messages.map((msg) => (
                    <div className={`message-row ${msg.mine ? "mine" : ""}`} key={msg.id}>
                      {!msg.mine && <div className="message-avatar">{msg.author[0]}</div>}
                      <div className="message-content">
                        {!msg.mine && <strong>{msg.author}</strong>}
                        <div className="message-bubble">{msg.text}</div>
                        <small>{msg.time}</small>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="chat-composer">
                  <textarea aria-label="Write a message" placeholder="Write a kind message..." value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
                  <div className="composer-actions">
                    <div><button title="Voice input" onClick={startVoiceInput}>🎙 Voice typing</button><button title="Read message aloud" onClick={() => speak(message || "Welcome to Humanity Connect.")}>🔊 Read aloud</button></div>
                    <button className="primary-button send-button" onClick={sendMessage}>Send message ↑</button>
                  </div>
                </div>
                <div className="preview-note">This is a local interface preview. Messages are not yet sent to Nexconn.</div>
              </section>
            </div>
          </div>
        )}

        {page === "Volunteer rooms" && (
          <div className="page-content">
            <div className="section-heading"><div><h1>Volunteer rooms</h1><p>People helping people. Find a community where you can make a difference.</p></div></div>
            <div className="room-cards">
              {rooms.map((room, index) => (
                <article className="panel room-card" key={room.name}>
                  <div className={`room-icon big ${room.color}`}>{room.icon}</div>
                  <span className="room-tag">COMMUNITY ROOM</span>
                  <h2>{room.name}</h2>
                  <p>{["Coordinate local volunteers and share requests for assistance.", "A welcoming space for conversation, friendship and mutual support.", "Connect neighbours and organize help for community needs."][index]}</p>
                  <div className="room-card-bottom"><span>👥 {room.members}</span><button className="primary-button" onClick={() => { setSelectedRoom(room.name); setPage("Messages"); }}>Open room →</button></div>
                </article>
              ))}
            </div>
          </div>
        )}

        {page === "Peer support" && (
          <div className="page-content">
            <div className="section-heading"><div><h1>Peer support</h1><p>You don't have to face everything alone.</p></div></div>
            <div className="support-hero panel">
              <div className="support-symbol">♡</div>
              <div><div className="eyebrow">YOU ARE NOT ALONE</div><h2>A listening ear can make a difference.</h2><p>Connect with your community, share how you are feeling, or offer a little encouragement to someone else.</p><button className="primary-button" onClick={() => setPage("Messages")}>Visit support conversations →</button></div>
            </div>
            <div className="support-grid">
              <div className="panel"><div className="stat-icon purple-bg">☀</div><h2>Daily check-ins</h2><p>Take a moment to connect and let others know how you are doing.</p><button className="text-button" onClick={() => announce("Check-in feature will be connected to the backend in a later stage.")}>Start a check-in →</button></div>
              <div className="panel"><div className="stat-icon green-bg">💚</div><h2>Offer encouragement</h2><p>A kind word or friendly conversation can brighten someone's day.</p><button className="text-button" onClick={() => setPage("Messages")}>Send encouragement →</button></div>
            </div>
            <p className="safety-note">Humanity Connect is a community-support platform, not an emergency or clinical service. For immediate danger, contact your local emergency services.</p>
          </div>
        )}

        {page === "Community" && (
          <div className="page-content">
            <div className="section-heading"><div><h1>Our community</h1><p>A place for connection, kindness and shared purpose.</p></div></div>
            <div className="panel community-panel"><div className="community-symbol">🌍</div><h2>Stronger together</h2><p>Our goal is to make communication easier and community support more accessible for everyone.</p><button className="primary-button" onClick={() => setPage("Volunteer rooms")}>Explore community rooms →</button></div>
          </div>
        )}

        {page === "Settings" && (
          <div className="page-content">
            <div className="section-heading"><div><h1>Accessibility settings</h1><p>Make Humanity Connect comfortable for you.</p></div></div>
            <div className="panel settings-panel">
              <div className="setting-row"><div><strong>Large text</strong><p>Increase text size across the website.</p></div><button className={`toggle ${largeFont ? "on" : ""}`} onClick={() => setLargeFont(!largeFont)} aria-label="Toggle large text"><span /></button></div>
              <div className="setting-row"><div><strong>Dark appearance</strong><p>Use a darker colour scheme.</p></div><button className={`toggle ${darkMode ? "on" : ""}`} onClick={() => setDarkMode(!darkMode)} aria-label="Toggle dark appearance"><span /></button></div>
              <div className="setting-row"><div><strong>Read-aloud support</strong><p>Use your browser's speech synthesis to read text.</p></div><button className={`toggle ${voiceEnabled ? "on" : ""}`} onClick={() => setVoiceEnabled(!voiceEnabled)} aria-label="Toggle read aloud">{voiceEnabled ? "On" : "Off"}</button></div>
              <button className="secondary-button" onClick={() => speak("Welcome to Humanity Connect. We are glad you are here.")}>🔊 Test read aloud</button>
            </div>
          </div>
        )}

        <footer className="footer">
          <span>© 2026 Humanity Connect</span>
          <span>Built with care for every community. 💙</span>
        </footer>
      </main>

      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}

export default App;