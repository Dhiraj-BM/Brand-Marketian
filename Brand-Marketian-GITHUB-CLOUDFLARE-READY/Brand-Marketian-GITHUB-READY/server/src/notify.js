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

  await notifyWhatsApp('New enquiry from ' + lead.name + '. ' + (lead.phone || lead.email));
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
