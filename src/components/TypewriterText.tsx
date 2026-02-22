'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface TypewriterTextProps {
  text: string
  speed?: number
  className?: string
}

export function TypewriterText({ text, speed = 100, className = '' }: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, speed)

      return () => clearTimeout(timeout)
    } else {
      // Reset para animación continua (opcional)
      // setDisplayedText('')
      // setCurrentIndex(0)
    }
  }, [currentIndex, text, speed])
  
  // Reset cuando cambia el texto
  useEffect(() => {
    setDisplayedText('')
    setCurrentIndex(0)
  }, [text])

  return (
    <span className={className}>
      {displayedText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
        className="inline-block w-0.5 h-6 bg-gradient-to-b from-[#00F5C8] to-[#7B5EF8] ml-1"
      />
    </span>
  )
}
