import { useState, useEffect } from 'react';
import { AppShell } from '@/components/app-shell';
import { AdminGate, AdminHeader } from './shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { useAdminStore } from '@/lib/stores/admin.store';
import { useAuthStore } from '@/lib/stores/auth.store';
import { ROLE_LABELS, ROLE_RANK, USER_ROLES, canManageRoles, getRoleRank, outranks } from '@/lib/roles';
import { UserSummary } from '@/lib/services/admin.service';
import { RotateCcw, Search, AlertTriangle } from 'lucide-react';

export function AdminUsersPage() {
  const { 
    users, 
    userPagination, 
    usersLoading, 
    usersError, 
    loadUsers, 
    updateUserRole, 
    suspendUser, 
    reinstateUser 
  } = useAdminStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  // Radix Select forbids empty-string item values, so "ALL" is the sentinel.
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [showSuspendDialog, setShowSuspendDialog] = useState<{open: boolean, user: UserSummary | null}>({open: false, user: null});

  // Role management mirrors the backend hierarchy (user < moderator < admin < owner):
  // an actor may only assign roles strictly below its own, except the owner — the
  // apex — which may assign any role, including owner.
  const actorRole = useAuthStore((s) => s.user?.userrole);
  const isOwner = getRoleRank(actorRole) >= ROLE_RANK.owner;
  const canManage = canManageRoles(actorRole);
  const canEditRow = (targetRole: string) => isOwner || outranks(actorRole, targetRole);
  const assignableRoles = USER_ROLES.filter((role) => isOwner || outranks(actorRole, role));

  useEffect(() => {
    loadUsers({
      page: currentPage,
      limit: 10,
      search: searchTerm,
      role: roleFilter === 'ALL' ? undefined : roleFilter
    });
  }, [currentPage, searchTerm, roleFilter]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    await updateUserRole(userId, newRole);
  };

  const handleSuspendUser = async (userId: string, reason?: string) => {
    if (showSuspendDialog.user) {
      if (showSuspendDialog.user.accountStatus === 'suspended') {
        await reinstateUser(userId);
      } else {
        await suspendUser(userId, reason);
      }
      setShowSuspendDialog({open: false, user: null});
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'suspended': return 'weak'; // Changed from 'destructive' to 'weak' which exists in badge variants
      case 'disabled': return 'vague'; // Changed to existing variant
      case 'deleted': return 'neutral'; // Changed to existing variant
      case 'pending': return 'vague'; // Changed to existing variant
      default: return 'outline';
    }
  };

  return (
    <AppShell title="Admin - Users">
      <AdminGate>
        <div className="mx-auto max-w-7xl p-4 md:p-6">
          <AdminHeader 
            title="User Management" 
            description="Manage user accounts, roles, and access" 
          />

          {usersError && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
              Error loading users: {usersError}
            </div>
          )}

          {/* Filters and Search */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>User Filters</CardTitle>
            </CardHeader>
            <CardContent>
              {/* The search field takes all the leftover width; the role select
                  stays content-sized from md upwards. */}
              <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
                <div className="relative w-full md:min-w-64 md:flex-1">
                  <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, username or email..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-8"
                  />
                </div>
                <div className="md:w-48">
                  <Select value={roleFilter} onValueChange={(value) => {
                    setRoleFilter(value);
                    setCurrentPage(1);
                  }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Roles</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                  </Select>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full md:w-auto"
                  onClick={() => {
                    setSearchTerm('');
                    // 'ALL' is the sentinel the Select needs; '' would blank the trigger.
                    setRoleFilter('ALL');
                    setCurrentPage(1);
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Interviews</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-8" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                      </TableRow>
                    ))
                  ) : users.length > 0 ? (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.firstName} {user.lastName}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Select 
                            value={user.userrole} 
                            onValueChange={(value) => handleRoleChange(user.id, value)}
                            disabled={!canManage || !canEditRow(user.userrole)}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {assignableRoles.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(user.accountStatus)}>
                            {user.accountStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.interviewCount}</TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant={user.accountStatus === 'suspended' ? "outline" : "default"} 
                            size="sm"
                            onClick={() => setShowSuspendDialog({open: true, user})}
                          >
                            {user.accountStatus === 'suspended' ? 'Reinstate' : 'Suspend'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {!usersLoading && (
                <div className="flex flex-col items-center justify-between gap-4 border-t bg-card px-6 py-4 sm:flex-row">
                  <div className="text-sm text-muted-foreground">
                    Showing <span className="font-medium">{Math.min((currentPage - 1) * 10 + 1, userPagination.total)}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * 10, userPagination.total)}
                    </span>{' '}
                    of <span className="font-medium">{userPagination.total}</span> users
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage <= 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, userPagination.totalPages) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, userPagination.totalPages))}
                      disabled={currentPage >= userPagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminGate>
      
      {/* Separate Dialog for Suspend/Reinstate Confirmation */}
      <Dialog
        open={showSuspendDialog.open}
        onClose={() => setShowSuspendDialog({open: false, user: null})}
      >
        {showSuspendDialog.user && (
          <ConfirmDialog
            open={showSuspendDialog.open}
            title={showSuspendDialog.user.accountStatus === 'suspended' ? 'Reinstate User' : 'Suspend User'}
            description={showSuspendDialog.user.accountStatus === 'suspended' 
              ? `Are you sure you want to reinstate ${showSuspendDialog.user.firstName} ${showSuspendDialog.user.lastName}?` 
              : `Are you sure you want to suspend ${showSuspendDialog.user.firstName} ${showSuspendDialog.user.lastName}?`}
            confirmLabel={showSuspendDialog.user.accountStatus === 'suspended' ? 'Reinstate' : 'Suspend'}
            destructive={showSuspendDialog.user.accountStatus !== 'suspended'}
            onConfirm={() => handleSuspendUser(showSuspendDialog.user!.id)}
            onClose={() => setShowSuspendDialog({open: false, user: null})}
          />
        )}
      </Dialog>
    </AppShell>
  );
}

export default AdminUsersPage;
