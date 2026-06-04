import { buffer } from 'micro';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export const config = { api: { bodyParser: false } };

async function sendTelegramMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
}

async function createInviteLink() {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/createChatInviteLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      member_limit: 1,
      expire_date: Math.floor(Date.now() / 1000) + 86400
    })
  });
  const data = await res.json();
  return data.result?.invite_link;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.created') {
    const session = event.data.object;
    const email = session.customer_email || session.customer_details?.email;

    const inviteLink = await createInviteLink();

    await sendTelegramMessage(TELEGRAM_CHAT_ID,
      `🆕 <b>Nuevo suscriptor</b>\n📧 ${email}\n🔗 ${inviteLink}`
    );
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    await sendTelegramMessage(TELEGRAM_CHAT_ID,
      `❌ <b>Baja de suscriptor</b>\n👤 Customer ID: ${subscription.customer}`
    );
  }

  res.status(200).json({ received: true });
}
