import { describe, expect, it } from 'vitest';
import { addLink, createTask, reviewTask, updateTask } from './tasks.js';

describe('task schemas', () => {
  const base = { title: 'Research', description: '', deliverable: '', assignee_id: null, due_date: '', due_time: '', estimated_hours: 6 };

  it('accepts a valid task and rejects unknown fields', () => {
    expect(createTask.safeParse(base).success).toBe(true);
    expect(createTask.safeParse({ ...base, created_by: '00000000-0000-0000-0000-000000000000' }).success).toBe(false);
    expect(updateTask.safeParse({ completion_seq: 3 }).success).toBe(false);
  });

  it('limits hours to half hour steps between 0 and 200', () => {
    expect(createTask.safeParse({ ...base, estimated_hours: 1.5 }).success).toBe(true);
    expect(createTask.safeParse({ ...base, estimated_hours: 1.25 }).success).toBe(false);
    expect(createTask.safeParse({ ...base, estimated_hours: 201 }).success).toBe(false);
  });

  it('accepts only https file links', () => {
    expect(addLink.safeParse({ url: 'https://docs.google.com/document/d/abc' }).success).toBe(true);
    expect(addLink.safeParse({ url: 'http://example.com/x' }).success).toBe(false);
    expect(addLink.safeParse({ url: 'javascript:alert(1)' }).success).toBe(false);
  });

  it('requires a reason for a flag', () => {
    expect(reviewTask.safeParse({ kind: 'confirmed' }).success).toBe(true);
    expect(reviewTask.safeParse({ kind: 'flagged' }).success).toBe(false);
    expect(reviewTask.safeParse({ kind: 'flagged', note: 'Two cases are too old.' }).success).toBe(true);
  });
});
