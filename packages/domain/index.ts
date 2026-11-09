import { z } from 'zod';
export const modules = ['overview', 'inventory', 'products', 'movements', 'purchases', 'quotes', 'team'] as const;
export const ThemeSchema = z.object({
 version: z.literal(1), name: z.string().trim().min(2).max(60),
 accent: z.enum(['blue', 'navy', 'sky', 'forest', 'wine', 'copper']), mode: z.enum(['light','dark']),
 density: z.enum(['comfortable','compact']), font: z.enum(['humanist','system']),
 modules: z.array(z.enum(modules)).max(7),
 logo: z.string().max(180000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).optional()
}).strict();
export type Theme = z.infer<typeof ThemeSchema>;
export const ProductSchema = z.object({
 id: z.string().uuid(), name: z.string().trim().min(2).max(120),
 sku: z.string().trim().min(1).max(40), unit: z.enum(['un','kg','cx','L']),
 minimum: z.number().int().min(0).max(1000000), quantity: z.number().int().min(0).max(1000000),
 category: z.string().trim().min(1).max(40)
}).strict();
export type Product = z.infer<typeof ProductSchema>;
export const MovementSchema = z.object({
 eventId:z.string().uuid(), productId:z.string().uuid(), expectedVersion:z.number().int().nonnegative(),
 kind:z.enum(['receipt','issue']), quantity:z.number().int().positive().max(1000000),
 reason:z.string().trim().min(3).max(160)
}).strict();
export type MovementInput = z.infer<typeof MovementSchema>;
export function applyMovement(balance:number, input:MovementInput):number {
 const event = MovementSchema.parse(input);
 const result = balance + (event.kind === 'receipt' ? event.quantity : -event.quantity);
 if (!Number.isSafeInteger(result) || result < 0 || result > 1000000) throw new Error('Saldo inválido. Confira a quantidade.');
 return result;
}
export type Role = 'owner' | 'manager' | 'operator' | 'viewer';
export function may(role:Role, action:'read'|'move'|'configure') {
 return action === 'read' || (action === 'move' && role !== 'viewer') || (action === 'configure' && (role === 'owner' || role === 'manager'));
}
export function belowMinimum(products:Product[]) { return products.filter(p=>p.quantity < p.minimum); }
