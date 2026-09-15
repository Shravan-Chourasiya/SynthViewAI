import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, Loader2, Plus, X } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useInterviewListStore } from '@/lib/stores/interview-list.store'
import type { Difficulty, EndingCriteria, ExperienceLevel, InterviewStyle, InterviewType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/http'

const STEPS = ['Role & Context', 'Interview Type', 'Interview Style', 'Difficulty & Experience', 'Topics & Skills', 'Duration & Ending', 'Review'] as const

// Keep this in sync with backend/src/constants/interview.constants.ts. A backend endpoint
// is intentionally deferred because this is a fixed, curated product list; update both
// locations together whenever the closed enum changes.
const TARGET_COMPANIES = ['Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Netflix', 'OpenAI', 'Nvidia', 'TCS', 'Infosys', 'JPMorgan', 'Wipro', 'Deloitte', 'Adobe', 'Anthropic'] as const
type CompanyChoice = (typeof TARGET_COMPANIES)[number] | 'NONE' | 'OTHER'

interface WizardState {
  domain: string
  roleTitle: string
  companyChoice: CompanyChoice
  companyOther: string
  experienceLevel: ExperienceLevel
  difficulty: Difficulty
  type: InterviewType
  interviewStyle: InterviewStyle
  durationMin: number
  topics: string[]
  endingCriteria: EndingCriteria
  questionCount: number
}

const initialState: WizardState = {
  domain: '', roleTitle: '', companyChoice: 'NONE', companyOther: '', experienceLevel: 'Entry',
  difficulty: 'Adaptive', type: 'Mixed', interviewStyle: 'REGULAR', durationMin: 30,
  topics: [], endingCriteria: 'DURATION', questionCount: 5,
}

const TYPE_OPTIONS: { value: InterviewType; title: string; description: string }[] = [
  { value: 'Behavioral', title: 'Behavioral', description: 'Communication, STAR stories, situational judgment.' },
  { value: 'Technical', title: 'Technical', description: 'Concepts, system design, domain knowledge.' },
  // No 'Coding' option: the backend interview-type enum is BEHAVIORAL | TECHNICAL | MIXED,
  // and there is no code execution environment, so a coding round cannot be created.
  { value: 'Mixed', title: 'Mixed', description: 'A realistic blend of both round types.' },
]
const STYLE_OPTIONS: { value: InterviewStyle; title: string; description: string }[] = [
  { value: 'FAANG', title: 'FAANG', description: 'Big-tech interview conventions.' },
  { value: 'MAANG', title: 'MAANG', description: 'Meta, Amazon, Apple, Netflix, Google.' },
  { value: 'STARTUP', title: 'Startup', description: 'Pragmatic, ownership-focused questions.' },
  { value: 'REGULAR', title: 'Other', description: 'A standard interview with no culture slant.' },
]
const DIFFICULTY_OPTIONS: { value: Difficulty; title: string; description: string }[] = [
  { value: 'Adaptive', title: 'Adaptive', description: 'Difficulty rises and falls with your performance. Recommended.' },
  { value: 'Easy', title: 'Easy', description: 'A gentle, confidence-building session.' },
  { value: 'Medium', title: 'Medium', description: 'A balanced challenge.' },
  { value: 'Hard', title: 'Hard', description: 'Consistently demanding questions.' },
]
const TOPIC_SUGGESTIONS = ['React', 'JavaScript', 'TypeScript', 'DSA', 'SQL', 'System Design', 'Node.js', 'Communication', 'Python', 'ML Basics', 'Data Structures', 'APIs']
const selectCls = 'h-9 w-full appearance-none rounded-md border border-input bg-transparent pl-3 pr-9 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring'

export function NewInterviewPage() {
  const navigate = useNavigate()
  const createInterview = useInterviewListStore((s) => s.createInterview)
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(initialState)
  const [errors, setErrors] = useState<string[]>([])
  const [topicInput, setTopicInput] = useState('')
  const [creating, setCreating] = useState(false)
  const patch = (p: Partial<WizardState>) => setState((s) => ({ ...s, ...p }))
  const topicsFull = state.topics.length === 10

  const validateStep = (): string[] => {
    const errs: string[] = []
    if (step === 0) {
      if (!state.domain.trim()) errs.push('Field / domain is required.')
      if (!state.roleTitle.trim()) errs.push('Target role is required.')
      if (state.companyChoice === 'OTHER' && !state.companyOther.trim()) errs.push('Enter the other company name or choose None.')
    }
    if (step === 5 && state.endingCriteria === 'QUESTION_COUNT' && (!Number.isInteger(state.questionCount) || state.questionCount < 1 || state.questionCount > 25)) errs.push('Question count must be a whole number from 1 to 25.')
    return errs
  }
  const next = () => { const errs = validateStep(); setErrors(errs); if (!errs.length) setStep((s) => Math.min(s + 1, STEPS.length - 1)) }
  const back = () => { setErrors([]); setStep((s) => Math.max(s - 1, 0)) }
  const addTopic = (topic: string) => {
    const value = topic.trim()
    if (!value || topicsFull || value.length > 50 || state.topics.includes(value)) return
    patch({ topics: [...state.topics, value] }); setTopicInput('')
  }
  const removeTopic = (topic: string) => patch({ topics: state.topics.filter((item) => item !== topic) })
  const create = async () => {
    setCreating(true)
    try {
      const id = await createInterview({
        ...state,
        rounds: 1,
        targetedCompany: TARGET_COMPANIES.includes(state.companyChoice as (typeof TARGET_COMPANIES)[number]) ? state.companyChoice : undefined,
        targetedCompanyOther: state.companyChoice === 'OTHER' ? state.companyOther.trim() : undefined,
      })
      navigate(`/interviews/${id}/lobby`)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
        const fields = (error.details as { fields?: { field?: string; message?: string }[] } | undefined)?.fields
        if (fields?.length) {
          setErrors(fields.map((field) => `${field.field ? `${field.field}: ` : ''}${field.message ?? 'Invalid value'}`))
        } else {
          setErrors([error.message])
        }
      } else {
        setErrors([error instanceof Error ? error.message : 'Unable to create the interview.'])
      }
    } finally { setCreating(false) }
  }

  return <AppShell title="New Interview"><div className="animate-slide-up mx-auto flex max-w-3xl flex-col gap-6">
    <header><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">New interview</p><h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">Configure your interview</h1><p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">The AI interviewer adapts to everything you set here. Review it all before entering the lobby.</p></header>
    <ol className="flex flex-wrap items-center gap-y-2">{STEPS.map((label, index) => { const done = index < step; const active = index === step; return <li key={label} className="flex items-center">{index > 0 && <span aria-hidden="true" className={cn('mx-1.5 h-px w-5 sm:mx-2 sm:w-8', index <= step ? 'bg-primary/50' : 'bg-border')} />}<button type="button" onClick={() => done && setStep(index)} disabled={!done} aria-current={active ? 'step' : undefined} className={cn('flex items-center gap-2 rounded-full py-1 pl-1 transition-colors', done ? 'cursor-pointer pr-2' : 'pr-1', active && 'pr-3')}><span className={cn('flex size-7 items-center justify-center rounded-full font-mono text-[11px] font-semibold ring-1 transition-colors', done && 'bg-[var(--signal-strong)]/15 text-[var(--signal-strong)] ring-[var(--signal-strong)]/30', active && 'bg-primary text-primary-foreground ring-primary', !done && !active && 'bg-secondary text-muted-foreground ring-border')}>{done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}</span>{(active || done) && <span className={cn('hidden font-mono text-[10px] uppercase tracking-wider md:inline', active ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>}</button></li> })}</ol>
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-7">
      {errors.length > 0 && <div className="mb-4"><Alert variant="destructive" icon={<AlertTriangle className="size-4" />}><ul className="list-inside list-disc">{errors.map((error) => <li key={error}>{error}</li>)}</ul></Alert></div>}
      {step === 0 && <RoleContext state={state} patch={patch} />}
      {step === 1 && <div className="flex flex-col gap-4"><OptionCards options={TYPE_OPTIONS} selected={state.type} onSelect={(type) => patch({ type })} /><div className="rounded-xl border border-dashed border-border bg-card/50 p-4"><p className="text-xs leading-relaxed text-muted-foreground">Coding rounds are not available yet — this build has no code execution environment, so every session is a writing-based behavioral, technical or mixed interview.</p></div></div>}
      {step === 2 && <OptionCards options={STYLE_OPTIONS} selected={state.interviewStyle} onSelect={(interviewStyle) => patch({ interviewStyle })} />}
      {step === 3 && <div className="flex flex-col gap-5"><div className="flex flex-col gap-1.5"><Label htmlFor="experience">Experience level</Label><SelectShell><select id="experience" className={selectCls} value={state.experienceLevel} onChange={(event) => patch({ experienceLevel: event.target.value as ExperienceLevel })}>{(['Entry', 'Junior', 'Mid-level', 'Senior'] as const).map((level) => <option key={level} value={level}>{level}</option>)}</select></SelectShell></div><OptionCards options={DIFFICULTY_OPTIONS} selected={state.difficulty} onSelect={(difficulty) => patch({ difficulty })} /></div>}
      {step === 4 && <Topics state={state} topicInput={topicInput} topicsFull={topicsFull} setTopicInput={setTopicInput} addTopic={addTopic} removeTopic={removeTopic} />}
      {step === 5 && <Ending state={state} patch={patch} />}
      {step === 6 && <Review state={state} />}
      <div className="mt-6 flex items-center justify-between border-t border-border pt-5"><Button variant="ghost" onClick={back} disabled={step === 0 || creating}><ArrowLeft className="size-4" />Back</Button><div className="flex items-center gap-3"><span className="font-mono text-[11px] text-muted-foreground">Step {step + 1} of {STEPS.length}</span>{step < STEPS.length - 1 ? <Button onClick={next}>Continue<ArrowRight className="size-4" /></Button> : <Button onClick={create} disabled={creating}>{creating ? <><Loader2 className="size-4 animate-spin" />Creating…</> : <>Create &amp; Enter Lobby<ArrowRight className="size-4" /></>}</Button>}</div></div>
    </div>
  </div></AppShell>
}

function RoleContext({ state, patch }: { state: WizardState; patch: (patch: Partial<WizardState>) => void }) { return <div className="flex flex-col gap-4"><div className="flex flex-col gap-1.5"><Label htmlFor="domain">Field / domain <span className="text-destructive">*</span></Label><Input id="domain" placeholder="e.g. Software Engineering" value={state.domain} onChange={(event) => patch({ domain: event.target.value })} /></div><div className="flex flex-col gap-1.5"><Label htmlFor="role">Target role <span className="text-destructive">*</span></Label><Input id="role" placeholder="e.g. Frontend Engineer" value={state.roleTitle} onChange={(event) => patch({ roleTitle: event.target.value })} /></div><div><Label>Target company</Label><div className="mt-2 flex flex-wrap gap-2">{TARGET_COMPANIES.map((company) => <ChoicePill key={company} active={state.companyChoice === company} onClick={() => patch({ companyChoice: company, companyOther: '' })}>{company}</ChoicePill>)}<ChoicePill active={state.companyChoice === 'NONE'} onClick={() => patch({ companyChoice: 'NONE', companyOther: '' })}>None</ChoicePill><ChoicePill active={state.companyChoice === 'OTHER'} onClick={() => patch({ companyChoice: 'OTHER' })}>Other</ChoicePill></div>{state.companyChoice === 'OTHER' && <div className="mt-3 flex flex-col gap-1.5"><Input maxLength={100} placeholder="Company name" value={state.companyOther} onChange={(event) => patch({ companyOther: event.target.value })} /><p className="text-xs text-muted-foreground">We’ll use this as context, but tailored questions are only available for the companies listed above.</p></div>}</div></div> }
function Topics({ state, topicInput, topicsFull, setTopicInput, addTopic, removeTopic }: { state: WizardState; topicInput: string; topicsFull: boolean; setTopicInput: (value: string) => void; addTopic: (topic: string) => void; removeTopic: (topic: string) => void }) { return <div><div className="flex items-center justify-between"><Label>Topics &amp; skills to cover</Label><span className="font-mono text-[10px] text-muted-foreground">{state.topics.length}/10 skills added</span></div><div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md border border-input bg-transparent p-2 transition-shadow focus-within:ring-1 focus-within:ring-ring">{state.topics.map((topic) => <span key={topic} className="flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 font-mono text-xs text-secondary-foreground">{topic}<button type="button" aria-label={`Remove ${topic}`} onClick={() => removeTopic(topic)} className="text-muted-foreground transition-colors hover:text-foreground"><X className="size-3" /></button></span>)}{!topicsFull && <input maxLength={50} value={topicInput} onChange={(event) => setTopicInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTopic(topicInput) } else if (event.key === 'Backspace' && !topicInput && state.topics.length) removeTopic(state.topics[state.topics.length - 1]) }} placeholder={state.topics.length ? 'Add another…' : 'Type a topic and press Enter…'} aria-label="Add topic" className="min-w-32 flex-1 border-0 bg-transparent px-1.5 py-1 text-sm focus:outline-none placeholder:text-muted-foreground" />}</div>{!topicsFull && <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">{topicInput.length}/50</p>}{topicsFull && <p className="mt-2 text-xs text-muted-foreground">10/10 skills added. Remove a skill to add another.</p>}<p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Suggestions</p><div className="mt-2 flex flex-wrap gap-2">{TOPIC_SUGGESTIONS.map((topic) => { const selected = state.topics.includes(topic); return <button key={topic} type="button" disabled={topicsFull && !selected} onClick={() => selected ? removeTopic(topic) : addTopic(topic)} className={cn('flex items-center gap-1 rounded-md border px-2.5 py-1 font-mono text-xs transition-colors', selected ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary', topicsFull && !selected && 'cursor-not-allowed opacity-50')}>{selected ? <Check className="size-3" /> : <Plus className="size-3" />}{topic}</button> })}</div></div> }
function Ending({ state, patch }: { state: WizardState; patch: (patch: Partial<WizardState>) => void }) { return <div className="flex flex-col gap-5"><div><Label>Duration</Label><div className="mt-1.5 flex flex-wrap gap-2">{[15, 30, 45, 60].map((minutes) => <ChoicePill key={minutes} active={state.durationMin === minutes} onClick={() => patch({ durationMin: minutes })}>{minutes} min</ChoicePill>)}</div></div><div><Label>End interview by</Label><div className="mt-1.5 flex flex-wrap gap-2"><ChoicePill active={state.endingCriteria === 'QUESTION_COUNT'} onClick={() => patch({ endingCriteria: 'QUESTION_COUNT' })}>By question count</ChoicePill><ChoicePill active={state.endingCriteria === 'DURATION'} onClick={() => patch({ endingCriteria: 'DURATION' })}>By duration</ChoicePill></div>{state.endingCriteria === 'QUESTION_COUNT' && <div className="mt-3 flex flex-col gap-1.5"><Label htmlFor="question-count">Question count</Label><Input id="question-count" type="number" min={1} max={25} value={state.questionCount} onChange={(event) => patch({ questionCount: Number(event.target.value) })} /><p className="text-xs text-muted-foreground">End after {state.questionCount || 1} questions. Your {state.durationMin}-minute duration remains a safety timeout.</p></div>}</div><Alert variant="default">Your selected duration always remains the maximum session length.</Alert></div> }
function Review({ state }: { state: WizardState }) { return <div><Alert variant="strong" icon={<Check className="size-4" />}>Everything looks good. Review the configuration, then create your interview.</Alert><div className="mt-4 grid gap-3 sm:grid-cols-2"><ReviewItem label="Role" value={state.roleTitle} /><ReviewItem label="Domain" value={state.domain} /><ReviewItem label="Company" value={state.companyChoice === 'OTHER' ? state.companyOther : state.companyChoice === 'NONE' ? 'None' : state.companyChoice} /><ReviewItem label="Type" value={state.type} /><ReviewItem label="Style" value={state.interviewStyle === 'REGULAR' ? 'Other / regular' : state.interviewStyle} /><ReviewItem label="Difficulty" value={`${state.difficulty} · ${state.experienceLevel}`} /><ReviewItem label="Duration" value={`${state.durationMin} minutes`} /><ReviewItem label="Ending" value={state.endingCriteria === 'QUESTION_COUNT' ? `${state.questionCount} questions (or duration limit)` : 'Duration limit'} /><ReviewItem label="Topics" value={state.topics.length ? state.topics.join(', ') : 'AI will choose based on the role'} /></div></div> }
function ChoicePill({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) { return <button type="button" aria-pressed={active} onClick={onClick} className={cn('rounded-lg border px-3 py-2 font-mono text-xs transition-colors', active ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary')}>{children}</button> }
function OptionCards<T extends string>({ options, selected, onSelect }: { options: { value: T; title: string; description: string }[]; selected: T; onSelect: (value: T) => void }) { return <div className="grid gap-3 sm:grid-cols-2">{options.map((option) => { const active = selected === option.value; return <button key={option.value} type="button" aria-pressed={active} onClick={() => onSelect(option.value)} className={cn('relative rounded-xl border p-4 text-left transition-all', active ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:border-primary/30 hover:bg-accent/40')}>{active && <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" strokeWidth={3} /></span>}<p className="pr-6 text-sm font-semibold">{option.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{option.description}</p></button> })}</div> }
function SelectShell({ children }: { children: ReactNode }) { return <div className="relative">{children}<ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /></div> }
function ReviewItem({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border bg-background/50 px-3.5 py-2.5"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div> }
