import React from 'react';

export default function LoadingIndicator() {
  return (
    <div className="mb-4 flex justify-start">
      <div className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-secondary-foreground animate-bounce" />
          <span className="inline-block h-2 w-2 rounded-full bg-secondary-foreground animate-bounce [animation-delay:0.2s]" />
          <span className="inline-block h-2 w-2 rounded-full bg-secondary-foreground animate-bounce [animation-delay:0.4s]" />
        </div>
        <span className="ml-2 text-sm text-secondary-foreground">
          Assistant is typing...
        </span>
      </div>
    </div>
  );
}
