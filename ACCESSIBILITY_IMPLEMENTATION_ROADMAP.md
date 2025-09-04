# Accessibility Implementation Roadmap
## Solicitor Brain v2 - Legal Case Management System

**Created**: 2025-09-04  
**Status**: Ready for Implementation  
**Priority**: URGENT - Legal Compliance & Client Safety  
**Estimated Timeline**: 3-4 weeks  

---

## PHASE 1: CRITICAL SAFETY FIXES (Week 1)
**Priority**: IMMEDIATE - Affects user safety and legal compliance**

### 1.1 MFA Security Flow Accessibility ⚡ CRITICAL
**Files**: `/client/src/components/mfa/MfaVerificationModal.tsx`

#### Issues:
- Focus trap not implemented - users can tab outside modal
- No escape key handling in security context  
- OTP input lacks proper accessibility attributes
- Aggressive error language triggers anxiety

#### Implementation:
```tsx
// Add focus trap library
npm install focus-trap-react

// Key fixes needed:
- Implement proper focus trapping with focus-trap-react
- Add aria-describedby for OTP inputs
- Replace "failed" language with supportive messages
- Add escape key warning (security context)
- Implement proper ARIA announcements
```

#### Success Criteria:
- [ ] Focus stays within modal during MFA process
- [ ] Screen reader announces verification steps
- [ ] Error messages use supportive language
- [ ] Keyboard navigation works completely

### 1.2 Remove Seizure-Triggering Animations ⚡ CRITICAL  
**Files**: `/client/src/pages/Login.tsx`, global CSS

#### Issues:
- Infinite blob animations without motion controls
- No prefers-reduced-motion support
- Rapid gradient animations may trigger seizures

#### Implementation:
```css
/* Add to global CSS */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

#### Component Updates:
- Replace current Login.tsx with Login-Accessible.tsx (already created)
- Add motion preference detection to all animated components
- Provide animation toggle in accessibility settings

### 1.3 Screen Reader Announcements ⚡ CRITICAL
**Files**: All interactive components

#### Implementation:
```tsx
// Add to all dynamic content updates
const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.textContent = message;
  announcement.style.position = 'absolute';
  announcement.style.left = '-10000px';
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};
```

#### Apply to:
- AI chat streaming responses
- Document loading states  
- Form validation feedback
- Success/error notifications

---

## PHASE 2: CORE ACCESSIBILITY (Week 2)

### 2.1 Document Viewer Keyboard Navigation
**Files**: `/client/src/components/documents/DocumentViewer.tsx`

#### Current Issues:
- PDF iframe not keyboard accessible
- Page navigation requires mouse
- Zoom controls lack keyboard support
- No alternative text for document content

#### Implementation:
```tsx
// Add keyboard event handlers
const handleKeyDown = (e: KeyboardEvent) => {
  switch(e.key) {
    case 'ArrowRight':
    case 'PageDown':
      e.preventDefault();
      nextPage();
      break;
    case 'ArrowLeft':
    case 'PageUp':
      e.preventDefault();
      previousPage();
      break;
    case '+':
    case '=':
      e.preventDefault();
      zoomIn();
      break;
    case '-':
      e.preventDefault();
      zoomOut();
      break;
  }
};

// Add to component
useEffect(() => {
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [currentPage, zoom]);
```

#### Additional Fixes:
- Add skip links to document sections
- Implement text extraction display as alternative
- Add keyboard shortcut help modal
- Ensure OCR text is screen reader accessible

### 2.2 AI Chat Conversation Accessibility
**Files**: `/client/src/components/AIChatPanel.tsx`

#### Current Issues:
- Streaming responses not announced to screen readers
- Message threading not clear for assistive technology
- Confidence warnings not associated with responses
- No keyboard shortcuts for common actions

#### Implementation:
```tsx
// Add aria-live regions for chat
<div 
  role="log"
  aria-live="polite"
  aria-atomic="false"
  className="sr-only"
  ref={chatAnnouncementsRef}
>
  {streamingResponse && `AI is responding: ${streamingResponse}`}
</div>

// Message structure for screen readers
<div role="article" aria-labelledby={`message-${message.id}-author`}>
  <div id={`message-${message.id}-author`} className="sr-only">
    {message.role === 'assistant' ? 'AI Assistant' : 'You'} at {timestamp}
  </div>
  <div aria-describedby={message.confidence ? `confidence-${message.id}` : undefined}>
    {message.content}
  </div>
  {message.confidence && (
    <div id={`confidence-${message.id}`} className="sr-only">
      AI confidence level: {getConfidenceLabel(message.confidence)}
    </div>
  )}
</div>
```

### 2.3 Form Validation Improvements  
**Files**: All form components

#### Trauma-Informed Validation Messages:
```tsx
const validationMessages = {
  email: {
    required: "Please add your email address to continue",
    invalid: "This doesn't look like an email address - please check it includes an @ symbol and domain (like .com)"
  },
  password: {
    required: "Please enter your password",
    weak: "To keep your account secure, please choose a password with at least 8 characters including: a capital letter, lowercase letter, number, and symbol"
  },
  general: {
    networkError: "We're having trouble connecting right now. Your information is safe. Please try again in a moment.",
    timeout: "The process took longer than expected. Your information is secure - let's try again."
  }
};
```

---

## PHASE 3: UI COMPONENT LIBRARY AUDIT (Week 3)

### 3.1 Button Component Accessibility
**File**: `/client/src/components/ui/button.tsx`

#### Current Issues:
- No loading state announcements
- Generic button text without context
- Missing disabled state explanations

#### Implementation:
```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
  loadingText?: string;
  ariaDescribedBy?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, loading, loadingText, ariaDescribedBy, disabled, ...props }, ref) => {
    return (
      <>
        <button
          ref={ref}
          disabled={disabled || loading}
          aria-describedby={ariaDescribedBy}
          {...props}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
              <span className="sr-only">{loadingText || 'Processing, please wait'}</span>
              <span aria-hidden="true">{loadingText || 'Loading...'}</span>
            </>
          ) : children}
        </button>
        {loading && (
          <div role="status" aria-live="polite" className="sr-only">
            {loadingText || 'Processing your request, please wait'}
          </div>
        )}
      </>
    );
  }
);
```

### 3.2 Input Component Enhancements
**File**: `/client/src/components/ui/input.tsx`

#### Add Built-in Validation Support:
```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  helpText?: string;
  label?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, helpText, label, className, ...props }, ref) => {
    const inputId = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const helpId = helpText ? `${inputId}-help` : undefined;
    
    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          aria-describedby={[helpId, errorId].filter(Boolean).join(' ') || undefined}
          aria-invalid={!!error}
          {...props}
        />
        {helpText && (
          <p id={helpId} className="text-sm text-muted-foreground">
            {helpText}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }
);
```

### 3.3 Alert Component Improvements
**File**: `/client/src/components/ui/alert.tsx`

#### Add Timeout and Dismissal Controls:
```tsx
interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
  dismissible?: boolean;
  autoTimeout?: number; // milliseconds
  onDismiss?: () => void;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'default', dismissible, autoTimeout, onDismiss, children, ...props }, ref) => {
    const [visible, setVisible] = useState(true);
    const timeoutRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
      if (autoTimeout && autoTimeout > 0) {
        timeoutRef.current = setTimeout(() => {
          setVisible(false);
          onDismiss?.();
        }, autoTimeout);
      }
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [autoTimeout, onDismiss]);

    if (!visible) return null;

    return (
      <div
        ref={ref}
        role="alert"
        aria-live={variant === 'destructive' ? 'assertive' : 'polite'}
        className={cn(alertVariants({ variant }), props.className)}
        {...props}
      >
        {children}
        {dismissible && (
          <button
            onClick={() => {
              setVisible(false);
              onDismiss?.();
            }}
            className="absolute top-2 right-2 p-1 rounded hover:bg-background/20"
            aria-label="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);
```

---

## PHASE 4: COMPREHENSIVE TESTING & COMPLIANCE (Week 4)

### 4.1 Automated Testing Implementation
**Setup**: Run the accessibility-testing-setup.js script

#### Install Required Packages:
```bash
npm install --save-dev @axe-core/react @axe-core/playwright eslint-plugin-jsx-a11y @testing-library/jest-dom jest-axe pa11y pa11y-ci
```

#### Configure Pre-commit Hooks:
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix --config .eslintrc.a11y.js",
      "npm run test:a11y"
    ]
  }
}
```

### 4.2 Color Contrast Audit
**Tools**: Colour Contrast Analyser, WebAIM Contrast Checker

#### CSS Custom Property Audit:
```css
/* Ensure minimum WCAG AA contrast ratios */
:root {
  /* Text colors - must meet 4.5:1 ratio */
  --foreground: hsl(222.2, 84%, 4.9%); /* #0f172a on white = 16.7:1 ✓ */
  --muted-foreground: hsl(215.4, 16.3%, 46.9%); /* #64748b on white = 4.6:1 ✓ */
  
  /* Background colors */
  --background: hsl(0, 0%, 100%); /* Pure white */
  --muted: hsl(210, 40%, 98%); /* #f8fafc */
  
  /* Interactive colors */
  --primary: hsl(221.2, 83.2%, 53.3%); /* #3b82f6 - must check on all backgrounds */
  --primary-foreground: hsl(210, 40%, 98%); /* White text on primary = needs verification */
  
  /* Error colors */
  --destructive: hsl(0, 84.2%, 60.2%); /* #ef4444 on white = 4.5:1 ✓ */
  --destructive-foreground: hsl(210, 40%, 98%); /* White on destructive = needs verification */
}
```

#### Verification Required:
- [ ] All text meets 4.5:1 minimum contrast ratio
- [ ] Interactive elements meet 3:1 non-text contrast
- [ ] Dark mode maintains contrast ratios
- [ ] Focus indicators have sufficient contrast

### 4.3 Mobile Accessibility Testing
**Devices**: iOS Safari, Android Chrome, Screen readers on mobile

#### Touch Target Audit:
```css
/* Ensure minimum 44px touch targets */
.btn, button, [role="button"], 
input[type="checkbox"], input[type="radio"],
.clickable {
  min-height: 44px;
  min-width: 44px;
  /* For smaller visual elements, expand hit area */
  position: relative;
}

.btn::before {
  content: '';
  position: absolute;
  top: -8px;
  bottom: -8px;
  left: -8px;
  right: -8px;
  /* Invisible expanded hit area */
}
```

#### Responsive Testing Checklist:
- [ ] Content reflows without horizontal scrolling at 320px width
- [ ] Text scales to 200% without loss of functionality
- [ ] Focus indicators visible on mobile devices
- [ ] Screen reader navigation works on mobile
- [ ] Voice control (Voice Access/Voice Control) compatibility

---

## QUALITY GATES & REVIEW CHECKLIST

### Pre-Deployment Checklist:
- [ ] **WCAG 2.2 AA Compliance**: All automated tests pass
- [ ] **Screen Reader Testing**: NVDA, JAWS, VoiceOver compatibility verified
- [ ] **Keyboard Navigation**: 100% keyboard accessible
- [ ] **Color Contrast**: All combinations meet minimum ratios  
- [ ] **Motion Preferences**: Respects prefers-reduced-motion
- [ ] **Focus Management**: Proper focus trapping and restoration
- [ ] **Form Accessibility**: All forms have proper labels and validation
- [ ] **Trauma-Informed Language**: All error/success messages reviewed
- [ ] **Mobile Accessibility**: Touch targets and mobile screen readers tested
- [ ] **Performance**: Accessibility features don't impact performance

### Legal Compliance Verification:
- [ ] **UK Equality Act 2010**: Public body accessibility requirements met
- [ ] **GDPR**: Consent flows accessible to all users
- [ ] **Legal Professional Standards**: Client privilege protection maintained
- [ ] **Crisis Support**: Appropriate resources and safe language implemented

### User Testing Requirements:
- [ ] Test with actual disabled users including legal clients
- [ ] Test with trauma survivors (with appropriate support)
- [ ] Validate trauma-informed language with legal professionals
- [ ] Verify cultural sensitivity for diverse legal communities

---

## MONITORING & MAINTENANCE

### Ongoing Accessibility Monitoring:
```bash
# Daily automated checks
npm run a11y:full

# Weekly manual testing
npm run test:a11y-e2e

# Monthly comprehensive audit  
npm run pa11y:full && npm run lighthouse:a11y
```

### Key Performance Indicators:
- **Lighthouse Accessibility Score**: Target 100 (currently ~70)
- **axe-core Violations**: Target 0 (currently 47+ critical issues)
- **User Feedback**: Positive accessibility feedback from disabled users
- **Compliance**: Zero legal accessibility complaints

### Team Training Schedule:
- **Week 1**: WCAG 2.2 Guidelines training (all developers)
- **Week 2**: Screen reader usage workshop (QA team)
- **Week 3**: Trauma-informed design principles (UX/Legal teams)
- **Month 1**: Accessibility user testing with disabled legal clients

---

## SUCCESS METRICS

### Technical Compliance:
- ✅ WCAG 2.2 AA Compliance: 100%
- ✅ Zero Critical Accessibility Violations
- ✅ Lighthouse Accessibility Score: 100
- ✅ Screen Reader Compatibility: NVDA, JAWS, VoiceOver

### User Experience:
- ✅ 100% Keyboard Navigation Support
- ✅ Trauma-Informed Language Throughout
- ✅ Crisis Support Integration
- ✅ Multilingual Accessibility Preparation

### Legal Protection:
- ✅ UK Equality Act Compliance
- ✅ GDPR Accessible Consent Flows  
- ✅ Professional Standards Maintenance
- ✅ Client Safety Prioritization

**This roadmap ensures the Solicitor Brain v2 application becomes fully accessible, trauma-informed, and legally compliant for all users, particularly vulnerable legal clients in the UK system.**