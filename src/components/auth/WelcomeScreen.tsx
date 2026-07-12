import { useEffect, useState } from 'react'

export function WelcomeScreen({ onComplete }: { onComplete: () => void }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    const timer = setTimeout(() => {
      onComplete()
    }, 10000) // Exactly 10 seconds

    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 animate-gradient-x bg-gradient-to-br from-blue-500 via-purple-500 via-yellow-400 via-teal-400 to-green-500 opacity-20" />
      
      {/* Light effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-yellow-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      {/* Content */}
      <div className={`relative z-10 text-center transition-all duration-1000 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-400 via-yellow-400 via-teal-400 to-green-400 rounded-full blur-2xl opacity-50 animate-pulse" />
            <img 
              src="/logo-bulldig.png" 
              alt="VH Bulldig Logo" 
              className="relative w-32 h-32 md:w-48 md:h-48 lg:w-64 lg:h-64 object-contain animate-pulse"
              style={{ animationDuration: '3s' }}
            />
          </div>
        </div>

        {/* Welcome text with color animation */}
        <div className="px-4">
          <h1 
            className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 animate-gradient-text"
            style={{
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #fbbf24, #2dd4bf, #22c55e, #3b82f6)',
              backgroundSize: '300% 100%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'gradient-flow 4s linear infinite'
            }}
          >
            Dobrý den, vítejte.
          </h1>
          <p 
            className="text-lg md:text-xl lg:text-2xl animate-gradient-text"
            style={{
              background: 'linear-gradient(90deg, #8b5cf6, #fbbf24, #2dd4bf, #22c55e, #3b82f6, #8b5cf6)',
              backgroundSize: '300% 100%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'gradient-flow 5s linear infinite'
            }}
          >
            Přeji Vám krásný, úspěšný a bezpečný pracovní den.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mt-12 w-64 md:w-80 mx-auto">
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 via-yellow-400 via-teal-400 to-green-500 rounded-full"
              style={{
                animation: 'progress 10s linear forwards'
              }}
            />
          </div>
        </div>
      </div>

      {/* Border glow effect */}
      <div className="absolute inset-4 border-2 border-gradient opacity-30 rounded-3xl" />
    </div>
  )
}
