export interface User {
  id: string;
  name: string;
  email: string;
  role: 'candidate' | 'recruiter' | 'admin';
  // Add other fields as needed
}