import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'

export default function Chat(){
  const [messages, setMessages] = useState([{ role: 'bot', text: 'Hello — ask me anything about the database.' }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef()

  useEffect(()=>{ endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(){
  if (!input.trim()) return;

  const userMsg = { role: "user", text: input };
  setMessages(m => [...m, userMsg]);
  setInput("");
  setLoading(true);

  try {
    const r = await axios.post("/api/ask", { question: input });
    
    console.log("Backend returned:", r.data); // IMPORTANT DEBUG

    const botText = r.data?.answer ?? "No answer from server.";
    const botMsg = { role: "bot", text: botText };

    setMessages(m => [...m, botMsg]);

  } catch (err) {
    console.error("Frontend error:", err);
    setMessages(m => [
      ...m,
      { role: "bot", text: "Frontend Error: " + err.message }
    ]);
  } finally {
    setLoading(false);
  }
}


  return (
    <div className="chat-wrapper">
      <div className="messages">
        {messages.map((m,i)=> (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble">{m.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="input-row">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if (e.key==='Enter') send() }} placeholder="Ask a question about the database..." />
        <button onClick={send} disabled={loading}>{loading ? '...' : 'Send'}</button>
      </div>

    </div>
  )
}