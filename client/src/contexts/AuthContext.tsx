import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface MfaStatus {
  enabled: boolean;
  hasTotp: boolean;
  hasSms: boolean;
  hasEmail: boolean;
  inGracePeriod: boolean;
  gracePeriodEnd?: string;
  deviceTrusted: boolean;
  unusedBackupCodes: number;
}

interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
  mfaRequired?: boolean;
  mfaStatus?: MfaStatus;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  mfaRequired: boolean;
  mfaStatus: MfaStatus | null;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  completeMfaVerification: (verificationData: any) => void;
  checkMfaStatus: () => Promise<MfaStatus | null>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);

  const clearAuthState = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setMfaRequired(false);
    setMfaStatus(null);
  };

  const checkMfaStatus = async (): Promise<MfaStatus | null> => {
    if (!token) return null;

    try {
      const response = await fetch('/api/mfa/status', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const status = await response.json();
        setMfaStatus(status);
        return status;
      }
    } catch (error) {
      console.error('Failed to check MFA status:', error);
    }

    return null;
  };

  // Load auth state from localStorage and validate with backend
  useEffect(() => {
    const loadAuthState = async () => {
      setLoading(true);

      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        try {
          // Validate token with backend
          const response = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${storedToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            setToken(storedToken);
            setUser(data.user);
            console.log('Auth state validated successfully:', data.user.email);

            // Check MFA status after successful authentication
            await checkMfaStatus();
          } else {
            // Token is invalid, clear it
            console.log('Stored token is invalid, clearing auth state');
            clearAuthState();
          }
        } catch (error) {
          console.error('Failed to validate auth state:', error);
          clearAuthState();
        }
      }

      setLoading(false);
    };

    loadAuthState();
  }, [checkMfaStatus]);

  const login = async (email: string, password: string): Promise<LoginResponse> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: LoginResponse = await response.json();

      if (data.success) {
        // Store basic auth info
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));

        // Check if MFA is required
        if (data.mfaRequired && data.mfaStatus) {
          setMfaRequired(true);
          setMfaStatus(data.mfaStatus);
        } else {
          setMfaRequired(false);
          setMfaStatus(null);
          // Check MFA status for authenticated user
          await checkMfaStatus();
        }
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Call backend logout endpoint if we have a token
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).catch(() => {
          // Ignore logout errors - we'll clear local state anyway
          console.warn('Backend logout failed, clearing local state');
        });
      }
    } finally {
      // Always clear local state
      clearAuthState();
    }
  };

  const completeMfaVerification = (verificationData: any) => {
    setMfaRequired(false);
    // Update MFA status based on verification
    if (mfaStatus) {
      setMfaStatus({
        ...mfaStatus,
        deviceTrusted: verificationData.deviceTrusted || false,
      });
    }
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    mfaRequired,
    mfaStatus,
    login,
    logout,
    completeMfaVerification,
    checkMfaStatus,
    isAuthenticated: !!token && !!user && !mfaRequired,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
