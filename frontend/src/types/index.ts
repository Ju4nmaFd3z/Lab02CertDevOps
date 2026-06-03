export interface Book {
  id: number;
  title: string;
  author: string;
  created_at: string;
}

export interface CreateBookPayload {
  title: string;
  author: string;
}
