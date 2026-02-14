// Domain entity for Auth
export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface AuthSession {
  user: User;
  access_token: string;
  refresh_token: string;
}

export interface SignUpData {
  email: string;
  password: string;
}

export interface SignInData {
  email: string;
  password: string;
}
