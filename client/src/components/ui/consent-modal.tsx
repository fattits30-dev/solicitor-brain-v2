import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConsent: () => void;
  title: string;
  description: string;
  actions: string[];
  privacy: string[];
}

export function ConsentModal({
  isOpen,
  onClose,
  onConsent,
  title,
  description,
  actions,
  privacy
}: ConsentModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="consent-modal">
        <DialogHeader>
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="fas fa-shield-alt text-secondary"></i>
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground" data-testid="consent-title">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1" data-testid="consent-description">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-foreground mb-2" data-testid="consent-actions-title">
              What we'll do:
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1" data-testid="consent-actions-list">
              {actions.map((action, index) => (
                <li key={index}>• {action}</li>
              ))}
            </ul>
          </div>
          
          <div className="p-4 bg-secondary/5 rounded-lg border border-secondary/20">
            <h3 className="text-sm font-medium text-foreground mb-2" data-testid="consent-privacy-title">
              Your privacy:
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1" data-testid="consent-privacy-list">
              {privacy.map((item, index) => (
                <li key={index}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex-1"
            data-testid="consent-decline"
          >
            Not Now
          </Button>
          <Button 
            onClick={onConsent}
            className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
            data-testid="consent-accept"
          >
            I Give Consent
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground text-center" data-testid="privacy-link">
          You control your data. <a href="#" className="text-primary hover:underline">Learn more about our privacy practices</a>
        </p>
      </DialogContent>
    </Dialog>
  );
}
