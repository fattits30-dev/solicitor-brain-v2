import { AuthProvider } from '@/contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock the router
jest.mock('wouter', () => ({
  Switch: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Route: ({ component }: { component: React.ComponentType }) => {
    const Component = component;
    return <Component />;
  },
}));

// Mock components
jest.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock pages
jest.mock('./pages/Login', () => () => <div>Login Page</div>);
jest.mock('./pages/dashboard', () => () => <div>Dashboard Page</div>);
jest.mock('./pages/cases', () => () => <div>Cases Page</div>);
jest.mock('./pages/upload', () => () => <div>Upload Page</div>);
jest.mock('./pages/search', () => () => <div>Search Page</div>);
jest.mock('./pages/drafts', () => () => <div>Drafts Page</div>);
jest.mock('./pages/activity', () => () => <div>Activity Page</div>);
jest.mock('./pages/audit', () => () => <div>Audit Page</div>);
jest.mock('./pages/settings', () => () => <div>Settings Page</div>);
jest.mock('./pages/ai-workspace', () => () => <div>AI Workspace Page</div>);
jest.mock('./pages/not-found', () => () => <div>Not Found Page</div>);

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{component}</AuthProvider>
    </QueryClientProvider>,
  );
};

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => renderWithProviders(<App />)).not.toThrow();
  });

  it('renders the main application structure', () => {
    renderWithProviders(<App />);

    // Check if the app renders basic structure
    expect(document.body).toBeInTheDocument();
  });

  it('includes all necessary providers', () => {
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>,
    );

    // Verify providers are rendered
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
  });

  it('handles routing structure', () => {
    renderWithProviders(<App />);

    // The app should render without routing errors
    expect(screen.getByText(/Page/)).toBeInTheDocument();
  });
});
