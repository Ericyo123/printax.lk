import { z } from 'zod'

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  type: z.enum(['WALK_IN', 'MONTHLY']).default('WALK_IN'),
})

try {
  const data = customerSchema.parse({ name: 'John', phone: '', email: '', address: '', notes: '', type: 'WALK_IN' })
  console.log("Success:", data)
} catch (e) {
  console.error("Error:", e.message)
}
