import "dotenv/config"
import { Op } from 'sequelize'
import { db } from './config/db'
import { Models } from './models'

async function seed() {
    await db.authenticate()
    await db.sync({ force: true, logging: false })

    // ── Create users ─────────────────────────────────────────
    const coreUser = await Models.Users.create({
        githubUserId: '20', githubLogin: 'core', displayName: 'Core Team',
        avatarUrl: null, profileUrl: null, email: null, role: 'admin', status: 'active',
    } as any)
    console.log(`Created user: ${coreUser.githubLogin} (id=${coreUser.id})`)

    const jsUser = await Models.Users.create({
        githubUserId: '40', githubLogin: 'js-tooling', displayName: 'JavaScript Tooling',
        avatarUrl: null, profileUrl: null, email: null, role: 'admin', status: 'active',
    } as any)
    console.log(`Created user: ${jsUser.githubLogin} (id=${jsUser.id})`)

    const dvUser = await Models.Users.create({
        githubUserId: '60', githubLogin: 'data-viz', displayName: 'Data Visualization',
        avatarUrl: null, profileUrl: null, email: null, role: 'admin', status: 'active',
    } as any)
    console.log(`Created user: ${dvUser.githubLogin} (id=${dvUser.id})`)

    const cliUser = await Models.Users.create({
        githubUserId: '80', githubLogin: 'cli', displayName: 'CLI Tools',
        avatarUrl: null, profileUrl: null, email: null, role: 'admin', status: 'active',
    } as any)
    console.log(`Created user: ${cliUser.githubLogin} (id=${cliUser.id})`)

    // ── Helper: create scoped package ───────────────────────
    async function createScopedPackage(scope: string, pkgName: string, data: {
        description: string; license: string
        repositoryUrl?: string; homepageUrl?: string; documentationUrl?: string
        totalDownloads: number; weeklyDownloads: number
        versionsCount: number; dependenciesCount: number; dependentsCount: number
        keywords: string[]
        versions: Array<{
            version: string; description?: string
            assetSizeBytes: number; minifiedSizeBytes?: number | null
            installCount: number; publishedAt: Date
            platforms: string[]
            dependencies?: Array<{ dependencyName: string; versionRange: string; dependencyType?: string }>
        }>
        security?: { status: string; vulnerabilitiesCount: number; malwareScanStatus: string; lastScannedAt?: Date }
    }, ownerUser: any) {
        const fullName = scope ? `@${scope}/${pkgName}` : pkgName
        const latestVer = data.versions[data.versions.length - 1]
        const maintainers = [{ userId: ownerUser.id, role: 'owner' }]
        const weeklyTotal = data.weeklyDownloads
        const downloadTrend = []
        for (let i = 29; i >= 0; i--) {
            const day = new Date(Date.now() - i * 86400000)
            const dayMultiplier = i < 7 ? 1 : i < 14 ? 0.85 : i < 21 ? 0.7 : 0.5
            const dailyAvg = weeklyTotal / 7
            const variance = (Math.random() * 0.4 + 0.8)
            const downloads = Math.round(dailyAvg * dayMultiplier * variance)
            downloadTrend.push({ date: day.toISOString().slice(0, 10), downloads })
        }

        const pkg = await Models.Packages.create({
            scope, name: pkgName, fullName, displayName: null,
            description: data.description,
            readmeText: `# ${fullName}\n\n${data.description}\n\n## Installation\n\n\`\`\`\nyogi add ${fullName}\n\`\`\`\n\n## Usage\n\n\`\`\`typescript\nimport { ${pkgName.replace(/[-/]/g, '_')} } from '${fullName}'\n\`\`\`\n\n## License\n\n${data.license}\n`,
            license: data.license, ownerUserId: ownerUser.id, ownerOrganizationId: null,
            visibility: 'public', status: 'active', verificationStatus: 'verified',
            repoFullName: `${scope}/${pkgName}`, githubRepoId: Math.floor(Math.random() * 100000) + 1,
            repositoryUrl: data.repositoryUrl ?? null, homepageUrl: data.homepageUrl ?? null,
            documentationUrl: data.documentationUrl ?? null, logo: null,
            latestVersionId: null, latestVersion: latestVer?.version ?? null,
            totalDownloads: data.totalDownloads, weeklyDownloads: data.weeklyDownloads,
            versionsCount: data.versionsCount, dependenciesCount: data.dependenciesCount,
            dependentsCount: data.dependentsCount,
            lastPublishedAt: latestVer?.publishedAt ?? null, lastCheckedAt: new Date(),
            keywords: data.keywords, maintainers,
            security: data.security ?? null, downloadTrend,
        } as any)

        const createdVersions: any[] = []
        for (const ver of data.versions) {
            const v = await Models.PackageVersion.create({
                packageId: pkg.id, version: ver.version, description: ver.description ?? null,
                readmeText: null, license: data.license, status: 'active',
                assetSizeBytes: ver.assetSizeBytes, minifiedSizeBytes: ver.minifiedSizeBytes ?? null,
                installCount: ver.installCount, checksum: null, tarballUrl: null,
                githubReleaseId: null, githubReleaseTag: `v${ver.version}`,
                publishedByUserId: ownerUser.id, publishedAt: ver.publishedAt,
                platforms: ver.platforms ?? [],
                dependencies: ver.dependencies ?? [],
                assets: [{
                    target: 'src', artifactType: 'source',
                    fileName: `${pkgName}-${ver.version}.tar.gz`,
                    url: `https://registry.yogi.dev/packages/${fullName}/-/${pkgName}-${ver.version}.tar.gz`,
                    sizeBytes: ver.assetSizeBytes, checksum: null,
                }],
            } as any)
            createdVersions.push(v)
        }

        if (createdVersions.length > 0) {
            const latest = createdVersions[createdVersions.length - 1]
            await pkg.update({ latestVersionId: latest.id, latestVersion: latest.version })
        }

        console.log(`  ✓ Created package: ${fullName} (${data.versions.length} versions)`)
        return pkg
    }

    // ── Package 1: @core/http ────────────────────────────────
    await createScopedPackage('core', 'http', {
        description: 'Lightweight, composable HTTP client for Node.js and the browser.',
        license: 'MIT', repositoryUrl: 'https://github.com/core/http',
        homepageUrl: 'https://core.dev/http', documentationUrl: 'https://docs.core.dev/http',
        totalDownloads: 48600000, weeklyDownloads: 1280000, versionsCount: 54,
        dependenciesCount: 3, dependentsCount: 12840,
        keywords: ['http', 'client', 'fetch', 'promise', 'browser', 'node', 'typescript', 'isomorphic'],
        versions: [
            { version: '0.1.0', assetSizeBytes: 12800, installCount: 120000, publishedAt: new Date('2023-06-15'), platforms: ['macos-x64', 'linux-x64-gnu'], dependencies: [{ dependencyName: 'shared-types', versionRange: '^1.0.0' }] },
            { version: '1.0.0', description: 'First stable release', assetSizeBytes: 24500, minifiedSizeBytes: 8900, installCount: 850000, publishedAt: new Date('2023-09-01'), platforms: ['macos-x64', 'linux-x64-gnu', 'windows-x64-msvc'], dependencies: [{ dependencyName: 'shared-types', versionRange: '^1.2.0' }, { dependencyName: 'zod', versionRange: '^3.0.0' }] },
            { version: '1.5.0', assetSizeBytes: 26100, minifiedSizeBytes: 9200, installCount: 2100000, publishedAt: new Date('2024-01-10'), platforms: ['macos-arm64', 'macos-x64', 'linux-x64-gnu', 'windows-x64-msvc'], dependencies: [{ dependencyName: 'shared-types', versionRange: '^1.5.0' }, { dependencyName: 'zod', versionRange: '^3.2.0' }] },
            { version: '2.0.0', description: 'Major rewrite with streaming support', assetSizeBytes: 32100, minifiedSizeBytes: 11800, installCount: 5600000, publishedAt: new Date('2024-06-20'), platforms: ['macos-arm64', 'macos-x64', 'linux-x64-gnu', 'windows-x64-msvc'], dependencies: [{ dependencyName: 'shared-types', versionRange: '^2.0.0' }, { dependencyName: 'zod', versionRange: '^3.4.0' }, { dependencyName: 'abort-controller', versionRange: '^1.0.0' }] },
            { version: '2.3.0', assetSizeBytes: 33400, minifiedSizeBytes: 12100, installCount: 9200000, publishedAt: new Date('2024-10-05'), platforms: ['macos-arm64', 'macos-x64', 'linux-x64-gnu', 'windows-x64-msvc'], dependencies: [{ dependencyName: 'shared-types', versionRange: '^2.1.0' }, { dependencyName: 'zod', versionRange: '^3.6.0' }, { dependencyName: 'abort-controller', versionRange: '~1.0.2' }] },
            { version: '2.3.1', description: 'Latest version', assetSizeBytes: 33400, minifiedSizeBytes: 12100, installCount: 12400000, publishedAt: new Date('2025-01-28'), platforms: ['macos-arm64', 'macos-x64', 'linux-x64-gnu', 'windows-x64-msvc'], dependencies: [{ dependencyName: 'shared-types', versionRange: '^2.1.0' }, { dependencyName: 'zod', versionRange: '^3.6.0' }, { dependencyName: 'abort-controller', versionRange: '~1.0.2' }] },
        ],
        security: { status: 'passed', vulnerabilitiesCount: 0, malwareScanStatus: 'passed' },
    }, coreUser)

    // ── Package 2: @core/zod ─────────────────────────────────
    await createScopedPackage('core', 'zod', {
        description: 'TypeScript-first schema validation with static type inference.',
        license: 'MIT', repositoryUrl: 'https://github.com/core/zod',
        homepageUrl: 'https://core.dev/zod', documentationUrl: 'https://docs.core.dev/zod',
        totalDownloads: 18200000, weeklyDownloads: 675000, versionsCount: 42,
        dependenciesCount: 1, dependentsCount: 25400,
        keywords: ['validation', 'typescript', 'schema', 'types', 'parser'],
        versions: [
            { version: '1.0.0', assetSizeBytes: 8400, installCount: 112000, publishedAt: new Date('2023-08-01'), platforms: ['wasm32-wasi', 'wasm32-browser'], dependencies: [] },
            { version: '2.0.0', assetSizeBytes: 12100, minifiedSizeBytes: 4500, installCount: 890000, publishedAt: new Date('2024-02-14'), platforms: ['wasm32-wasi', 'wasm32-browser', 'linux-x64-gnu'], dependencies: [{ dependencyName: 'shared-types', versionRange: '^1.0.0' }] },
            { version: '3.0.0', assetSizeBytes: 15600, minifiedSizeBytes: 5800, installCount: 4500000, publishedAt: new Date('2024-11-01'), platforms: ['wasm32-wasi', 'wasm32-browser', 'linux-x64-gnu', 'linux-arm64-gnu'], dependencies: [{ dependencyName: 'shared-types', versionRange: '^2.0.0' }] },
        ],
        security: { status: 'passed', vulnerabilitiesCount: 0, malwareScanStatus: 'passed' },
    }, coreUser)

    // ── Package 3: @core/react ───────────────────────────────
    await createScopedPackage('core', 'react', {
        description: 'React UI primitives and hooks for building modern web applications.',
        license: 'MIT', repositoryUrl: 'https://github.com/core/react',
        homepageUrl: 'https://core.dev/react', documentationUrl: 'https://docs.core.dev/react',
        totalDownloads: 31200000, weeklyDownloads: 2450000, versionsCount: 38,
        dependenciesCount: 4, dependentsCount: 18200,
        keywords: ['react', 'ui', 'hooks', 'components', 'frontend', 'typescript'],
        versions: [
            { version: '0.5.0', assetSizeBytes: 22100, installCount: 65000, publishedAt: new Date('2023-03-10'), platforms: ['wasm32-browser'], dependencies: [{ dependencyName: 'react', versionRange: '^18.0.0' }] },
            { version: '1.0.0', description: 'First stable release', assetSizeBytes: 38400, minifiedSizeBytes: 14200, installCount: 520000, publishedAt: new Date('2023-07-22'), platforms: ['wasm32-browser'], dependencies: [{ dependencyName: 'react', versionRange: '^18.2.0' }, { dependencyName: 'shared-types', versionRange: '^1.0.0' }] },
            { version: '1.5.0', assetSizeBytes: 41200, minifiedSizeBytes: 15600, installCount: 3400000, publishedAt: new Date('2024-03-15'), platforms: ['wasm32-browser', 'wasm32-wasi'], dependencies: [{ dependencyName: 'react', versionRange: '^18.2.0' }, { dependencyName: 'shared-types', versionRange: '^1.5.0' }] },
            { version: '2.0.0', description: 'Server components support', assetSizeBytes: 48500, minifiedSizeBytes: 17800, installCount: 8900000, publishedAt: new Date('2025-02-01'), platforms: ['wasm32-browser', 'wasm32-wasi'], dependencies: [{ dependencyName: 'react', versionRange: '^19.0.0' }, { dependencyName: 'shared-types', versionRange: '^2.0.0' }] },
        ],
        security: { status: 'passed', vulnerabilitiesCount: 0, malwareScanStatus: 'passed' },
    }, coreUser)

    // ── Package 4: @core/logger ──────────────────────────────
    await createScopedPackage('core', 'logger', {
        description: 'Structured, leveled logging for Node.js and browser environments.',
        license: 'Apache-2.0', repositoryUrl: 'https://github.com/core/logger',
        homepageUrl: 'https://core.dev/logger', documentationUrl: 'https://docs.core.dev/logger',
        totalDownloads: 8400000, weeklyDownloads: 340000, versionsCount: 18,
        dependenciesCount: 2, dependentsCount: 6800,
        keywords: ['logging', 'logger', 'structured', 'debug', 'node', 'typescript'],
        versions: [
            { version: '1.0.0', assetSizeBytes: 6200, installCount: 98000, publishedAt: new Date('2023-11-01'), platforms: ['linux-x64-gnu', 'linux-x64-musl'], dependencies: [{ dependencyName: 'safe-stringify', versionRange: '^1.0.0' }] },
            { version: '1.2.0', assetSizeBytes: 7100, minifiedSizeBytes: 2800, installCount: 680000, publishedAt: new Date('2024-05-10'), platforms: ['linux-x64-gnu', 'linux-x64-musl', 'macos-x64'], dependencies: [{ dependencyName: 'safe-stringify', versionRange: '^1.1.0' }] },
            { version: '2.0.0', description: 'Browser support and transports', assetSizeBytes: 9800, minifiedSizeBytes: 3600, installCount: 2100000, publishedAt: new Date('2025-01-20'), platforms: ['linux-x64-gnu', 'linux-x64-musl', 'macos-arm64', 'macos-x64'], dependencies: [{ dependencyName: 'safe-stringify', versionRange: '^2.0.0' }, { dependencyName: 'event-emitter', versionRange: '^1.0.0' }] },
        ],
    }, coreUser)

    // ── Package 5: @core/cache ───────────────────────────────
    await createScopedPackage('core', 'cache', {
        description: 'In-memory and distributed caching with TTL, LRU, and Redis backends.',
        license: 'MIT', repositoryUrl: 'https://github.com/core/cache',
        homepageUrl: null, documentationUrl: 'https://docs.core.dev/cache',
        totalDownloads: 3200000, weeklyDownloads: 180000, versionsCount: 12,
        dependenciesCount: 2, dependentsCount: 3200,
        keywords: ['cache', 'lru', 'ttl', 'memory', 'redis', 'typescript'],
        versions: [
            { version: '0.1.0', assetSizeBytes: 5100, installCount: 12000, publishedAt: new Date('2024-04-01'), platforms: ['linux-x64-gnu'], dependencies: [{ dependencyName: 'event-emitter', versionRange: '^1.0.0' }] },
            { version: '1.0.0', description: 'Stable release with Redis adapter', assetSizeBytes: 12400, minifiedSizeBytes: 4900, installCount: 340000, publishedAt: new Date('2024-09-15'), platforms: ['linux-x64-gnu', 'linux-arm64-gnu', 'linux-x64-musl'], dependencies: [{ dependencyName: 'event-emitter', versionRange: '^1.0.0' }, { dependencyName: 'safe-json', versionRange: '^1.0.0' }] },
        ],
    }, coreUser)

    // ── Package 6: @js-tooling/prettier ──────────────────────
    await createScopedPackage('js-tooling', 'prettier', {
        description: 'An opinionated code formatter — supports many languages.',
        license: 'MIT', repositoryUrl: 'https://github.com/js-tooling/prettier',
        homepageUrl: 'https://prettier.io', documentationUrl: 'https://prettier.io/docs',
        totalDownloads: 48500000, weeklyDownloads: 2100000, versionsCount: 56,
        dependenciesCount: 5, dependentsCount: 34200,
        keywords: ['formatter', 'code', 'prettier', 'style', 'javascript', 'typescript', 'css'],
        versions: [
            { version: '1.0.0', assetSizeBytes: 48000, installCount: 2500000, publishedAt: new Date('2023-01-15'), platforms: ['macos-x64', 'linux-x64-gnu'], dependencies: [{ dependencyName: 'resolve-config', versionRange: '^1.0.0' }] },
            { version: '2.0.0', assetSizeBytes: 52000, minifiedSizeBytes: 18500, installCount: 8900000, publishedAt: new Date('2024-04-20'), platforms: ['macos-x64', 'linux-x64-gnu', 'linux-arm64-gnu', 'windows-x64-msvc'], dependencies: [{ dependencyName: 'resolve-config', versionRange: '^2.0.0' }, { dependencyName: 'plugin-json', versionRange: '^1.0.0' }, { dependencyName: 'plugin-markdown', versionRange: '^1.0.0' }] },
            { version: '3.0.0', description: 'Major update with YAML and TOML support', assetSizeBytes: 68900, minifiedSizeBytes: 22100, installCount: 18200000, publishedAt: new Date('2025-03-01'), platforms: ['macos-arm64', 'macos-x64', 'linux-x64-gnu', 'linux-arm64-gnu', 'windows-x64-msvc'], dependencies: [{ dependencyName: 'resolve-config', versionRange: '^3.0.0' }, { dependencyName: 'plugin-json', versionRange: '^2.0.0' }, { dependencyName: 'plugin-markdown', versionRange: '^2.0.0' }, { dependencyName: 'plugin-yaml', versionRange: '^1.0.0' }] },
        ],
        security: { status: 'passed', vulnerabilitiesCount: 0, malwareScanStatus: 'passed' },
    }, jsUser)

    // ── Package 7: @js-tooling/eslint ────────────────────────
    await createScopedPackage('js-tooling', 'eslint', {
        description: 'Shared ESLint configurations and plugins for consistent code quality.',
        license: 'MIT', repositoryUrl: 'https://github.com/js-tooling/eslint',
        homepageUrl: 'https://js-tooling.dev/eslint', documentationUrl: 'https://docs.js-tooling.dev/eslint',
        totalDownloads: 22400000, weeklyDownloads: 980000, versionsCount: 28,
        dependenciesCount: 7, dependentsCount: 15200,
        keywords: ['eslint', 'lint', 'config', 'quality', 'javascript', 'typescript'],
        versions: [
            { version: '1.0.0', assetSizeBytes: 18200, installCount: 1100000, publishedAt: new Date('2023-04-10'), platforms: ['linux-x64-gnu'], dependencies: [{ dependencyName: 'eslint-core', versionRange: '^8.0.0' }] },
            { version: '2.0.0', description: 'Flat config support', assetSizeBytes: 24100, minifiedSizeBytes: 8200, installCount: 4700000, publishedAt: new Date('2024-08-01'), platforms: ['linux-x64-gnu', 'linux-x64-musl'], dependencies: [{ dependencyName: 'eslint-core', versionRange: '^9.0.0' }, { dependencyName: 'plugin-typescript', versionRange: '^2.0.0' }, { dependencyName: 'plugin-react', versionRange: '^1.0.0' }] },
            { version: '2.1.0', assetSizeBytes: 24800, minifiedSizeBytes: 8400, installCount: 6800000, publishedAt: new Date('2025-02-10'), platforms: ['linux-x64-gnu', 'linux-x64-musl', 'macos-x64'], dependencies: [{ dependencyName: 'eslint-core', versionRange: '^9.0.0' }, { dependencyName: 'plugin-typescript', versionRange: '^2.1.0' }, { dependencyName: 'plugin-react', versionRange: '^1.1.0' }] },
        ],
    }, jsUser)

    // ── Package 8: @js-tooling/typescript ────────────────────
    await createScopedPackage('js-tooling', 'typescript', {
        description: 'TypeScript utility types, helpers, and runtime type guards.',
        license: 'MIT', repositoryUrl: 'https://github.com/js-tooling/typescript',
        homepageUrl: null, documentationUrl: 'https://docs.js-tooling.dev/typescript',
        totalDownloads: 15600000, weeklyDownloads: 720000, versionsCount: 22,
        dependenciesCount: 1, dependentsCount: 9800,
        keywords: ['typescript', 'types', 'utilities', 'helpers', 'type-guards'],
        versions: [
            { version: '1.0.0', assetSizeBytes: 9200, installCount: 420000, publishedAt: new Date('2023-10-01'), platforms: ['wasm32-wasi'], dependencies: [] },
            { version: '1.5.0', assetSizeBytes: 11500, minifiedSizeBytes: 3900, installCount: 2100000, publishedAt: new Date('2024-06-15'), platforms: ['wasm32-wasi', 'wasm32-browser'], dependencies: [{ dependencyName: 'shared-types', versionRange: '^1.0.0' }] },
            { version: '2.0.0', description: 'Branded types and branded-optional', assetSizeBytes: 14800, minifiedSizeBytes: 5200, installCount: 5800000, publishedAt: new Date('2025-04-01'), platforms: ['wasm32-wasi', 'wasm32-browser', 'linux-x64-gnu'], dependencies: [{ dependencyName: 'shared-types', versionRange: '^2.0.0' }] },
        ],
    }, jsUser)

    // ── Package 9: @data-viz/charts ──────────────────────────
    await createScopedPackage('data-viz', 'charts', {
        description: 'Declarative charting library built on D3 — line, bar, pie, scatter.',
        license: 'MIT', repositoryUrl: 'https://github.com/data-viz/charts',
        homepageUrl: 'https://dataviz.dev/charts', documentationUrl: 'https://docs.dataviz.dev/charts',
        totalDownloads: 12800000, weeklyDownloads: 560000, versionsCount: 16,
        dependenciesCount: 3, dependentsCount: 7200,
        keywords: ['charts', 'd3', 'visualization', 'line', 'bar', 'pie', 'scatter'],
        versions: [
            { version: '0.1.0', assetSizeBytes: 28500, installCount: 34000, publishedAt: new Date('2023-12-01'), platforms: ['wasm32-browser'], dependencies: [{ dependencyName: 'd3-shape', versionRange: '^3.0.0' }] },
            { version: '1.0.0', description: 'First stable release', assetSizeBytes: 42100, minifiedSizeBytes: 16500, installCount: 680000, publishedAt: new Date('2024-07-01'), platforms: ['wasm32-browser', 'wasm32-wasi'], dependencies: [{ dependencyName: 'd3-shape', versionRange: '^3.2.0' }, { dependencyName: 'event-emitter', versionRange: '^1.0.0' }] },
            { version: '1.2.0', assetSizeBytes: 43800, minifiedSizeBytes: 17200, installCount: 2400000, publishedAt: new Date('2025-01-15'), platforms: ['wasm32-browser', 'wasm32-wasi', 'macos-x64'], dependencies: [{ dependencyName: 'd3-shape', versionRange: '^3.2.0' }, { dependencyName: 'event-emitter', versionRange: '^1.0.0' }, { dependencyName: 'shared-types', versionRange: '^2.0.0' }] },
        ],
    }, dvUser)

    // ── Package 10: @data-viz/dataset ────────────────────────
    await createScopedPackage('data-viz', 'dataset', {
        description: 'Data manipulation and transformation utilities for tabular data.',
        license: 'MIT', repositoryUrl: 'https://github.com/data-viz/dataset',
        homepageUrl: null, documentationUrl: 'https://docs.dataviz.dev/dataset',
        totalDownloads: 5600000, weeklyDownloads: 290000, versionsCount: 10,
        dependenciesCount: 2, dependentsCount: 4100,
        keywords: ['data', 'table', 'transform', 'filter', 'aggregate', 'csv'],
        versions: [
            { version: '1.0.0', assetSizeBytes: 14200, installCount: 150000, publishedAt: new Date('2024-03-01'), platforms: ['linux-x64-gnu'], dependencies: [{ dependencyName: 'csv-parse', versionRange: '^5.0.0' }] },
            { version: '1.1.0', assetSizeBytes: 15300, minifiedSizeBytes: 5600, installCount: 680000, publishedAt: new Date('2024-08-20'), platforms: ['linux-x64-gnu', 'linux-arm64-gnu', 'wasm32-wasi'], dependencies: [{ dependencyName: 'csv-parse', versionRange: '^5.1.0' }] },
        ],
    }, dvUser)

    // ── Organizations ─────────────────────────────────────────
    const coreOrg = await Models.Organizations.create({
        name: 'core', displayName: 'Core Team',
        description: 'Official core packages for the Yogi ecosystem.',
        avatarUrl: null, ownerUserId: coreUser.id, status: 'active',
    } as any)
    console.log(`Created organization: ${coreOrg.name} (id=${coreOrg.id})`)

    const jsOrg = await Models.Organizations.create({
        name: 'js-tooling', displayName: 'JavaScript Tooling',
        description: 'JavaScript and TypeScript tooling packages.',
        avatarUrl: null, ownerUserId: jsUser.id, status: 'active',
    } as any)
    console.log(`Created organization: ${jsOrg.name} (id=${jsOrg.id})`)

    const dvOrg = await Models.Organizations.create({
        name: 'data-viz', displayName: 'Data Visualization',
        description: 'Data visualization and charting packages.',
        avatarUrl: null, ownerUserId: dvUser.id, status: 'active',
    } as any)
    console.log(`Created organization: ${dvOrg.name} (id=${dvOrg.id})`)

    // Link packages to organizations
    for (const [fullName, orgName] of [
        ['@core/http', 'core'], ['@core/zod', 'core'], ['@core/react', 'core'],
        ['@core/logger', 'core'], ['@core/cache', 'core'],
        ['@js-tooling/prettier', 'js-tooling'], ['@js-tooling/eslint', 'js-tooling'],
        ['@js-tooling/typescript', 'js-tooling'],
        ['@data-viz/charts', 'data-viz'], ['@data-viz/dataset', 'data-viz'],
    ]) {
        const pkg = await Models.Packages.findOne({ where: { fullName } })
        const org = await Models.Organizations.findOne({ where: { name: orgName } })
        if (pkg && org) {
            await pkg.update({ ownerOrganizationId: org.id })
        }
    }
    console.log('  Linked all packages to their organizations')

    // ── Create additional users for new orgs ─────────────────
    const securityUser = await Models.Users.create({
        githubUserId: '100', githubLogin: 'security', displayName: 'Security Team',
        avatarUrl: null, profileUrl: null, email: null, role: 'admin', status: 'active',
    } as any)
    console.log(`Created user: ${securityUser.githubLogin} (id=${securityUser.id})`)

    const mobileUser = await Models.Users.create({
        githubUserId: '120', githubLogin: 'mobile', displayName: 'Mobile Team',
        avatarUrl: null, profileUrl: null, email: null, role: 'admin', status: 'active',
    } as any)
    console.log(`Created user: ${mobileUser.githubLogin} (id=${mobileUser.id})`)

    // ── Maintainer users ─────────────────────────────────────
    const maintainers = [
        { githubUserId: '200', githubLogin: 'alice', displayName: 'Alice Johnson' },
        { githubUserId: '201', githubLogin: 'bob', displayName: 'Bob Chen' },
        { githubUserId: '202', githubLogin: 'carol', displayName: 'Carol Martinez' },
        { githubUserId: '203', githubLogin: 'dave', displayName: 'Dave Kim' },
        { githubUserId: '204', githubLogin: 'eve', displayName: 'Eve Thompson' },
        { githubUserId: '205', githubLogin: 'frank', displayName: 'Frank Garcia' },
        { githubUserId: '206', githubLogin: 'grace', displayName: 'Grace Patel' },
        { githubUserId: '207', githubLogin: 'henry', displayName: 'Henry Wilson' },
        { githubUserId: '208', githubLogin: 'iris', displayName: 'Iris Anderson' },
        { githubUserId: '209', githubLogin: 'jack', displayName: 'Jack Brown' },
    ]

    const maintainerUsers: any[] = []
    for (const m of maintainers) {
        const user = await Models.Users.create({
            ...m,
            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(m.displayName)}&background=random&color=fff&size=64`,
            profileUrl: null,
            email: null,
            role: 'maintainer',
            status: 'active',
        } as any)
        maintainerUsers.push(user)
        console.log(`Created maintainer: ${user.githubLogin} (id=${user.id})`)
    }

    // ── Additional Organizations ──────────────────────────────
    const securityOrg = await Models.Organizations.create({
        name: 'security', displayName: 'Security Tools',
        description: 'Security scanning, authentication, and encryption packages.',
        avatarUrl: null, ownerUserId: securityUser.id, status: 'active',
    } as any)
    console.log(`Created organization: ${securityOrg.name} (id=${securityOrg.id})`)

    const mobileOrg = await Models.Organizations.create({
        name: 'mobile', displayName: 'Mobile Development',
        description: 'Cross-platform mobile development and native bridge packages.',
        avatarUrl: null, ownerUserId: mobileUser.id, status: 'active',
    } as any)
    console.log(`Created organization: ${mobileOrg.name} (id=${mobileOrg.id})`)

    // ── Package: @security/auth ──────────────────────────────
    await createScopedPackage('security', 'auth', {
        description: 'Authentication and authorization toolkit for modern applications.',
        license: 'MIT', repositoryUrl: 'https://github.com/security/auth',
        homepageUrl: 'https://security.dev/auth', documentationUrl: 'https://docs.security.dev/auth',
        totalDownloads: 8900000, weeklyDownloads: 520000, versionsCount: 14,
        dependenciesCount: 3, dependentsCount: 4200,
        keywords: ['auth', 'authentication', 'jwt', 'oauth', 'security', 'typescript'],
        versions: [
            { version: '1.0.0', assetSizeBytes: 18200, installCount: 180000, publishedAt: new Date('2023-09-01'), platforms: ['linux-x64-gnu'], dependencies: [{ dependencyName: 'jose', versionRange: '^4.0.0' }] },
            { version: '2.0.0', assetSizeBytes: 22400, minifiedSizeBytes: 8100, installCount: 1200000, publishedAt: new Date('2024-05-15'), platforms: ['linux-x64-gnu', 'linux-x64-musl', 'wasm32-browser'], dependencies: [{ dependencyName: 'jose', versionRange: '^5.0.0' }, { dependencyName: 'safe-buffer', versionRange: '^1.0.0' }] },
        ],
    }, securityUser)

    // ── Package: @security/vault ─────────────────────────────
    await createScopedPackage('security', 'vault', {
        description: 'Encrypted secrets management for environment variables and config.',
        license: 'Apache-2.0', repositoryUrl: 'https://github.com/security/vault',
        homepageUrl: null, documentationUrl: 'https://docs.security.dev/vault',
        totalDownloads: 3400000, weeklyDownloads: 180000, versionsCount: 8,
        dependenciesCount: 2, dependentsCount: 1800,
        keywords: ['vault', 'secrets', 'encryption', 'config', 'security'],
        versions: [
            { version: '1.0.0', assetSizeBytes: 12400, installCount: 85000, publishedAt: new Date('2024-02-01'), platforms: ['linux-x64-gnu'], dependencies: [{ dependencyName: 'crypto-utils', versionRange: '^1.0.0' }] },
            { version: '1.1.0', assetSizeBytes: 13100, minifiedSizeBytes: 4800, installCount: 340000, publishedAt: new Date('2024-10-10'), platforms: ['linux-x64-gnu', 'linux-arm64-gnu', 'linux-x64-musl'], dependencies: [{ dependencyName: 'crypto-utils', versionRange: '^1.1.0' }] },
        ],
    }, securityUser)

    // ── Package: @mobile/native ──────────────────────────────
    await createScopedPackage('mobile', 'native', {
        description: 'React Native bridge and native module utilities.',
        license: 'MIT', repositoryUrl: 'https://github.com/mobile/native',
        homepageUrl: 'https://mobile.dev/native', documentationUrl: 'https://docs.mobile.dev/native',
        totalDownloads: 2100000, weeklyDownloads: 95000, versionsCount: 11,
        dependenciesCount: 3, dependentsCount: 1200,
        keywords: ['mobile', 'react-native', 'native', 'bridge', 'ios', 'android'],
        versions: [
            { version: '1.0.0', assetSizeBytes: 28100, installCount: 42000, publishedAt: new Date('2024-04-01'), platforms: ['ios-arm64', 'android-arm64'], dependencies: [{ dependencyName: 'react-native', versionRange: '^0.72.0' }] },
            { version: '1.1.0', assetSizeBytes: 29400, minifiedSizeBytes: 11200, installCount: 180000, publishedAt: new Date('2024-09-15'), platforms: ['ios-arm64', 'android-arm64', 'macos-arm64'], dependencies: [{ dependencyName: 'react-native', versionRange: '^0.73.0' }] },
        ],
    }, mobileUser)

    // ── Link new packages to organizations ───────────────────
    for (const [fullName, orgName] of [
        ['@security/auth', 'security'], ['@security/vault', 'security'],
        ['@mobile/native', 'mobile'],
    ]) {
        const pkg = await Models.Packages.findOne({ where: { fullName } })
        const org = await Models.Organizations.findOne({ where: { name: orgName } })
        if (pkg && org) {
            await pkg.update({ ownerOrganizationId: org.id })
        }
    }
    console.log('  Linked new packages to their organizations')

    // ── Metrics ──────────────────────────────────────────────
    const totalPackages = await Models.Packages.count()
    const totalVersions = await Models.PackageVersion.count()
    const totalOrganizations = await Models.Organizations.count()
    const totalDownloads = (await Models.Packages.sum('totalDownloads')) || 0
    const weeklyDownloads = (await Models.Packages.sum('weeklyDownloads')) || 0
    const weekAgo = new Date(Date.now() - 7 * 86400000)
    const packageUpdates = await Models.PackageVersion.count({
        where: { publishedAt: { [Op.gte]: weekAgo } },
    })
    const activeOrganizations = await Models.Organizations.count({ where: { status: 'active' } })

    const metricsData: any[] = [
        { key: 'total_packages', value: totalPackages, label: 'Total Packages' },
        { key: 'total_versions', value: totalVersions, label: 'Total Versions' },
        { key: 'total_organizations', value: totalOrganizations, label: 'Total Organizations' },
        { key: 'total_downloads', value: totalDownloads, label: 'Total Downloads' },
        { key: 'weekly_downloads', value: weeklyDownloads, label: 'Weekly Downloads' },
        { key: 'package_updates', value: packageUpdates, label: 'Package Updates' },
        { key: 'verified_organizations', value: activeOrganizations, label: 'Verified Organizations' },
    ]
    for (const m of metricsData) {
        await Models.Metrics.create(m as any)
    }
    console.log(`Created ${metricsData.length} dashboard metrics (weekly_downloads=${weeklyDownloads}, package_updates=${packageUpdates}, verified_organizations=${activeOrganizations}).`)

    // ── Categories ────────────────────────────────────────────
    const allPackages = await Models.Packages.findAll({
        where: { status: 'active', visibility: 'public' },
        attributes: ['keywords'],
        raw: true,
    })
    const categoryMap = new Map<string, number>()
    for (const pkg of allPackages) {
        const keywords: string[] = (pkg as any).keywords || []
        const seen = new Set<string>()
        for (const kw of keywords) {
            if (!seen.has(kw)) {
                seen.add(kw)
                categoryMap.set(kw, (categoryMap.get(kw) || 0) + 1)
            }
        }
    }
    const now = new Date()
    for (const [name, count] of Array.from(categoryMap.entries())) {
        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        await Models.Categories.create({
            name, slug, packageCount: count,
            createdAt: now, updatedAt: now,
        } as any)
    }
    console.log(`Created ${categoryMap.size} categories from package keywords.`)

    console.log(`\nDone! Created ${totalPackages} packages with ${totalVersions} versions total, ${totalOrganizations} organizations.`)
    console.log(`\nDatabase: PostgreSQL (yogi_registry)`)

    await db.close()
}

seed().catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
})
