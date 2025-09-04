import React from 'react'

interface FrankenIndicatorProps {
  className?: string
  title?: string
}

export default function FrankenIndicator({ 
  className = "inline-flex items-center justify-center w-6 h-6 bg-gray-500 text-white text-xs font-bold rounded-full", 
  title = "Frankenswitch" 
}: FrankenIndicatorProps) {
  return (
    <span 
      className={className}
      title={title}
    >
      F
    </span>
  )
}