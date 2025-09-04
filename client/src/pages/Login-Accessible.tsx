import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { AlertCircle, Brain, Lock, Mail, Scale, Shield, Sparkles } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // Accessibility refs
  const errorRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Detect user's motion preferences
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    // Focus first input on mount for keyboard users
    if (emailRef.current) {
      emailRef.current.focus();
    }
  }, []);

  // Enhanced error handling with trauma-informed messaging
  const getTraumaInformedErrorMessage = (originalError: string) => {
    if (originalError.toLowerCase().includes('invalid') || originalError.toLowerCase().includes('incorrect')) {
      return "We couldn't sign you in with those details. Let's try again - check your email and password match what you set up.";
    }
    if (originalError.toLowerCase().includes('network') || originalError.toLowerCase().includes('connection')) {
      return "We're having trouble connecting right now. Your information is safe. Please try again in a moment.";
    }
    if (originalError.toLowerCase().includes('timeout')) {
      return "The sign-in process took longer than expected. Your information is secure - let's try again.";
    }
    if (originalError.toLowerCase().includes('locked') || originalError.toLowerCase().includes('blocked')) {
      return "Your account is temporarily protected. For your security, please wait 15 minutes or contact support who can help you access your workspace safely.";
    }
    // Default supportive message
    return "Something didn't work as expected. You're safe, and you can try again. If this keeps happening, our support team can help.";
  };

  // Form validation with supportive messaging
  const validateForm = () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');

    if (!email.trim()) {
      setEmailError('Please add your email address to continue');
      isValid = false;
    } else if (!email.includes('@') || !email.includes('.')) {
      setEmailError("This doesn't look like an email address - please check it includes an @ symbol and domain (like .com)");
      isValid = false;
    }

    if (!password.trim()) {
      setPasswordError('Please enter your password');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      // Focus first field with error
      if (emailError && emailRef.current) {
        emailRef.current.focus();
      } else if (passwordError && passwordRef.current) {
        passwordRef.current.focus();
      }
      return;
    }

    setLoading(true);

    try {
      // Use API client for consistent request handling
      const data = await apiClient.post<{ token: string; user: any }>(
        '/api/auth/login',
        { email, password },
        { requiresAuth: false },
      );

      // Store token and user info via auth context
      login(data.token, data.user);

      // Announce success to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.textContent = 'Welcome back to your secure workspace';
      announcement.style.position = 'absolute';
      announcement.style.left = '-10000px';
      document.body.appendChild(announcement);
      
      setTimeout(() => {
        document.body.removeChild(announcement);
        setLocation('/');
      }, 1000);

    } catch (err) {
      const originalError = err instanceof Error ? err.message : 'Unknown error';
      const traumaInformedMessage = getTraumaInformedErrorMessage(originalError);
      setError(traumaInformedMessage);
      
      // Focus error alert for screen readers
      if (errorRef.current) {
        errorRef.current.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-blue-900 dark:to-purple-900 p-4">
      {/* Skip link for keyboard navigation */}
      <a 
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-foreground px-4 py-2 rounded-md z-50"
      >
        Skip to main content
      </a>

      {/* Background decoration - respects reduced motion preference */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className={`absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 ${!prefersReducedMotion.current ? 'animate-blob' : ''}`}></div>
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 ${!prefersReducedMotion.current ? 'animate-blob animation-delay-2000' : ''}`}></div>
        <div className={`absolute top-40 left-40 w-80 h-80 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 ${!prefersReducedMotion.current ? 'animate-blob animation-delay-4000' : ''}`}></div>
      </div>

      <Card className="w-full max-w-md relative backdrop-blur-sm bg-white/95 dark:bg-slate-900/95 shadow-2xl border-0" id="main-content">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              {!prefersReducedMotion.current && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur-lg opacity-75 animate-pulse"></div>
              )}
              <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-full">
                <Brain className="h-12 w-12 text-white" aria-hidden="true" />
              </div>
            </div>
          </div>
          <CardTitle className="text-3xl text-center font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Solicitor Brain
          </CardTitle>
          <CardDescription className="text-center text-base">
            Your Secure Legal Workspace
          </CardDescription>
          <div className="flex items-center justify-center gap-6 pt-2" role="list">
            <div className="flex items-center gap-1 text-xs text-muted-foreground" role="listitem">
              <Shield className="h-3 w-3" aria-hidden="true" />
              <span>Secure</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground" role="listitem">
              <Scale className="h-3 w-3" aria-hidden="true" />
              <span>Compliant</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground" role="listitem">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              <span>AI-Enhanced</span>
            </div>
          </div>
        </CardHeader>
        
        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4">
            {error && (
              <Alert 
                variant="destructive"
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
              >
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4" aria-hidden="true" />
                Your email address
              </Label>
              <div className="relative">
                <Input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(''); // Clear error on change
                  }}
                  required
                  disabled={loading}
                  autoComplete="email"
                  className="pl-10"
                  aria-describedby={emailError ? "email-error" : undefined}
                  aria-invalid={!!emailError}
                />
                <Mail className="absolute h-4 w-4 left-3 top-3 text-muted-foreground pointer-events-none" aria-hidden="true" />
              </div>
              {emailError && (
                <div 
                  id="email-error"
                  role="alert"
                  aria-live="polite"
                  className="text-sm text-destructive"
                >
                  {emailError}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium">
                <Lock className="h-4 w-4" aria-hidden="true" />
                Your secure password
              </Label>
              <div className="relative">
                <Input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(''); // Clear error on change
                  }}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  className="pl-10"
                  aria-describedby={passwordError ? "password-error" : undefined}
                  aria-invalid={!!passwordError}
                />
                <Lock className="absolute h-4 w-4 left-3 top-3 text-muted-foreground pointer-events-none" aria-hidden="true" />
              </div>
              {passwordError && (
                <div 
                  id="password-error"
                  role="alert"
                  aria-live="polite"
                  className="text-sm text-destructive"
                >
                  {passwordError}
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-2">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              aria-describedby="submit-help"
            >
              <span className="sr-only">
                {loading ? 'Signing you in securely, please wait' : 'Sign in to access your secure workspace'}
              </span>
              <span aria-hidden="true">
                {loading ? 'Signing in...' : 'Access my workspace'}
              </span>
            </Button>
            
            {loading && (
              <div 
                role="status" 
                aria-live="polite"
                className="sr-only"
              >
                Signing you in securely, please wait
              </div>
            )}
            
            <p id="submit-help" className="text-xs text-center text-muted-foreground">
              Protected by audit logging and encryption
            </p>
          </CardFooter>
        </form>
      </Card>

      {/* Reduced motion CSS for users who prefer less animation */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
        `
      }} />
    </div>
  );
}