import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TablePagination } from './table-pagination';

describe('TablePagination', () => {
  it('renders nothing with a single page', () => {
    const { container } = render(
      <TablePagination page={1} totalPages={1} pageSize={10} totalItems={5} onPageChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the visible range and page indicator', () => {
    render(
      <TablePagination page={2} totalPages={3} pageSize={10} totalItems={25} onPageChange={() => {}} />,
    );
    expect(screen.getByText(/Mostrando 11–20 de 25/)).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('clamps the upper bound to totalItems on the last page', () => {
    render(
      <TablePagination page={3} totalPages={3} pageSize={10} totalItems={25} onPageChange={() => {}} />,
    );
    expect(screen.getByText(/Mostrando 21–25 de 25/)).toBeInTheDocument();
  });

  it('navigates with the chevrons and disables them at the edges', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <TablePagination page={1} totalPages={3} pageSize={10} totalItems={25} onPageChange={onPageChange} />,
    );
    const [prev, next] = screen.getAllByRole('button');
    expect(prev).toBeDisabled();
    fireEvent.click(next);
    expect(onPageChange).toHaveBeenCalledWith(2);

    rerender(
      <TablePagination page={3} totalPages={3} pageSize={10} totalItems={25} onPageChange={onPageChange} />,
    );
    const [, nextAtEnd] = screen.getAllByRole('button');
    expect(nextAtEnd).toBeDisabled();
  });
});
