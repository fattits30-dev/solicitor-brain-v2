import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIChatPanel } from '../AIChatPanel';

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}));

// Mock fetch
global.fetch = jest.fn();

describe('AIChatPanel', () => {
  const mockOnDocumentAnalyze = jest.fn();
  
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    mockOnDocumentAnalyze.mockReset();
  });

  it('renders AI chat panel with correct title', () => {
    render(<AIChatPanel onDocumentAnalyze={mockOnDocumentAnalyze} />);
    expect(screen.getByText('AI Legal Assistant')).toBeInTheDocument();
  });

  it('shows different modes correctly', () => {
    render(<AIChatPanel onDocumentAnalyze={mockOnDocumentAnalyze} />);
    
    // Check mode tabs
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Legal Analysis')).toBeInTheDocument();
    expect(screen.getByText('Document Drafting')).toBeInTheDocument();
  });

  it('displays quick actions when no messages', () => {
    render(<AIChatPanel onDocumentAnalyze={mockOnDocumentAnalyze} />);
    
    // Check for quick action buttons
    expect(screen.getByText('Summarize Case')).toBeInTheDocument();
    expect(screen.getByText('Identify Legal Issues')).toBeInTheDocument();
  });

  it('allows typing in message input', () => {
    render(<AIChatPanel onDocumentAnalyze={mockOnDocumentAnalyze} />);
    
    const textArea = screen.getByPlaceholderText(/How can I help with your legal work today/);
    fireEvent.change(textArea, { target: { value: 'Test message' } });
    
    expect(textArea).toHaveValue('Test message');
  });

  it('enables send button when message is typed', () => {
    render(<AIChatPanel onDocumentAnalyze={mockOnDocumentAnalyze} />);
    
    const textArea = screen.getByPlaceholderText(/How can I help with your legal work today/);
    const sendButton = screen.getByText('Send');
    
    expect(sendButton).toBeDisabled();
    
    fireEvent.change(textArea, { target: { value: 'Test message' } });
    expect(sendButton).not.toBeDisabled();
  });

  it('handles quick action clicks', () => {
    render(<AIChatPanel onDocumentAnalyze={mockOnDocumentAnalyze} />);
    
    const summarizeCaseButton = screen.getByText('Summarize Case');
    fireEvent.click(summarizeCaseButton);
    
    // Should populate the input with the action prompt
    const textArea = screen.getByPlaceholderText(/How can I help with your legal work today/);
    expect(textArea).toHaveValue(expect.stringContaining('comprehensive summary'));
  });

  it('changes mode correctly', () => {
    render(<AIChatPanel onDocumentAnalyze={mockOnDocumentAnalyze} />);
    
    // Click on Legal Analysis tab
    const legalTab = screen.getByText('Legal Analysis');
    fireEvent.click(legalTab);
    
    // Placeholder should change
    expect(screen.getByPlaceholderText(/Ask about legal issues/)).toBeInTheDocument();
  });

  it('shows conversation history button', () => {
    render(<AIChatPanel onDocumentAnalyze={mockOnDocumentAnalyze} />);
    
    const historyButton = screen.getByTitle('Conversation history');
    expect(historyButton).toBeInTheDocument();
  });

  it('shows settings button', () => {
    render(<AIChatPanel onDocumentAnalyze={mockOnDocumentAnalyze} />);
    
    const settingsButton = screen.getByTitle('Chat settings');
    expect(settingsButton).toBeInTheDocument();
  });

  it('handles file attachment', () => {
    render(<AIChatPanel onDocumentAnalyze={mockOnDocumentAnalyze} />);
    
    const attachButton = screen.getByText('Attach');
    expect(attachButton).toBeInTheDocument();
  });

  it('shows correct disclaimer', () => {
    render(<AIChatPanel onDocumentAnalyze={mockOnDocumentAnalyze} />);
    
    expect(screen.getByText(/AI responses are for guidance only/)).toBeInTheDocument();
  });

  it('handles prop changes correctly', () => {
    const { rerender } = render(<AIChatPanel caseId="123" onDocumentAnalyze={mockOnDocumentAnalyze} />);
    
    // Re-render with documentId
    rerender(<AIChatPanel caseId="123" documentId="doc-456" onDocumentAnalyze={mockOnDocumentAnalyze} />);
    
    // Component should handle the prop changes without errors
    expect(screen.getByText('AI Legal Assistant')).toBeInTheDocument();
  });
});