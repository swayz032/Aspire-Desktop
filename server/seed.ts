import { db } from './db';
import { sql } from 'drizzle-orm';

async function seed() {
  console.log('Seeding database...');

  const demoUserId = '00000000-0000-0000-0000-000000000001';
  
  await db.execute(sql`
    INSERT INTO users (id, email, name, business_name, booking_slug)
    VALUES (${demoUserId}, 'demo@zenith.com', 'Scott Thompson', 'Zenith Solutions', 'zenith-solutions')
    ON CONFLICT (id) DO UPDATE SET 
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      business_name = EXCLUDED.business_name,
      booking_slug = EXCLUDED.booking_slug
  `);
  console.log('Created demo user');

  await db.execute(sql`
    INSERT INTO services (id, user_id, name, description, duration, price, currency, color, is_active)
    VALUES 
      ('10000000-0000-0000-0000-000000000001', ${demoUserId}, 'Strategy Consultation', 'Deep dive into your business strategy and growth opportunities', 60, 15000, 'usd', '#4facfe', true),
      ('10000000-0000-0000-0000-000000000002', ${demoUserId}, 'Quick Call', 'Short check-in or quick question session', 15, 0, 'usd', '#34c759', true),
      ('10000000-0000-0000-0000-000000000003', ${demoUserId}, 'Operations Review', 'Review your current operations and identify improvements', 45, 10000, 'usd', '#f59e0b', true)
    ON CONFLICT (id) DO NOTHING
  `);
  console.log('Created demo services');

  await db.execute(sql`
    INSERT INTO availability (id, user_id, day_of_week, start_time, end_time, is_active)
    VALUES 
      ('20000000-0000-0000-0000-000000000001', ${demoUserId}, 1, '09:00', '17:00', true),
      ('20000000-0000-0000-0000-000000000002', ${demoUserId}, 2, '09:00', '17:00', true),
      ('20000000-0000-0000-0000-000000000003', ${demoUserId}, 3, '09:00', '17:00', true),
      ('20000000-0000-0000-0000-000000000004', ${demoUserId}, 4, '09:00', '17:00', true),
      ('20000000-0000-0000-0000-000000000005', ${demoUserId}, 5, '09:00', '12:00', true)
    ON CONFLICT (id) DO NOTHING
  `);
  console.log('Created demo availability');

  await db.execute(sql`
    INSERT INTO buffer_settings (id, user_id, before_buffer, after_buffer, minimum_notice, max_advance_booking)
    VALUES ('30000000-0000-0000-0000-000000000001', ${demoUserId}, 0, 15, 60, 30)
    ON CONFLICT (user_id) DO NOTHING
  `);
  console.log('Created buffer settings');

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch(console.error);
