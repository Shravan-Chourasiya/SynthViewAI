import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatedAuthCard } from '@/components/auth/animated-auth-card'
import { LoginForm } from '@/components/auth/login-form'
import { RegisterForm } from '@/components/auth/register-form'

export function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

    return (
        <AnimatedAuthCard
            mode="login"
            onModeChange={(mode) => navigate(mode === 'login' ? '/login' : '/register')}
            loginSlot={<LoginForm onSuccess={() => navigate(from, { replace: true })} showModeLink={false} />}
            registerSlot={<RegisterForm onSuccess={(email) => navigate('/verify-email', { state: { email } })} showModeLink={false} />}
        />
    )
}
