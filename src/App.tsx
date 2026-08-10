import { Header } from './components/Header'
import { Hero } from './components/Hero'
// import { SignatureRive } from './components/SignatureRive'

export default function App() {
  return (
    <div className="page">
      <Header />
      <Hero />
      {/* <footer className="site-footer">
        <SignatureRive />
        <p className="footer-note">
          Fan-made tribute · Built with React Three Fiber · Not affiliated with
          Lando Norris or McLaren Racing.
        </p>
        <p className="footer-credits">
          Original 3D assets &amp; design © OFF+BRAND / landonorris.com —
          used here for educational purposes only.
        </p>
      </footer> */}
    </div>
  )
}
