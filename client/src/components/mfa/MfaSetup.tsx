import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  Smartphone, 
  Mail, 
  Download, 
  Copy, 
  CheckCircle, 
  AlertTriangle,
  QrCode,
  Key,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MfaStatus {
  enabled: boolean;
  hasTotp: boolean;
  hasSms: boolean;
  hasEmail: boolean;
  inGracePeriod: boolean;
  gracePeriodEnd?: string;
  trustedDevicesCount: number;
  unusedBackupCodes: number;
  deviceTrusted: boolean;
}

interface TotpSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export function MfaSetup() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupStep, setSetupStep] = useState<'start' | 'totp' | 'verify' | 'complete'>('start');
  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [email, setEmail] = useState('');
  const [copiedCodes, setCopiedCodes] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMfaStatus();
  }, []);

  const fetchMfaStatus = async () => {
    try {
      const response = await fetch('/api/mfa/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        
        if (data.enabled) {
          setSetupStep('complete');
        }
      } else {
        throw new Error('Failed to fetch MFA status');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load MFA status",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupTotp = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter your email address",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/mfa/setup/totp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const data = await response.json();
        setTotpSetup(data);
        setSetupStep('totp');
        toast({
          title: "Success",
          description: "TOTP setup initiated. Scan the QR code with your authenticator app.",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Setup failed');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to setup TOTP",
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyTotpSetup = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid 6-digit code",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/mfa/setup/totp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ token: verificationCode }),
      });

      if (response.ok) {
        setSetupStep('complete');
        await fetchMfaStatus();
        toast({
          title: "Success",
          description: "MFA has been successfully enabled!",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Verification failed');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Verification failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    if (totpSetup?.backupCodes) {
      const codesText = totpSetup.backupCodes.join('\n');
      navigator.clipboard.writeText(codesText);
      setCopiedCodes(true);
      toast({
        title: "Copied",
        description: "Backup codes copied to clipboard",
      });
    }
  };

  const downloadBackupCodes = () => {
    if (totpSetup?.backupCodes) {
      const codesText = totpSetup.backupCodes.join('\n');
      const blob = new Blob([codesText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'solicitor-brain-backup-codes.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Downloaded",
        description: "Backup codes saved to your device",
      });
    }
  };

  const sendSmsCode = async () => {
    if (!phoneNumber) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid UK phone number",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/mfa/send/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ phoneNumber }),
      });

      if (response.ok) {
        toast({
          title: "SMS Sent",
          description: "Verification code sent to your phone",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send SMS');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send SMS",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendEmailCode = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mfa/send/email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        toast({
          title: "Email Sent",
          description: "Verification code sent to your email",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send email",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateNewBackupCodes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mfa/backup-codes/regenerate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTotpSetup(prev => prev ? { ...prev, backupCodes: data.backupCodes } : null);
        await fetchMfaStatus();
        toast({
          title: "Success",
          description: "New backup codes generated",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate codes');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate backup codes",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !status) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (setupStep === 'start') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Multi-Factor Authentication Setup
          </CardTitle>
          <CardDescription>
            Secure your account with an additional layer of protection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status?.inGracePeriod && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You're in a grace period until {status.gracePeriodEnd ? new Date(status.gracePeriodEnd).toLocaleDateString() : 'N/A'}. 
                MFA will be required after this date.
              </AlertDescription>
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
            </div>

            <Button 
              onClick={setupTotp} 
              disabled={loading || !email}
              className="w-full"
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <QrCode className="mr-2 h-4 w-4" />
                  Setup Authenticator App
                </>
              )}
            </Button>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-medium mb-2">What you'll need:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• An authenticator app (Google Authenticator, Authy, etc.)</li>
              <li>• Access to your email for backup verification</li>
              <li>• A secure place to store backup codes</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (setupStep === 'totp' && totpSetup) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Scan QR Code
          </CardTitle>
          <CardDescription>
            Use your authenticator app to scan this QR code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-white rounded-lg">
              <img src={totpSetup.qrCode} alt="QR Code" className="w-48 h-48" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Manual Entry Key (if QR code doesn't work)</Label>
            <div className="flex gap-2">
              <Input value={totpSetup.secret} readOnly className="font-mono text-sm" />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  navigator.clipboard.writeText(totpSetup.secret);
                  toast({ title: "Copied", description: "Secret key copied to clipboard" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verification-code">Enter 6-digit code from your app</Label>
              <Input
                id="verification-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <Button 
              onClick={verifyTotpSetup} 
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
                  Verify & Enable MFA
                </>
              )}
            </Button>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Backup Codes</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyBackupCodes}>
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={downloadBackupCodes}>
                  <Download className="mr-1 h-3 w-3" />
                  Download
                </Button>
              </div>
            </div>
            
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                Save these backup codes in a secure location. You can use them to access your account if you lose your authenticator device.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
              {totpSetup.backupCodes.map((code, index) => (
                <div key={index} className="p-2 bg-background rounded text-center">
                  {code}
                </div>
              ))}
            </div>

            {copiedCodes && (
              <p className="text-sm text-green-600 flex items-center">
                <CheckCircle className="mr-1 h-3 w-3" />
                Backup codes copied to clipboard
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (setupStep === 'complete' && status) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Multi-Factor Authentication
            <Badge variant="secondary" className="ml-2">
              {status.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </CardTitle>
          <CardDescription>
            Manage your two-factor authentication settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="status" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="verify">Verify</TabsTrigger>
              <TabsTrigger value="backup">Backup</TabsTrigger>
            </TabsList>
            
            <TabsContent value="status" className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5" />
                    <div>
                      <p className="font-medium">Authenticator App</p>
                      <p className="text-sm text-muted-foreground">TOTP verification</p>
                    </div>
                  </div>
                  <Badge variant={status.hasTotp ? "default" : "secondary"}>
                    {status.hasTotp ? 'Active' : 'Not Set'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5" />
                    <div>
                      <p className="font-medium">Email Verification</p>
                      <p className="text-sm text-muted-foreground">Backup method</p>
                    </div>
                  </div>
                  <Badge variant={status.hasEmail ? "default" : "secondary"}>
                    {status.hasEmail ? 'Available' : 'Not Set'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Key className="h-5 w-5" />
                    <div>
                      <p className="font-medium">Backup Codes</p>
                      <p className="text-sm text-muted-foreground">{status.unusedBackupCodes} unused codes</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={generateNewBackupCodes}>
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Generate New
                  </Button>
                </div>
              </div>

              {status.deviceTrusted && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    This device is trusted. You won't need to provide MFA codes for {Math.ceil((new Date().getTime() - Date.now()) / (1000 * 60 * 60 * 24))} more days.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="verify" className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totp-verify">Authenticator Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="totp-verify"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    />
                    <Button variant="outline">Verify</Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="phone">SMS Verification (UK numbers only)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+44 7xxx xxx xxx"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                    <Button variant="outline" onClick={sendSmsCode}>
                      Send
                    </Button>
                  </div>
                  {phoneNumber && (
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="SMS code"
                        value={smsCode}
                        onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ''))}
                      />
                      <Button variant="outline">Verify</Button>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Email Verification</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={sendEmailCode} className="flex-1">
                      <Mail className="mr-2 h-4 w-4" />
                      Send Email Code
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Email code"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                    />
                    <Button variant="outline">Verify</Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="backup" className="space-y-4">
              <Alert>
                <Key className="h-4 w-4" />
                <AlertDescription>
                  Backup codes are single-use codes that can be used if you lose access to your authenticator device.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="backup-code">Enter Backup Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="backup-code"
                    type="text"
                    placeholder="XXXXXXXX"
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  />
                  <Button variant="outline">Use Code</Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={generateNewBackupCodes} className="flex-1">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Generate New Codes
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                You have {status.unusedBackupCodes} unused backup codes remaining.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }

  return null;
}