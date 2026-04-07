require('dotenv').config();
const nodemailer = require('nodemailer');

const testEmail = async () => {
  console.log('--- SMTP TEST START ---');
  console.log('Host:', process.env.SMTP_HOST);
  console.log('Port:', process.env.SMTP_PORT);
  console.log('User:', process.env.SMTP_USER);
  console.log('From:', process.env.EMAIL_FROM);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    console.log('\nVerifying connection...');
    await transporter.verify();
    console.log('✅ Connection verified successfully!');

    console.log('\nSending test email...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.SMTP_USER.includes('@') ? process.env.SMTP_USER : 'jdeep514@gmail.com', // fallback
      subject: 'Link Scanner Pro - SMTP Test',
      text: 'If you are reading this, your Brevo SMTP configuration is working correctly.',
      html: '<b>Success!</b> Your Brevo SMTP configuration is working correctly.',
    });

    console.log('✅ Test email sent: %s', info.messageId);
    console.log('--- SMTP TEST COMPLETE ---');
  } catch (error) {
    console.error('\n❌ SMTP TEST FAILED:');
    console.error(error.message);
    if (error.response) console.error('Response:', error.response);
    console.log('--- SMTP TEST FAILED ---');
  }
};

testEmail();
