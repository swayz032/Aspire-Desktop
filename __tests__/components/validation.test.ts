/**
 * Form Validation Tests
 *
 * Validates Wave 4 Zod-based form validation schemas and the validateForm helper.
 * Tests both positive (valid data passes) and negative (invalid data fails with
 * field-level error messages) cases.
 */

import {
  validateForm,
  invoiceCreateSchema,
  bookingDetailsSchema,
  signInSchema,
  signUpSchema,
  contactSupportSchema,
  serviceFormSchema,
  clientFormSchema,
  emailSchema,
  requiredString,
  positiveNumber,
} from '@/lib/validation';

// ---------------------------------------------------------------------------
// Invoice form validation
// ---------------------------------------------------------------------------

describe('invoiceCreateSchema', () => {
  test('should validate invoice form correctly — valid data passes', () => {
    const validData = {
      customerEmail: 'client@example.com',
      lineItems: [{ description: 'Consulting', amount: '500' }],
      dueDays: '30',
    };

    const result = validateForm(invoiceCreateSchema, validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerEmail).toBe('client@example.com');
      expect(result.data.lineItems).toHaveLength(1);
    }
  });

  test('should reject invoice with invalid email', () => {
    const result = validateForm(invoiceCreateSchema, {
      customerEmail: 'not-an-email',
      lineItems: [{ description: 'Work', amount: '100' }],
      dueDays: '30',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors['customerEmail']).toBeDefined();
    }
  });

  test('should reject invoice with empty line items', () => {
    const result = validateForm(invoiceCreateSchema, {
      customerEmail: 'valid@email.com',
      lineItems: [],
      dueDays: '30',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors['lineItems']).toBeDefined();
    }
  });

  test('should reject invoice with zero amount', () => {
    const result = validateForm(invoiceCreateSchema, {
      customerEmail: 'valid@email.com',
      lineItems: [{ description: 'Work', amount: '0' }],
      dueDays: '30',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors['lineItems.0.amount']).toBeDefined();
    }
  });

  test('should reject invoice with negative due days', () => {
    const result = validateForm(invoiceCreateSchema, {
      customerEmail: 'valid@email.com',
      lineItems: [{ description: 'Work', amount: '100' }],
      dueDays: '-5',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors['dueDays']).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Booking details validation
// ---------------------------------------------------------------------------

describe('bookingDetailsSchema', () => {
  test('should validate booking form correctly — valid data passes', () => {
    const result = validateForm(bookingDetailsSchema, {
      clientName: 'Jane Doe',
      clientEmail: 'jane@example.com',
    });
    expect(result.success).toBe(true);
  });

  test('should reject booking with empty name', () => {
    const result = validateForm(bookingDetailsSchema, {
      clientName: '',
      clientEmail: 'jane@example.com',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors['clientName']).toBeDefined();
    }
  });

  test('should reject booking with invalid email', () => {
    const result = validateForm(bookingDetailsSchema, {
      clientName: 'Jane Doe',
      clientEmail: 'not-email',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors['clientEmail']).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// validateForm: field-level errors
// ---------------------------------------------------------------------------

describe('validateForm: field-level errors', () => {
  test('should return field-level errors keyed by path', () => {
    const result = validateForm(signUpSchema, {
      inviteCode: '',
      email: 'bad',
      password: 'short',
      confirmPassword: 'mismatch',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      // Errors should be keyed by field path
      expect(typeof result.errors).toBe('object');
      expect(result.errors['inviteCode']).toBeDefined();
      expect(result.errors['email']).toBeDefined();
      // password is 5 chars, schema requires min 8
      expect(result.errors['password']).toBeDefined();
    }
  });

  test('should return empty errors object when data is valid', () => {
    const result = validateForm(signInSchema, {
      email: 'user@example.com',
      password: 'my-secure-pass',
    });

    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Service form validation
// ---------------------------------------------------------------------------

describe('serviceFormSchema', () => {
  test('should validate service form with valid data', () => {
    const result = validateForm(serviceFormSchema, {
      name: 'Haircut',
      duration: '60',
      price: '45.00',
    });
    expect(result.success).toBe(true);
  });

  test('should allow zero price (free services)', () => {
    const result = validateForm(serviceFormSchema, {
      name: 'Free Consultation',
      duration: '30',
      price: '0',
    });
    expect(result.success).toBe(true);
  });

  test('should reject negative duration', () => {
    const result = validateForm(serviceFormSchema, {
      name: 'Haircut',
      duration: '-10',
      price: '45',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors['duration']).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Atomic schema tests
// ---------------------------------------------------------------------------

describe('atomic schemas', () => {
  test('emailSchema rejects empty string', () => {
    const result = emailSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  test('emailSchema accepts valid email', () => {
    const result = emailSchema.safeParse('test@domain.com');
    expect(result.success).toBe(true);
  });

  test('requiredString rejects empty string', () => {
    const result = requiredString.safeParse('');
    expect(result.success).toBe(false);
  });

  test('positiveNumber rejects zero', () => {
    const result = positiveNumber.safeParse(0);
    expect(result.success).toBe(false);
  });

  test('positiveNumber accepts 1', () => {
    const result = positiveNumber.safeParse(1);
    expect(result.success).toBe(true);
  });
});
