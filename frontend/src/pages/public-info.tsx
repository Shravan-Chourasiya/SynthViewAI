import { useState, type ReactNode } from 'react'
import { Loader2, Mail, MessageSquare, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Eyebrow, Section } from '@/components/section'
import { Reveal } from '@/components/reveal'
import { Panel } from '@/components/ui/panel'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { contactService } from '@/lib/services'

function ProsePage({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string
  title: string
  lede: string
  children: ReactNode
}) {
  return (
    <Section className="mx-auto max-w-3xl">
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">{lede}</p>
      </Reveal>
      <div className="mt-10 space-y-8">{children}</div>
    </Section>
  )
}

function Prose({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <Reveal>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </section>
    </Reveal>
  )
}

export function AboutPage() {
  return (
    <ProsePage
      eyebrow="About"
      title="We built the interview we wished we had."
      lede="SynthView AI is a mock-interview platform that behaves like a real loop: one question at a time, scored as you speak, with the next question chosen from what you actually said."
    >
      <Prose heading="Why adaptive">
        <p>
          Most practice tools are questionnaires. You answer twenty fixed prompts, get a percentage, and learn
          nothing about the part of your reasoning that was actually weak. We wanted the opposite: a session that
          notices when an answer was thin and probes it, then moves on when you have proven the point.
        </p>
      </Prose>
      <Prose heading="What it is not">
        <p>
          SynthView does not screen candidates for employers, and it does not pretend a model can replace a human
          interviewer. It is a rehearsal room: honest, private, and available at 1am the night before the loop.
        </p>
      </Prose>
      <Prose heading="How judgement is scored">
        <p>
          Every answer lands on the same four-point scale — strong, good, vague, weak. Because the scale never
          changes, the trend across sessions is meaningful. The colour is functional: green means strong, blue
          means good, amber means vague, red means weak.
        </p>
      </Prose>
      <Prose heading="This build">
        <p>
          This is a frontend prototype. Every screen is wired to typed mock services that return realistic data,
          so the real API and WebSocket can be dropped in without touching a single component.
        </p>
      </Prose>
    </ProsePage>
  )
}

export function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState('feedback')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await contactService.send({ name, email, subject: topic, message })
      setSent(true)
      toast.success('Message sent')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ProsePage
      eyebrow="Contact"
      title="Tell us what broke, or what you want next."
      lede="Bug reports, evaluation disagreements and feature requests all land in the same inbox. We read everything, even when we cannot reply quickly."
    >
      <Reveal>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
              <Mail className="size-4.5 text-primary" />
            </span>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Email</h3>
              <p className="mt-1 font-mono text-xs text-muted-foreground">hello@synthview.ai</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
              <MessageSquare className="size-4.5 text-primary" />
            </span>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Response time</h3>
              <p className="mt-1 font-mono text-xs text-muted-foreground">usually under 2 working days</p>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <Panel>
          {sent ? (
            <div className="space-y-3 text-center">
              <h2 className="text-lg font-semibold tracking-tight">Message received.</h2>
              <p className="text-sm text-muted-foreground">
                Thanks {name || 'there'} — we&apos;ll reply to{' '}
                <span className="font-mono text-[12px]">{email}</span> if a reply is needed.
              </p>
              <Button variant="outline" onClick={() => setSent(false)}>
                Send another
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Name</Label>
                  <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-topic">Topic</Label>
                <Select value={topic} onValueChange={setTopic}>
                  <SelectTrigger id="contact-topic">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feedback">Evaluation feedback</SelectItem>
                    <SelectItem value="bug">Bug report</SelectItem>
                    <SelectItem value="feature">Feature request</SelectItem>
                    <SelectItem value="privacy">Privacy or data</SelectItem>
                    <SelectItem value="other">Something else</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-message">Message</Label>
                <Textarea
                  id="contact-message"
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What happened, and what did you expect instead?"
                  minLength={10}
                  required
                />
              </div>

              <Button type="submit" size="lg" disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {submitting ? 'Sending' : 'Send message'}
              </Button>
            </form>
          )}
        </Panel>
      </Reveal>
    </ProsePage>
  )
}

export function PrivacyPage() {
  return (
    <ProsePage
      eyebrow="Privacy"
      title="What we store, and why."
      lede="An interview platform sees a lot. Here is the honest version of what SynthView keeps and how long it stays."
    >
      <Prose heading="What we collect">
        <p>
          Account details (name, email), your answers and their evaluations, session metadata such as duration and
          difficulty, and device information used to show you active sessions.
        </p>
      </Prose>
      <Prose heading="Audio and video">
        <p>
          The live room shows a local camera preview so the session feels real. Recordings are not retained by
          default, and transcripts are stored only so you can revisit your own report.
        </p>
      </Prose>
      <Prose heading="Retention">
        <p>
          Sessions and reports stay until you delete them. Deleting an interview removes its questions, answers,
          evaluations and derived analytics.
        </p>
      </Prose>
      <Prose heading="Your controls">
        <p>
          You can export a report, copy a share link (which can be revoked), revoke individual device sessions,
          and delete your account from settings.
        </p>
      </Prose>
    </ProsePage>
  )
}

export function TermsPage() {
  return (
    <ProsePage
      eyebrow="Terms"
      title="The rules of the room."
      lede="Short version: practise honestly, don't use SynthView to screen people without their knowledge, and don't expect a guarantee of employment."
    >
      <Prose heading="Acceptable use">
        <p>
          Use SynthView for your own practice or with consenting participants. Do not upload other people&apos;s
          personal data, and do not scrape evaluation output to train competing models.
        </p>
      </Prose>
      <Prose heading="Scores are advisory">
        <p>
          Evaluation is probabilistic. A score is a signal about a session, not a judgement about you, and it
          carries no guarantee about any real interview outcome.
        </p>
      </Prose>
      <Prose heading="Availability">
        <p>
          This build is a preview and is provided as-is. Sessions may be reset, and mock data may change between
          releases.
        </p>
      </Prose>
    </ProsePage>
  )
}
