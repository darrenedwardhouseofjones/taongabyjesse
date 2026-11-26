import { SocialPlatform } from '../types';

export interface SocialPlatformOption {
  platform: SocialPlatform;
  label: string;
  placeholder: string;
}

export const SOCIAL_PLATFORM_OPTIONS: SocialPlatformOption[] = [
  {
    platform: SocialPlatform.FACEBOOK,
    label: 'Facebook',
    placeholder: 'https://www.facebook.com/pounamuatelier',
  },
  {
    platform: SocialPlatform.INSTAGRAM,
    label: 'Instagram',
    placeholder: 'https://www.instagram.com/pounamuatelier',
  },
  {
    platform: SocialPlatform.YOUTUBE,
    label: 'YouTube',
    placeholder: 'https://www.youtube.com/@pounamuatelier',
  },
  {
    platform: SocialPlatform.RUMBLE,
    label: 'Rumble',
    placeholder: 'https://rumble.com/c/pounamuatelier',
  },
  {
    platform: SocialPlatform.X,
    label: 'X (Twitter)',
    placeholder: 'https://x.com/pounamuatelier',
  },
  {
    platform: SocialPlatform.TIKTOK,
    label: 'TikTok',
    placeholder: 'https://www.tiktok.com/@pounamuatelier',
  },
  {
    platform: SocialPlatform.PINTEREST,
    label: 'Pinterest',
    placeholder: 'https://www.pinterest.com/pounamuatelier',
  },
  {
    platform: SocialPlatform.LINKEDIN,
    label: 'LinkedIn',
    placeholder: 'https://www.linkedin.com/company/pounamuatelier',
  },
  {
    platform: SocialPlatform.THREADS,
    label: 'Threads',
    placeholder: 'https://www.threads.net/@pounamuatelier',
  },
  {
    platform: SocialPlatform.DISCORD,
    label: 'Discord',
    placeholder: 'https://discord.gg/your-invite',
  },
  {
    platform: SocialPlatform.WHATSAPP,
    label: 'WhatsApp',
    placeholder: 'https://wa.me/6468350194',
  },
  {
    platform: SocialPlatform.WEBSITE,
    label: 'Website / Blog',
    placeholder: 'https://pounamuatelier.co.nz',
  },
];

export function getSocialPlatformMeta(platform: SocialPlatform): SocialPlatformOption {
  return (
    SOCIAL_PLATFORM_OPTIONS.find((opt) => opt.platform === platform) ||
    SOCIAL_PLATFORM_OPTIONS[SOCIAL_PLATFORM_OPTIONS.length - 1]
  );
}

export function isSafeHttpUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeSocialUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) {
    return /^https?:\/\//i.test(trimmed) ? trimmed : trimmed;
  }
  return `https://${trimmed.replace(/^\/+/, '')}`;
}
