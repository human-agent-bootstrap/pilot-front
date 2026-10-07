import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTask, getTasks, INVALID_REQUEST, PROCESSING_ERROR } from './api';

const task = { id: 1, title: '첫 작업', status: 'open' };
const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('GET /api/tasks', () => {
  it('reads the ordered list without a body, query parameters, or credentials', async () => {
    const items = [task, { ...task, id: 2 }];
    fetchMock.mockResolvedValue(json({ items }));
    expect(await getTasks()).toEqual(items);
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8000/api/tasks', {
      method: 'GET', signal: undefined, credentials: 'omit',
    });
  });

  it('accepts an empty list', async () => {
    fetchMock.mockResolvedValue(json({ items: [] }));
    expect(await getTasks()).toEqual([]);
  });

  it.each([
    ['missing items', {}],
    ['extra list field', { items: [], total: 0 }],
    ['non-array items', { items: null }],
    ['non-object task', { items: [null] }],
    ['missing task field', { items: [{ id: 1, title: '첫 작업' }] }],
    ['extra task field', { items: [{ ...task, extra: true }] }],
    ['zero id', { items: [{ ...task, id: 0 }] }],
    ['negative id', { items: [{ ...task, id: -1 }] }],
    ['fractional id', { items: [{ ...task, id: 1.5 }] }],
    ['string id', { items: [{ ...task, id: '1' }] }],
    ['non-string title', { items: [{ ...task, title: 1 }] }],
    ['empty title', { items: [{ ...task, title: '' }] }],
    ['unnormalized title', { items: [{ ...task, title: '\t 첫 작업\r\n' }] }],
    ['overlong title', { items: [{ ...task, title: '가'.repeat(101) }] }],
    ['unsupported status', { items: [{ ...task, status: 'done' }] }],
    ['descending ids', { items: [{ ...task, id: 2 }, task] }],
    ['duplicate ids', { items: [task, task] }],
  ])('rejects %s in a 200 response', async (_label, body) => {
    fetchMock.mockResolvedValue(json(body));
    await expect(getTasks()).rejects.toThrow(PROCESSING_ERROR);
  });

  it.each([201, 500])('rejects HTTP %s as list success', async (status) => {
    fetchMock.mockResolvedValue(json({ items: [task] }, status));
    await expect(getTasks()).rejects.toThrow(PROCESSING_ERROR);
  });

  it.each([
    ['invalid JSON', () => new Response('{', { headers: { 'Content-Type': 'application/json' } })],
    ['wrong Content-Type', () => new Response('{"items":[]}', { headers: { 'Content-Type': 'text/plain' } })],
    ['missing Content-Type', () => new Response(new TextEncoder().encode('{"items":[]}'))],
  ])('rejects %s', async (_label, response) => {
    fetchMock.mockResolvedValue(response());
    await expect(getTasks()).rejects.toThrow(PROCESSING_ERROR);
  });

  it('reports a connection failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(getTasks()).rejects.toThrow(PROCESSING_ERROR);
  });
});

describe('POST /api/tasks', () => {
  it('sends only the raw title as JSON and accepts the normalized 201 Task', async () => {
    fetchMock.mockResolvedValue(json(task, 201));
    expect(await createTask(' \t첫 작업\r\n')).toEqual(task);
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8000/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: ' \t첫 작업\r\n' }),
      credentials: 'omit',
    });
  });

  it.each(['😀'.repeat(100), '\u00a0', '한 줄\n다음 줄'])(
    'uses code points and only the four declared trimming characters',
    async (title) => {
      fetchMock.mockResolvedValue(json({ ...task, title }, 201));
      expect((await createTask(title)).title).toBe(title);
    },
  );

  it('sends blank input to the backend and reports the contracted 422 message', async () => {
    fetchMock.mockResolvedValue(json({
      error: { code: 'INVALID_REQUEST', message: INVALID_REQUEST },
    }, 422));
    await expect(createTask(' \t\r\n')).rejects.toThrow(INVALID_REQUEST);
    expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify({ title: ' \t\r\n' }));
  });

  it.each([
    ['wrong status', task, 200],
    ['missing field', { id: 1, title: '첫 작업' }, 201],
    ['extra field', { ...task, extra: true }, 201],
    ['wrong title', { ...task, title: '다른 작업' }, 201],
    ['wrong 422 envelope', { detail: 'Invalid' }, 422],
    ['wrong 422 code', { error: { code: 'OTHER', message: INVALID_REQUEST } }, 422],
    ['wrong 422 message', { error: { code: 'INVALID_REQUEST', message: 'Other' } }, 422],
    ['server error', { error: { code: 'INTERNAL_ERROR', message: PROCESSING_ERROR } }, 500],
  ])('rejects %s', async (_label, body, status) => {
    fetchMock.mockResolvedValue(json(body, status));
    await expect(createTask('첫 작업')).rejects.toThrow(PROCESSING_ERROR);
  });
});
