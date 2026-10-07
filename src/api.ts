export type Task = {
  id: number;
  title: string;
  status: 'open';
};

export const PROCESSING_ERROR = '작업을 처리하지 못했습니다.';
export const INVALID_REQUEST = '제목은 공백을 제외한 1~100자 문자열이어야 합니다.';

const apiOrigin = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000')
  .replace(/\/$/, '');

function hasKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function normalizeTitle(title: string): string {
  return title.replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '');
}

function isTask(value: unknown): value is Task {
  if (!hasKeys(value, ['id', 'title', 'status'])) return false;
  return typeof value.id === 'number' && Number.isInteger(value.id) && value.id > 0
    && typeof value.title === 'string'
    && value.title === normalizeTitle(value.title)
    && Array.from(value.title).length >= 1 && Array.from(value.title).length <= 100
    && value.status === 'open';
}

async function request(expectedStatus: number, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${apiOrigin}/api/tasks`, { ...init, credentials: 'omit' });
  } catch {
    throw new Error(PROCESSING_ERROR);
  }
  if (response.status !== expectedStatus && response.status !== 422) {
    throw new Error(PROCESSING_ERROR);
  }
  if (response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
    !== 'application/json') {
    throw new Error(PROCESSING_ERROR);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(PROCESSING_ERROR);
  }
  if (response.status === 422) {
    if (hasKeys(body, ['error']) && hasKeys(body.error, ['code', 'message'])
      && body.error.code === 'INVALID_REQUEST' && body.error.message === INVALID_REQUEST) {
      throw new Error(INVALID_REQUEST);
    }
    throw new Error(PROCESSING_ERROR);
  }
  return body;
}

export async function getTasks(signal?: AbortSignal): Promise<Task[]> {
  const body = await request(200, { method: 'GET', signal });
  if (!hasKeys(body, ['items']) || !Array.isArray(body.items) || !body.items.every(isTask)
    || !body.items.every((task, index, items) => index === 0 || items[index - 1].id < task.id)) {
    throw new Error(PROCESSING_ERROR);
  }
  return body.items;
}

export async function createTask(title: string): Promise<Task> {
  const body = await request(201, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!isTask(body) || body.title !== normalizeTitle(title)) {
    throw new Error(PROCESSING_ERROR);
  }
  return body;
}
