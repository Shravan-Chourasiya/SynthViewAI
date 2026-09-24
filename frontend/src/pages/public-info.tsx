import { useState } from 'react'
import { CheckCircle2, Loader2, Mail, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { notifyApiError } from '@/lib/notify'
import { submitContactMessage } from '@/lib/services/contact.service'

function PublicPage({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <SiteNav />
            <main className="animate-slide-up mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">{children}</main>
            <SiteFooter />
        </div>
    )
}

function PageIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
    return (
        <header className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">{eyebrow}</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">{body}</p>
        </header>
    )
}

export function AboutPage() {
    return (
        <PublicPage>
            <PageIntro
                eyebrow="About SynthView AI"
                title="Practice for the interview that actually happens."
                body="SynthView AI gives candidates a realistic place to rehearse technical and behavioral interviews, then turns each session into useful, specific feedback."
            />
            <div className="mt-16 grid gap-10 border-y border-border py-10 md:grid-cols-3">
                <section>
                    <Sparkles className="size-6 text-primary" />
                    <h2 className="mt-4 text-lg font-semibold">Adaptive by design</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Every answer helps shape what comes next, so practice does not feel like a fixed quiz.</p>
                </section>
                <section>
                    <Users className="size-6 text-primary" />
                    <h2 className="mt-4 text-lg font-semibold">Built for candidates</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Clear feedback helps you understand your strengths, gaps, and next best practice step.</p>
                </section>
                <section>
                    <ShieldCheck className="size-6 text-primary" />
                    <h2 className="mt-4 text-lg font-semibold">A private practice space</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Your sessions are designed for reflection and improvement, not public performance.</p>
                </section>
            </div>
            <div className="mt-12 flex flex-wrap gap-3">
                <Link to="/register"><Button>Start practicing</Button></Link>
                <Link to="/contact"><Button variant="outline">Talk to us</Button></Link>
            </div>
            <section className="mt-16 border-y border-border py-10">
                <p className="font-mono text-xs uppercase tracking-widest text-primary">Built by</p>
                <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">Lorde Aizen</h2>
                        <p className="mt-2 font-mono text-xs text-muted-foreground">Design &amp; engineering</p>
                    </div>
                    <div className="space-y-4 text-sm leading-7 text-muted-foreground">
                        <p>
                            I don't just build what is seen.
                            <br />
                            I build what makes it work beneath the surface.
                        </p>
                        <p>Curious by nature, obsessive about details, and always looking a few steps ahead — I turn ideas into systems, and systems into experiences.</p>
                        <p className="font-medium text-foreground">Perception is only the beginning.</p>
                    </div>
                </div>
            </section>
        </PublicPage>
    )
}

const CONTACT_LIMITS = { name: 80, email: 180, subject: 120, message: 2000 } as const

interface ContactForm {
    name: string
    email: string
    subject: string
    message: string
}

type ContactFieldErrors = Partial<Record<keyof ContactForm, string>>

const EMPTY_CONTACT_FORM: ContactForm = { name: '', email: '', subject: '', message: '' }

/**
 * Mirrors the backend zod schema so a visitor is told about a problem before the
 * request is sent, rather than only after it comes back as a 422.
 */
function validateContactForm(form: ContactForm): ContactFieldErrors {
    const errors: ContactFieldErrors = {}
    const name = form.name.trim()
    const email = form.email.trim()
    const subject = form.subject.trim()
    const message = form.message.trim()

    if (name.length < 2) errors.name = 'Please enter your name.'
    else if (name.length > CONTACT_LIMITS.name) errors.name = `Name must be ${CONTACT_LIMITS.name} characters or fewer.`

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email address.'
    else if (email.length > CONTACT_LIMITS.email) errors.email = `Email must be ${CONTACT_LIMITS.email} characters or fewer.`

    if (subject.length < 3) errors.subject = 'Please add a short subject.'
    else if (subject.length > CONTACT_LIMITS.subject) errors.subject = `Subject must be ${CONTACT_LIMITS.subject} characters or fewer.`

    if (message.length < 20) errors.message = 'Please add a little more detail (at least 20 characters).'
    else if (message.length > CONTACT_LIMITS.message) errors.message = `Message must be ${CONTACT_LIMITS.message} characters or fewer.`

    return errors
}

function FieldError({ id, message }: { id: string; message?: string }) {
    if (!message) return null
    return (
        <p id={id} className="text-xs text-destructive">
            {message}
        </p>
    )
}

export function ContactPage() {
    const [form, setForm] = useState<ContactForm>(EMPTY_CONTACT_FORM)
    const [errors, setErrors] = useState<ContactFieldErrors>({})
    const [submitting, setSubmitting] = useState(false)
    const [sent, setSent] = useState(false)

    const update =
        (field: keyof ContactForm) =>
        (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const value = event.target.value
            setForm((current) => ({ ...current, [field]: value }))
            setErrors((current) => {
                if (!current[field]) return current
                const next = { ...current }
                delete next[field]
                return next
            })
        }

    const onSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (submitting) return

        const nextErrors = validateContactForm(form)
        setErrors(nextErrors)
        const firstInvalid = (Object.keys(nextErrors) as (keyof ContactForm)[])[0]
        if (firstInvalid) {
            document.getElementById(firstInvalid)?.focus()
            return
        }

        setSubmitting(true)
        try {
            await submitContactMessage({
                name: form.name.trim(),
                email: form.email.trim(),
                subject: form.subject.trim(),
                message: form.message.trim(),
            })
            setForm(EMPTY_CONTACT_FORM)
            setSent(true)
        } catch (error) {
            notifyApiError(error)
        } finally {
            setSubmitting(false)
        }
    }

    if (sent) {
        return (
            <PublicPage>
                <PageIntro
                    eyebrow="Message sent"
                    title="Thanks — your message is with us."
                    body="We have emailed you a confirmation. A member of the team will reply within two business days."
                />
                <section className="mt-12 flex flex-col items-start gap-5 border-y border-border py-10">
                    <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
                        <CheckCircle2 className="size-5 text-primary" />
                    </span>
                    <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                        Need to add something? Reply to the confirmation email and it will land in the same thread.
                    </p>
                    <Button variant="outline" onClick={() => setSent(false)}>Send another message</Button>
                </section>
            </PublicPage>
        )
    }

    return (
        <PublicPage>
            <PageIntro
                eyebrow="Contact"
                title="Questions, feedback, or a partnership idea?"
                body="We would like to hear what would make interview practice more useful for you. Send a note and our team will get back to you within two business days."
            />
            <div className="mt-12 grid gap-10 border-y border-border py-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="name">Your name</Label>
                            <Input
                                id="name"
                                name="name"
                                autoComplete="name"
                                placeholder="Ada Lovelace"
                                value={form.name}
                                onChange={update('name')}
                                maxLength={CONTACT_LIMITS.name}
                                aria-invalid={Boolean(errors.name)}
                                aria-describedby={errors.name ? 'name-error' : undefined}
                            />
                            <FieldError id="name-error" message={errors.name} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                placeholder="you@example.com"
                                value={form.email}
                                onChange={update('email')}
                                maxLength={CONTACT_LIMITS.email}
                                aria-invalid={Boolean(errors.email)}
                                aria-describedby={errors.email ? 'email-error' : undefined}
                            />
                            <FieldError id="email-error" message={errors.email} />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="subject">Subject</Label>
                        <Input
                            id="subject"
                            name="subject"
                            placeholder="Account help, product feedback, partnership…"
                            value={form.subject}
                            onChange={update('subject')}
                            maxLength={CONTACT_LIMITS.subject}
                            aria-invalid={Boolean(errors.subject)}
                            aria-describedby={errors.subject ? 'subject-error' : undefined}
                        />
                        <FieldError id="subject-error" message={errors.subject} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                            <Label htmlFor="message">Message</Label>
                            <span className="font-mono text-[11px] text-muted-foreground">
                                {form.message.length}/{CONTACT_LIMITS.message}
                            </span>
                        </div>
                        <Textarea
                            id="message"
                            name="message"
                            rows={7}
                            placeholder="Tell us what you need help with. Include the page or session you are asking about so we can respond efficiently."
                            value={form.message}
                            onChange={update('message')}
                            maxLength={CONTACT_LIMITS.message}
                            aria-invalid={Boolean(errors.message)}
                            aria-describedby={errors.message ? 'message-error' : undefined}
                        />
                        <FieldError id="message-error" message={errors.message} />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button type="submit" className="h-10" disabled={submitting}>
                            {submitting ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Sending…
                                </>
                            ) : (
                                'Send message'
                            )}
                        </Button>
                        <p className="text-xs leading-5 text-muted-foreground">
                            We only use your email to reply to this message.
                        </p>
                    </div>
                </form>
                <aside className="flex flex-col gap-3 lg:border-l lg:border-border lg:pl-10">
                    <Mail className="size-6 text-primary" />
                    <h2 className="text-base font-semibold">Prefer email?</h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                        Write to us directly at{' '}
                        <a href="mailto:hello@synthview.ai" className="text-foreground underline underline-offset-4">
                            hello@synthview.ai
                        </a>
                        .
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                        For account help, email us from the address on the account so we can verify it without extra steps.
                    </p>
                </aside>
            </div>
        </PublicPage>
    )
}

function LegalPage({ type }: { type: 'privacy' | 'terms' }) {
    const privacy = type === 'privacy'
    return (
        <PublicPage>
            <PageIntro
                eyebrow={privacy ? 'Privacy' : 'Terms'}
                title={privacy ? 'Privacy at a glance' : 'Terms of use'}
                body={privacy ? 'This summary explains the principles we follow when handling your account and interview practice data.' : 'These terms describe the ground rules for using SynthView AI and its interview practice features.'}
            />
            <div className="mt-12 max-w-3xl space-y-10 border-t border-border pt-10 text-sm leading-7 text-muted-foreground">
                {privacy ? (
                    <>
                        <section><h2 className="text-lg font-semibold text-foreground">What we collect</h2><p className="mt-2">We collect the account details and interview content needed to provide the service, improve your experience, and keep accounts secure.</p></section>
                        <section><h2 className="text-lg font-semibold text-foreground">How we use it</h2><p className="mt-2">Your information is used to run interviews, generate feedback, maintain account security, and communicate important service updates. We do not sell personal information.</p></section>
                        <section><h2 className="text-lg font-semibold text-foreground">Your choices</h2><p className="mt-2">You can review or update profile information and request account deletion through the account settings or by contacting us.</p></section>
                    </>
                ) : (
                    <>
                        <section><h2 className="text-lg font-semibold text-foreground">Use of the service</h2><p className="mt-2">Use SynthView AI for lawful interview preparation. Keep your account credentials private and do not submit content you do not have permission to use.</p></section>
                        <section><h2 className="text-lg font-semibold text-foreground">Feedback is guidance</h2><p className="mt-2">Interview evaluations are practice guidance, not employment advice or a guarantee of hiring outcomes. Review results with your own judgment.</p></section>
                        <section><h2 className="text-lg font-semibold text-foreground">Availability</h2><p className="mt-2">We work to keep the service reliable, but features may change or be temporarily unavailable for maintenance and improvements.</p></section>
                    </>
                )}
                <p className="border-t border-border pt-6 font-mono text-xs">Last updated September 10, 2026</p>
            </div>
        </PublicPage>
    )
}

export function PrivacyPage() {
    return <LegalPage type="privacy" />
}

export function TermsPage() {
    return <LegalPage type="terms" />
}
