import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatedAuthCard } from '@/components/auth/animated-auth-card'
import { LoginForm } from '@/components/auth/login-form'
import { RegisterForm } from '@/components/auth/register-form'
import { VerifyEmailForm } from '@/components/auth/verify-email-form'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useEffect, useState } from 'react'

export function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
    const [showVerifyForm, setShowVerifyForm] = useState(false);
    const pendingEmail = useAuthStore.getState().pendingEmail;

    useEffect(() => {
        if (pendingEmail) {
            setShowVerifyForm(true);
        }
    }, [pendingEmail]);

    const handleVerifySuccess = () => {
        setShowVerifyForm(false);
        navigate(from, { replace: true });
    };

    return (
        <AnimatedAuthCard
            mode={showVerifyForm ? 'verify' : 'login'}
            onModeChange={(mode) => {
                if (mode === 'verify') {
                    setShowVerifyForm(true);
                } else {
                    setShowVerifyForm(false);
                    navigate(mode === 'login' ? '/login' : '/register')
                }
            }}
            showModeSwitcher={!showVerifyForm}
            loginSlot={<LoginForm onSuccess={() => navigate(from, { replace: true })} onUnverified={(email) => {
                setShowVerifyForm(true);
            }} showModeLink={false} />}
            registerSlot={<RegisterForm onSuccess={(email) => navigate('/verify-email', { state: { email } })} onAlreadyExists={(email) => {
                setShowVerifyForm(true);
            }} showModeLink={false} />}
            verifySlot={<VerifyEmailForm onSuccess={handleVerifySuccess} />}
        />
    )
}
