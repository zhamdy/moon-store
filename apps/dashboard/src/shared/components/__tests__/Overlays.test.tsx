import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../tests/testUtils';
import { ActionModal, SlideOverDrawer, ConfirmDialog } from '../overlays';

describe('Unit 3: Overlays & Panels Suite', () => {
  describe('ActionModal', () => {
    it('renders with role="dialog" and handles close button click', () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <ActionModal
          isOpen={true}
          onClose={handleClose}
          title="Edit Profile"
          description="Update your personal details"
          footer={<button>Save</button>}
        >
          <div>Modal Content</div>
        </ActionModal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      expect(screen.getByText('Update your personal details')).toBeInTheDocument();
      expect(screen.getByText('Modal Content')).toBeInTheDocument();

      const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('dismisses on Escape key press', () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <ActionModal isOpen={true} onClose={handleClose} title="Escape Test">
          <div>Content</div>
        </ActionModal>
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('SlideOverDrawer', () => {
    it('renders off-canvas drawer with modal semantics and RTL awareness', () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <SlideOverDrawer
          isOpen={true}
          onClose={handleClose}
          title="Filter Products"
          description="Refine your search results"
        >
          <div>Filter options</div>
        </SlideOverDrawer>,
        { direction: 'rtl' }
      );

      const drawer = screen.getByRole('dialog');
      expect(drawer).toHaveAttribute('aria-modal', 'true');
      expect(screen.getByText('Filter Products')).toBeInTheDocument();

      const closeBtn = screen.getByRole('button', { name: 'Close drawer' });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('ConfirmDialog', () => {
    it('renders role="alertdialog" and focuses Cancel button initially', async () => {
      const handleConfirm = vi.fn();
      const handleOpenChange = vi.fn();

      renderWithProviders(
        <ConfirmDialog
          isOpen={true}
          onOpenChange={handleOpenChange}
          title="Delete Product"
          description="Are you sure you want to delete this product?"
          onConfirm={handleConfirm}
          confirmColor="danger"
          confirmText="Delete"
          cancelText="Cancel"
        />
      );

      const alertdialog = screen.getByRole('alertdialog');
      expect(alertdialog).toHaveAttribute('aria-modal', 'true');
      expect(screen.getByText('Delete Product')).toBeInTheDocument();

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      await waitFor(() => {
        expect(document.activeElement).toBe(cancelBtn);
      });

      const confirmBtn = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(confirmBtn);
      expect(handleConfirm).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });
});
