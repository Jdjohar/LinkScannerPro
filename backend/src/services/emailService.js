const axios = require('axios');

const sendEmailReport = async (to, subject, html, attachments = []) => {
  try {
    // Calling the external relay API via HTTP to bypass Render's SMTP port restrictions.
    const response = await axios.post(process.env.EMAIL_API_URL, {
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT,
      smtpUser: process.env.SMTP_USER,
      smtpPass: process.env.SMTP_PASS,
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: to,
      subject: subject,
      html: html,
      text: "Link Scanner Pro Audit Report - See HTML for details"
    });

    if (response.data && response.data.success) {
      console.log('📬 Email sent via relay: %s', response.data.messageId);
    } else {
      console.log('Email sent via relay (unknown status):', response.data);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Error sending email via relay:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Email relay failed');
  }
};

module.exports = { sendEmailReport };
