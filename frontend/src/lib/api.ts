import type { Book, CreateBookPayload } from '@/types';

export async function getBooks(): Promise<Book[]> {
  const res = await fetch('/api/books');
  if (!res.ok) throw new Error('No se pudo conectar con el backend');
  return res.json();
}

export async function addBook(payload: CreateBookPayload): Promise<Book> {
  const res = await fetch('/api/books', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Error al crear el libro');
  return res.json();
}
