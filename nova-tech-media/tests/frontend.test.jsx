// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ToastProvider } from '../src/components/Toast.jsx';
import ResultCard from '../src/components/ResultCard.jsx';
import Uploader from '../src/components/Uploader.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const wrap = (ui) => render(<ToastProvider>{ui}</ToastProvider>);
const media = {
  id: 'abc123', url: 'https://x.test/a.jpg', createdAt: '2026-10-14T10:00:00.000Z', mediaType: 'image',
  mimeType: 'image/jpeg', sizeBytes: 2048, originalName: 'a.jpg'
};
const config = { allowedFormats: ['jpg', 'png', 'mp4'], maxUploadBytes: 1024, uploadsDisabled: false };

function mockClipboard(impl) {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: impl }, configurable: true });
}

describe('copy buttons', () => {
  it('copies ID, URL, time and all details', async () => {
    const write = vi.fn().mockResolvedValue();
    mockClipboard(write);
    wrap(<ResultCard media={media} />);
    fireEvent.click(screen.getByText('Copy ID'));
    fireEvent.click(screen.getByText('Copy URL'));
    fireEvent.click(screen.getByText('Copy Time'));
    fireEvent.click(screen.getByText('Copy All'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(4));
    expect(write.mock.calls[0][0]).toBe('abc123');
    expect(write.mock.calls[1][0]).toBe(media.url);
    expect(write.mock.calls[2][0]).toBe(media.createdAt);
    expect(write.mock.calls[3][0]).toContain('ID: abc123');
  });
  it('shows an error toast when copying fails', async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    wrap(<ResultCard media={media} />);
    fireEvent.click(screen.getByText('Copy ID'));
    expect(await screen.findByText(/Copy failed/)).toBeTruthy();
  });
  it('disables Copy URL and explains when no public link exists', () => {
    wrap(<ResultCard media={{ ...media, url: null }} />);
    expect(screen.getByText('Copy URL').closest('button').disabled).toBe(true);
    expect(screen.getAllByText(/private|no public link/i).length).toBeGreaterThan(0);
  });
});

describe('uploader error states', () => {
  const pick = (file) => fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } });
  it('flags oversized files', () => {
    wrap(<Uploader config={config} />);
    pick(new File([new Uint8Array(5000)], 'big.jpg', { type: 'image/jpeg' }));
    expect(screen.getByText(/Too large/)).toBeTruthy();
  });
  it('flags disallowed formats', () => {
    wrap(<Uploader config={config} />);
    pick(new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
    expect(screen.getByText(/not allowed/)).toBeTruthy();
  });
  it('shows a notice when uploads are disabled', () => {
    wrap(<Uploader config={{ ...config, uploadsDisabled: true }} />);
    expect(screen.getByRole('alert').textContent).toMatch(/switched off/);
  });
});
