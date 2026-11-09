import { z } from 'zod';

export const uuidParam = z.object({ id: z.uuid() });
export const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const password = z.string().min(8).max(72); // bcrypt solo usa los primeros 72 bytes.
export const shortText = (max) => z.string().trim().min(1).max(max);
