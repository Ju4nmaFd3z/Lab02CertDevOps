'use client';

import { useState, useEffect } from 'react';
import type { Book } from '@/types';
import { getBooks, addBook } from '@/lib/api';

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');

  useEffect(() => {
    getBooks()
      .then(setBooks)
      .catch(() => setError(true));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const book = await addBook({ title, author });
    setBooks((prev) => [book, ...prev]);
    setTitle('');
    setAuthor('');
  }

  return (
    <main className="max-w-lg mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">📚 BookShelf</h1>

      {error && (
        <p className="text-red-500 mb-6 text-sm">
          No se pudo conectar con el backend. ¿Está el servidor en marcha?
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-8">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          required
          className="border border-gray-300 rounded px-3 py-2"
        />
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Autor"
          required
          className="border border-gray-300 rounded px-3 py-2"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
        >
          Añadir libro
        </button>
      </form>

      <ul className="space-y-2">
        {books.map((book) => (
          <li key={book.id} className="border border-gray-200 rounded px-4 py-3">
            <span className="font-medium">{book.title}</span>
            <span className="text-gray-500 ml-2">— {book.author}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
