import { useNavigate } from 'react-router-dom'
import { AnimatedAuthCard } from '@/components/auth/animated-auth-card'
import { LoginForm } from '@/components/auth/login-form'
import { RegisterForm } from '@/components/auth/register-form'

export function RegisterPage() {
    const navigate = useNavigate()

    return (
        <AnimatedAuthCard
            mode="register"
            onModeChange={(mode) => navigate(mode === 'login' ? '/login' : '/register')}
            showModeSwitcher={false}
            loginSlot={<LoginForm onSuccess={() => navigate('/dashboard', { replace: true })} />}
            registerSlot={<RegisterForm onSuccess={(email) => navigate('/verify-email', { state: { email } })} showModeLink />}
        />
    )
}
