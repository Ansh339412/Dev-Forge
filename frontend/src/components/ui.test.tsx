import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button, Field, Input, ProgressBar } from './ui';

describe('ui primitives', () => {
  it('exposes progress to assistive technology', () => {
    render(<ProgressBar percent={40} label="Launch completion" />);
    const bar = screen.getByRole('progressbar', { name: 'Launch completion' });
    expect(bar).toHaveAttribute('aria-valuenow', '40');
  });

  it('disables a button while it is working', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveTextContent('Working');
  });

  it('ties a label to its input', () => {
    render(<Field label="Email">{(id) => <Input id={id} />}</Field>);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
