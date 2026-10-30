import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/stores/auth.store'
import { AnimatedAuthCard, type AuthMode } from '@/components/auth/animated-auth-card'
import { LoginForm } from '@/components/auth/login-form'
import { RegisterForm } from '@/components/auth/register-form'
import { VerifyEmailForm } from '@/components/auth/verify-email-form'

export function AuthPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const mode: AuthMode = location.pathname === '/register' ? 'register' : 'login'
    const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
    
    const [showVerifyForm, setShowVerifyForm] = useState(false);
    const pendingEmail = useAuthStore((s) => s.pendingEmail);
    const status = useAuthStore((s) => s.status);

    useEffect(() => {
        if (status === 'authenticated') {
            navigate(from, { replace: true });
        }
    }, [status, navigate, from]);

    useEffect(() => {
        if (pendingEmail) {
            setShowVerifyForm(true);
        }
    }, [pendingEmail]);

    const handleVerifySuccess = () => {
        // After successful verification, clear pending email and redirect to login
        useAuthStore.getState().setPendingEmail(null);
        setShowVerifyForm(false);
        navigate('/login');
    };

    return (
        <AnimatedAuthCard
            mode={showVerifyForm ? 'verify' : mode}
            onModeChange={(nextMode) => {
                if (nextMode === 'verify') {
                    setShowVerifyForm(true);
                } else {
                    setShowVerifyForm(false);
                    navigate(nextMode === 'login' ? '/login' : '/register')
                }
            }}
            showModeSwitcher={!showVerifyForm}
            loginSlot={<LoginForm onSuccess={() => navigate(from, { replace: true })} onUnverified={(email) => setShowVerifyForm(true)} showModeLink={false} />}
            registerSlot={<RegisterForm onSuccess={() => setShowVerifyForm(true)} showModeLink={false} />}
            verifySlot={<VerifyEmailForm onSuccess={handleVerifySuccess} />}
        />
    )
}
