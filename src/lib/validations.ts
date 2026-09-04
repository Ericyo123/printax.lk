import { z } from 'zod'

export const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  type: z.enum(['WALK_IN', 'MONTHLY']).default('WALK_IN'),
})

export const jobSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  paperSizeId: z.string().min(1, 'Paper size is required'),
  printType: z.enum(['COLOR', 'BW']),
  printMode: z.enum(['SINGLE', 'DOUBLE']),
  pages: z.number().int().min(1),
  copies: z.number().int().min(1),
  pricingType: z.enum(['PER_PAGE', 'PER_COPY', 'PER_BOOK', 'MANUAL']),
  manualPrice: z.number().optional().nullable(),
  baseAmount: z.number().min(0).optional(),
  additionalTotal: z.number().min(0).optional(),
  discount: z.number().min(0).optional().default(0),
  totalAmount: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  services: z.array(z.object({
    serviceId: z.string().optional().nullable(),
    customLabel: z.string().optional().nullable(),
    amount: z.number().min(0),
  })).optional(),
  customServices: z.array(z.object({
    label: z.string(),
    amount: z.number().min(0),
  })).optional(),
})

export const invoiceSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  date: z.string().or(z.date()).optional(),
  dueDate: z.string().or(z.date()).optional().nullable(),
  paymentStatus: z.enum(['PAID', 'UNPAID', 'PARTIAL']).default('UNPAID'),
  paymentMethod: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  jobs: z.array(jobSchema).min(1, 'At least one job is required'),
})

export const createJobSchema = jobSchema.extend({
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  createInvoice: z.boolean().default(false),
  dueDate: z.string().or(z.date()).optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
})

export const statementSchema = z.object({
  customerId: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
  invoiceIds: z.array(z.string()),
  dueDate: z.string().or(z.date()).optional().nullable(),
})

export const quotationItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  paperSizeId: z.string().optional().nullable(),
  printType: z.enum(['COLOR', 'BW']).optional().nullable(),
  printMode: z.enum(['SINGLE', 'DOUBLE']).optional().nullable(),
  pages: z.number().int().min(1).default(1),
  copies: z.number().int().min(1).default(1),
  pricingType: z.enum(['PER_PAGE', 'PER_COPY', 'PER_BOOK', 'MANUAL']).default('MANUAL'),
  unitPrice: z.number().min(0).default(0),
  baseAmount: z.number().min(0).default(0),
  additionalTotal: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  totalAmount: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
})

export const quotationSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  customerEmail: z.string().optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  validUntil: z.string().or(z.date()).optional().nullable(),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED']).default('DRAFT'),
  discount: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  items: z.array(quotationItemSchema).min(1, 'At least one quotation item is required'),
})

export const expenseSchema = z.object({
  title: z.string().min(1, 'Description / Title is required'),
  category: z.string().min(1, 'Category is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  date: z.string().or(z.date()).optional(),
  paymentMethod: z.string().optional().nullable().default('CASH'),
  reference: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

