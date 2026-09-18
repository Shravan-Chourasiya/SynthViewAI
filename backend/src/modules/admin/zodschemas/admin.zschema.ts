import { z } from "zod";

// User listing filters
export const userListQuerySchema = z.object({
  page: z.string().optional().default('1').transform((val) => {
    const num = Number(val);
    return isNaN(num) || num < 1 ? 1 : num;
  }),
  limit: z.string().optional().default('10').transform((val) => {
    const num = Number(val);
    return isNaN(num) || num < 1 || num > 100 ? 10 : Math.min(Math.max(num, 1), 100);
  }),
  search: z.string().optional().default('').transform((val) => val.trim()),
  role: z.enum(['user', 'admin', 'moderator', 'owner']).optional(),
  sortBy: z.enum(['createdAt', 'email', 'firstName', 'lastName', 'userrole']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Update user role
export const updateUserRoleSchema = z.object({
  newRole: z.enum(['user', 'admin', 'moderator', 'owner']),
});

// User suspension/reinstatement
export const suspendUserSchema = z.object({
  reason: z.string().optional().default('Administrative action'),
});

// Interview listing filters
export const interviewListQuerySchema = z.object({
  page: z.string().optional().default('1').transform((val) => {
    const num = Number(val);
    return isNaN(num) || num < 1 ? 1 : num;
  }),
  limit: z.string().optional().default('10').transform((val) => {
    const num = Number(val);
    return isNaN(num) || num < 1 || num > 100 ? 10 : Math.min(Math.max(num, 1), 100);
  }),
  status: z.enum(['DRAFT', 'READY', 'SCHEDULED', 'INPROGRESS', 'COMPLETED', 'CANCELLED', 'ABANDONED', 'EXPIRED', 'TIMED_OUT']).optional(),
  userId: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'status', 'title']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Admin overview query
export const adminOverviewQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).optional().default('30d'),
});