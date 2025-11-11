require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// --- Configure providers ---
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// --- Helper: build messages ---
function buildPlainText(body) {
  const {
    firstName, lastName, phone, email, address, jobTypes = [], message = '', submittedAt
  } = body;

  return [
    'New 4G Contractors Lead',
    '------------------------',
    `Name: ${firstName} ${lastName}`,
    `Phone: ${phone}`,
    `Email: ${email}`,
    `Address: ${address}`,
    `Job Types: ${jobTypes.join(', ') || '—'}`,
    `Message:`,
    message || '—',
    '',
    `Submitted: ${submittedAt || new Date().toISOString()}`
  ].join('\n');
}

function buildSms(body) {
  const { firstName, lastName, phone, jobTypes = [] } = body;
  const jobs = jobTypes.length ? `Jobs: ${jobTypes.join(', ')}` : '';
  return `New lead: ${firstName} ${lastName} | ${phone}. ${jobs}`;
}

// --- Basic validation ---
function validate(payload) {
  const errors = [];
  if (!payload.firstName) errors.push('firstName');
  if (!payload.lastName) errors.push('lastName');
  if (!payload.phone) errors.push('phone');
  if (!payload.email) errors.push('email');
  if (!payload.termsAccepted) errors.push('termsAccepted');
  return errors;
}

// --- Route ---
app.post('/api/contact', async (req, res) => {
  try {
    const errors = validate(req.body);
    if (errors.length) {
      return res.status(400).json({ ok: false, errors });
    }

    const textBody = buildPlainText(req.body);
    const smsBody  = buildSms(req.body);

    // Send email
    await sgMail.send({
      to: process.env.EMAIL_TO,           // where you want to receive it
      from: process.env.EMAIL_FROM,       // a verified sender in SendGrid
      subject: 'New 4G Contractors Lead',
      text: textBody
    });

    // Send SMS
    await twilioClient.messages.create({
      to: process.env.SMS_TO,             // your mobile number
      from: process.env.TWILIO_FROM,      // your Twilio number
      body: smsBody
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to send messages' });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
