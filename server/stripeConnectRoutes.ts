import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { createTrustSpineReceipt } from './receiptService';
import { logger } from './logger';

const router = Router();

const stripeKey = process.env.STRIPE_CONNECT_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';
const stripe = new Stripe(stripeKey);

const DOMAIN = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';

let connectedAccountId: string | null = null;

// --- Helper: extract suite context from headers ---
function getSuiteContext(req: Request) {
  return {
    suiteId: (req.headers['x-suite-id'] as string) || '',
    officeId: (req.headers['x-office-id'] as string) || undefined,
    actorId: (req.headers['x-actor-id'] as string) || (req.headers['x-user-id'] as string) || 'unknown',
    correlationId: (req.headers['x-correlation-id'] as string) || undefined,
  };
}

// --- Helper: emit receipt for Stripe operations ---
async function emitReceipt(
  req: Request,
  receiptType: string,
  status: 'SUCCEEDED' | 'FAILED' | 'DENIED',
  action: Record<string, unknown>,
  result: Record<string, unknown>,
) {
  const ctx = getSuiteContext(req);
  if (!ctx.suiteId) return; // Can't create receipt without suite_id
  try {
    await createTrustSpineReceipt({
      suiteId: ctx.suiteId,
      officeId: ctx.officeId,
      receiptType,
      status,
      correlationId: ctx.correlationId,
      actorType: 'USER',
      actorId: ctx.actorId,
      action,
      result,
    });
  } catch (err) {
    logger.error('Receipt creation failed', { receiptType, error: err instanceof Error ? err.message : 'unknown' });
  }
}

// ─── Stripe Connect Account Management ───────────────────────────────

router.post('/api/stripe-connect/create-account', async (req: Request, res: Response) => {
  try {
    const { email, business_type, country } = req.body;
    const account = await stripe.accounts.create({
      type: 'express',
      country: country || 'US',
      email: email || undefined,
      business_type: business_type || 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    connectedAccountId = account.id;
    await emitReceipt(req, 'stripe.account.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', country: country || 'US', business_type: business_type || 'individual' },
      { account_id: account.id },
    );
    res.json({ accountId: account.id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Stripe create account error', { error: msg });
    await emitReceipt(req, 'stripe.account.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

router.post('/api/stripe-connect/account-link', async (req: Request, res: Response) => {
  try {
    const accountId = req.body.account_id || connectedAccountId;
    if (!accountId) {
      return res.status(400).json({ error: 'No connected account. Create one first.' });
    }
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `https://${DOMAIN}/finance-hub/connections?stripe=refresh`,
      return_url: `https://${DOMAIN}/finance-hub/connections?stripe=connected`,
      type: 'account_onboarding',
    });
    await emitReceipt(req, 'stripe.account_link.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', account_id: accountId },
      { url_generated: true },
    );
    res.json({ url: accountLink.url });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Stripe account link error', { error: msg });
    await emitReceipt(req, 'stripe.account_link.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

router.get('/api/stripe-connect/authorize', async (req: Request, res: Response) => {
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    connectedAccountId = account.id;

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `https://${DOMAIN}/finance-hub/connections?stripe=refresh`,
      return_url: `https://${DOMAIN}/finance-hub/connections?stripe=connected`,
      type: 'account_onboarding',
    });
    await emitReceipt(req, 'stripe.authorize', 'SUCCEEDED',
      { method: 'GET', path: req.path, risk_tier: 'YELLOW' },
      { account_id: account.id },
    );
    res.json({ url: accountLink.url });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Stripe Connect authorize error', { error: msg });
    await emitReceipt(req, 'stripe.authorize', 'FAILED',
      { method: 'GET', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

router.get('/api/stripe-connect/status', async (_req: Request, res: Response) => {
  try {
    if (!connectedAccountId) {
      return res.json({ connected: false, accountId: null });
    }
    const account = await stripe.accounts.retrieve(connectedAccountId);
    res.json({
      connected: true,
      accountId: connectedAccountId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch {
    connectedAccountId = null;
    res.json({ connected: false, accountId: null });
  }
});

router.post('/api/stripe-connect/disconnect', async (req: Request, res: Response) => {
  const oldId = connectedAccountId;
  connectedAccountId = null;
  await emitReceipt(req, 'stripe.account.disconnect', 'SUCCEEDED',
    { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
    { disconnected_account_id: oldId },
  );
  res.json({ success: true });
});

router.get('/api/stripe-connect/account', async (_req: Request, res: Response) => {
  try {
    if (!connectedAccountId) {
      return res.status(400).json({ error: 'No connected account' });
    }
    const account = await stripe.accounts.retrieve(connectedAccountId);
    res.json(account);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.post('/api/stripe-connect/login-link', async (req: Request, res: Response) => {
  try {
    if (!connectedAccountId) {
      return res.status(400).json({ error: 'No connected account' });
    }
    const loginLink = await stripe.accounts.createLoginLink(connectedAccountId);
    res.json({ url: loginLink.url });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Stripe login link error', { error: msg });
    res.status(500).json({ error: msg });
  }
});

// ─── Invoices ────────────────────────────────────────────────────────

router.get('/api/stripe/invoices', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const status = req.query.status as string;
    const params: Stripe.InvoiceListParams = { limit };
    if (status && ['draft', 'open', 'paid', 'uncollectible', 'void'].includes(status)) {
      params.status = status as Stripe.InvoiceListParams['status'];
    }
    const invoices = await stripe.invoices.list(params);
    res.json({ invoices: invoices.data, has_more: invoices.has_more });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Stripe invoices error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.get('/api/stripe/invoices/summary', async (_req: Request, res: Response) => {
  try {
    const [draft, open, paid, voidInv] = await Promise.all([
      stripe.invoices.list({ status: 'draft', limit: 100 }),
      stripe.invoices.list({ status: 'open', limit: 100 }),
      stripe.invoices.list({ status: 'paid', limit: 100 }),
      stripe.invoices.list({ status: 'void', limit: 100 }),
    ]);

    const openTotal = open.data.reduce((s, i) => s + (i.amount_due || 0), 0);
    const paidTotal = paid.data.reduce((s, i) => s + (i.amount_paid || 0), 0);
    const draftTotal = draft.data.reduce((s, i) => s + (i.amount_due || 0), 0);

    const now = Math.floor(Date.now() / 1000);
    const overdueInvoices = open.data.filter(i => i.due_date && i.due_date < now);
    const overdueTotal = overdueInvoices.reduce((s, i) => s + (i.amount_due || 0), 0);

    const paidInvoicesWithDates = paid.data.filter(i => i.status_transitions?.paid_at && i.created);
    const avgPaymentDays = paidInvoicesWithDates.length > 0
      ? Math.round(paidInvoicesWithDates.reduce((s, i) => {
          const paidAt = i.status_transitions?.paid_at || 0;
          return s + (paidAt - i.created) / 86400;
        }, 0) / paidInvoicesWithDates.length)
      : 0;

    res.json({
      outstanding: { count: open.data.length, total: openTotal / 100 },
      overdue: { count: overdueInvoices.length, total: overdueTotal / 100 },
      paid_30d: { count: paid.data.length, total: paidTotal / 100 },
      draft: { count: draft.data.length, total: draftTotal / 100 },
      void: { count: voidInv.data.length },
      avg_payment_days: avgPaymentDays,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Invoice summary error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch invoice summary' });
  }
});

router.get('/api/stripe/invoices/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const invoice = await stripe.invoices.retrieve(id);
    res.json(invoice);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

router.post('/api/stripe/invoices', async (req: Request, res: Response) => {
  try {
    const { customer_id, items, due_days, memo } = req.body;

    let customerId = customer_id;
    if (!customerId && req.body.customer_email) {
      const customer = await stripe.customers.create({
        email: req.body.customer_email,
        name: req.body.customer_name || undefined,
      });
      customerId = customer.id;
    }

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID or email required' });
    }

    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: due_days || 30,
      description: memo || undefined,
      auto_advance: false,
    });

    if (items && items.length > 0) {
      for (const item of items) {
        await stripe.invoiceItems.create({
          customer: customerId,
          invoice: invoice.id,
          description: item.description,
          amount: Math.round(item.amount * 100),
          currency: 'usd',
        });
      }
    }

    const finalInvoice = await stripe.invoices.retrieve(invoice.id);
    await emitReceipt(req, 'stripe.invoice.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', customer_id: customerId, item_count: items?.length || 0 },
      { invoice_id: invoice.id, amount_due: finalInvoice.amount_due },
    );
    res.json(finalInvoice);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Create invoice error', { error: msg });
    await emitReceipt(req, 'stripe.invoice.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

router.post('/api/stripe/invoices/:id/send', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const invoice = await stripe.invoices.sendInvoice(id);
    await emitReceipt(req, 'stripe.invoice.send', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', invoice_id: id },
      { status: invoice.status },
    );
    res.json(invoice);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await emitReceipt(req, 'stripe.invoice.send', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', invoice_id: req.params.id },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

router.post('/api/stripe/invoices/:id/finalize', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const invoice = await stripe.invoices.finalizeInvoice(id);
    await emitReceipt(req, 'stripe.invoice.finalize', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', invoice_id: id },
      { status: invoice.status },
    );
    res.json(invoice);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await emitReceipt(req, 'stripe.invoice.finalize', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', invoice_id: req.params.id },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

router.post('/api/stripe/invoices/:id/void', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const invoice = await stripe.invoices.voidInvoice(id);
    await emitReceipt(req, 'stripe.invoice.void', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'RED', invoice_id: id },
      { status: invoice.status },
    );
    res.json(invoice);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await emitReceipt(req, 'stripe.invoice.void', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'RED', invoice_id: req.params.id },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

router.delete('/api/stripe/invoices/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await stripe.invoices.del(id);
    await emitReceipt(req, 'stripe.invoice.delete', 'SUCCEEDED',
      { method: 'DELETE', path: req.path, risk_tier: 'RED', invoice_id: id },
      { deleted: true },
    );
    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await emitReceipt(req, 'stripe.invoice.delete', 'FAILED',
      { method: 'DELETE', path: req.path, risk_tier: 'RED', invoice_id: req.params.id },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

// ─── Quotes ──────────────────────────────────────────────────────────

router.get('/api/stripe/quotes', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const status = req.query.status as string;
    const params: Stripe.QuoteListParams = { limit };
    if (status) params.status = status as Stripe.QuoteListParams['status'];
    const quotes = await stripe.quotes.list(params);
    res.json({ quotes: quotes.data, has_more: quotes.has_more });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Stripe quotes error', { error: msg });
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

router.post('/api/stripe/quotes', async (req: Request, res: Response) => {
  try {
    const { customer_id, line_items, description, expires_at, header, footer } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'Customer ID required' });

    const quoteParams: Stripe.QuoteCreateParams = {
      customer: customer_id,
      description: description || undefined,
      header: header || undefined,
      footer: footer || undefined,
    };

    if (expires_at) {
      quoteParams.expires_at = Math.floor(new Date(expires_at).getTime() / 1000);
    }

    const quote = await stripe.quotes.create(quoteParams);

    if (line_items && line_items.length > 0) {
      for (const item of line_items) {
        const price = await stripe.prices.create({
          product_data: { name: item.description || 'Service' },
          unit_amount: Math.round(item.amount * 100),
          currency: 'usd',
        });
        await stripe.quotes.update(quote.id, {
          line_items: [{ price: price.id, quantity: item.quantity || 1 }],
        });
      }
    }

    const finalQuote = await stripe.quotes.retrieve(quote.id);
    await emitReceipt(req, 'stripe.quote.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', customer_id, item_count: line_items?.length || 0 },
      { quote_id: quote.id },
    );
    res.json(finalQuote);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Create quote error', { error: msg });
    await emitReceipt(req, 'stripe.quote.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

router.post('/api/stripe/quotes/:id/finalize', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const quote = await stripe.quotes.finalizeQuote(id);
    await emitReceipt(req, 'stripe.quote.finalize', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', quote_id: id },
      { status: quote.status },
    );
    res.json(quote);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await emitReceipt(req, 'stripe.quote.finalize', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', quote_id: req.params.id },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

router.post('/api/stripe/quotes/:id/accept', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const quote = await stripe.quotes.accept(id);
    await emitReceipt(req, 'stripe.quote.accept', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'RED', quote_id: id },
      { status: quote.status },
    );
    res.json(quote);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await emitReceipt(req, 'stripe.quote.accept', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'RED', quote_id: req.params.id },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

router.post('/api/stripe/quotes/:id/cancel', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const quote = await stripe.quotes.cancel(id);
    await emitReceipt(req, 'stripe.quote.cancel', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', quote_id: id },
      { status: quote.status },
    );
    res.json(quote);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await emitReceipt(req, 'stripe.quote.cancel', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', quote_id: req.params.id },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

router.get('/api/stripe/quotes/:id/pdf', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const pdf = await stripe.quotes.pdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=quote-${id}.pdf`);
    const chunks: Buffer[] = [];
    for await (const chunk of pdf as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    res.send(Buffer.concat(chunks));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// ─── Customers ───────────────────────────────────────────────────────

router.get('/api/stripe/customers', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const customers = await stripe.customers.list({ limit });
    res.json({ customers: customers.data, has_more: customers.has_more });
  } catch {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.get('/api/stripe/customers/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const customer = await stripe.customers.retrieve(id);
    res.json(customer);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.post('/api/stripe/customers', async (req: Request, res: Response) => {
  try {
    const { email, name, phone, description, address } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const customer = await stripe.customers.create({
      email, name, phone, description,
      address: address || undefined,
    });
    await emitReceipt(req, 'stripe.customer.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { customer_id: customer.id },
    );
    res.json(customer);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await emitReceipt(req, 'stripe.customer.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

router.put('/api/stripe/customers/:id', async (req: Request, res: Response) => {
  try {
    const { email, name, phone, description, address } = req.body;
    const id = req.params.id as string;
    const customer = await stripe.customers.update(id, {
      email, name, phone, description,
      address: address || undefined,
    });
    await emitReceipt(req, 'stripe.customer.update', 'SUCCEEDED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', customer_id: id },
      { updated: true },
    );
    res.json(customer);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await emitReceipt(req, 'stripe.customer.update', 'FAILED',
      { method: 'PUT', path: req.path, risk_tier: 'YELLOW', customer_id: req.params.id },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

router.delete('/api/stripe/customers/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await stripe.customers.del(id);
    await emitReceipt(req, 'stripe.customer.delete', 'SUCCEEDED',
      { method: 'DELETE', path: req.path, risk_tier: 'RED', customer_id: id },
      { deleted: true },
    );
    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await emitReceipt(req, 'stripe.customer.delete', 'FAILED',
      { method: 'DELETE', path: req.path, risk_tier: 'RED', customer_id: req.params.id },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

// ─── Payments & Balance (read-only, no receipts needed) ──────────────

router.get('/api/stripe/payment-intents', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const paymentIntents = await stripe.paymentIntents.list({ limit });
    res.json({ payments: paymentIntents.data, has_more: paymentIntents.has_more });
  } catch {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

router.get('/api/stripe/charges', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const charges = await stripe.charges.list({ limit });
    res.json({ charges: charges.data, has_more: charges.has_more });
  } catch {
    res.status(500).json({ error: 'Failed to fetch charges' });
  }
});

router.get('/api/stripe/balance', async (_req: Request, res: Response) => {
  try {
    const balance = await stripe.balance.retrieve();
    res.json(balance);
  } catch {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

router.get('/api/stripe/balance-transactions', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const transactions = await stripe.balanceTransactions.list({ limit });
    res.json({ transactions: transactions.data, has_more: transactions.has_more });
  } catch {
    res.status(500).json({ error: 'Failed to fetch balance transactions' });
  }
});

router.get('/api/stripe/products', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const products = await stripe.products.list({ limit, active: true });
    res.json({ products: products.data, has_more: products.has_more });
  } catch {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/api/stripe/subscriptions', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const subscriptions = await stripe.subscriptions.list({ limit });
    res.json({ subscriptions: subscriptions.data, has_more: subscriptions.has_more });
  } catch {
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

router.post('/api/stripe/payment-links', async (req: Request, res: Response) => {
  try {
    const { name, amount, description } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount required' });

    const product = await stripe.products.create({
      name: name || 'Payment',
      description: description || undefined,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(amount * 100),
      currency: 'usd',
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
    });

    await emitReceipt(req, 'stripe.payment_link.create', 'SUCCEEDED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW', amount },
      { payment_link_id: paymentLink.id, url: paymentLink.url },
    );
    res.json(paymentLink);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await emitReceipt(req, 'stripe.payment_link.create', 'FAILED',
      { method: 'POST', path: req.path, risk_tier: 'YELLOW' },
      { error: msg },
    );
    res.status(500).json({ error: msg });
  }
});

export default router;
