import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { db } from './db';
import { users, services, availability, bookings, bufferSettings, frontDeskSetup } from './schema';
import type { User, InsertUser, Service, InsertService, Availability, InsertAvailability, Booking, InsertBooking, BufferSettings, InsertBufferSettings, FrontDeskSetup, InsertFrontDeskSetup } from './schema';

export class Storage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserBySlug(slug: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.bookingSlug, slug));
    return user;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return user;
  }

  async getServices(userId: string): Promise<Service[]> {
    return db.select().from(services).where(eq(services.userId, userId));
  }

  async getService(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async getActiveServices(userId: string): Promise<Service[]> {
    return db.select().from(services).where(and(eq(services.userId, userId), eq(services.isActive, true)));
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

  async getAvailability(userId: string): Promise<Availability[]> {
    return db.select().from(availability).where(eq(availability.userId, userId));
  }

  async setAvailability(userId: string, slots: InsertAvailability[]): Promise<Availability[]> {
    await db.delete(availability).where(eq(availability.userId, userId));
    if (slots.length === 0) return [];
    const result = await db.insert(availability).values(slots).returning();
    return result;
  }

  async getBookings(userId: string): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.userId, userId)).orderBy(desc(bookings.scheduledAt));
  }

  async getUpcomingBookings(userId: string): Promise<Booking[]> {
    return db.select().from(bookings)
      .where(and(
        eq(bookings.userId, userId),
        gte(bookings.scheduledAt, new Date()),
        eq(bookings.status, 'confirmed')
      ))
      .orderBy(bookings.scheduledAt);
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async getBookingsByDate(userId: string, date: Date): Promise<Booking[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return db.select().from(bookings)
      .where(and(
        eq(bookings.userId, userId),
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

  async getBufferSettings(userId: string): Promise<BufferSettings | undefined> {
    const [settings] = await db.select().from(bufferSettings).where(eq(bufferSettings.userId, userId));
    return settings;
  }

  async upsertBufferSettings(userId: string, data: Partial<InsertBufferSettings>): Promise<BufferSettings> {
    const existing = await this.getBufferSettings(userId);
    if (existing) {
      const [updated] = await db.update(bufferSettings).set(data).where(eq(bufferSettings.userId, userId)).returning();
      return updated;
    }
    const [created] = await db.insert(bufferSettings).values({ userId, ...data }).returning();
    return created;
  }

  async getBookingStats(userId: string): Promise<{ total: number; upcoming: number; revenue: number }> {
    const allBookings = await this.getBookings(userId);
    const upcoming = allBookings.filter(b => new Date(b.scheduledAt) > new Date() && b.status === 'confirmed');
    const paidBookings = allBookings.filter(b => b.paymentStatus === 'paid');
    const revenue = paidBookings.reduce((sum, b) => sum + b.amount, 0);
    return { total: allBookings.length, upcoming: upcoming.length, revenue };
  }

  async getFrontDeskSetup(userId: string): Promise<FrontDeskSetup | undefined> {
    const [setup] = await db.select().from(frontDeskSetup).where(eq(frontDeskSetup.userId, userId));
    return setup;
  }

  async upsertFrontDeskSetup(userId: string, data: Partial<InsertFrontDeskSetup>): Promise<FrontDeskSetup> {
    const existing = await this.getFrontDeskSetup(userId);
    if (existing) {
      const [updated] = await db.update(frontDeskSetup)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(frontDeskSetup.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(frontDeskSetup)
        .values({ ...data, userId })
        .returning();
      return created;
    }
  }
}

export const storage = new Storage();
