import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CommandDiagram from './CommandDiagram';

describe('diagrama ladder de comando', () => {
  it('identifica o intertravamento estrela-triângulo por texto', () => {
    render(<CommandDiagram mode="star-triangle" phase="switching" status="starting" direction="forward" language="pt" />);
    expect(screen.getByRole('img', { name: /botoeiras, selo/i })).toBeInTheDocument();
    expect(screen.getByText(/K2 e K3 não podem energizar juntos/)).toBeInTheDocument();
    expect(screen.getByText('BOBINA ESTRELA')).toBeInTheDocument();
    expect(screen.getByText('BOBINA TRIÂNGULO')).toBeInTheDocument();
  });

  it('expõe a reversão e as bobinas intertravadas em inglês', () => {
    render(<CommandDiagram mode="direct" phase="steady" status="running" direction="reverse" language="en" />);
    expect(screen.getByRole('img', { name: /stop, start, seal-in/i })).toBeInTheDocument();
    expect(screen.getByText(/only one rotation coil can energize/i)).toBeInTheDocument();
    expect(screen.getByText('REV COIL')).toBeInTheDocument();
  });
});