import React from 'react';

/**
 * Converts URLs in text to clickable links while preserving newlines
 * @param text - The text that may contain URLs
 * @returns JSX elements with clickable links
 */
export function linkify(text: string): React.ReactNode {
  if (!text) return text;

  // Regular expression to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  // Split text by newlines first to preserve line breaks
  const lines = text.split('\n');
  
  return lines.map((line, lineIndex) => {
    const parts = line.split(urlRegex);
    const lineContent = parts.map((part, partIndex) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={`${lineIndex}-${partIndex}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
          >
            {part}
          </a>
        );
      }
      return part;
    });
    
    // Add a line break after each line except the last one
    if (lineIndex < lines.length - 1) {
      return (
        <React.Fragment key={lineIndex}>
          {lineContent}
          <br />
        </React.Fragment>
      );
    }
    return <React.Fragment key={lineIndex}>{lineContent}</React.Fragment>;
  });
}