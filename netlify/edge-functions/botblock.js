// Botok kitiltása (Netlify Edge Function)
//
// A honlap tulajdonosának döntése: a keresők (Google, Bing, DuckDuckGo, Apple) beléphetnek, hogy a honlap
// megtalálható maradjon; minden más bot — AI-gyűjtők, SEO-elemzők, linkelőnézet-készítők, programozott
// letöltők — kint marad. A böngészőazonosító (User-Agent) alapján szűr;
// a magát rendes böngészőnek álcázó botokat így nem lehet megfogni, de az ismertek mind fennakadnak.
// A robots.txt kivétel: azt a botok megkaphatják, hogy lássák, ide nem jöhetnek.
//
// Költség: a Netlify a futtatást közönséges webes kérésként számolja (nem számítási időként); a kitiltott
// bot csak egy pár bájtos választ kap a hangfájlok és PDF-ek helyett, így adatforgalmat is spórol.

const BOT = new RegExp([
  // általános jelölések (Googlebot, bingbot, YandexBot, … crawler, spider)
  "bot\\b", "bot[/_\\-;]", "crawl", "spider", "slurp", "scrap", "archiver", "indexer", "fetcher",
  // AI-cégek
  "gptbot", "chatgpt", "oai-searchbot", "openai", "claude", "anthropic", "ccbot", "commoncrawl", "perplexity",
  "bytespider", "amazonbot", "applebot", "cohere", "diffbot", "youbot", "imagesift", "omgili", "timpi",
  "mistral", "duckassist", "ai2bot", "webzio", "meta-externalagent", "meta-externalfetcher", "facebookbot",
  "google-extended", "googleother", "google-inspectiontool", "gemini", "deepseek", "kangaroo", "novaact",
  // keresők és SEO-elemzők
  "bingpreview", "yandex", "baidu", "seznam", "sogou", "petalbot", "semrush", "ahrefs", "mj12", "dotbot",
  "blexbot", "dataforseo", "serpstat", "screaming frog", "sitebulb", "barkrowler",
  // linkelőnézetek
  "facebookexternalhit", "facebot", "twitterbot", "linkedinbot", "slackbot", "discordbot", "telegrambot",
  "whatsapp", "skypeuripreview", "pinterestbot", "redditbot", "embedly", "quora link preview", "vkshare", "iframely",
  // programozott letöltők és automatizált böngészők
  "curl", "wget", "python", "httpx", "aiohttp", "scrapy", "libwww", "lwp-", "go-http", "java/", "okhttp",
  "axios", "node-fetch", "undici", "got \\(", "httpie", "postman", "insomnia", "headless", "phantomjs",
  "selenium", "puppeteer", "playwright",
].join("|"), "i");

// beengedett keresők (a Google AI-tanítását a robots.txt Google-Extended sora tiltja, a Bing AI-használatát
// a „noai” jelzés kéri ki); az Applebot-Extended csak robots.txt-név, az Apple AI-tanítását az tiltja
const SEARCH = /googlebot|google-inspectiontool|bingbot|msnbot|duckduckbot|duckduckgo-favicons-bot|applebot|yahoo! slurp/i;

// valódi eszköznevek, amelyekben véletlenül benne van a „bot” (pl. CUBOT telefonok)
const NOT_BOT = /cubot/i;

export default async (request, context) => {
  const ua = request.headers.get("user-agent") || "";
  if (!ua.trim() || (BOT.test(ua) && !NOT_BOT.test(ua) && !SEARCH.test(ua))) {
    return new Response("Ez az oldal automatizált látogatók (botok) számára nem érhető el.\n", {
      status: 403,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-robots-tag": "noindex, nofollow, noai, noimageai",
        "cache-control": "no-store",
      },
    });
  }
  return context.next();
};

export const config = { path: "/*", excludedPath: ["/robots.txt"] };
