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
    const user = useAuthStore.getState().user;
    const status = useAuthStore.getState().status;

    // Check if user is already authenticated and redirect
    useEffect(() => {
        if (status === 'authenticated' && user) {
            navigate(from, { replace: true });
        }
    }, [status, user, navigate, from]);

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
            registerSlot={<RegisterForm onSuccess={() => setShowVerifyForm(true)} showModeLink={false} />}
            verifySlot={<VerifyEmailForm onSuccess={handleVerifySuccess} />}
        />
    )
}
