import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { db } from './db';
import { suiteProfiles, services, availability, bookings, bufferSettings, frontDeskSetup } from './schema';
import type { SuiteProfile, InsertSuiteProfile, Service, InsertService, Availability, InsertAvailability, Booking, InsertBooking, BufferSettings, InsertBufferSettings, FrontDeskSetup, InsertFrontDeskSetup } from './schema';

export class Storage {
  async getSuiteProfile(suiteId: string): Promise<SuiteProfile | undefined> {
    const [profile] = await db.select().from(suiteProfiles).where(eq(suiteProfiles.suiteId, suiteId));
    return profile;
  }

  async getSuiteProfileByEmail(email: string): Promise<SuiteProfile | undefined> {
    const [profile] = await db.select().from(suiteProfiles).where(eq(suiteProfiles.email, email));
    return profile;
  }

  async getSuiteProfileBySlug(slug: string): Promise<SuiteProfile | undefined> {
    const [profile] = await db.select().from(suiteProfiles).where(eq(suiteProfiles.bookingSlug, slug));
    return profile;
  }

  async createSuiteProfile(data: InsertSuiteProfile): Promise<SuiteProfile> {
    const [profile] = await db.insert(suiteProfiles).values(data).returning();
    return profile;
  }

  async updateSuiteProfile(suiteId: string, data: Partial<InsertSuiteProfile>): Promise<SuiteProfile | undefined> {
    const [profile] = await db.update(suiteProfiles).set({ ...data, updatedAt: new Date() }).where(eq(suiteProfiles.suiteId, suiteId)).returning();
    return profile;
  }

  async getServices(suiteId: string): Promise<Service[]> {
    return db.select().from(services).where(eq(services.suiteId, suiteId));
  }

  async getService(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async getActiveServices(suiteId: string): Promise<Service[]> {
    return db.select().from(services).where(and(eq(services.suiteId, suiteId), eq(services.isActive, true)));
  }

  async createService(data: InsertService): Promise<Service> {
    const [service] = await db.insert(services).values(data).returning();
    return service;
  }

  async updateService(id: string, data: Partial<InsertService>): Promise<Service | undefined> {
    const [service] = await db.update(services).set({ ...data, updatedAt: new Date() }).where(eq(services.id, id)).returning();
    return service;
  }

  async deleteService(id: string): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  async getAvailability(suiteId: string): Promise<Availability[]> {
    return db.select().from(availability).where(eq(availability.suiteId, suiteId));
  }

  async setAvailability(suiteId: string, slots: InsertAvailability[]): Promise<Availability[]> {
    await db.delete(availability).where(eq(availability.suiteId, suiteId));
    if (slots.length === 0) return [];
    const result = await db.insert(availability).values(slots).returning();
    return result;
  }

  async getBookings(suiteId: string): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.suiteId, suiteId)).orderBy(desc(bookings.scheduledAt));
  }

  async getUpcomingBookings(suiteId: string): Promise<Booking[]> {
    return db.select().from(bookings)
      .where(and(
        eq(bookings.suiteId, suiteId),
        gte(bookings.scheduledAt, new Date()),
        eq(bookings.status, 'confirmed')
      ))
      .orderBy(bookings.scheduledAt);
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async getBookingsByDate(suiteId: string, date: Date): Promise<Booking[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return db.select().from(bookings)
      .where(and(
        eq(bookings.suiteId, suiteId),
        gte(bookings.scheduledAt, startOfDay),
        lte(bookings.scheduledAt, endOfDay)
      ))
      .orderBy(bookings.scheduledAt);
  }

  async createBooking(data: InsertBooking): Promise<Booking> {
    const [booking] = await db.insert(bookings).values(data).returning();
    return booking;
  }

  async updateBooking(id: string, data: Partial<InsertBooking>): Promise<Booking | undefined> {
    const [booking] = await db.update(bookings).set({ ...data, updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
    return booking;
  }

  async cancelBooking(id: string, reason?: string): Promise<Booking | undefined> {
    const [booking] = await db.update(bookings)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: reason,
        updatedAt: new Date()
      })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async getBufferSettings(suiteId: string): Promise<BufferSettings | undefined> {
    const [settings] = await db.select().from(bufferSettings).where(eq(bufferSettings.suiteId, suiteId));
    return settings;
  }

  async upsertBufferSettings(suiteId: string, data: Partial<InsertBufferSettings>): Promise<BufferSettings> {
    const existing = await this.getBufferSettings(suiteId);
    if (existing) {
      const [updated] = await db.update(bufferSettings).set(data).where(eq(bufferSettings.suiteId, suiteId)).returning();
      return updated;
    }
    const [created] = await db.insert(bufferSettings).values({ suiteId, ...data }).returning();
    return created;
  }

  async getBookingStats(suiteId: string): Promise<{ total: number; upcoming: number; revenue: number }> {
    const allBookings = await this.getBookings(suiteId);
    const upcoming = allBookings.filter(b => new Date(b.scheduledAt) > new Date() && b.status === 'confirmed');
    const paidBookings = allBookings.filter(b => b.paymentStatus === 'paid');
    const revenue = paidBookings.reduce((sum, b) => sum + b.amount, 0);
    return { total: allBookings.length, upcoming: upcoming.length, revenue };
  }

  async getFrontDeskSetup(suiteId: string): Promise<FrontDeskSetup | undefined> {
    const [setup] = await db.select().from(frontDeskSetup).where(eq(frontDeskSetup.suiteId, suiteId));
    return setup;
  }

  async upsertFrontDeskSetup(suiteId: string, data: Partial<InsertFrontDeskSetup>): Promise<FrontDeskSetup> {
    const existing = await this.getFrontDeskSetup(suiteId);
    if (existing) {
      const [updated] = await db.update(frontDeskSetup)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(frontDeskSetup.suiteId, suiteId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(frontDeskSetup)
        .values({ ...data, suiteId })
        .returning();
      return created;
    }
  }
}

export const storage = new Storage();
