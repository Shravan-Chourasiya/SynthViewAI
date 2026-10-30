import { toast } from 'sonner';
import { ApiError } from './http';

/**
 * Show a success toast notification
 */
export function notifySuccess(message: string) {
  toast.success(message);
}

/**
 * Show an error toast notification
 */
export function notifyError(message: string) {
  toast.error(message);
}

/**
 * Show an API error toast notification
 * Unwraps the ApiError shape and extracts human-readable message
 */
export function notifyApiError(error: unknown) {
  if (error instanceof ApiError) {
    // Use the error message from the ApiError instance
    notifyError(error.message);
  } else if (error instanceof Error) {
    // For standard errors, use the message
    notifyError(error.message);
  } else if (typeof error === 'string') {
    // For string errors, use the string directly
    notifyError(error);
  } else {
    // For unexpected error shapes, show a generic message
    notifyError('An unexpected error occurred. Please try again.');
  }
}

/**
 * Show an info toast notification
 */
export function notifyInfo(message: string) {
  toast(message);
}

/**
 * Show a warning toast notification
 */
export function notifyWarning(message: string) {
  toast.warning(message);
}