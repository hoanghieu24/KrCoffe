export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null
  const clean = url.trim()
  const patterns = [
    /(?:youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/)([^#&?]*)/,
    /[?&]v=([^#&?]*)/,
  ]
  for (const p of patterns) {
    const match = clean.match(p)
    if (match && match[1] && match[1].length === 11) {
      return match[1]
    }
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return clean
  }
  return null
}

export async function fetchYouTubeDetails(rawUrl: string): Promise<{
  videoId: string
  title?: string
  author?: string
  durationSec: number
} | null> {
  const videoId = extractYouTubeId(rawUrl)
  if (!videoId) return null

  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    const html = await res.text()

    // 1. Duration
    let durationSec = 180
    const mLen = html.match(/"lengthSeconds":"(\d+)"/)
    if (mLen && Number(mLen[1]) > 0) {
      durationSec = Number(mLen[1])
    } else {
      const mApprox = html.match(/"approxDurationMs":"(\d+)"/)
      if (mApprox && Number(mApprox[1]) > 0) {
        durationSec = Math.round(Number(mApprox[1]) / 1000)
      }
    }

    // 2. Title
    let title: string | undefined
    const mTitle = html.match(/<title>([^<]+)<\/title>/)
    if (mTitle) {
      title = decodeHtmlEntities(mTitle[1].replace(/\s*-\s*YouTube$/i, '').trim())
    }

    // 3. Author / Channel
    let author: string | undefined
    const mAuthor = html.match(/"ownerChannelName":"([^"]+)"/) || html.match(/<link itemprop="name" content="([^"]+)">/)
    if (mAuthor) {
      author = decodeHtmlEntities(mAuthor[1].trim())
    }

    return { videoId, title, author, durationSec }
  } catch (err) {
    console.warn('[YouTubeHelper] Failed to fetch details:', err)
    return { videoId, durationSec: 210 }
  }
}
