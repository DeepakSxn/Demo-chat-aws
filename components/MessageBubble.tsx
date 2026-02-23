import React from 'react';

interface MessageBubbleProps {
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

export default function MessageBubble({
  text,
  sender,
  timestamp,
}: MessageBubbleProps) {
  const isUser = sender === 'user';
  const formattedTime = timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`mb-4 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex max-w-xs flex-col gap-1 lg:max-w-md ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        <div
          className={`rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          }`}
        >
          <p className="break-words">{text}</p>
        </div>
        <span className="text-xs text-muted-foreground">{formattedTime}</span>
      </div>
    </div>
  );
}
