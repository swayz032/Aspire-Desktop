import { db } from './db';
import { sql } from 'drizzle-orm';

async function seed() {
  console.log('Seeding database...');

  // Create demo suite via Trust Spine's ensure_suite function
  const suiteResult = await db.execute(sql`
    SELECT app.ensure_suite('demo-tenant', 'Aspire Demo') AS suite_id
  `);
  const rows = (suiteResult.rows || suiteResult) as any[];
  const demoSuiteId = rows[0].suite_id;
  console.log(`Demo suite created: ${demoSuiteId}`);

  // Create demo office
  await db.execute(sql`
    INSERT INTO app.offices (suite_id, label)
    VALUES (${demoSuiteId}, 'Main Office')
    ON CONFLICT DO NOTHING
  `);
  console.log('Demo office created');

  // Create suite profile (business profile)
  await db.execute(sql`
    INSERT INTO suite_profiles (suite_id, email, name, business_name, booking_slug)
    VALUES (${demoSuiteId}, 'demo@aspire.com', 'Scott Thompson', 'Aspire Demo', 'aspire-demo')
    ON CONFLICT (suite_id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      business_name = EXCLUDED.business_name,
      booking_slug = EXCLUDED.booking_slug
  `);
  console.log('Created demo suite profile');

  // Create demo services
  await db.execute(sql`
    INSERT INTO services (id, suite_id, name, description, duration, price, currency, color, is_active)
    VALUES
      ('10000000-0000-0000-0000-000000000001', ${demoSuiteId}, 'Strategy Consultation', 'Deep dive into your business strategy and growth opportunities', 60, 15000, 'usd', '#4facfe', true),
      ('10000000-0000-0000-0000-000000000002', ${demoSuiteId}, 'Quick Call', 'Short check-in or quick question session', 15, 0, 'usd', '#34c759', true),
      ('10000000-0000-0000-0000-000000000003', ${demoSuiteId}, 'Operations Review', 'Review your current operations and identify improvements', 45, 10000, 'usd', '#f59e0b', true)
    ON CONFLICT (id) DO NOTHING
  `);
  console.log('Created demo services');

  // Set RLS context for availability and buffer_settings inserts
  await db.execute(sql`SELECT set_config('app.current_suite_id', ${demoSuiteId}, true)`);

  await db.execute(sql`
    INSERT INTO availability (id, suite_id, day_of_week, start_time, end_time, is_active)
    VALUES
      ('20000000-0000-0000-0000-000000000001', ${demoSuiteId}, 1, '09:00', '17:00', true),
      ('20000000-0000-0000-0000-000000000002', ${demoSuiteId}, 2, '09:00', '17:00', true),
      ('20000000-0000-0000-0000-000000000003', ${demoSuiteId}, 3, '09:00', '17:00', true),
      ('20000000-0000-0000-0000-000000000004', ${demoSuiteId}, 4, '09:00', '17:00', true),
      ('20000000-0000-0000-0000-000000000005', ${demoSuiteId}, 5, '09:00', '12:00', true)
    ON CONFLICT (id) DO NOTHING
  `);
  console.log('Created demo availability');

  await db.execute(sql`
    INSERT INTO buffer_settings (id, suite_id, before_buffer, after_buffer, minimum_notice, max_advance_booking)
    VALUES ('30000000-0000-0000-0000-000000000001', ${demoSuiteId}, 0, 15, 60, 30)
    ON CONFLICT (suite_id) DO NOTHING
  `);
  console.log('Created buffer settings');

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch(console.error);
