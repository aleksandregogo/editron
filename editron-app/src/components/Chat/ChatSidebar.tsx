import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User, ChevronRight } from 'lucide-react';
import { apiClient } from '../../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

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
        className="fixed top-0 right-0 w-12 h-screen bg-muted border-l border-border flex flex-col items-center justify-center cursor-pointer z-30 transition-all duration-300 hover:bg-muted/80"
        onClick={toggleMinimized}
      >
        <div className="rotate-[-90deg] origin-center whitespace-nowrap text-sm font-medium text-muted-foreground flex items-center gap-2">
          <MessageSquare size={16} />
          <span>{documentUuid ? 'Document Chat' : 'AI Chat'}</span>
        </div>
      </div>
    );
  }

  // Expanded state - full sidebar
  return (
    <div className="fixed top-0 right-0 w-[25vw] min-w-[300px] max-w-[500px] h-screen bg-card border-l border-border flex flex-col z-30 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50 min-h-[56px]">
        <div className="flex items-center gap-3">
          <MessageSquare size={18} className="text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground m-0 leading-tight">
              {documentUuid ? 'Document Assistant' : 'AI Assistant'}
            </h3>
            <p className="text-xs text-muted-foreground m-0 leading-tight">
              {documentUuid ? 'Ask about this document' : 'General chat about your documents'}
            </p>
          </div>
        </div>
        
        <Button
          onClick={toggleMinimized}
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0"
        >
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto p-4 bg-background scrollbar-thin scrollbar-thumb-border scrollbar-track-muted"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare size={48} className="mb-4 opacity-50 text-muted-foreground" />
            <h4 className="text-base font-medium mb-2 text-muted-foreground">
              Start a conversation
            </h4>
            <p className="text-sm text-muted-foreground max-w-[200px]">
              {documentUuid 
                ? 'Ask questions about this document or request edits'
                : 'Ask questions about your document library'
              }
            </p>
          </div>
        )}
        
        <div className="flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-primary'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              
              {/* Message Bubble */}
              <div className={`max-w-[85%] p-3 rounded-lg shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-card text-card-foreground border border-border'
              }`}>
                <p className="text-sm leading-relaxed m-0 whitespace-pre-wrap">
                  {msg.content || (msg.role === 'assistant' && isLoading ? (
                    <span className="opacity-70">
                      <span className="animate-pulse">Thinking</span>
                      <span className="animate-bounce">...</span>
                    </span>
                  ) : '')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Input Form */}
      <div className="p-4 border-t border-border bg-card">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <div className="flex-1">
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
              className="w-full min-h-[40px] max-h-[120px] p-3 border border-input rounded-md bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            size="sm"
            className="w-10 h-10 p-0"
          >
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}; 