import { Link } from "wouter";
import { useState } from "react";
import { ConsentModal } from "@/components/ui/consent-modal";

export default function QuickActions() {
  const [showConsentModal, setShowConsentModal] = useState(false);

  const actions = [
    {
      label: "New Case",
      subtitle: "Create case file",
      icon: "fas fa-plus",
      href: "/cases",
      iconBg: "bg-primary/5 hover:bg-primary/10",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
      testId: "action-new-case"
    },
    {
      label: "Upload Files",
      subtitle: "OCR & index",
      icon: "fas fa-upload",
      onClick: () => setShowConsentModal(true),
      iconBg: "bg-secondary/5 hover:bg-secondary/10",
      iconColor: "text-secondary",
      borderColor: "border-secondary/20",
      testId: "action-upload-files"
    },
    {
      label: "AI Search",
      subtitle: "Find information",
      icon: "fas fa-search",
      href: "/search",
      iconBg: "bg-accent/5 hover:bg-accent/10",
      iconColor: "text-accent",
      borderColor: "border-accent/20",
      testId: "action-ai-search"
    },
    {
      label: "Draft Studio",
      subtitle: "AI assistance",
      icon: "fas fa-edit",
      href: "/drafts",
      iconBg: "bg-primary/5 hover:bg-primary/10",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
      testId: "action-draft-studio"
    },
  ];

  const handleConsentGranted = () => {
    setShowConsentModal(false);
    // In production, this would redirect to upload page with consent granted
    window.location.href = "/upload";
  };

  return (
    <>
      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-6" data-testid="quick-actions-title">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {actions.map((action) => {
            if (action.href) {
              return (
                <Link key={action.label} href={action.href}>
                  <a className={`flex flex-col items-center p-6 ${action.iconBg} rounded-lg border ${action.borderColor} transition-colors cursor-pointer`} data-testid={action.testId}>
                    <div className={`w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3`}>
                      <i className={`${action.icon} ${action.iconColor} text-xl`}></i>
                    </div>
                    <span className="text-sm font-medium text-foreground" data-testid={`${action.testId}-label`}>
                      {action.label}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1" data-testid={`${action.testId}-subtitle`}>
                      {action.subtitle}
                    </span>
                  </a>
                </Link>
              );
            } else {
              return (
                <button key={action.label} onClick={action.onClick} className={`flex flex-col items-center p-6 ${action.iconBg} rounded-lg border ${action.borderColor} transition-colors cursor-pointer`} data-testid={action.testId}>
                  <div className={`w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3`}>
                    <i className={`${action.icon} ${action.iconColor} text-xl`}></i>
                  </div>
                  <span className="text-sm font-medium text-foreground" data-testid={`${action.testId}-label`}>
                    {action.label}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1" data-testid={`${action.testId}-subtitle`}>
                    {action.subtitle}
                  </span>
                </button>
              );
            }
          })}
        </div>
      </div>

      <ConsentModal
        isOpen={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        onConsent={handleConsentGranted}
        title="Your Consent Required"
        description="We need your permission to process documents with AI for OCR and search indexing."
        actions={[
          "Extract text using OCR technology",
          "Create searchable index (with PII redaction)",
          "Enable AI-powered case insights"
        ]}
        privacy={[
          "Personal information is automatically redacted",
          "You can revoke this consent anytime",
          "Processing happens on secure local servers"
        ]}
      />
    </>
  );
}
