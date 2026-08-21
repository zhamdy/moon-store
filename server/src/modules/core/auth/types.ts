export interface UserRecord {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: string;
  last_login?: string | null;
}

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
}
