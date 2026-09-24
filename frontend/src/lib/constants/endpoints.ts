// Every REST endpoint path used by the frontend.
// Paths are relative to HTTP_BASE_URL (i.e. they do NOT include the API version prefix).
// Nothing in the codebase may hardcode a path string outside this file.

export const ENDPOINTS = {
  auth: {
    register: "/auth/register",
    verifyOtp: "/auth/verify-otp",
    login: "/auth/login",
    refresh: "/auth/refresh",
    logout: "/usr/logout",
    me: "/usr/me",
    profile: "/usr/profile",
    sessions: "/usr/sessions",
    session: (id: string) => `/usr/session/${id}`,
    recoverAccount: "/auth/recover-account",
    recoverAccountVerify: "/auth/recover-account/verify",
    forgotPassword: "/auth/forgot-password",
    forgotPasswordVerify: "/auth/forgot-password/verify",
    updatePassword: "/usr/update-password",
    updateEmail: "/usr/update-email",
    updateEmailVerify: "/usr/update-email/verify",
    deleteAccount: "/usr/account",
    deleteSessions: "/usr/sessions",
  },
  interviews: {
    list: "/interviews",
    resumable: "/interviews/resumable",
    create: "/interviews",
    byId: (id: string) => `/interviews/${id}`,
    history: (id: string) => `/interviews/${id}/history`,
    metrics: (id: string) => `/interviews/${id}/metrics`,
    report: (id: string) => `/interviews/${id}/report`,
    start: (id: string) => `/interviews/${id}/start`,
    pause: (id: string) => `/interviews/${id}/pause`,
    resume: (id: string) => `/interviews/${id}/resume`,
    cancel: (id: string) => `/interviews/${id}/cancel`,
    end: (id: string) => `/interviews/${id}/end`,
    answer: (interviewId: string, questionId: string) =>
      `/interviews/${interviewId}/questions/${questionId}/answer`,
    share: (id: string) => `/interviews/${id}/share`,
    shareRevoke: (id: string) => `/interviews/${id}/share/revoke`,
    sharedReport: (token: string) => `/interviews/shared/${encodeURIComponent(token)}`,
  },
  notifications: {
    list: "/notifications",
    readAll: "/notifications/read-all",
    read: (id: string) => `/notifications/${id}/read`,
  },
  contact: {
    // Public: the contact form is available to signed-out visitors.
    submit: "/contact",
  },
} as const;
