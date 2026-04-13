import TypewriterText from './TypewriterText'
import ParticleBackground from './ParticleBackground'

export default function Hero() {
  return (
    <section className="relative w-full h-screen overflow-hidden bg-black">

      <ParticleBackground />

      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none" />

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center text-white whitespace-nowrap">
        <div className="flex items-center justify-center gap-6 mb-4">
          <span className="w-1 h-1 rounded-full bg-white/40 inline-block" />
          <h1 className="text-2xl font-light leading-snug tracking-wide">
            Alejandro Beamud Romero.
            <br />
            <span className="opacity-80">Profesor de FP de Informática.</span>
            <br />
            <span className="opacity-60">Formando a los que no se conforman.</span>
          </h1>
          <span className="w-1 h-1 rounded-full bg-white/40 inline-block" />
        </div>
        <p className="text-sm text-white mt-3 mb-1">
          <TypewriterText />
        </p>
        <p className="text-xs tracking-[0.3em] text-neutral-400 uppercase">
          2023&mdash;Presente
        </p>
      </div>

      <div className="absolute bottom-10 right-16 flex flex-col items-center gap-1 animate-bounce">
        <svg
          width="16"
          height="24"
          viewBox="0 0 16 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-white/50"
        >
          <line x1="8" y1="0" x2="8" y2="20" stroke="currentColor" strokeWidth="1"/>
          <polyline points="2,14 8,21 14,14" stroke="currentColor" strokeWidth="1" fill="none"/>
        </svg>
      </div>

    </section>
  )
}
