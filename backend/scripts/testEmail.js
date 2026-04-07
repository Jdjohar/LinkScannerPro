require('dotenv').config();
const { sendEmailReport } = require('../src/services/emailService');

const testEmail = async () => {
  console.log('--- RELAY API TEST START ---');
  console.log('Relay URL: https://grithomes.onrender.com/api/send-email');
  console.log('From:', process.env.EMAIL_FROM);
  console.log('Using SMTP Host:', process.env.SMTP_HOST);

  try {
    console.log('\nSending test email via HTTP relay...');
    const result = await sendEmailReport(
      'jashandeep115@gmail.com', // test recipient
      'Link Scanner Pro - Relay API Test',
      '<b>Success!</b> Your Link Scanner Pro is now bypasssing Render SMTP blocks by using an HTTP relay.'
    );

    console.log('✅ Success! Result:', JSON.stringify(result, null, 2));
    console.log('\n--- RELAY API TEST COMPLETE ---');
  } catch (error) {
    console.error('\n❌ RELAY TEST FAILED:');
    console.error(error.message);
    console.log('--- RELAY API TEST FAILED ---');
  }
};

testEmail();
