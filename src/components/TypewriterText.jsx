import { useState, useEffect } from 'react'

const WORDS = [
  'Bienvenido',  
  'Welcome',     
  'Bienvenue',   
  'Willkommen',  
  'Benvenuto',   
  'Bem-vindo',   
  'Welkom',      
]

export default function TypewriterText() {
  const [wordIndex, setWordIndex] = useState(0)
  const [text, setText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const current = WORDS[wordIndex]

    const delay =
      !isDeleting && text === current ? 1600
      : isDeleting && text === '' ? 500
      : isDeleting ? 55
      : 100

    const timeout = setTimeout(() => {
      if (!isDeleting && text === current) {
        setIsDeleting(true)
      } else if (!isDeleting) {
        setText(current.slice(0, text.length + 1))
      } else if (text === '') {
        setIsDeleting(false)
        setWordIndex((i) => (i + 1) % WORDS.length)
      } else {
        setText(text.slice(0, -1))
      }
    }, delay)

    return () => clearTimeout(timeout)
  }, [text, isDeleting, wordIndex])

  return (
    <span className="opacity-50 tracking-wide">
      {text || '\u00A0'}<span className="cursor-blink">_</span>
    </span>
  )
}
