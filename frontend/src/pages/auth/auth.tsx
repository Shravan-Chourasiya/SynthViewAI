import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatedAuthCard, type AuthMode } from '@/components/auth/animated-auth-card'
import { LoginForm } from '@/components/auth/login-form'
import { RegisterForm } from '@/components/auth/register-form'

export function AuthPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const mode: AuthMode = location.pathname === '/register' ? 'register' : 'login'
    const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

    return (
        <AnimatedAuthCard
            mode={mode}
            onModeChange={(nextMode) => navigate(nextMode === 'login' ? '/login' : '/register')}
            showModeSwitcher={mode === 'login'}
            loginSlot={<LoginForm onSuccess={() => navigate(from, { replace: true })} showModeLink={false} />}
            registerSlot={<RegisterForm onSuccess={(email) => navigate('/verify-email', { state: { email } })} showModeLink={mode === 'register'} />}
        />
    )
}
