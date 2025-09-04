import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import * as MfaApi from '@/lib/mfa-api';
import {
  AlertTriangle,
  CheckCircle,
  Key,
  Mail,
  MessageSquare,
  RefreshCw,
  Shield,
  Smartphone,
} from 'lucide-react';
import { useState } from 'react';

interface MfaVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerificationSuccess: () => void;
  onVerificationFailure: (error: string) => void;
}

type VerificationMethod = 'totp' | 'sms' | 'email' | 'backup';

export function MfaVerificationModal({
  isOpen,
  onClose,
  onVerificationSuccess,
  onVerificationFailure,
}: MfaVerificationModalProps) {
  const [activeMethod, setActiveMethod] = useState<VerificationMethod>('totp');
  const [totpCode, setTotpCode] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState('');
  const { toast } = useToast();

  const resetState = () => {
    setTotpCode('');
    setSmsCode('');
    setEmailCode('');
    setBackupCode('');
    setPhoneNumber('');
    setLoading(false);
    setSmsSent(false);
    setEmailSent(false);
    setError('');
  };

  const handleVerification = async (method: VerificationMethod, code: string) => {
    try {
      setLoading(true);
      setError('');

      let response;
      switch (method) {
        case 'totp':
          response = await MfaApi.verifyTotp(code);
          break;
        case 'sms':
          response = await MfaApi.verifySms(code);
          break;
        case 'email':
          response = await MfaApi.verifyEmail(code);
          break;
        case 'backup':
          response = await MfaApi.verifyBackupCode(code);
          break;
        default:
          throw new Error('Invalid verification method');
      }

      if (response.success) {
        // If user wants to trust this device
        if (trustDevice) {
          await addTrustedDevice();
        }

        // Complete MFA verification
        await MfaApi.completeMfaVerification();

        toast({
          title: 'Success',
          description: 'MFA verification completed',
        });

        resetState();
        onVerificationSuccess();
      } else {
        const error = response.error || 'Verification failed';
        throw new Error(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setError(errorMessage);
      onVerificationFailure(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const sendSmsCode = async () => {
    if (!phoneNumber) {
      setError('Please enter a valid UK phone number');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await MfaApi.sendSmsCode(phoneNumber);

      if (response.success) {
        setSmsSent(true);
        toast({
          title: 'SMS Sent',
          description: 'Verification code sent to your phone',
        });
      } else {
        throw new Error(response.error || 'Failed to send SMS');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send SMS';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const sendEmailCode = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await MfaApi.sendEmailCode();

      if (response.success) {
        setEmailSent(true);
        toast({
          title: 'Email Sent',
          description: 'Verification code sent to your email',
        });
      } else {
        throw new Error(response.error || 'Failed to send email');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send email';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const addTrustedDevice = async () => {
    try {
      const response = await MfaApi.addTrustedDevice({
        deviceName: deviceName || 'Web Browser',
        expirationDays: 30,
      });
      if (!response.success) {
        console.error('Failed to add trusted device:', response.error);
      }
    } catch (error) {
      console.error('Failed to add trusted device:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Multi-Factor Authentication Required
          </DialogTitle>
          <DialogDescription>
            Please verify your identity to continue accessing the system.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs
            value={activeMethod}
            onValueChange={(value) => setActiveMethod(value as VerificationMethod)}
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="totp">
                <Smartphone className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="sms">
                <MessageSquare className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="email">
                <Mail className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="backup">
                <Key className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="totp" className="space-y-4">
              <div className="text-center mb-4">
                <Smartphone className="h-12 w-12 mx-auto mb-2 text-primary" />
                <h3 className="font-medium">Authenticator App</h3>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totp-code">Verification Code</Label>
                <Input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-lg tracking-widest"
                />
              </div>

              <Button
                onClick={() => handleVerification('totp', totpCode)}
                disabled={loading || totpCode.length !== 6}
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
            </TabsContent>

            <TabsContent value="sms" className="space-y-4">
              <div className="text-center mb-4">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 text-primary" />
                <h3 className="font-medium">SMS Verification</h3>
                <p className="text-sm text-muted-foreground">
                  Receive a verification code via text message
                </p>
              </div>

              {!smsSent ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone-number">Phone Number (UK)</Label>
                    <Input
                      id="phone-number"
                      type="tel"
                      placeholder="+44 7xxx xxx xxx"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={sendSmsCode}
                    disabled={loading || !phoneNumber}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Send SMS Code
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sms-code">SMS Verification Code</Label>
                    <Input
                      id="sms-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      value={smsCode}
                      onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ''))}
                      className="text-center text-lg tracking-widest"
                    />
                  </div>

                  <Button
                    onClick={() => handleVerification('sms', smsCode)}
                    disabled={loading || smsCode.length !== 6}
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
                        Verify SMS Code
                      </>
                    )}
                  </Button>

                  <Button variant="outline" onClick={() => setSmsSent(false)} className="w-full">
                    Use Different Number
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="email" className="space-y-4">
              <div className="text-center mb-4">
                <Mail className="h-12 w-12 mx-auto mb-2 text-primary" />
                <h3 className="font-medium">Email Verification</h3>
                <p className="text-sm text-muted-foreground">
                  Receive a verification code via email
                </p>
              </div>

              {!emailSent ? (
                <Button onClick={sendEmailCode} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Email Code
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-4">
                  <Alert>
                    <Mail className="h-4 w-4" />
                    <AlertDescription>
                      Verification code sent to your registered email address. Check your inbox and
                      spam folder.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="email-code">Email Verification Code</Label>
                    <Input
                      id="email-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                      className="text-center text-lg tracking-widest"
                    />
                  </div>

                  <Button
                    onClick={() => handleVerification('email', emailCode)}
                    disabled={loading || emailCode.length !== 6}
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
                        Verify Email Code
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={sendEmailCode}
                    disabled={loading}
                    className="w-full"
                  >
                    Resend Email Code
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="backup" className="space-y-4">
              <div className="text-center mb-4">
                <Key className="h-12 w-12 mx-auto mb-2 text-primary" />
                <h3 className="font-medium">Backup Code</h3>
                <p className="text-sm text-muted-foreground">Use one of your saved backup codes</p>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Backup codes are single-use only. This code will be invalidated after use.
                </AlertDescription>
              </Alert>

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
              </div>

              <Button
                onClick={() => handleVerification('backup', backupCode)}
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
                    Use Backup Code
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="trust-device"
                checked={trustDevice}
                onCheckedChange={(checked) => setTrustDevice(checked === true)}
              />
              <Label htmlFor="trust-device" className="text-sm cursor-pointer">
                Trust this device for 30 days
              </Label>
            </div>

            {trustDevice && (
              <div className="space-y-2">
                <Label htmlFor="device-name">Device Name (optional)</Label>
                <Input
                  id="device-name"
                  type="text"
                  placeholder="My Laptop"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  maxLength={100}
                />
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Having trouble? Contact your administrator or use a different verification method.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
