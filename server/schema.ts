import { pgTable, text, timestamp, integer, boolean, jsonb, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  businessName: text('business_name'),
  bookingSlug: text('booking_slug').unique(),
  logoUrl: text('logo_url'),
  accentColor: text('accent_color').default('#3b82f6'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeAccountId: text('stripe_account_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  duration: integer('duration').notNull(),
  price: integer('price').notNull(),
  currency: text('currency').default('usd').notNull(),
  color: text('color').default('#4facfe'),
  isActive: boolean('is_active').default(true).notNull(),
  stripePriceId: text('stripe_price_id'),
  stripeProductId: text('stripe_product_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const availability = pgTable('availability', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  serviceId: uuid('service_id').references(() => services.id).notNull(),
  clientName: text('client_name').notNull(),
  clientEmail: text('client_email').notNull(),
  clientPhone: text('client_phone'),
  clientNotes: text('client_notes'),
  scheduledAt: timestamp('scheduled_at').notNull(),
  duration: integer('duration').notNull(),
  status: text('status').default('pending').notNull(),
  paymentStatus: text('payment_status').default('unpaid').notNull(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeCheckoutSessionId: text('stripe_checkout_session_id'),
  amount: integer('amount').notNull(),
  currency: text('currency').default('usd').notNull(),
  cancelledAt: timestamp('cancelled_at'),
  cancelReason: text('cancel_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const bufferSettings = pgTable('buffer_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  beforeBuffer: integer('before_buffer').default(0).notNull(),
  afterBuffer: integer('after_buffer').default(15).notNull(),
  minimumNotice: integer('minimum_notice').default(60).notNull(),
  maxAdvanceBooking: integer('max_advance_booking').default(30).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;
export type Availability = typeof availability.$inferSelect;
export type InsertAvailability = typeof availability.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;
export type BufferSettings = typeof bufferSettings.$inferSelect;
export type InsertBufferSettings = typeof bufferSettings.$inferInsert;

export const frontDeskSetup = pgTable('front_desk_setup', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  lineMode: text('line_mode').default('ASPIRE_NUMBER'),
  aspireNumberE164: text('aspire_number_e164'),
  existingNumberE164: text('existing_number_e164'),
  forwardingVerified: boolean('forwarding_verified').default(false),
  businessName: text('business_name'),
  businessHours: jsonb('business_hours'),
  afterHoursMode: text('after_hours_mode').default('TAKE_MESSAGE'),
  pronunciation: text('pronunciation'),
  enabledReasons: jsonb('enabled_reasons').default([]),
  questionsByReason: jsonb('questions_by_reason').default({}),
  targetByReason: jsonb('target_by_reason').default({}),
  busyMode: text('busy_mode').default('TAKE_MESSAGE'),
  teamMembers: jsonb('team_members').default([]),
  setupComplete: boolean('setup_complete').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type FrontDeskSetup = typeof frontDeskSetup.$inferSelect;
export type InsertFrontDeskSetup = typeof frontDeskSetup.$inferInsert;

export const oauthTokens = pgTable('oauth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').notNull().unique(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  realmId: text('realm_id'),
  companyUuid: text('company_uuid'),
  itemId: text('item_id'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type OAuthToken = typeof oauthTokens.$inferSelect;
export type InsertOAuthToken = typeof oauthTokens.$inferInsert;
