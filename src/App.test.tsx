import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { INVALID_REQUEST, PROCESSING_ERROR } from './api';

const task = { id: 1, title: '첫 작업', status: 'open' };
const emptyMessage = '등록된 작업이 없습니다. 위에서 첫 작업을 등록하세요.';
const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

async function openEmptyBoard() {
  fetchMock.mockResolvedValueOnce(json({ items: [] }));
  render(<App />);
  await screen.findByText(emptyMessage);
}

function submitTitle(title: string) {
  fireEvent.change(screen.getByLabelText('작업 제목'), { target: { value: title } });
  fireEvent.click(screen.getByRole('button', { name: '등록' }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('loads the backend list on opening and again after a page remount', async () => {
  fetchMock.mockImplementation(async () => json({ items: [task] }));
  const view = render(<App />);
  await screen.findByText('첫 작업');
  expect(screen.getByLabelText('상태: open')).toBeTruthy();
  view.unmount();
  render(<App />);
  await screen.findByText('첫 작업');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('shows an empty list message', async () => {
  await openEmptyBoard();
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
});

it('rejects a 201 Task whose title does not match the submitted title', async () => {
  await openEmptyBoard();
  fetchMock.mockResolvedValueOnce(json(task, 201));
  submitTitle('다른 작업');
  expect((await screen.findByRole('alert')).textContent).toBe(PROCESSING_ERROR);
  expect((screen.getByLabelText('작업 제목') as HTMLInputElement).value).toBe('다른 작업');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.queryByText('작업을 등록했습니다.')).toBeNull();
});

it('shows the saved task only after refreshing the list', async () => {
  await openEmptyBoard();
  fetchMock.mockResolvedValueOnce(json(task, 201))
    .mockResolvedValueOnce(json({ items: [task] }));
  submitTitle(' 첫 작업 ');
  await screen.findByText('작업을 등록했습니다.');
  expect(screen.getByText('첫 작업')).toBeTruthy();
  expect((screen.getByLabelText('작업 제목') as HTMLInputElement).value).toBe('');
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls.map((call) => call[1]?.method)).toEqual(['GET', 'POST', 'GET']);
});

it('allows whitespace submission, shows 422, and retains the raw input', async () => {
  await openEmptyBoard();
  fetchMock.mockResolvedValueOnce(json({
    error: { code: 'INVALID_REQUEST', message: INVALID_REQUEST },
  }, 422));
  submitTitle('   ');
  expect((await screen.findByRole('alert')).textContent).toBe(INVALID_REQUEST);
  expect((screen.getByLabelText('작업 제목') as HTMLInputElement).value).toBe('   ');
  expect(fetchMock.mock.calls[1][1]?.body).toBe('{"title":"   "}');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('listitem')).toBeNull();
  expect(screen.queryByText('작업을 등록했습니다.')).toBeNull();
});

it.each(['GET', 'POST'])('reports a %s connection failure without success', async (method) => {
  if (method === 'POST') await openEmptyBoard();
  fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  if (method === 'GET') render(<App />);
  else submitTitle('첫 작업');
  expect((await screen.findByRole('alert')).textContent).toBe(PROCESSING_ERROR);
  expect(screen.queryByText('작업을 등록했습니다.')).toBeNull();
  if (method === 'POST') {
    expect((screen.getByLabelText('작업 제목') as HTMLInputElement).value).toBe('첫 작업');
  }
});

it('shows a 500 error and preserves the input', async () => {
  await openEmptyBoard();
  fetchMock.mockResolvedValueOnce(json({
    error: { code: 'INTERNAL_ERROR', message: PROCESSING_ERROR },
  }, 500));
  submitTitle('첫 작업');
  expect((await screen.findByRole('alert')).textContent).toBe(PROCESSING_ERROR);
  expect((screen.getByLabelText('작업 제목') as HTMLInputElement).value).toBe('첫 작업');
});

it.each([
  ['GET', 200, { items: [{ ...task, status: 'done' }] }],
  ['POST', 200, task],
  ['POST', 201, { ...task, extra: true }],
])('rejects an invalid %s success (%s) in the UI', async (method, status, body) => {
  if (method === 'POST') await openEmptyBoard();
  fetchMock.mockResolvedValueOnce(json(body, status));
  if (method === 'GET') render(<App />);
  else submitTitle('첫 작업');
  expect((await screen.findByRole('alert')).textContent).toBe(PROCESSING_ERROR);
  expect(screen.queryByRole('listitem')).toBeNull();
  expect(screen.queryByText('작업을 등록했습니다.')).toBeNull();
});

it('does not show success when GET refresh fails after a valid POST', async () => {
  await openEmptyBoard();
  fetchMock.mockResolvedValueOnce(json(task, 201))
    .mockRejectedValueOnce(new TypeError('Failed to fetch'));
  submitTitle('첫 작업');
  expect((await screen.findByRole('alert')).textContent).toBe(PROCESSING_ERROR);
  expect((screen.getByLabelText('작업 제목') as HTMLInputElement).value).toBe('');
  expect(screen.queryByText('작업을 등록했습니다.')).toBeNull();
  expect(screen.queryByRole('listitem')).toBeNull();
});

it('does not show success when the refreshed list omits the saved task', async () => {
  await openEmptyBoard();
  fetchMock.mockResolvedValueOnce(json(task, 201))
    .mockResolvedValueOnce(json({ items: [] }));
  submitTitle('첫 작업');
  expect((await screen.findByRole('alert')).textContent).toBe(PROCESSING_ERROR);
  expect(screen.queryByText('작업을 등록했습니다.')).toBeNull();
  expect(screen.queryByRole('listitem')).toBeNull();
});

it('disables duplicate registration until POST and the GET refresh finish', async () => {
  await openEmptyBoard();
  let resolvePost!: (response: Response) => void;
  let resolveList!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolvePost = resolve; }))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveList = resolve; }));
  submitTitle('첫 작업');
  const button = screen.getByRole('button', { name: '등록' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  resolvePost(json(task, 201));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(button.disabled).toBe(true);
  expect(screen.queryByText('작업을 등록했습니다.')).toBeNull();
  resolveList(json({ items: [task] }));
  await screen.findByText('작업을 등록했습니다.');
  expect(button.disabled).toBe(false);
});

it('clears a previous success notice when a subsequent registration fails', async () => {
  await openEmptyBoard();
  fetchMock.mockResolvedValueOnce(json(task, 201))
    .mockResolvedValueOnce(json({ items: [task] }));
  submitTitle('첫 작업');
  await screen.findByText('작업을 등록했습니다.');
  fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  submitTitle('두 번째 작업');
  await screen.findByRole('alert');
  expect(screen.queryByText('작업을 등록했습니다.')).toBeNull();
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
});
