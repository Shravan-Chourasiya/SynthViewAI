import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/stores/auth.store'
import { notifyError, notifySuccess } from '@/lib/notify'

export function VerifyEmailForm({ onVerify, onBack }: { onVerify: (code: string) => void; onBack: () => void }) {
    const [code, setCode] = useState(['', '', '', '', '', ''])
    const [loading, setLoading] = useState(false)

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) return
        
        const newCode = [...code]
        newCode[index] = value
        
        // 自动聚焦到下一个输入框
        if (value && index < 5) {
            const nextInput = document.getElementById(`code-${index + 1}`)
            if (nextInput) {
                nextInput.focus()
            }
        }
        
        setCode(newCode)
    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            const prevInput = document.getElementById(`code-${index - 1}`)
            if (prevInput) {
                prevInput.focus()
            }
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (loading) return
        
        const codeString = code.join('')
        if (codeString.length !== 6) {
            notifyError('Please enter a 6-digit code.')
            return
        }
        
        setLoading(true)
        onVerify(codeString)
    }

    return (
        <div className="mx-auto w-full max-w-md">
            <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30 shadow-[0_0_28px_-8px_var(--primary)]">
                <Lock className="size-5 text-primary" strokeWidth={1.75} />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Verify your email</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
                Enter the 6-digit code sent to <br />
                <span className="font-medium">{useAuthStore.getState().pendingEmail}</span>
            </p>
            
            <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
                <div className="flex justify-center gap-2">
                    {code.map((digit, index) => (
                        <div key={index} className="relative">
                            <Input
                                id={`code-${index}`}
                                type="text"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                className="w-12 h-12 text-center text-lg border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                placeholder="•"
                            />
                        </div>
                    ))}
                </div>
                
                <Button 
                    type="submit" 
                    className="mt-6 h-12 w-full text-base font-medium" 
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="size-4 animate-spin" /> 
                            Verifying...
                        </>
                    ) : 'Verify Email'}
                </Button>
            </form>
            
            <div className="mt-6 text-center">
                <button 
                    type="button" 
                    onClick={onBack}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    ← Back to registration
                </button>
            </div>
            
            <div className="mt-8 pt-6 border-t border-border text-center">
                <p className="text-sm text-muted-foreground">
                    Need to go back?{' '}
                    <Link 
                        to="/register" 
                        className="font-medium text-primary hover:underline"
                    >
                        Back to registration
                    </Link>
                </p>
            </div>
        </div>
    )
}