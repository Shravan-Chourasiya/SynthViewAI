import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Mail, MapPin, Save, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { InitialsAvatar } from '@/components/ui/misc'
import { SkeletonRows } from '@/components/ui/skeleton'
import { ScoreChip } from '@/components/stat-card'
import { useAuthStore } from '@/lib/stores/auth-store'
import { interviewService } from '@/lib/services'
import { DIFFICULTY_LABEL, TYPE_LABEL, formatDate, formatRelative } from '@/lib/format'

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const updateProfile = useAuthStore((s) => s.updateProfile)

  const [name, setName] = useState(user?.name ?? user?.username ?? '')
  const [headline, setHeadline] = useState(user?.headline ?? '')
  const [location, setLocation] = useState(user?.location ?? '')

  const interviews = useQuery({
    queryKey: ['interviews', 'recent'],
    queryFn: () => interviewService.list({ sort: 'recent', pageSize: 5 }),
  })

  if (!user) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your profile."
        lede="How you show up in reports and on shared links."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Panel className="space-y-5">
          <div className="flex items-center gap-4">
            <InitialsAvatar name={user.name ?? user.username} className="size-14" />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold tracking-tight">{user.name ?? user.username}</h2>
              <p className="font-mono text-[11px] text-muted-foreground">@{user.username}</p>
            </div>
          </div>

          <dl className="space-y-3 border-t border-border pt-5 text-sm">
            <div className="flex items-center gap-3">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-mono text-[12px]">{user.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              <span>{user.location ?? '—'}</span>
            </div>
            <div className="flex items-center gap-3">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
              <span>Joined {formatDate(user.joinedAt ?? user.createdAt)}</span>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
              <Badge variant={(user.role ?? user.userrole) === 'admin' ? 'default' : 'neutral'}>{user.role ?? user.userrole}</Badge>
            </div>
          </dl>

          <p className="border-t border-border pt-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            last active {user.lastActiveAt ? formatRelative(user.lastActiveAt) : 'recently'}
          </p>
        </Panel>

        <div className="space-y-4">
          <Panel flush>
            <PanelHeader title="Account details" />
            <div className="space-y-5 p-5">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-headline">Headline</Label>
                <Input
                  id="profile-headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Senior frontend engineer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-location">Location</Label>
                <Input id="profile-location" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <Button
                onClick={() => {
                  void updateProfile({
                    firstName: name.split(' ')[0],
                    lastName: name.split(' ').slice(1).join(' ') || undefined,
                  })
                    .then(() => toast.success('Profile updated'))
                    .catch(() => toast.error('Could not save your profile'))
                }}
              >
                <Save className="size-4" />
                Save changes
              </Button>
            </div>
          </Panel>

          <Panel flush>
            <PanelHeader
              title="Recent sessions"
              aside={
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {interviews.data?.total ?? 0} total
                </span>
              }
            />
            {interviews.isLoading ? (
              <SkeletonRows rows={4} />
            ) : (
              <ul className="divide-y divide-border">
                {(interviews.data?.items ?? []).map((interview) => (
                  <li key={interview.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{interview.roleTitle}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {interview.code} · {formatDate(interview.createdAt)}
                      </p>
                    </div>
                    <Badge variant="neutral">{TYPE_LABEL[interview.type]}</Badge>
                    <Badge variant="outline">{DIFFICULTY_LABEL[interview.difficulty]}</Badge>
                    <StatusBadge status={interview.status} />
                    <ScoreChip score={interview.score} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="flex items-start gap-3 border-primary/30 bg-primary/5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed">
              Add a headline and location and they will appear on shared report links.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
