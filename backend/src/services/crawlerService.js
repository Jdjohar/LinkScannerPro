const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const robotsParser = require('robots-parser');
const Domain = require('../models/Domain');
const ScanReport = require('../models/ScanReport');
const { sendEmailReport } = require('./emailService');
const { getIO } = require('../socket');

// Configure axios defaults
axios.defaults.timeout = 15000;
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Normalizes and validates a URL
 */
const normalizeUrl = (baseUrl, targetUrl) => {
  if (!targetUrl || targetUrl === 'undefined' || targetUrl === 'null' || targetUrl === '#' || targetUrl.startsWith('javascript:')) {
    return null;
  }
  try {
    const url = new URL(targetUrl, baseUrl);
    // Exclude non-web schemes like mailto, tel, etc.
    if (url.protocol && !['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    url.hash = '';
    return url.toString();
  } catch (e) {
    return null;
  }
};

/**
 * Checks robots.txt for a domain
 */
const getRobotsChecker = async (baseUrl) => {
  try {
    const rootUrl = new URL('/', baseUrl).toString();
    const response = await axios.get(`${rootUrl}robots.txt`, { validateStatus: () => true });
    if (response.status === 200) {
      return robotsParser(`${rootUrl}robots.txt`, response.data);
    }
  } catch (e) {
    // Ignore errors, assume allowed if robots.txt unreachable
  }
  return { isAllowed: () => true };
};

/**
 * Checks for Soft 404 content
 */
const isSoft404 = (html) => {
  const soft404Patterns = [
    /page not found/i,
    /404 not found/i,
    /could not find the page/i,
    /sorry, that page doesn't exist/i,
    /this page has been moved or deleted/i,
  ];
  return soft404Patterns.some(pattern => pattern.test(html));
};

/**
 * Advanced Link Checker with Redirect Tracking and Soft 404 detection
 */
const checkLink = async (url, retries = 2, backoff = 1500) => {
  for (let i = 0; i <= retries; i++) {
    try {
      // Mimic a full browser request to avoid 400/403 on social sites
      const response = await axios.get(url, {
        validateStatus: () => true,
        maxRedirects: 8,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Referer': new URL(url).origin, // Some sites require Referer
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        }
      });

      // Special handling for Social Sites that return 400/403/999 but might be OK
      const isSocial = /facebook|linkedin|twitter|instagram|youtube/.test(url);

      // Handle Rate Limiting (429)
      if (response.status === 429 && i < retries) {
        await sleep(backoff * Math.pow(2, i));
        continue;
      }

      const redirectCount = response.request?._redirectable?._redirectCount || 0;
      let isBroken = response.status >= 400 && response.status !== 429;

      // If we got a 400/403 on a social site, but it's external, try a simple HEAD as a fallback
      if (isBroken && isSocial && (response.status === 400 || response.status === 403 || response.status === 999)) {
        isBroken = false; 
      }

      // Check for Soft 404
      if (response.status === 200 && typeof response.data === 'string' && isSoft404(response.data)) {
        return { statusCode: response.status, isBroken: true, type: 'Soft 404', redirectCount };
      }

      return {
        statusCode: response.status,
        isBroken: isBroken || redirectCount > 8,
        type: redirectCount > 8 ? 'Redirect Loop' : (isBroken ? 'Broken' : 'OK'),
        redirectCount,
      };
    } catch (error) {
      if (i === retries) {
        return {
          statusCode: error.response ? error.response.status : 0,
          isBroken: true,
          type: 'Timeout/Network Error',
        };
      }
      await sleep(backoff);
    }
  }
};

/**
 * Enhanced Crawler Engine
 */
const crawl = async (domainId, startUrl, maxDepth = 3, maxPages = 200) => {
  const visited = new Set();
  const checkedLinks = new Map();
  const queue = [{ url: startUrl, depth: 0 }];
  const brokenLinks = [];
  const reportedBrokenUrls = new Set(); // To prevent duplicate URLs in the report
  let pagesProcessed = 0;
  const baseUrlObj = new URL(startUrl);
  const startTime = Date.now();
  const io = getIO();

  console.log(`Starting Advanced Scan for ${startUrl}...`);
  const robots = await getRobotsChecker(startUrl);

  while (queue.length > 0 && pagesProcessed < maxPages) {
    const { url, depth } = queue.shift();

    if (visited.has(url)) continue;
    if (!robots.isAllowed(url, axios.defaults.headers.common['User-Agent'])) {
      console.log(`Blocked by robots.txt: ${url}`);
      continue;
    }

    visited.add(url);
    pagesProcessed++;

    try {
      await sleep(500); // Politeness delay

      const response = await axios.get(url, { timeout: 10000 });
      if (response.status !== 200) continue;

      const $ = cheerio.load(response.data);
      const linksToCheck = [];

      // 1. Links <a>
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim() || 'No Text';
        const absoluteUrl = normalizeUrl(url, href);
        if (absoluteUrl && !absoluteUrl.startsWith('javascript:')) {
          linksToCheck.push({ url: absoluteUrl, text, type: 'link', sourcePage: url });
        }
      });

      // 2. Images <img>
      $('img').each((i, el) => {
        const src = $(el).attr('src');
        const alt = $(el).attr('alt') || 'No Alt Text';
        const absoluteUrl = normalizeUrl(url, src);
        if (absoluteUrl) linksToCheck.push({ url: absoluteUrl, text: alt, type: 'image', sourcePage: url });
      });

      // 3. Scripts <script src>
      $('script[src]').each((i, el) => {
        const src = $(el).attr('src');
        const absoluteUrl = normalizeUrl(url, src);
        if (absoluteUrl) linksToCheck.push({ url: absoluteUrl, text: 'Script Resource', type: 'script', sourcePage: url });
      });

      // 4. Stylesheets <link rel="stylesheet">
      $('link[rel="stylesheet"]').each((i, el) => {
        const href = $(el).attr('href');
        const absoluteUrl = normalizeUrl(url, href);
        if (absoluteUrl) linksToCheck.push({ url: absoluteUrl, text: 'Stylesheet', type: 'stylesheet', sourcePage: url });
      });

      // 5. Iframes <iframe>
      $('iframe[src]').each((i, el) => {
        const src = $(el).attr('src');
        const absoluteUrl = normalizeUrl(url, src);
        if (absoluteUrl) linksToCheck.push({ url: absoluteUrl, text: 'Iframe Source', type: 'iframe', sourcePage: url });
      });

      // 6. SEO Tags (Canonical/Hreflang)
      $('link[rel="canonical"], link[rel="alternate"][hreflang]').each((i, el) => {
        const href = $(el).attr('href');
        const absoluteUrl = normalizeUrl(url, href);
        if (absoluteUrl) linksToCheck.push({ url: absoluteUrl, text: 'SEO Tag', type: 'seo', sourcePage: url });
      });

      // Batch link checking for high performance
      const BATCH_SIZE = 5;
      for (let i = 0; i < linksToCheck.length; i += BATCH_SIZE) {
        const batch = linksToCheck.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (item) => {
          let isInternal = false;
          try {
            const itemUrl = new URL(item.url);
            isInternal = itemUrl.hostname === baseUrlObj.hostname;
          } catch (e) { return; }

          if (isInternal && depth < maxDepth && !visited.has(item.url)) {
            if (!queue.some(q => q.url === item.url)) {
              queue.push({ url: item.url, depth: depth + 1 });
            }
          }

          let status;
          if (checkedLinks.has(item.url)) {
            status = checkedLinks.get(item.url);
          } else {
            if (item.url.includes('/undefined') || item.url.includes('/null')) {
              status = { isBroken: true, statusCode: 404, type: 'Malformed URL' };
            } else {
              status = await checkLink(item.url);
            }
            checkedLinks.set(item.url, status);
          }

          if (status.isBroken && !reportedBrokenUrls.has(item.url)) {
            reportedBrokenUrls.add(item.url);
            brokenLinks.push({
              pageUrl: item.sourcePage,
              brokenUrl: item.url,
              anchorText: item.text,
              statusCode: status.statusCode,
              type: item.type,
              errorType: status.type || 'Broken',
            });
          }
        }));

        // Emit progress update after each batch
        if (io) {
          io.to(`scan:${domainId}`).emit('scan:progress', {
            currentUrl: url,
            progress: Math.min(Math.round((pagesProcessed / maxPages) * 100), 99),
            pagesScanned: pagesProcessed,
            brokenCount: brokenLinks.length,
          });
        }
      }
    } catch (error) {
      console.error(`Error crawling ${url}:`, error.message);
    }
  }

  const duration = Date.now() - startTime;
  return { brokenLinks, duration, totalVisited: visited.size };
};

/**
 * Entry point for a scan
 */
const startScan = async (domainId) => {
  const domain = await Domain.findById(domainId);
  if (!domain) return;
  const io = getIO();

  try {
    domain.status = 'scanning';
    await domain.save();

    if (io) io.to(`scan:${domainId}`).emit('scan:started', { url: domain.url });

    const results = await crawl(domain._id, domain.url);

    const report = await ScanReport.create({
      domain: domainId,
      totalLinksFound: results.totalVisited,
      totalBrokenLinks: results.brokenLinks.length,
      brokenLinks: results.brokenLinks,
      scanDuration: results.duration,
    });

    domain.status = 'completed';
    domain.lastScanDate = new Date();
    domain.totalBrokenLinks = results.brokenLinks.length;
    domain.nextScanDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await domain.save();

    if (io) io.to(`scan:${domainId}`).emit('scan:complete', { reportId: report._id, brokenCount: results.brokenLinks.length });

    await sendNotification(domain, report);
    console.log(`Scan completed for ${domain.url}. Found ${results.brokenLinks.length} broken links.`);
  } catch (error) {
    console.error(`Scan failed for domain ${domain.url}:`, error);
    domain.status = 'failed';
    await domain.save();
    if (io) io.to(`scan:${domainId}`).emit('scan:failed', { error: error.message });
  }
};

/**
 * Sends email notifications
 */
const sendNotification = async (domain, report) => {
  const allEmails = [domain.primaryEmail, ...(domain.secondaryEmails || [])];
  const subject = `Broken Link Report: ${domain.url} (${report.totalBrokenLinks} found)`;

  let brokenTableHtml = '';
  if (report.brokenLinks.length > 0) {
    brokenTableHtml = `
      <div style="overflow-x:auto;">
        <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse; width: 100%; font-family: sans-serif;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th>Source Page</th>
              <th>Broken URL</th>
              <th>Type</th>
              <th>Status</th>
              <th>Issue</th>
            </tr>
          </thead>
          <tbody>
            ${report.brokenLinks.slice(0, 100).map(link => `
              <tr>
                <td><a href="${link.pageUrl}">${link.pageUrl}</a></td>
                <td><a href="${link.brokenUrl}" style="color: #ef4444;">${link.brokenUrl}</a></td>
                <td><span style="background: #eee; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${link.type}</span></td>
                <td style="color: #ef4444; font-weight: bold;">${link.statusCode || 'Error'}</td>
                <td>${link.errorType || 'Broken'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${report.brokenLinks.length > 100 ? '<p>... and more. Visit your dashboard for the full list.</p>' : ''}
      </div>
    `;
  } else {
    brokenTableHtml = '<div style="padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; border-radius: 8px;">No broken links found! Your website is in great shape.</div>';
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
      <h1 style="color: #2563eb;">Scan Completed for ${domain.url}</h1>
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
        <p style="margin: 5px 0;"><strong>Total Pages Checked:</strong> ${report.totalLinksFound}</p>
        <p style="margin: 5px 0;"><strong>Total Broken Hits:</strong> ${report.totalBrokenLinks}</p>
        <p style="margin: 5px 0;"><strong>Scan Date:</strong> ${new Date(report.createdAt).toLocaleString()}</p>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <h2 style="margin-bottom: 15px;">Detailed Findings</h2>
      ${brokenTableHtml}
      <p style="margin-top: 30px; font-size: 13px; color: #64748b;">Visit your admin dashboard to see redirect chains and more deep analysis.</p>
    </div>
  `;

  for (const email of allEmails) {
    try {
      await sendEmailReport(email, subject, html);
    } catch (e) {
      console.error(`Failed to send email to ${email}:`, e);
    }
  }
};

module.exports = { startScan };
