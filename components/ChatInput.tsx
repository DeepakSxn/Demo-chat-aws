'use client';

import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isInitializing: boolean;
  disabled?: boolean;
}

export default function ChatInput({
  onSendMessage,
  isLoading,
  isInitializing,
  disabled = false,
}: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && !isInitializing && !disabled) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const isDisabled = isLoading || isInitializing || disabled;

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={
          isInitializing
            ? 'Initializing session...'
            : isLoading
              ? 'Waiting for response...'
              : 'Type your message...'
        }
        disabled={isDisabled}
        className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder-muted-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isDisabled || !input.trim()}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send size={18} />
        <span className="hidden sm:inline">Send</span>
      </button>
    </form>
  );
}
