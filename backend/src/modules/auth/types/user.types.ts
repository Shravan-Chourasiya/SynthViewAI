export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  deviceId: string;
  sessionId: string;
  userId: string;
}
