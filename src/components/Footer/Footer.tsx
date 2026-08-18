import { SignatureRive } from '../SignatureRive/SignatureRive'

export function Footer() {
  return (
    <footer className="site-footer">
      <SignatureRive />
      <p className="footer-note">Lando Norris — 2025 McLaren Formula 1</p>
      <p className="footer-credits">
        Creative landing clone built with React + React Three Fiber.
      </p>
    </footer>
  )
}
