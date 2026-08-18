import Rive from '@rive-app/react-canvas'
import { ASSETS } from '../../config/assets'

export function SignatureRive() {
  return (
    <div className="signature">
      <Rive src={ASSETS.rive.signature} className="signature-rive" />
    </div>
  )
}
