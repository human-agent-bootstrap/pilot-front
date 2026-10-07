import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createTask, getTasks, INVALID_REQUEST, PROCESSING_ERROR } from './api';
import type { Task } from './api';

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message === INVALID_REQUEST
    ? INVALID_REQUEST : PROCESSING_ERROR;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getTasks(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setTasks(items);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await createTask(title);
      setTitle('');
      const items = await getTasks();
      if (!items.some((task) => task.id === saved.id && task.title === saved.title)) {
        throw new Error(PROCESSING_ERROR);
      }
      setTasks(items);
      setNotice('작업을 등록했습니다.');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header>
        <h1>팀 작업 보드</h1>
        <p>할 일을 등록하고 팀의 작업을 한곳에서 확인하세요.</p>
      </header>
      <form onSubmit={(event) => { void submit(event); }}>
        <label htmlFor="task-title">작업 제목</label>
        <div className="entry">
          <input
            id="task-title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-describedby="title-help"
          />
          <button type="submit" disabled={busy}>등록</button>
        </div>
        <p id="title-help" className="help">앞뒤 공백을 제외한 1~100자로 입력하세요.</p>
      </form>
      <p role="status">{busy ? '작업을 처리하고 있습니다.' : notice}</p>
      {error && <p role="alert">{error}</p>}
      <section aria-labelledby="list-heading" aria-busy={busy}>
        <h2 id="list-heading">작업 목록</h2>
        {tasks?.length === 0 && (
          <p className="empty">등록된 작업이 없습니다. 위에서 첫 작업을 등록하세요.</p>
        )}
        {tasks !== null && tasks.length > 0 && (
          <ul>
            {tasks.map((task) => (
              <li key={task.id}>
                <span className="task-id">#{task.id}</span>
                <span className="task-title">{task.title}</span>
                <span className="task-status" aria-label={`상태: ${task.status}`}>
                  {task.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
