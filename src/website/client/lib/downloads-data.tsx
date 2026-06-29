import { FaApple, FaLinux, FaWindows } from 'react-icons/fa'

export type Platform = { id: string; os: string; arch: string; label: string; size: string; url: string }

export type VersionRelease = {
  version: string
  date: string
  latest: boolean
  prerelease: boolean
  platforms: {
    os: 'macOS' | 'Windows' | 'Linux'
    arch: string
    label: string
    size: string
    url: string
  }[]
  changelog?: string
}

export const platforms: Platform[] = [
  { id: 'macos-arm64', os: 'macOS', arch: 'arm64', label: 'Apple Silicon', size: '18.2 MB', url: '#' },
  { id: 'macos-x64', os: 'macOS', arch: 'x64', label: 'Intel', size: '19.1 MB', url: '#' },
  { id: 'windows-x64', os: 'Windows', arch: 'x64', label: '64-bit', size: '16.8 MB', url: '#' },
  { id: 'windows-arm64', os: 'Windows', arch: 'arm64', label: 'ARM', size: '17.2 MB', url: '#' },
  { id: 'linux-x64-gnu', os: 'Linux', arch: 'x64', label: 'glibc', size: '15.4 MB', url: '#' },
  { id: 'linux-x64-musl', os: 'Linux', arch: 'x64', label: 'musl', size: '14.9 MB', url: '#' },
  { id: 'linux-arm64', os: 'Linux', arch: 'arm64', label: 'ARM64', size: '14.2 MB', url: '#' },
]

export const releases: VersionRelease[] = [
  {
    version: '2.3.1',
    date: '2026-06-18',
    latest: true,
    prerelease: false,
    changelog: '#',
    platforms: [
      { os: 'macOS', arch: 'arm64', label: 'Apple Silicon', size: '18.2 MB', url: '#' },
      { os: 'macOS', arch: 'x64', label: 'Intel', size: '19.1 MB', url: '#' },
      { os: 'Windows', arch: 'x64', label: '64-bit', size: '16.8 MB', url: '#' },
      { os: 'Windows', arch: 'arm64', label: 'ARM', size: '17.2 MB', url: '#' },
      { os: 'Linux', arch: 'x64', label: 'glibc', size: '15.4 MB', url: '#' },
      { os: 'Linux', arch: 'x64', label: 'musl', size: '14.9 MB', url: '#' },
      { os: 'Linux', arch: 'arm64', label: 'ARM64', size: '14.2 MB', url: '#' },
    ],
  },
  {
    version: '2.3.0',
    date: '2026-05-22',
    latest: false,
    prerelease: false,
    changelog: '#',
    platforms: [
      { os: 'macOS', arch: 'arm64', label: 'Apple Silicon', size: '18.0 MB', url: '#' },
      { os: 'macOS', arch: 'x64', label: 'Intel', size: '19.0 MB', url: '#' },
      { os: 'Windows', arch: 'x64', label: '64-bit', size: '16.6 MB', url: '#' },
      { os: 'Windows', arch: 'arm64', label: 'ARM', size: '17.0 MB', url: '#' },
      { os: 'Linux', arch: 'x64', label: 'glibc', size: '15.2 MB', url: '#' },
      { os: 'Linux', arch: 'x64', label: 'musl', size: '14.7 MB', url: '#' },
      { os: 'Linux', arch: 'arm64', label: 'ARM64', size: '14.0 MB', url: '#' },
    ],
  },
  {
    version: '2.2.0',
    date: '2026-04-10',
    latest: false,
    prerelease: false,
    changelog: '#',
    platforms: [
      { os: 'macOS', arch: 'arm64', label: 'Apple Silicon', size: '17.8 MB', url: '#' },
      { os: 'macOS', arch: 'x64', label: 'Intel', size: '18.6 MB', url: '#' },
      { os: 'Windows', arch: 'x64', label: '64-bit', size: '16.2 MB', url: '#' },
      { os: 'Windows', arch: 'arm64', label: 'ARM', size: '16.8 MB', url: '#' },
      { os: 'Linux', arch: 'x64', label: 'glibc', size: '14.8 MB', url: '#' },
      { os: 'Linux', arch: 'x64', label: 'musl', size: '14.4 MB', url: '#' },
      { os: 'Linux', arch: 'arm64', label: 'ARM64', size: '13.8 MB', url: '#' },
    ],
  },
  {
    version: '2.2.0-beta.1',
    date: '2026-03-28',
    latest: false,
    prerelease: true,
    changelog: '#',
    platforms: [
      { os: 'macOS', arch: 'arm64', label: 'Apple Silicon', size: '17.5 MB', url: '#' },
      { os: 'macOS', arch: 'x64', label: 'Intel', size: '18.3 MB', url: '#' },
      { os: 'Windows', arch: 'x64', label: '64-bit', size: '15.9 MB', url: '#' },
      { os: 'Windows', arch: 'arm64', label: 'ARM', size: '16.5 MB', url: '#' },
      { os: 'Linux', arch: 'x64', label: 'glibc', size: '14.5 MB', url: '#' },
      { os: 'Linux', arch: 'x64', label: 'musl', size: '14.1 MB', url: '#' },
      { os: 'Linux', arch: 'arm64', label: 'ARM64', size: '13.5 MB', url: '#' },
    ],
  },
]

type ArchResult = { os: 'macOS' | 'Windows' | 'Linux'; arch: 'arm64' | 'x64' }

export async function detectOSArch(): Promise<ArchResult> {
  const ua = navigator.userAgent

  const os: ArchResult['os'] =
    /Mac/i.test(ua) ? 'macOS' :
      /Win/i.test(ua) ? 'Windows' :
        /Linux/i.test(ua) && !/Mac/i.test(ua) ? 'Linux' :
          'macOS'

  let arch: ArchResult['arch'] | undefined

  if (!arch && (navigator as any).userAgentData?.getHighEntropyValues) {
    try {
      const values = await (navigator as any).userAgentData.getHighEntropyValues(['architecture'])
      const a = values.architecture?.toLowerCase() ?? ''
      if (a.includes('arm')) arch = 'arm64'
      else if (a) arch = 'x64'
    } catch { /* fall through */ }
  }

  if (!arch) {
    if (/ARM64|aarch64|armv8|ARM\b/i.test(ua)) arch = 'arm64'
    else if (/x86_64|Win64|WOW64/i.test(ua)) arch = 'x64'
  }

  if (!arch && navigator.platform) {
    const p = navigator.platform.toLowerCase()
    if (p.includes('arm') || p.includes('aarch')) arch = 'arm64'
  }

  if (!arch) arch = os === 'macOS' ? 'arm64' : 'x64'

  return { os, arch }
}

export function detectPlatform(
  result: ArchResult,
  versionPlatforms?: { os: string; arch: string; label: string; size: string; url: string }[]
): { os: string; arch: string; label: string; size: string; url: string } | undefined {
  const lookup: Record<string, string> = {
    'macOS-arm64': 'macos-arm64',
    'macOS-x64': 'macos-x64',
    'Windows-arm64': 'windows-arm64',
    'Windows-x64': 'windows-x64',
    'Linux-arm64': 'linux-arm64',
    'Linux-x64': 'linux-x64-gnu',
  }
  const key = `${result.os}-${result.arch}`
  const id = lookup[key]
  const list = versionPlatforms || platforms
  return list.find(p => {
    if (versionPlatforms) {
      return p.os === result.os && p.arch === result.arch
    }
    return (p as Platform).id === id
  })
}

export const osIcon: Record<string, React.ReactNode> = {
  macOS: <FaApple />,
  Windows: <FaWindows />,
  Linux: <FaLinux />,
}

export const osMeta: Record<string, { icon: React.ReactNode; color: string; desc: string }> = {
  macOS: { icon: <FaApple />, color: 'var(--dl-macos)', desc: 'Native macOS binaries' },
  Windows: { icon: <FaWindows />, color: 'var(--dl-windows)', desc: 'Windows x64 and ARM' },
  Linux: { icon: <FaLinux />, color: 'var(--dl-linux)', desc: 'Install via script — auto-detects your distro' },
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
