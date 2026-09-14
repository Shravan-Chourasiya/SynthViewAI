import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from 'react'
import { Activity, Code2, MessageSquare, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'
import { BrandMark } from '@/components/brand-mark'

export type AuthMode = 'login' | 'register'

type AnimatedAuthCardProps = {
    mode: AuthMode
    onModeChange: (mode: AuthMode) => void
    loginSlot: ReactNode
    registerSlot: ReactNode
    /** Hide the desktop footer when the register form supplies its own flow link. */
    showModeSwitcher?: boolean
}

/* ------------------------------------------------------------------ */
/*  3D Scene on the left — reacts to mouse movement                   */
/* ------------------------------------------------------------------ */
function Interactive3DScene({ mode }: { mode: AuthMode }) {
    const sceneRef = useRef<HTMLDivElement>(null)
    const [tilt, setTilt] = useState({ x: 0, y: 0 })

    // Generate medium-sized particles for the background
    const particles = Array.from({ length: 24 }).map((_, i) => ({
        id: i,
        size: Math.random() * 8 + 4, // 4px to 12px (medium sized)
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        opacity: Math.random() * 0.25 + 0.1, // 0.1 to 0.35
        duration: `${Math.random() * 10 + 6}s`, // 6s to 16s
        delay: `${Math.random() * 5}s`,
    }))

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width - 0.5
        const y = (e.clientY - rect.top) / rect.height - 0.5
        setTilt({ x: y * -18, y: x * 18 })
    }

    const handleMouseLeave = () => setTilt({ x: 0, y: 0 })

    return (
        <div
            ref={sceneRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="relative h-full w-full overflow-hidden bg-primary"
            style={{ perspective: '1200px' }}
        >
            {/* Inject floating animation */}
            <style>{`
                @keyframes float-particle {
                    0% { transform: translateY(0px) translateX(0px); }
                    100% { transform: translateY(-24px) translateX(12px); }
                }
            `}</style>

            {/* Dot grid overlay */}
            <div
                className="absolute inset-0 opacity-15"
                style={{
                    backgroundImage:
                        'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
                    backgroundSize: '22px 22px',
                }}
            />

            {/* Glowing blobs */}
            <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-black/20 blur-3xl" />
            <div className="absolute top-1/2 left-1/3 h-56 w-56 rounded-full bg-primary-foreground/10 blur-3xl" />

            {/* Floating Particles Layer */}
            <div className="absolute inset-0 pointer-events-none">
                {particles.map((p) => (
                    <div
                        key={p.id}
                        className="absolute rounded-full bg-white"
                        style={{
                            width: `${p.size}px`,
                            height: `${p.size}px`,
                            left: p.left,
                            top: p.top,
                            opacity: p.opacity,
                            animation: `float-particle ${p.duration} ease-in-out ${p.delay} infinite alternate`,
                        }}
                    />
                ))}
            </div>

            {/* 3D floating cards container */}
            <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                    transition: 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
            >
                {/* Back card — large, low opacity */}
                <div
                    className="absolute h-64 w-64 rounded-3xl border border-white/20 bg-white/5 backdrop-blur-sm"
                    style={{
                        transform: 'translateZ(-120px) rotate(-12deg)',
                        transition: 'transform 0.4s ease-out',
                    }}
                />

                {/* Middle card */}
                <div
                    className="absolute h-56 w-56 rounded-3xl border border-white/25 bg-white/10 backdrop-blur-md shadow-2xl"
                    style={{
                        transform: 'translateZ(-40px) rotate(6deg)',
                        transition: 'transform 0.4s ease-out',
                    }}
                >
                    <div className="flex h-full flex-col items-center justify-center p-6 text-center text-primary-foreground">
                        <Code2 className="mb-3 size-10 opacity-80" strokeWidth={1.5} />
                        <p className="text-sm font-medium opacity-90">Adaptive Coding Rounds</p>
                        <p className="mt-1 text-xs opacity-60">Sandboxed · Parallel · Real-time</p>
                    </div>
                </div>

                {/* Front card — main hero */}
                <div
                    className="relative h-60 w-64 rounded-3xl border border-white/30 bg-white/15 backdrop-blur-lg shadow-2xl"
                    style={{
                        transform: 'translateZ(40px) rotate(-3deg)',
                        transition: 'transform 0.4s ease-out',
                    }}
                >
                    <div className="flex h-full flex-col items-center justify-center p-6 text-center text-primary-foreground">
                        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-foreground/20 ring-1 ring-white/30">
                            <Sparkles className="size-7" strokeWidth={1.5} />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight">
                            {mode === 'login' ? 'Welcome back' : 'Join SynthView'}
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-primary-foreground/80">
                            {mode === 'login'
                                ? 'Pick up where you left off.'
                                : 'Start practicing with AI-driven interviews.'}
                        </p>
                    </div>
                </div>

                {/* Floating icon — MessageSquare */}
                <div
                    className="absolute -right-6 top-10 flex size-14 items-center justify-center rounded-2xl border border-white/25 bg-white/15 backdrop-blur-md shadow-xl"
                    style={{
                        transform: 'translateZ(80px)',
                        transition: 'transform 0.4s ease-out',
                    }}
                >
                    <MessageSquare className="size-6 text-primary-foreground" strokeWidth={1.5} />
                </div>

                {/* Floating icon — Activity */}
                <div
                    className="absolute -left-4 bottom-12 flex size-12 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur-md shadow-xl"
                    style={{
                        transform: 'translateZ(100px)',
                        transition: 'transform 0.4s ease-out',
                    }}
                >
                    <Activity className="size-5 text-primary-foreground" strokeWidth={1.5} />
                </div>
            </div>

            {/* Bottom caption */}
            <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-primary-foreground/60">
                Move your cursor to explore
            </div>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Form panel with 3D slide transition                               */
/* ------------------------------------------------------------------ */
function FormPanel({
    active,
    direction,
    children,
    label,
}: {
    active: boolean
    direction: 'left' | 'right'
    children: ReactNode
    label: string
}) {
    const panelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const panel = panelRef.current
        if (!panel) return
            ; (panel as HTMLDivElement & { inert: boolean }).inert = !active
    }, [active])

    const translateClass = direction === 'left' ? '-translate-x-8' : 'translate-x-8'

    return (
        <div
            ref={panelRef}
            aria-hidden={!active}
            aria-label={label}
            className={cn(
                'absolute inset-0 flex items-center justify-center p-8 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform lg:p-12',
                active
                    ? 'translate-x-0 translate-y-0 scale-100 opacity-100'
                    : `${translateClass} translate-y-2 scale-95 opacity-0 pointer-events-none`,
            )}
            style={{ transformStyle: 'preserve-3d' }}
        >
            {children}
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */
export function AnimatedAuthCard({
    mode,
    onModeChange,
    loginSlot,
    registerSlot,
    showModeSwitcher = true,
}: AnimatedAuthCardProps) {
    const loginActive = mode === 'login'

    return (
        <div className="relative flex min-h-screen flex-col bg-background text-foreground">
            <div aria-hidden="true" className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />

            {/* Header */}
            <header className="relative z-10 mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link to="/" className="flex items-center gap-2">
                    <BrandMark className="size-9" />
                    <span className="text-[15px] font-semibold tracking-tight">
                        SynthView <span className="text-primary">AI</span>
                    </span>
                </Link>
                <ThemeToggle />
            </header>

            {/* Main */}
            <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12 pt-4 sm:px-6 lg:px-8">
                <Card className="w-full max-w-6xl overflow-hidden rounded-3xl shadow-2xl shadow-black/20 border-border/60">
                    {/* Mobile tabs */}
                    <div className="border-b border-border p-3 md:hidden">
                        <div
                            className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1"
                            role="tablist"
                            aria-label="Authentication mode"
                        >
                            {(['login', 'register'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    role="tab"
                                    aria-selected={mode === tab}
                                    onClick={() => onModeChange(tab)}
                                    className={cn(
                                        'rounded-md px-3 py-2 text-sm font-medium outline-none transition-all duration-200',
                                        mode === tab
                                            ? 'bg-card text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {tab === 'login' ? 'Sign in' : 'Sign up'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content area */}
                    <div className="grid min-h-155 grid-cols-1 md:grid-cols-2">
                        {/* LEFT — 3D Scene (hidden on mobile) */}
                        <div className="relative hidden md:block">
                            <Interactive3DScene mode={mode} />
                        </div>

                        {/* RIGHT — Forms */}
                        <div className="relative bg-card">
                            {/* Mobile forms */}
                            <div className="relative min-h-125 md:hidden">
                                <FormPanel active={loginActive} direction="left" label="Sign in form">
                                    {loginSlot}
                                </FormPanel>
                                <FormPanel active={!loginActive} direction="right" label="Create account form">
                                    {registerSlot}
                                </FormPanel>
                            </div>

                            {/* Desktop forms — stacked with 3D transitions */}
                            <div className="relative hidden h-full min-h-155 md:block">
                                <FormPanel active={loginActive} direction="left" label="Sign in form">
                                    {loginSlot}
                                </FormPanel>
                                <FormPanel active={!loginActive} direction="right" label="Create account form">
                                    {registerSlot}
                                </FormPanel>

                                {/* Login needs a mode switcher; register keeps its link in
                                    the form flow so it cannot overlap the submit button. */}
                                {showModeSwitcher ? <div className={cn('absolute left-0 right-0 text-center', loginActive ? 'bottom-16' : 'bottom-4')}>
                                    <button type="button" onClick={() => onModeChange(loginActive ? 'register' : 'login')} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                                        {loginActive ? <>Don&apos;t have an account? <span className="font-medium text-primary">Create one</span></> : <>Already have an account? <span className="font-medium text-primary">Sign in</span></>}
                                    </button>
                                </div> : null}
                            </div>
                        </div>
                    </div>
                </Card>
            </main>
        </div>
    )
}

