import nodemailer from 'nodemailer';
import { config } from './config.js';

let transport = null;
function mailer() {
  if (transport || !config.smtp.host || !config.smtp.user) return transport;
  transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass }
  });
  return transport;
}

export async function notifyLead(lead) {
  const lines = [
    'Name: ' + lead.name,
    'Email: ' + lead.email,
    'Phone: ' + (lead.phone || 'not given'),
    'Company: ' + (lead.company || 'not given'),
    'Services: ' + (lead.services || []).join(', '),
    'Budget: ' + (lead.budget || 'not given'),
    'Segment: ' + lead.segment,
    'Page: ' + (lead.page || '/'),
    '',
    lead.message || ''
  ].join('\n');

  const t = mailer();
  if (t) {
    await t.sendMail({
      from: config.smtp.user,
      to: config.smtp.notifyTo,
      replyTo: lead.email,
      subject: 'New enquiry: ' + lead.name + (lead.company ? ' (' + lead.company + ')' : ''),
      text: lines
    }).catch(e => console.error('[mail]', e.message));
  } else {
    console.log('[mail skipped]\n' + lines);
  }

  const waText = [
    '🟠 New enquiry — Brand Marketian',
    'Name: ' + lead.name,
    'Phone: ' + (lead.phone || '-'),
    'Email: ' + lead.email,
    'Company: ' + (lead.company || '-'),
    'Services: ' + (lead.services || []).join(', '),
    'Budget: ' + (lead.budget || '-')
  ].join('\n');

  // Fire all configured channels; each is a no-op unless its env vars are set.
  await Promise.allSettled([
    notifyWhatsApp(waText),           // WhatsApp Cloud API (Meta)
    notifyWhatsAppCallMeBot(waText),  // WhatsApp via CallMeBot (simple, free)
    notifySheet(lead)                 // Google Sheet row (via Apps Script webhook)
  ]);
}

// Appends the lead as a row in a Google Sheet through an Apps Script Web App URL.
export async function notifySheet(lead) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        at: new Date().toISOString(),
        name: lead.name,
        phone: lead.phone || '',
        email: lead.email,
        company: lead.company || '',
        services: (lead.services || []).join(', '),
        budget: lead.budget || '',
        message: lead.message || '',
        page: lead.page || '',
        segment: lead.segment || ''
      })
    });
  } catch (e) {
    console.error('[sheet]', e.message);
  }
}

// Sends a WhatsApp message to yourself via CallMeBot (no Meta setup needed).
export async function notifyWhatsAppCallMeBot(text) {
  const phone = process.env.WA_CALLMEBOT_PHONE;
  const apikey = process.env.WA_CALLMEBOT_APIKEY;
  if (!phone || !apikey) return;
  try {
    const u = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(phone) +
      '&text=' + encodeURIComponent(text) + '&apikey=' + encodeURIComponent(apikey);
    await fetch(u);
  } catch (e) {
    console.error('[callmebot]', e.message);
  }
}

export async function notifyWhatsApp(text) {
  const { phoneId, token, to } = config.whatsapp;
  if (!phoneId || !token || !to) return;
  try {
    await fetch('https://graph.facebook.com/v20.0/' + phoneId + '/messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } })
    });
  } catch (e) {
    console.error('[whatsapp]', e.message);
  }
}
