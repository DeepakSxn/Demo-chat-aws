'use client';

import { useEffect, useState, useRef } from 'react';
import MessageBubble from '@/components/MessageBubble';
import ChatInput from '@/components/ChatInput';
import LoadingIndicator from '@/components/LoadingIndicator';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE;

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check for existing session on mount
  useEffect(() => {
    const storedSessionId = localStorage.getItem('sessionId');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    }
  }, []);

  const resetSession = () => {
    localStorage.removeItem('sessionId');
    setSessionId(null);
    setMessages([]);
    setSessionError(null);

    toast({
      title: 'Session reset',
      description: 'The current session has been cleared.',
    });
  };

  const startSession = async () => {
    if (!apiBaseUrl) {
      setSessionError('API base URL not configured. Please set NEXT_PUBLIC_API_BASE environment variable.');
      toast({
        title: 'Configuration Error',
        description: 'API base URL is not configured.',
        variant: 'destructive',
      });
      return;
    }

    setIsInitializing(true);
    setSessionError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/v1/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }

      const data = await response.json();
      const newSessionId = data.sessionId;
      localStorage.setItem('sessionId', newSessionId);
      setSessionId(newSessionId);
      setSessionError(null);
      
      toast({
        title: 'Success',
        description: 'Session started successfully!',
      });
    } catch (error) {
      console.error('Session start error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setSessionError(`Failed to start session: ${errorMessage}`);
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!sessionId || !text.trim()) return;

    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/v1/agent/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          message: text,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      const assistantText: string =
        data.reply || data.message || data.response || 'No response received';

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: assistantText,
        sender: 'assistant',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Message send error:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Chat Assistant</h1>
            <p className="text-sm text-muted-foreground">
              {sessionId ? 'Session active' : 'No active session'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!sessionId && (
              <button
                onClick={startSession}
                disabled={isInitializing}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isInitializing ? 'Starting...' : 'Start Session'}
              </button>
            )}
            {sessionId && (
              <button
                onClick={resetSession}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Reset Session
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {sessionError && (
          <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive">{sessionError}</p>
          </div>
        )}

        {messages.length === 0 && !isInitializing && (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="text-center">
              <h2 className="mb-2 text-2xl font-semibold text-foreground">
                {sessionId ? 'Start a Conversation' : 'Ready to Chat'}
              </h2>
              <p className="text-muted-foreground">
                {sessionId
                  ? 'Send a message to begin chatting with the AI assistant'
                  : 'Click "Start Session" to initialize a new chat session'}
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            text={message.text}
            sender={message.sender}
            timestamp={message.timestamp}
          />
        ))}

        {isLoading && <LoadingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="border-t border-border bg-card px-6 py-4">
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          isInitializing={isInitializing}
          disabled={!sessionId}
        />
      </div>
    </main>
  );
}
