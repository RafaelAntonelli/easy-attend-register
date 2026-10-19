import { z } from 'zod';
export const contatoPortalSchema = z.object({ telefone: z.string().trim().max(20), telefone2: z.string().trim().max(20), email: z.union([z.literal(''), z.string().trim().email().max(254)]) }).strict();
export const fotoPortalSchema = z.object({ tipo: z.enum(['image/jpeg','image/png','image/webp']), base64: z.string().max(7_000_000) }).strict();
export const avisoPortalSchema = z.object({ alunoId: z.string().uuid().nullable(), titulo: z.string().trim().min(1).max(100), mensagem: z.string().trim().min(1).max(1000) }).strict();
