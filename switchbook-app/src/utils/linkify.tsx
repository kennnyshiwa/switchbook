import React from 'react';

/**
 * Converts URLs in text to clickable links
 * @param text - The text that may contain URLs
 * @returns JSX elements with clickable links
 */
export function linkify(text: string): React.ReactNode {
  if (!text) return text;

  // Regular expression to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
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
}