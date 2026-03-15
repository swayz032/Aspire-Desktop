import { z } from 'zod';

// ---------------------------------------------------------------------------
// Common reusable schemas
// ---------------------------------------------------------------------------

export const emailSchema = z.string().min(1, 'Email is required').email('Invalid email address');
export const optionalEmail = z.string().email('Invalid email address').or(z.literal(''));
export const requiredString = z.string().min(1, 'This field is required');
export const positiveNumber = z.number().positive('Must be greater than 0');
export const nonNegativeNumber = z.number().min(0, 'Must be 0 or greater');
export const positiveIntString = z.string().refine(
  (v) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0; },
  'Must be a positive whole number',
);

// ---------------------------------------------------------------------------
// Form-specific schemas
// ---------------------------------------------------------------------------

/** Public booking — client details step */
export const bookingDetailsSchema = z.object({
  clientName: requiredString.describe('Full Name'),
  clientEmail: emailSchema.describe('Email'),
  clientPhone: z.string().optional(),
  clientNotes: z.string().optional(),
});

/** Invoice creation modal */
export const invoiceCreateSchema = z.object({
  customerEmail: emailSchema.describe('Customer Email'),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1, 'Description is required'),
        amount: z.string().refine(
          (v) => { const n = parseFloat(v); return !isNaN(n) && n > 0; },
          'Amount must be a positive number',
        ),
      }),
    )
    .min(1, 'At least one line item is required'),
  dueDays: z.string().refine(
    (v) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0; },
    'Due days must be a positive number',
  ),
});

/** Quote creation modal */
export const quoteCreateSchema = z.object({
  customerEmail: emailSchema.describe('Customer Email'),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1, 'Description is required'),
        amount: z.string().refine(
          (v) => { const n = parseFloat(v); return !isNaN(n) && n > 0; },
          'Amount must be a positive number',
        ),
      }),
    )
    .min(1, 'At least one line item is required'),
  expiryDays: z.string().refine(
    (v) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0; },
    'Expiry days must be a positive number',
  ),
});

/** Client add/edit form */
export const clientFormSchema = z.object({
  email: emailSchema.describe('Email'),
  name: z.string().optional(),
  phone: z.string().optional(),
  description: z.string().optional(),
});

/** Contact support form */
export const contactSupportSchema = z.object({
  subject: requiredString.describe('Subject'),
  category: requiredString.describe('Category'),
  description: requiredString.describe('Description'),
});

/** Auth sign-in */
export const signInSchema = z.object({
  email: emailSchema.describe('Email'),
  password: requiredString.describe('Password'),
});

/** Auth sign-up */
export const signUpSchema = z.object({
  inviteCode: requiredString.describe('Invite Code'),
  email: emailSchema.describe('Email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/** Books — journal entry form */
export const journalEntrySchema = z.object({
  lines: z
    .array(
      z.object({
        accountId: z.string().min(1, 'Account is required'),
        amount: z.string().refine(
          (v) => { const n = parseFloat(v); return !isNaN(n) && n > 0; },
          'Amount must be a positive number',
        ),
      }),
    )
    .min(2, 'At least two lines are required'),
});

/** Bookings — service form */
export const serviceFormSchema = z.object({
  name: requiredString.describe('Service Name'),
  duration: z.string().refine(
    (v) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0; },
    'Duration must be a positive number',
  ),
  price: z.string().refine(
    (v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0; },
    'Price must be 0 or greater',
  ),
});

// ---------------------------------------------------------------------------
// Validation helper — returns field-level errors keyed by path
// ---------------------------------------------------------------------------

export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) errors[path] = issue.message;
  }
  return { success: false, errors };
}
