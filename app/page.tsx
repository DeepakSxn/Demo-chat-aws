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
  const [from, setFrom] = useState<string>('');
  const [isFromModalOpen, setIsFromModalOpen] = useState(false);
  const [fromDraft, setFromDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const apiBaseUrlRaw = process.env.NEXT_PUBLIC_API_BASE || '/api';
  // Prevent accidental direct calls to an external API from the browser (CORS + key exposure risk).
  const apiBaseUrl = apiBaseUrlRaw.startsWith('http') ? '/api' : apiBaseUrlRaw;

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSessionHistory = async (existingSessionId: string, existingFrom: string) => {
    if (!apiBaseUrl) return;

    try {
      const response = await fetch(`${apiBaseUrl}/v1/sessions/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: existingFrom,
          sessionId: existingSessionId,
        }),
      });

      if (response.status === 404) {
        localStorage.removeItem('sessionId');
        setSessionId(null);
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load session history: ${response.status}`);
      }

      const data = await response.json();
      const historyMessages = Array.isArray(data.messages) ? data.messages : [];

      const mappedMessages: Message[] = historyMessages
        .filter(
          (m: any) =>
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string' &&
            m.content.trim().length > 0
        )
        .map((m: any, index: number) => {
          const ts = typeof m.timestamp === 'string' ? Date.parse(m.timestamp) : NaN;
          return {
            id: `${Date.now()}-${index}`,
            text: m.content,
            sender: m.role,
            timestamp: Number.isFinite(ts) ? new Date(ts) : new Date(),
          };
        });

      if (mappedMessages.length > 0) {
        setMessages(mappedMessages);
      }
    } catch (error) {
      console.error('Failed to load session history:', error);
      toast({
        title: 'Error',
        description: 'Could not load previous conversation. You can reset the session if needed.',
        variant: 'destructive',
      });
    }
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

    const storedFrom = localStorage.getItem('chatFrom');
    if (storedFrom && storedFrom.trim()) {
      setFrom(storedFrom.trim());
    } else {
      setIsFromModalOpen(true);
    }
  }, []);

  // Load history when both identity + sessionId exist
  useEffect(() => {
    if (!sessionId || !from.trim()) return;
    if (messages.length > 0) return;
    loadSessionHistory(sessionId, from);
  }, [sessionId, from]);

  const openFromModal = () => {
    setFromDraft(from);
    setIsFromModalOpen(true);
  };

  const saveFrom = () => {
    const raw = fromDraft.trim();
    if (!raw) {
      toast({
        title: 'Missing number',
        description: 'Please enter a phone/user id to continue.',
        variant: 'destructive',
      });
      return;
    }

    // WhatsApp UX: allow user to type only digits (e.g. 959615665)
    // Normalize to upstream expected format: whatsapp:+<number>
    const compact = raw.replace(/\s+/g, '');
    let normalized: string;
    if (compact.toLowerCase().startsWith('whatsapp:')) {
      normalized = compact;
    } else if (compact.startsWith('+')) {
      normalized = `whatsapp:${compact}`;
    } else {
      const digitsOnly = compact.replace(/[^\d]/g, '');
      if (digitsOnly.length < 10) {
        toast({
          title: 'Invalid number',
          description: 'Please enter a valid phone number (at least 10 digits).',
          variant: 'destructive',
        });
        return;
      }
      normalized = `whatsapp:+${digitsOnly}`;
    }

    localStorage.setItem('chatFrom', normalized);
    setFrom(normalized);
    setIsFromModalOpen(false);
    toast({
      title: 'Saved',
      description: `Using identity: ${normalized}`,
    });
  };

  const resetSession = () => {
    localStorage.removeItem('sessionId');
    setSessionId(null);
    setMessages([]);

    toast({
      title: 'Session reset',
      description: 'The current session has been cleared.',
    });
  };

  const handleSendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!from.trim()) {
      openFromModal();
      return;
    }

    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      text: trimmed,
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
          from,
          ...(sessionId ? { sessionId } : {}),
          message: trimmed,
        }),
      });

      if (!response.ok) {
        let detail: any = null;
        try {
          detail = await response.json();
        } catch {
          try {
            detail = await response.text();
          } catch {
            detail = null;
          }
        }

        const message =
          (typeof detail === 'object' && detail && (detail.error || detail.message)) ||
          (typeof detail === 'string' && detail.trim()) ||
          `HTTP ${response.status}`;

        throw new Error(message);
      }

      const data = await response.json();
      if (typeof data?.sessionId === 'string' && data.sessionId.trim()) {
        localStorage.setItem('sessionId', data.sessionId);
        setSessionId(data.sessionId);
      }

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
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to send message. Please try again.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex h-screen flex-col bg-background">
      {isFromModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground">Enter your number</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter just the phone number (example: <span className="font-mono">919999999999</span>). We’ll format it as{' '}
              <span className="font-mono">whatsapp:+&lt;number&gt;</span>.
            </p>
            <input
              className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
              value={fromDraft}
              onChange={(e) => setFromDraft(e.target.value)}
              placeholder="919999999999"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setIsFromModalOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={saveFrom}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Chat Assistant</h1>
            <p className="text-sm text-muted-foreground">
              {sessionId ? 'Session active' : 'New session (will be created on first message)'}
            </p>
            <p className="text-xs text-muted-foreground">
              From: <span className="font-mono">{from || '(not set)'}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openFromModal}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Set Number
            </button>
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
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="text-center">
              <h2 className="mb-2 text-2xl font-semibold text-foreground">
                {sessionId ? 'Start a Conversation' : 'Ready to Chat'}
              </h2>
              <p className="text-muted-foreground">
                Send a message to begin chatting with the AI assistant.
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
          isInitializing={false}
          disabled={false}
        />
      </div>
    </main>
  );
}
