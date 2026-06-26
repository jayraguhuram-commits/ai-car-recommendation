import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE from '../api';
import './ChatBot.css';

export default function ChatBot() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'model', content: 'Hi! Tell me about your trip and I\'ll find the right car for you.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    const newHistory = [...messages, { role: 'user', content: userMsg }];
    setMessages(newHistory);
    setLoading(true);

    try {
      const res = await fetch(`${BASE}/api/recommend/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: messages })
      });
      const data = await res.json();
      if (data.success) {
        setMessages([...newHistory, { role: 'model', content: data.reply }]);
        
        // If the bot says "Shall I take you to the booking form?" or similar,
        // we can optionally parse for a car name and navigate. For now, let the user click a link.
      } else {
        setMessages([...newHistory, { role: 'model', content: 'Sorry, I encountered an error. Please try again.' }]);
      }
    } catch (err) {
      setMessages([...newHistory, { role: 'model', content: 'Network error. Please try the recommendation form.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button className="chatbot-fab" onClick={() => setIsOpen(true)}>
        <span className="fab-icon">🤖</span>
        <span className="fab-text">Chat with Mani</span>
      </button>
    );
  }

  return (
    <div className="chatbot-panel card shadow-active">
      <div className="chatbot-header">
        <div className="chatbot-title">
          <span className="title-icon">🚗</span>
          Car Assistant by Manivtha
        </div>
        <button className="chatbot-minimize" onClick={() => setIsOpen(false)}>━</button>
      </div>

      <div className="chatbot-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble-wrapper ${msg.role === 'user' ? 'user' : 'model'}`}>
            {msg.role === 'model' && <div className="chat-avatar">🤖</div>}
            <div className={`chat-bubble ${msg.role}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-bubble-wrapper model">
            <div className="chat-avatar">🤖</div>
            <div className="chat-bubble model typing">
              <span className="dot"></span><span className="dot"></span><span className="dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chatbot-input-area" onSubmit={handleSend}>
        <input
          type="text"
          className="chat-input"
          placeholder="Type your message here..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="chat-send-btn" disabled={!input.trim() || loading}>
          ➤
        </button>
      </form>
    </div>
  );
}
