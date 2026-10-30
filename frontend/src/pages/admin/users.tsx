import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Search, ShieldCheck, UserX, Users } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SkeletonRows } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { InitialsAvatar } from '@/components/ui/misc'
import { adminService } from '@/lib/services'
import { formatDate, formatRelative } from '@/lib/format'
import type { UserRole, UserStatus } from '@/lib/types'

const ROLE_VARIANT: Record<UserRole, 'default' | 'neutral' | 'outline'> = {
  admin: 'default',
  reviewer: 'outline',
  candidate: 'neutral',
}

const STATUS_VARIANT: Record<UserStatus, 'strong' | 'vague' | 'weak'> = {
  active: 'strong',
  invited: 'vague',
  suspended: 'weak',
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<UserRole | 'all'>('all')
  const [status, setStatus] = useState<UserStatus | 'all'>('all')

  const query = useQuery({
    queryKey: ['admin', 'users', { search, role, status }],
    queryFn: () => adminService.users({ search, role, status }),
  })

  const setUserStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: UserStatus }) => adminService.setStatus(id, next),
    onSuccess: () => {
      toast.success('User updated')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })

  const setUserRole = useMutation({
    mutationFn: ({ id, next }: { id: string; next: UserRole }) => adminService.setRole(id, next),
    onSuccess: () => {
      toast.success('Role updated')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Users."
        lede="Search accounts, adjust roles and suspend access without deleting history."
      />

      <Panel flush>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, username or email"
              className="pl-9"
              aria-label="Search users"
            />
          </div>
          <Select value={role} onValueChange={(value) => setRole(value as UserRole | 'all')}>
            <SelectTrigger className="w-36" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="candidate">Candidate</SelectItem>
              <SelectItem value="reviewer">Reviewer</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => setStatus(value as UserStatus | 'all')}>
            <SelectTrigger className="w-36" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <PanelHeader
          title="Accounts"
          aside={
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {query.data?.length ?? 0} shown
            </span>
          }
        />

        {query.isLoading ? (
          <SkeletonRows rows={8} />
        ) : query.data && query.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Avg score</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((user, index) => (
                <TableRow
                  key={user.id}
                  className="animate-rise-in"
                  style={{ '--stagger-i': index } as React.CSSProperties}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={user.name} className="size-8" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROLE_VARIANT[user.role]}>{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[user.status]} dot>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] tabular-nums">
                    {user.interviews}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] tabular-nums">
                    {user.avgScore ?? '—'}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {formatDate(user.joinedAt)}
                  </TableCell>
                  <TableCell>
                    <Popover.Root>
                      <Popover.Trigger asChild>
                        <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${user.name}`}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content
                          align="end"
                          sideOffset={6}
                          className="z-50 w-52 rounded-xl border border-border bg-popover p-1 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0"
                        >
                          <p className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            last active {formatRelative(user.lastActiveAt)}
                          </p>
                          <button
                            type="button"
                            disabled={user.role === 'reviewer'}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent disabled:opacity-40"
                            onClick={() => setUserRole.mutate({ id: user.id, next: 'reviewer' })}
                          >
                            <ShieldCheck className="size-4 text-muted-foreground" />
                            Make reviewer
                          </button>
                          <button
                            type="button"
                            disabled={user.status === 'suspended'}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive outline-none hover:bg-destructive/10 disabled:opacity-40"
                            onClick={() => setUserStatus.mutate({ id: user.id, next: 'suspended' })}
                          >
                            <UserX className="size-4" />
                            Suspend access
                          </button>
                          {user.status === 'suspended' ? (
                            <button
                              type="button"
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent"
                              onClick={() => setUserStatus.mutate({ id: user.id, next: 'active' })}
                            >
                              <ShieldCheck className="size-4 text-signal-strong" />
                              Reinstate
                            </button>
                          ) : null}
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={Users}
              title="No users match"
              description="Try a different search term, or clear the role and status filters."
            />
          </div>
        )}
      </Panel>
    </div>
  )
}
