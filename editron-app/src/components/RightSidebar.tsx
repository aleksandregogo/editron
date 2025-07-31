import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, ChevronLeft, ChevronDown, Bot } from 'lucide-react';
import { apiClient } from '../utils/api';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { setGlobalAddMessage, getGlobalAgentRequest } from './EditorPage';

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
  mode?: 'chat' | 'agent';
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ isCollapsed, onToggleCollapse, onAgentRequest, documentUuid, projectUuid }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Check if we're on an editor page
  const isEditorPage = !!documentUuid;

  // Set default mode based on page type - automatically switch on navigation
  useEffect(() => {
    if (isEditorPage) {
      setIsAgentMode(true); // Default to Agent mode on editor pages
    } else {
      setIsAgentMode(false); // Default to Ask mode on dashboard pages
    }
  }, [isEditorPage]);

  // Function to fetch chat history
  const fetchHistory = useCallback(async () => {
    try {
      const historyMessages = await apiClient.getChatHistory() as any[];
      setMessages(historyMessages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        mode: msg.mode,
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
    const addMessage = (message: { role: 'user' | 'assistant'; content: string; mode?: 'chat' | 'agent' }) => {
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

  // Auto-scroll when sidebar expands
  useEffect(() => {
    if (!isCollapsed && scrollAreaRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [isCollapsed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const promptText = input;
    setInput('');
    
    // Add user message to chat history for both modes
    const userMessage: ChatMessage = { role: 'user', content: promptText };
    setMessages(prev => [...prev, userMessage]);
    
    // Handle Agent Mode differently
    if (isAgentMode && isEditorPage) {
      if (onAgentRequest) {
        console.log('Agent mode: calling onAgentRequest with:', promptText);
        onAgentRequest(promptText);
        return;
      } else {
        console.error('Agent mode requested but onAgentRequest function not available');
        // Try to get the function from global state as fallback
        const globalAgentRequest = getGlobalAgentRequest();
        if (globalAgentRequest) {
          console.log('Using global agent request function as fallback');
          globalAgentRequest(promptText);
          return;
        }
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Sorry, agent mode is not available for this document. Please try again later.',
          mode: 'agent'
        }]);
        return;
      }
    }

    // Regular chat mode
    console.log('Chat mode: processing chat query');
    setIsLoading(true);

    const assistantMessage: ChatMessage = { role: 'assistant', content: '', mode: isAgentMode ? 'agent' : 'chat' };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const reader = await apiClient.chatQuery(promptText, documentUuid, projectUuid, isAgentMode ? 'agent' : 'chat');
      
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
        content: 'Sorry, I encountered an error. Please try again.',
        mode: isAgentMode ? 'agent' : 'chat'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Collapsed state
  if (isCollapsed) {
    return (
      <div 
        className="w-full h-full cursor-pointer hover:bg-neutral-100 transition-colors flex items-center justify-center"
        onClick={onToggleCollapse}
      >
        <div className="rotate-90 origin-center whitespace-nowrap text-sm font-medium text-neutral-600 flex items-center gap-2">
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
      <div className="flex items-center justify-between p-4 border-b border-neutral-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare size={20} className="text-primary-500" />
          <span className="text-sm font-semibold text-neutral-900">AI Assistant</span>
        </div>
        <Button
          onClick={onToggleCollapse}
          variant="ghost"
          size="sm"
          className="w-8 h-8 p-0 hover:bg-neutral-100"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-neutral-50 scrollbar-thin scrollbar-thumb-border scrollbar-track-muted"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
              <MessageSquare size={24} className="text-neutral-400" />
            </div>
            <h4 className="text-base font-medium mb-2 text-neutral-900">
              Start a conversation
            </h4>
            <p className="text-sm text-neutral-600 max-w-[200px]">
              {isEditorPage 
                ? 'Ask questions about this document or request edits'
                : 'Ask questions about your document library'
              }
            </p>
          </div>
        )}
        
        <div className="flex flex-col gap-4 min-w-0">
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={`flex items-start gap-3 min-w-0 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Message Bubble */}
              <div className={`max-w-[85%] min-w-0 p-4 rounded-2xl relative ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-br-md' 
                  : msg.mode === 'agent'
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-100 text-neutral-800 rounded-bl-md border border-blue-200'
                  : 'bg-white text-neutral-800 rounded-bl-md border border-neutral-200'
              }`}>
                {/* Agent Badge */}
                {msg.role === 'assistant' && msg.mode === 'agent' && (
                  <div className="absolute -top-2 -left-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 text-xs px-2 py-1 flex items-center gap-1">
                      <Bot size={10} />
                      Agent
                    </Badge>
                  </div>
                )}
                
                <p className="text-sm leading-relaxed m-0 whitespace-pre-wrap break-words">
                  {msg.content || (msg.role === 'assistant' && isLoading ? (
                    <span className="opacity-70">
                      <span className="loading-pulse">Thinking</span>
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
      <div className="p-4 border-t border-neutral-200 bg-white flex-shrink-0">
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
              className="w-full min-h-[80px] max-h-[200px] p-4 pr-16 pb-8 border border-neutral-200 rounded-lg bg-white text-neutral-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
            />
            
            {/* Mode Dropdown - bottom-left, only visible on editor pages */}
            {isEditorPage && (
              <div className="absolute bottom-3 left-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-neutral-500 hover:text-neutral-700"
                    >
                      {isAgentMode ? 'Agent' : 'Ask'}
                      <ChevronDown size={12} className="ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-24">
                    <DropdownMenuItem
                      onClick={() => {
                        console.log('Switching to Agent mode');
                        setIsAgentMode(true);
                      }}
                      className={isAgentMode ? "bg-neutral-100" : "" + "cursor-pointer"}
                    >
                      Agent
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        console.log('Switching to Ask mode');
                        setIsAgentMode(false);
                      }}
                      className={!isAgentMode ? "bg-neutral-100" : "" + "cursor-pointer"}
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
              className="absolute bottom-3 right-3 w-8 h-8 p-0 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-sm"
            >
              <Send size={14} />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}; 