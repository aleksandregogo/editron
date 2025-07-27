import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Bot, User, ChevronLeft, ChevronDown } from 'lucide-react';
import { apiClient } from '../utils/api';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { setGlobalAddMessage } from './EditorPage';

interface RightSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onAgentRequest?: (promptText: string) => void;
  documentUuid?: string;
  projectUuid?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ isCollapsed, onToggleCollapse, onAgentRequest, documentUuid, projectUuid }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  // Check if we're on an editor page
  const isEditorPage = !!documentUuid;


  // Set default mode based on page type only on initial load
  useEffect(() => {
    if (!hasInitialized.current) {
      if (isEditorPage) {
        setIsAgentMode(true); // Default to Agent mode on editor pages
      } else {
        setIsAgentMode(false); // Default to Ask mode on dashboard pages
      }
      hasInitialized.current = true;
    }
  }, [isEditorPage]);

  // Function to fetch chat history
  const fetchHistory = useCallback(async () => {
    try {
      const historyMessages = await apiClient.getChatHistory() as any[];
      setMessages(historyMessages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })));
    } catch (error) {
      console.error("Failed to fetch chat history:", error);
    }
  }, []);

  // Fetch chat history on component mount
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Set global add message function
  useEffect(() => {
    const addMessage = (message: { role: 'user' | 'assistant'; content: string }) => {
      setMessages(prev => [...prev, message]);
    };
    
    setGlobalAddMessage(addMessage);
    return () => setGlobalAddMessage(null);
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

    const promptText = input;
    setInput('');
    
    // Add user message to chat history for both modes
    const userMessage: ChatMessage = { role: 'user', content: promptText };
    setMessages(prev => [...prev, userMessage]);
    
    // Handle Agent Mode differently
    if (isAgentMode && isEditorPage && onAgentRequest) {
      onAgentRequest(promptText);
      return;
    }

    // Regular chat mode
    setIsLoading(true);

    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const reader = await apiClient.chatQuery(promptText, documentUuid, projectUuid);
      
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

  // Collapsed state
  if (isCollapsed) {
    return (
      <div 
        className="w-full h-full cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-center"
        onClick={onToggleCollapse}
      >
        <div className="rotate-90 origin-center whitespace-nowrap text-sm font-medium text-muted-foreground flex items-center gap-2">
          <MessageSquare size={18} />
          <span>Chat</span>
        </div>
      </div>
    );
  }

  // Expanded state
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare size={20} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">AI Assistant</span>
        </div>
        <Button
          onClick={onToggleCollapse}
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0 hover:bg-muted"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto p-4 bg-background scrollbar-thin scrollbar-thumb-border scrollbar-track-muted"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare size={24} className="text-muted-foreground" />
            </div>
            <h4 className="text-base font-medium mb-2 text-foreground">
              Start a conversation
            </h4>
            <p className="text-sm text-muted-foreground max-w-[200px]">
              {isEditorPage 
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
              <div className={`max-w-[85%] p-3 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-card text-foreground border border-border'
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
      <div className="p-4 border-t border-border bg-card flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={
                isEditorPage 
                  ? (isAgentMode ? "Request document changes..." : "Ask about the document...")
                  : "Ask about your documents..."
              }
              disabled={isLoading}
              rows={3}
              className="w-full min-h-[80px] max-h-[200px] p-4 pr-16 pb-8 border border-input rounded-lg bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
            />
            
            {/* Mode Dropdown - bottom-left, only visible on editor pages */}
            {isEditorPage && (
              <div className="absolute bottom-3 left-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {isAgentMode ? 'Agent' : 'Ask'}
                      <ChevronDown size={12} className="ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-24">
                    <DropdownMenuItem
                      onClick={() => {
                        setIsAgentMode(true);
                      }}
                      className={isAgentMode ? "bg-accent" : "" + "cursor-pointer"}
                    >
                      Agent
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setIsAgentMode(false);
                      }}
                      className={!isAgentMode ? "bg-accent" : "" + "cursor-pointer"}
                    >
                      Ask
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            
            {/* Send Button - bottom-right */}
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              size="sm"
              className="absolute bottom-3 right-3 w-8 h-8 p-0 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Send size={14} />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}; 