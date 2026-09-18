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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAdminStore } from '@/lib/stores/admin.store';
import { UserSummary } from '@/lib/services/admin.service';
import { RotateCcw, Search, Edit, Trash2, AlertTriangle } from 'lucide-react';

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
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showSuspendDialog, setShowSuspendDialog] = useState<{open: boolean, user: UserSummary | null}>({open: false, user: null});

  useEffect(() => {
    loadUsers({
      page: currentPage,
      limit: 10,
      search: searchTerm,
      role: roleFilter
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
      case 'suspended': return 'destructive';
      case 'pending': return 'secondary';
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
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 mb-4">
              Error loading users: {usersError}
            </div>
          )}

          {/* Filters and Search */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>User Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-8"
                  />
                </div>
                <Select value={roleFilter} onValueChange={(value) => {
                  setRoleFilter(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Roles</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm('');
                    setRoleFilter('');
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
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="moderator">Moderator</SelectItem>
                              <SelectItem value="owner">Owner</SelectItem>
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
                          <Dialog 
                            open={showSuspendDialog.open && showSuspendDialog.user?.id === user.id} 
                            onOpenChange={(open) => {
                              if (!open) {
                                setShowSuspendDialog({open: false, user: null});
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button 
                                variant={user.accountStatus === 'suspended' ? "outline" : "destructive"} 
                                size="sm"
                                onClick={() => setShowSuspendDialog({open: true, user})}
                              >
                                {user.accountStatus === 'suspended' ? 'Reinstate' : 'Suspend'}
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  {user.accountStatus === 'suspended' ? 'Reinstate User' : 'Suspend User'}
                                </DialogTitle>
                                <DialogDescription>
                                  {user.accountStatus === 'suspended' 
                                    ? `Are you sure you want to reinstate ${user.firstName} ${user.lastName}?` 
                                    : `Are you sure you want to suspend ${user.firstName} ${user.lastName}?`}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="flex items-start gap-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
                                <div className="text-sm text-yellow-700">
                                  {user.accountStatus === 'suspended' 
                                    ? 'The user will regain access to their account.' 
                                    : 'The user will lose access to their account and all active sessions will be terminated.'}
                                </div>
                              </div>
                              <DialogFooter>
                                <Button 
                                  variant={user.accountStatus === 'suspended' ? "default" : "destructive"} 
                                  onClick={() => handleSuspendUser(user.id)}
                                >
                                  {user.accountStatus === 'suspended' ? 'Reinstate' : 'Suspend'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
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
                <div className="flex flex-col items-center justify-between gap-4 border-t bg-white px-6 py-4 sm:flex-row">
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
    </AppShell>
  );
}