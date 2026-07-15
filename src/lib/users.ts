import type { Db } from '../db';
import { users } from '../db/schema';
import type { User } from '../db/schema';

// Token opaco e URL-safe usado como credencial do feed .ics (hex de 24 bytes).
export function newCalToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Cria um usuário anônimo (sem dados pessoais), identificado por um uuid opaco.
export async function createAnonUser(db: Db): Promise<User> {
  const row = {
    id: crypto.randomUUID(),
    calToken: newCalToken(),
    createdAt: new Date(),
  };
  await db.insert(users).values(row);
  return row;
}
