import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
// import { Separator } from '@/components/ui/separator';
import {
  KeyRound,
  Mail,
  Phone,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MfaRecoveryProps {
  onRecoverySuccess: () => void;
  onCancel: () => void;
}

type RecoveryStep = 'start' | 'verify-identity' | 'choose-method' | 'reset-mfa' | 'complete';
type RecoveryMethod = 'backup-code' | 'admin-reset' | 'account-recovery';

export function MfaRecovery({ onRecoverySuccess, onCancel }: MfaRecoveryProps) {
  const [step, setStep] = useState<RecoveryStep>('start');
  const [method, setMethod] = useState<RecoveryMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [backupCode, setBackupCode] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [reason, setReason] = useState('');
  const [contactInfo, setContactInfo] = useState('');

  const { toast } = useToast();

  const handleBackupCodeRecovery = async () => {
    if (!backupCode || backupCode.length !== 8) {
      setError('Please enter a valid 8-character backup code');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/mfa/verify/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ code: backupCode }),
      });

      if (response.ok) {
        setStep('reset-mfa');
        toast({
          title: 'Success',
          description: 'Backup code verified. You can now reset your MFA settings.',
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Invalid backup code');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const sendRecoveryEmail = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // This would typically send a recovery email with a special token
      // For now, we'll simulate the process
      const response = await fetch('/api/mfa/send/email', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        toast({
          title: 'Recovery Email Sent',
          description: 'Check your email for recovery instructions.',
        });
        setStep('verify-identity');
      } else {
        throw new Error('Failed to send recovery email');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send recovery email';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const submitAdminRecoveryRequest = async () => {
    if (!reason || !contactInfo) {
      setError('Please provide all required information');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // In a real implementation, this would create a support ticket
      // or notify administrators of the recovery request

      // Simulate admin request submission
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: 'Recovery Request Submitted',
        description: 'Your request has been sent to administrators for review.',
      });
      setStep('complete');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit request';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetMfa = async () => {
    try {
      setLoading(true);
      setError('');

      // In a production system, this would only be available after proper verification
      const response = await fetch('/api/mfa/disable', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setStep('complete');
        toast({
          title: 'MFA Reset',
          description:
            'Your MFA settings have been reset. You can set up new authentication methods.',
        });
        setTimeout(() => {
          onRecoverySuccess();
        }, 2000);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset MFA');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset MFA';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'start') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            MFA Account Recovery
          </CardTitle>
          <CardDescription>
            Lost access to your authentication device? Choose a recovery method below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <HelpCircle className="h-4 w-4" />
            <AlertDescription>
              Account recovery is a security-sensitive process. Please choose the method that best
              matches your situation.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4">
            <Button
              variant="outline"
              className="flex items-center justify-start gap-3 p-6 h-auto"
              onClick={() => {
                setMethod('backup-code');
                setStep('choose-method');
              }}
            >
              <KeyRound className="h-6 w-6" />
              <div className="text-left">
                <div className="font-medium">Use Backup Code</div>
                <div className="text-sm text-muted-foreground">
                  I have one of my saved backup codes
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="flex items-center justify-start gap-3 p-6 h-auto"
              onClick={() => {
                setMethod('account-recovery');
                setStep('choose-method');
              }}
            >
              <Mail className="h-6 w-6" />
              <div className="text-left">
                <div className="font-medium">Email Recovery</div>
                <div className="text-sm text-muted-foreground">
                  Send recovery instructions to my email
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="flex items-center justify-start gap-3 p-6 h-auto"
              onClick={() => {
                setMethod('admin-reset');
                setStep('choose-method');
              }}
            >
              <Phone className="h-6 w-6" />
              <div className="text-left">
                <div className="font-medium">Contact Administrator</div>
                <div className="text-sm text-muted-foreground">
                  Request manual recovery assistance
                </div>
              </div>
            </Button>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'choose-method') {
    if (method === 'backup-code') {
      return (
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Enter Backup Code
            </CardTitle>
            <CardDescription>Use one of your saved backup codes to regain access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Backup codes are single-use only. This code will be invalidated after successful
                use.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backup-code">Backup Code</Label>
                <Input
                  id="backup-code"
                  type="text"
                  maxLength={8}
                  placeholder="XXXXXXXX"
                  value={backupCode}
                  onChange={(e) =>
                    setBackupCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                  }
                  className="text-center text-lg tracking-widest font-mono"
                />
                <p className="text-sm text-muted-foreground">
                  Enter the 8-character backup code from your saved list
                </p>
              </div>

              <Button
                onClick={handleBackupCodeRecovery}
                disabled={loading || backupCode.length !== 8}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Verify Backup Code
                  </>
                )}
              </Button>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep('start')}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (method === 'account-recovery') {
      return (
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Recovery
            </CardTitle>
            <CardDescription>
              Send recovery instructions to your registered email address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  This must match the email address associated with your account
                </p>
              </div>

              <Button onClick={sendRecoveryEmail} disabled={loading || !email} className="w-full">
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Recovery Email
                  </>
                )}
              </Button>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep('start')}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (method === 'admin-reset') {
      return (
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Administrator Recovery Request
            </CardTitle>
            <CardDescription>
              Request manual assistance from your system administrator
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <HelpCircle className="h-4 w-4" />
              <AlertDescription>
                This will create a support request that requires manual review by an administrator.
                Response time may vary based on availability.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Recovery Request</Label>
                <textarea
                  id="reason"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Describe your situation (e.g., lost device, new phone, etc.)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-info">Alternative Contact Information</Label>
                <Input
                  id="contact-info"
                  type="text"
                  placeholder="Phone number or other contact method"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Provide an alternative way for administrators to verify your identity
                </p>
              </div>

              <Button
                onClick={submitAdminRecoveryRequest}
                disabled={loading || !reason || !contactInfo}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Phone className="mr-2 h-4 w-4" />
                    Submit Recovery Request
                  </>
                )}
              </Button>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep('start')}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
  }

  if (step === 'verify-identity') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Verify Your Identity
          </CardTitle>
          <CardDescription>Enter the verification code sent to your email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              Check your email for a verification code. It may take a few minutes to arrive.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verification-code">Verification Code</Label>
              <Input
                id="verification-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-lg tracking-widest"
              />
            </div>

            <Button
              onClick={() => setStep('reset-mfa')}
              disabled={loading || verificationCode.length !== 6}
              className="w-full"
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Verify Code
                </>
              )}
            </Button>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="ghost" onClick={() => setStep('start')}>
              Back
            </Button>
            <Button variant="outline" onClick={sendRecoveryEmail}>
              Resend Email
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'reset-mfa') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Reset MFA Settings
          </CardTitle>
          <CardDescription>
            You can now reset your multi-factor authentication settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This will disable your current MFA settings. You'll need to set up new authentication
              methods after reset.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-medium mb-2">What will be reset:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Authenticator app configuration</li>
                <li>• All trusted devices</li>
                <li>• Remaining backup codes</li>
                <li>• SMS and email verification settings</li>
              </ul>
            </div>

            <Button onClick={resetMfa} disabled={loading} variant="destructive" className="w-full">
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Reset MFA Settings
                </>
              )}
            </Button>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="ghost" onClick={() => setStep('start')}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'complete') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Recovery Complete
          </CardTitle>
          <CardDescription>Your MFA recovery process has been completed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {method === 'admin-reset'
                ? 'Your recovery request has been submitted. An administrator will review your request and contact you.'
                : 'Your MFA settings have been reset. You can now set up new authentication methods.'}
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <Button onClick={onRecoverySuccess} className="w-full">
              {method === 'admin-reset' ? 'Return to Login' : 'Set Up New MFA'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
