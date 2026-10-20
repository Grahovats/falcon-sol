import { WalletAuthButton } from './WalletAuthButton'
import './AuthenticationRequired.css'

export function AuthenticationRequired({ title = 'Connect to continue' }: { title?: string }) {
  return (
    <section className="auth-gate" aria-labelledby="auth-required-title">
      <div className="auth-gate-content">
        <div><h1 id="auth-required-title">{title}</h1><p>Sign a message to continue. No transaction required.</p></div>
      </div>
      <div className="auth-gate-action"><WalletAuthButton /></div>
    </section>
  )
}
