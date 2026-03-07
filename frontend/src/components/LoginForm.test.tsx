import type { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginForm from './LoginForm';

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('LoginForm', () => {
  it('renders email and password fields and submit button', () => {
    const onSubmit = vi.fn();
    renderWithRouter(<LoginForm onSubmit={onSubmit} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('calls onSubmit with email and password on submit', () => {
    const onSubmit = vi.fn();
    renderWithRouter(<LoginForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByRole('button', { name: /log in/i }).closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co', password: 'password123' });
  });
});
