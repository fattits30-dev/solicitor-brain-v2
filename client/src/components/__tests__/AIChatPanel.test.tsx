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
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
  });

  it('renders AI chat panel with correct title', () => {
    render(<AIChatPanel />);
    expect(screen.getByText('AI Legal Assistant')).toBeInTheDocument();
  });

  it('shows different modes correctly', () => {
    render(<AIChatPanel />);
    
    // Check mode tabs
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Legal Analysis')).toBeInTheDocument();
    expect(screen.getByText('Document Drafting')).toBeInTheDocument();
  });

  it('displays quick actions when no messages', () => {
    render(<AIChatPanel />);
    
    // Check for quick action buttons
    expect(screen.getByText('Summarize Case')).toBeInTheDocument();
    expect(screen.getByText('Identify Legal Issues')).toBeInTheDocument();
  });

  it('allows typing in message input', () => {
    render(<AIChatPanel />);
    
    const textArea = screen.getByPlaceholderText(/How can I help with your legal work today/);
    fireEvent.change(textArea, { target: { value: 'Test message' } });
    
    expect(textArea).toHaveValue('Test message');
  });

  it('enables send button when message is typed', () => {
    render(<AIChatPanel />);
    
    const textArea = screen.getByPlaceholderText(/How can I help with your legal work today/);
    const sendButton = screen.getByText('Send');
    
    expect(sendButton).toBeDisabled();
    
    fireEvent.change(textArea, { target: { value: 'Test message' } });
    expect(sendButton).not.toBeDisabled();
  });

  it('handles quick action clicks', () => {
    render(<AIChatPanel />);
    
    const summarizeCaseButton = screen.getByText('Summarize Case');
    fireEvent.click(summarizeCaseButton);
    
    // Should populate the input with the action prompt
    const textArea = screen.getByPlaceholderText(/How can I help with your legal work today/);
    expect(textArea).toHaveValue(expect.stringContaining('comprehensive summary'));
  });

  it('changes mode correctly', () => {
    render(<AIChatPanel />);
    
    // Click on Legal Analysis tab
    const legalTab = screen.getByText('Legal Analysis');
    fireEvent.click(legalTab);
    
    // Placeholder should change
    expect(screen.getByPlaceholderText(/Ask about legal issues/)).toBeInTheDocument();
  });

  it('shows conversation history button', () => {
    render(<AIChatPanel />);
    
    const historyButton = screen.getByTitle('Conversation history');
    expect(historyButton).toBeInTheDocument();
  });

  it('shows settings button', () => {
    render(<AIChatPanel />);
    
    const settingsButton = screen.getByTitle('Chat settings');
    expect(settingsButton).toBeInTheDocument();
  });

  it('handles file attachment', () => {
    render(<AIChatPanel />);
    
    const attachButton = screen.getByText('Attach');
    expect(attachButton).toBeInTheDocument();
  });

  it('shows correct disclaimer', () => {
    render(<AIChatPanel />);
    
    expect(screen.getByText(/AI responses are for guidance only/)).toBeInTheDocument();
  });

  it('handles prop changes correctly', () => {
    const { rerender } = render(<AIChatPanel caseId="123" />);
    
    // Re-render with documentId
    rerender(<AIChatPanel caseId="123" documentId="doc-456" />);
    
    // Component should handle the prop changes without errors
    expect(screen.getByText('AI Legal Assistant')).toBeInTheDocument();
  });
});