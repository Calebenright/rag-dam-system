import axios from 'axios';

/**
 * Scrape a URL and extract useful text content for ad copy context.
 * Returns null on failure (non-blocking — ad generation proceeds with other inputs).
 */
export async function scrapeUrl(url) {
  try {
    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const response = await axios.get(normalizedUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      maxRedirects: 5,
      responseType: 'text',
    });

    const html = response.data;
    if (typeof html !== 'string') return null;

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : null;

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i)
      || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["'][^>]*>/i);
    const description = descMatch ? descMatch[1].replace(/\s+/g, ' ').trim() : null;

    // Extract og:image
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i)
      || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*property=["']og:image["'][^>]*>/i);
    const ogImage = ogImageMatch ? ogImageMatch[1].trim() : null;

    // Extract body text
    let bodyText = html;
    // Remove script, style, nav, footer, header, aside tags
    bodyText = bodyText.replace(/<(script|style|nav|footer|header|aside|noscript|svg|iframe)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
    // Remove all remaining HTML tags
    bodyText = bodyText.replace(/<[^>]+>/g, ' ');
    // Decode common HTML entities
    bodyText = bodyText.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
    // Collapse whitespace
    bodyText = bodyText.replace(/\s+/g, ' ').trim();
    // Truncate to 5000 chars
    bodyText = bodyText.substring(0, 5000);

    return { title, description, ogImage, bodyText, url: normalizedUrl };
  } catch (error) {
    console.warn(`URL scrape failed for ${url}:`, error.message);
    return null;
  }
}
