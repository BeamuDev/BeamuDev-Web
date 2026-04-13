import { useState } from 'react'

export default function Navbar() {
  const [active, setActive] = useState(null)

  const navItems = [
    {
      section: 'Mi trabajo',
      links: [
        { label: 'Proyectos', href: '#proyectos' },
        { label: 'Experiencia', href: '#experiencia' },
      ],
    },
    {
      section: 'Educación',
      links: [
        { label: 'Alumnos', href: '#alumnos' },
        { label: 'Artículos', href: '#articulos' },
      ],
    },
    {
      section: 'Mis aficiones',
      links: [
        { label: 'Explorar', href: '#aficiones' },
      ],
    },
  ]

  return (
    <nav className="fixed top-3 left-3 right-3 z-50 flex items-center justify-between px-16 py-6 bg-transparent">
      <div className="flex items-center gap-16">
        <div className="text-white font-bold text-sm tracking-widest uppercase shrink-0">
          AB
        </div>
        <div className="flex gap-12 text-xs">
          {navItems.map(({ section, links }) => (
            <div key={section} className="flex flex-col gap-1">
              <span className="text-white uppercase tracking-widest text-[10px] mb-1 font-medium">
                {section}
              </span>
              {links.map(({ label, href }) => {
                const isActive = active === label
                return (
                  <a
                    key={label}
                    href={href}
                    onClick={() => setActive(label)}
                    className={[
                      'underline underline-offset-2 transition-colors duration-200',
                      isActive
                        ? 'text-white decoration-white'
                        : 'text-neutral-500 decoration-neutral-500 hover:text-white hover:decoration-white',
                    ].join(' ')}
                  >
                    {label}
                  </a>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="text-white text-xs tracking-widest uppercase opacity-60 hover:opacity-100 transition-opacity shrink-0">
        <a href="#redes">Redes sociales</a>
      </div>
    </nav>
  )
}
