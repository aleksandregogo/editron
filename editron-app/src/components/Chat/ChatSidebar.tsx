import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User, ChevronRight } from 'lucide-react';
import './ChatSidebar.css';
import { apiClient } from '../../utils/api';

interface ChatSidebarProps {
  documentUuid?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ documentUuid }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch chat history on component mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const historyMessages = await apiClient.getChatHistory() as any[];
        setMessages(historyMessages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        })));
      } catch (error) {
        console.error("Failed to fetch chat history:", error);
      }
    };

    fetchHistory();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    const promptText = input;
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const reader = await apiClient.chatQuery(promptText, documentUuid);
      
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                if (data.type === 'chunk' && data.content) {
                  setMessages(prev => prev.map((msg, index) =>
                    index === prev.length - 1 ? { ...msg, content: msg.content + data.content } : msg
                  ));
                } else if (data.type === 'error') {
                  console.error('Chat error:', data.message);
                }
              } catch(e) {
                // Ignore parse errors on partial chunks
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat request failed:', error);
      setMessages(prev => prev.slice(0, -1));
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMinimized = () => {
    setIsMinimized(!isMinimized);
  };

  // Minimized state - thin tab on the right edge
  if (isMinimized) {
    return (
      <div 
        className="chat-sidebar-minimized"
        onClick={toggleMinimized}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '48px',
          height: '100vh',
          backgroundColor: 'var(--bg-tertiary)',
          borderLeft: '1px solid var(--border-primary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 'var(--z-fixed)',
          transition: 'all var(--transition-normal)',
        }}
      >
        <div 
          className="chat-tab-content"
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: 'center',
            whiteSpace: 'nowrap',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <MessageSquare size={16} />
          <span>{documentUuid ? 'Document Chat' : 'AI Chat'}</span>
        </div>
      </div>
    );
  }

  // Expanded state - full sidebar
  return (
    <div 
      className="chat-sidebar-expanded"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '25vw', // 1/4 of screen width
        minWidth: '300px',
        maxWidth: '500px',
        height: '100vh',
        backgroundColor: 'var(--bg-elevated)',
        borderLeft: '1px solid var(--border-primary)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 'var(--z-fixed)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* Header */}
      <div 
        className="chat-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--border-secondary)',
          backgroundColor: 'var(--bg-tertiary)',
          minHeight: '56px',
        }}
      >
        <div 
          className="header-content"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <MessageSquare 
            size={18} 
            style={{ color: 'var(--accent-primary)' }}
          />
          <div>
            <h3 
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--text-primary)',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {documentUuid ? 'Document Assistant' : 'AI Assistant'}
            </h3>
            <p 
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {documentUuid ? 'Ask about this document' : 'General chat about your documents'}
            </p>
          </div>
        </div>
        
        <button
          onClick={toggleMinimized}
          className="minimize-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollAreaRef}
        className="messages-container"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-4)',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        {messages.length === 0 && (
          <div 
            className="empty-state"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
            }}
          >
            <MessageSquare 
              size={48} 
              style={{ 
                marginBottom: 'var(--space-4)',
                opacity: 0.5,
              }}
            />
            <h4 
              style={{
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-weight-medium)',
                marginBottom: 'var(--space-2)',
                color: 'var(--text-secondary)',
              }}
            >
              Start a conversation
            </h4>
            <p 
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-tertiary)',
                maxWidth: '200px',
              }}
            >
              {documentUuid 
                ? 'Ask questions about this document or request edits'
                : 'Ask questions about your document library'
              }
            </p>
          </div>
        )}
        
        <div className="messages-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={`message-wrapper ${msg.role}`}
              style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
              }}
            >
              {/* Avatar */}
              <div 
                className="message-avatar"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  backgroundColor: msg.role === 'user' 
                    ? 'var(--accent-primary)' 
                    : 'var(--bg-tertiary)',
                  color: msg.role === 'user' 
                    ? 'var(--text-inverse)' 
                    : 'var(--accent-primary)',
                }}
              >
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              
              {/* Message Bubble */}
              <div 
                className="message-bubble"
                style={{
                  maxWidth: '85%',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: msg.role === 'user' 
                    ? 'var(--accent-primary)' 
                    : 'var(--bg-elevated)',
                  color: msg.role === 'user' 
                    ? 'var(--text-inverse)' 
                    : 'var(--text-primary)',
                  border: msg.role === 'assistant' 
                    ? '1px solid var(--border-primary)' 
                    : 'none',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <p 
                  style={{
                    fontSize: 'var(--text-sm)',
                    lineHeight: 'var(--line-height-relaxed)',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content || (msg.role === 'assistant' && isLoading ? (
                    <span style={{ opacity: 0.7 }}>
                      <span className="typing-indicator">Thinking</span>
                      <span className="dots">...</span>
                    </span>
                  ) : '')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Input Form */}
      <form 
        onSubmit={handleSubmit} 
        className="chat-input-form"
        style={{
          padding: 'var(--space-4)',
          borderTop: '1px solid var(--border-secondary)',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        <div 
          className="input-container"
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ flex: 1 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={documentUuid ? "Ask about the document..." : "Ask about your documents..."}
              disabled={isLoading}
              rows={1}
              style={{
                width: '100%',
                minHeight: '40px',
                maxHeight: '120px',
                padding: 'var(--space-3)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-family-sans)',
                resize: 'none',
                outline: 'none',
                transition: 'border-color var(--transition-fast)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent-primary)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-primary)';
              }}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="send-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              backgroundColor: input.trim() && !isLoading ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: input.trim() && !isLoading ? 'var(--text-inverse)' : 'var(--text-tertiary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              if (!isLoading && input.trim()) {
                e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && input.trim()) {
                e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
              }
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </form>


    </div>
  );
}; 