import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app title', () => {
  render(<App />);
  const titleElement = screen.getByText(/Your App Title/i);
  expect(titleElement).toBeInTheDocument();
});
