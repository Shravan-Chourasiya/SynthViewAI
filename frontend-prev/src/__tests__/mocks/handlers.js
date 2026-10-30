import { http, HttpResponse } from 'msw';

const API_BASE_URL = 'http://localhost:4000/api/v1';

// Mock user data
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
};

// Mock interview data
const mockInterview = {
  id: 'interview-123',
  title: 'Frontend Developer Interview',
  status: 'scheduled',
  createdAt: '2024-01-01T00:00:00Z',
  scheduledAt: '2024-01-02T00:00:00Z',
};

// Handlers array
export const handlers = [
  // Auth endpoints
  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    const body = await request.json();
    console.log('[MSW] Login attempt with:', body);
    
    // Simulate login success
    return HttpResponse.json({
      user: mockUser,
      token: 'mock-jwt-token',
      refreshToken: 'mock-refresh-token'
    }, { status: 200 });
  }),

  http.post(`${API_BASE_URL}/auth/register`, async ({ request }) => {
    const body = await request.json();
    console.log('[MSW] Register attempt with:', body);
    
    return HttpResponse.json({
      message: 'Registration successful',
      pendingEmail: body.email
    }, { status: 200 });
  }),

  http.get(`${API_BASE_URL}/auth/me`, ({ request }) => {
    const authHeader = request.headers.get('authorization');
    console.log('[MSW] Auth check with header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    return HttpResponse.json(mockUser, { status: 200 });
  }),

  http.post(`${API_BASE_URL}/auth/logout`, () => {
    return HttpResponse.json({ message: 'Logged out successfully' }, { status: 200 });
  }),

  // Interview endpoints
  http.get(`${API_BASE_URL}/interviews`, () => {
    return HttpResponse.json({
      data: [mockInterview],
      total: 1,
      page: 1,
      limit: 10
    }, { status: 200 });
  }),

  http.post(`${API_BASE_URL}/interviews`, async ({ request }) => {
    const body = await request.json();
    console.log('[MSW] Create interview with:', body);
    
    return HttpResponse.json({
      ...mockInterview,
      id: `interview-${Date.now()}`,
      ...body
    }, { status: 201 });
  }),

  http.get(`${API_BASE_URL}/interviews/:id`, ({ params }) => {
    return HttpResponse.json({
      ...mockInterview,
      id: params.id
    }, { status: 200 });
  }),

  http.put(`${API_BASE_URL}/interviews/:id`, async ({ request, params }) => {
    const body = await request.json();
    console.log('[MSW] Update interview:', params.id, 'with:', body);
    
    return HttpResponse.json({
      ...mockInterview,
      id: params.id,
      ...body
    }, { status: 200 });
  }),

  http.delete(`${API_BASE_URL}/interviews/:id`, ({ params }) => {
    return HttpResponse.json({ message: 'Interview deleted successfully' }, { status: 200 });
  }),

  // Health check endpoint
  http.get(`${API_BASE_URL}/health`, () => {
    return HttpResponse.json({ status: 'ok', timestamp: new Date().toISOString() }, { status: 200 });
  }),
];