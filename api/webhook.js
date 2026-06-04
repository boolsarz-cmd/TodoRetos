const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.created') {
    const session = event.data.object;
    const email = session.customer_email || session.customer_details?.email || 'desconocido';

    // Crear enlace único de invitación
    const invRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/createChatInviteLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        member_limit: 1,
        expire_date: Math.floor(Date.now() / 1000) + 86400
      })
    });
    const invData = await invRes.json();
    const inviteLink = invData.result?.invite_link || 'error generando enlace';

    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: `🆕 Nuevo suscriptor\n📧 ${email}\n🔗 ${inviteLink}`,
        parse_mode: 'HTML'
      })
    });
  }

  res.status(200).json({ received: true });
};
