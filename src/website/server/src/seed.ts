import { Op } from 'sequelize'
import { db } from './config/db'
import { Models } from './models'

async function seed() {
    await db.authenticate()
    await db.sync({ force: true, logging: false })

    // ── Create user ─────────────────────────────────────────
    const coreUser = await Models.Users.create({
        githubUserId: '20',
        githubLogin: 'core',
        displayName: 'Core Team',
        avatarUrl: null,
        profileUrl: null,
        email: null,
        role: 'admin',
        status: 'active',
    } as any)
    console.log(`Created user: ${coreUser.githubLogin} (id=${coreUser.id})`)

    const jsUser = await Models.Users.create({
        githubUserId: '40',
        githubLogin: 'js-tooling',
        displayName: 'JavaScript Tooling',
        avatarUrl: null,
        profileUrl: null,
        email: null,
        role: 'admin',
        status: 'active',
    } as any)
    console.log(`Created user: ${jsUser.githubLogin} (id=${jsUser.id})`)

    // ── Helper: create scoped package ───────────────────────
    async function createScopedPackage(scope: string, pkgName: string, data: {
        description: string
        license: string
        repositoryUrl?: string
        homepageUrl?: string
        documentationUrl?: string
        totalDownloads: number
        weeklyDownloads: number
        versionsCount: number
        dependenciesCount: number
        dependentsCount: number
        keywords: string[]
        platforms: string[]
        versions: Array<{
            version: string
            description?: string
            assetSizeBytes: number
            minifiedSizeBytes?: number | null
            installCount: number
            publishedAt: Date
            dependencies?: Array<{
                dependencyName: string
                versionRange: string
                dependencyType?: string
            }>
        }>
        security?: {
            status: string
            vulnerabilitiesCount: number
            malwareScanStatus: string
            lastScannedAt?: Date
        }
    }, ownerUser: any) {
        const fullName = scope ? `@${scope}/${pkgName}` : pkgName
        const latestVer = data.versions[data.versions.length - 1]

        // Build JSON arrays
        const maintainers = [{ userId: ownerUser.id, role: 'owner' }]
        const weeklyTotal = data.weeklyDownloads
        const downloadTrend = []
        for (let i = 29; i >= 0; i--) {
            const day = new Date(Date.now() - i * 86400000)
            const dayMultiplier = i < 7 ? 1 : i < 14 ? 0.85 : i < 21 ? 0.7 : 0.5
            const dailyAvg = weeklyTotal / 7
            const variance = (Math.random() * 0.4 + 0.8)
            const downloads = Math.round(dailyAvg * dayMultiplier * variance)
            downloadTrend.push({
                date: day.toISOString().slice(0, 10),
                downloads,
            })
        }

        const pkg = await Models.Packages.create({
            scope,
            name: pkgName,
            fullName,
            displayName: null,
            description: data.description,
            readmeText: `# ${fullName}\n\n${data.description}\n\n## Installation\n\n\`\`\`\nyogi add ${fullName}\n\`\`\`\n\n## Usage\n\n\`\`\`typescript\nimport { ${pkgName.replace(/[-/]/g, '_')} } from '${fullName}'\n\`\`\`\n\n## License\n\n${data.license}\n`,
            license: data.license,
            ownerUserId: ownerUser.id,
            ownerOrganizationId: null,
            visibility: 'public',
            status: 'active',
            verificationStatus: 'verified',
            repoFullName: `${scope}/${pkgName}`,
            githubRepoId: Math.floor(Math.random() * 100000) + 1,
            repositoryUrl: data.repositoryUrl ?? null,
            homepageUrl: data.homepageUrl ?? null,
            documentationUrl: data.documentationUrl ?? null,
            latestVersionId: null,
            latestVersion: latestVer?.version ?? null,
            totalDownloads: data.totalDownloads,
            weeklyDownloads: data.weeklyDownloads,
            versionsCount: data.versionsCount,
            dependenciesCount: data.dependenciesCount,
            dependentsCount: data.dependentsCount,
            lastPublishedAt: latestVer?.publishedAt ?? null,
            lastCheckedAt: new Date(),
            keywords: data.keywords,
            platforms: data.platforms,
            maintainers,
            security: data.security ?? null,
            downloadTrend,
        } as any)

        // Create versions with JSON assets and dependencies
        const createdVersions: any[] = []
        for (const ver of data.versions) {
            const v = await Models.PackageVersion.create({
                packageId: pkg.id,
                version: ver.version,
                description: ver.description ?? null,
                readmeText: null,
                license: data.license,
                status: 'active',
                assetSizeBytes: ver.assetSizeBytes,
                minifiedSizeBytes: ver.minifiedSizeBytes ?? null,
                installCount: ver.installCount,
                checksum: null,
                tarballUrl: null,
                githubReleaseId: null,
                githubReleaseTag: `v${ver.version}`,
                publishedByUserId: ownerUser.id,
                publishedAt: ver.publishedAt,
                dependencies: ver.dependencies ?? [],
                assets: [
                    {
                        target: 'src',
                        artifactType: 'source',
                        fileName: `${pkgName}-${ver.version}.tar.gz`,
                        url: `https://registry.yogi.dev/packages/${fullName}/-/${pkgName}-${ver.version}.tar.gz`,
                        sizeBytes: ver.assetSizeBytes,
                        checksum: null,
                    },
                ],
            } as any)
            createdVersions.push(v)
        }

        // Link latest version
        if (createdVersions.length > 0) {
            const latest = createdVersions[createdVersions.length - 1]
            await pkg.update({ latestVersionId: latest.id, latestVersion: latest.version })
        }

        console.log(`  ✓ Created package: ${fullName} (${data.versions.length} versions)`)
        return pkg
    }

    // ── Seed @core/http ─────────────────────────────────────
    await createScopedPackage('core', 'http', {
        description: 'Lightweight, composable HTTP client for Node.js and the browser.',
        license: 'MIT',
        repositoryUrl: 'https://github.com/core/http',
        homepageUrl: 'https://core.dev/http',
        documentationUrl: 'https://docs.core.dev/http',
        totalDownloads: 48600000,
        weeklyDownloads: 1280000,
        versionsCount: 54,
        dependenciesCount: 3,
        dependentsCount: 12840,
        keywords: ['http', 'client', 'fetch', 'promise', 'browser', 'node', 'typescript', 'isomorphic'],
        platforms: ['node', 'browser', 'macos-arm64', 'linux-x64'],
        versions: [
            {
                version: '0.1.0',
                assetSizeBytes: 12800,
                installCount: 120000,
                publishedAt: new Date('2023-06-15'),
                dependencies: [{ dependencyName: 'shared-types', versionRange: '^1.0.0' }],
            },
            {
                version: '1.0.0',
                description: 'First stable release of @core/http',
                assetSizeBytes: 24500,
                minifiedSizeBytes: 8900,
                installCount: 850000,
                publishedAt: new Date('2023-09-01'),
                dependencies: [
                    { dependencyName: 'shared-types', versionRange: '^1.2.0' },
                    { dependencyName: 'zod', versionRange: '^3.0.0' },
                ],
            },
            {
                version: '1.5.0',
                assetSizeBytes: 26100,
                minifiedSizeBytes: 9200,
                installCount: 2100000,
                publishedAt: new Date('2024-01-10'),
                dependencies: [
                    { dependencyName: 'shared-types', versionRange: '^1.5.0' },
                    { dependencyName: 'zod', versionRange: '^3.2.0' },
                ],
            },
            {
                version: '2.0.0',
                description: 'Major rewrite with streaming support',
                assetSizeBytes: 32100,
                minifiedSizeBytes: 11800,
                installCount: 5600000,
                publishedAt: new Date('2024-06-20'),
                dependencies: [
                    { dependencyName: 'shared-types', versionRange: '^2.0.0' },
                    { dependencyName: 'zod', versionRange: '^3.4.0' },
                    { dependencyName: 'abort-controller', versionRange: '^1.0.0' },
                ],
            },
            {
                version: '2.3.0',
                assetSizeBytes: 33400,
                minifiedSizeBytes: 12100,
                installCount: 9200000,
                publishedAt: new Date('2024-10-05'),
                dependencies: [
                    { dependencyName: 'shared-types', versionRange: '^2.1.0' },
                    { dependencyName: 'zod', versionRange: '^3.6.0' },
                    { dependencyName: 'abort-controller', versionRange: '~1.0.2' },
                ],
            },
            {
                version: '2.3.1',
                description: 'Latest version of @core/http',
                assetSizeBytes: 33400,
                minifiedSizeBytes: 12100,
                installCount: 12400000,
                publishedAt: new Date('2025-01-28'),
                dependencies: [
                    { dependencyName: 'shared-types', versionRange: '^2.1.0' },
                    { dependencyName: 'zod', versionRange: '^3.6.0' },
                    { dependencyName: 'abort-controller', versionRange: '~1.0.2' },
                ],
            },
        ],
        security: {
            status: 'passed',
            vulnerabilitiesCount: 0,
            malwareScanStatus: 'passed',
        },
    }, coreUser)

    // ── Seed @core/zod ──────────────────────────────────────
    await createScopedPackage('core', 'zod', {
        description: 'TypeScript-first schema validation with static type inference.',
        license: 'MIT',
        repositoryUrl: 'https://github.com/core/zod',
        homepageUrl: 'https://core.dev/zod',
        documentationUrl: 'https://docs.core.dev/zod',
        totalDownloads: 18200000,
        weeklyDownloads: 675000,
        versionsCount: 42,
        dependenciesCount: 1,
        dependentsCount: 25400,
        keywords: ['validation', 'typescript', 'schema', 'types', 'parser'],
        platforms: ['node', 'browser', 'deno', 'bun'],
        versions: [
            {
                version: '1.0.0',
                assetSizeBytes: 8400,
                installCount: 112000,
                publishedAt: new Date('2023-08-01'),
                dependencies: [],
            },
            {
                version: '2.0.0',
                assetSizeBytes: 12100,
                minifiedSizeBytes: 4500,
                installCount: 890000,
                publishedAt: new Date('2024-02-14'),
                dependencies: [{ dependencyName: 'shared-types', versionRange: '^1.0.0' }],
            },
            {
                version: '3.0.0',
                assetSizeBytes: 15600,
                minifiedSizeBytes: 5800,
                installCount: 4500000,
                publishedAt: new Date('2024-11-01'),
                dependencies: [{ dependencyName: 'shared-types', versionRange: '^2.0.0' }],
            },
        ],
        security: {
            status: 'passed',
            vulnerabilitiesCount: 0,
            malwareScanStatus: 'passed',
        },
    }, coreUser)

    // ── Seed @js-tooling/prettier ───────────────────────────
    await createScopedPackage('js-tooling', 'prettier', {
        description: 'An opinionated code formatter — supports many languages.',
        license: 'MIT',
        repositoryUrl: 'https://github.com/js-tooling/prettier',
        homepageUrl: 'https://prettier.io',
        documentationUrl: 'https://prettier.io/docs',
        totalDownloads: 48500000,
        weeklyDownloads: 2100000,
        versionsCount: 56,
        dependenciesCount: 5,
        dependentsCount: 34200,
        keywords: ['formatter', 'code', 'prettier', 'style', 'javascript', 'typescript', 'css'],
        platforms: ['node', 'bun', 'deno'],
        versions: [
            {
                version: '1.0.0',
                assetSizeBytes: 48000,
                installCount: 2500000,
                publishedAt: new Date('2023-01-15'),
                dependencies: [{ dependencyName: 'resolve-config', versionRange: '^1.0.0' }],
            },
            {
                version: '2.0.0',
                assetSizeBytes: 52000,
                minifiedSizeBytes: 18500,
                installCount: 8900000,
                publishedAt: new Date('2024-04-20'),
                dependencies: [
                    { dependencyName: 'resolve-config', versionRange: '^2.0.0' },
                    { dependencyName: 'plugin-json', versionRange: '^1.0.0' },
                    { dependencyName: 'plugin-markdown', versionRange: '^1.0.0' },
                ],
            },
            {
                version: '3.0.0',
                description: 'Major update with YAML and TOML support',
                assetSizeBytes: 68900,
                minifiedSizeBytes: 22100,
                installCount: 18200000,
                publishedAt: new Date('2025-03-01'),
                dependencies: [
                    { dependencyName: 'resolve-config', versionRange: '^3.0.0' },
                    { dependencyName: 'plugin-json', versionRange: '^2.0.0' },
                    { dependencyName: 'plugin-markdown', versionRange: '^2.0.0' },
                    { dependencyName: 'plugin-yaml', versionRange: '^1.0.0' },
                ],
            },
        ],
        security: {
            status: 'passed',
            vulnerabilitiesCount: 0,
            malwareScanStatus: 'passed',
        },
    }, jsUser)

    // ── Seed Organizations ───────────────────────────────────
    const coreOrg = await Models.Organizations.create({
        name: 'core',
        displayName: 'Core Team',
        description: 'Official core packages for the Yogi ecosystem.',
        avatarUrl: null,
        ownerUserId: coreUser.id,
        status: 'active',
    } as any)
    console.log(`Created organization: ${coreOrg.name} (id=${coreOrg.id})`)

    const jsOrg = await Models.Organizations.create({
        name: 'js-tooling',
        displayName: 'JavaScript Tooling',
        description: 'JavaScript and TypeScript tooling packages.',
        avatarUrl: null,
        ownerUserId: jsUser.id,
        status: 'active',
    } as any)
    console.log(`Created organization: ${jsOrg.name} (id=${jsOrg.id})`)

    // Link packages to organizations
    const coreHttp = await Models.Packages.findOne({ where: { fullName: '@core/http' } })
    if (coreHttp) {
        await coreHttp.update({ ownerOrganizationId: coreOrg.id })
        console.log(`  Linked @core/http → organization "core"`)
    }

    const jsPrettier = await Models.Packages.findOne({ where: { fullName: '@js-tooling/prettier' } })
    if (jsPrettier) {
        await jsPrettier.update({ ownerOrganizationId: jsOrg.id })
        console.log(`  Linked @js-tooling/prettier → organization "js-tooling"`)
    }

    // ── Seed Metrics (real computed values) ──────────────────
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

    // ── Summary ────────────────────────────────────────────
    console.log(`\nDone! Created ${totalPackages} packages with ${totalVersions} versions total, ${totalOrganizations} organizations.`)
    console.log(`\nDatabase: PostgreSQL (yogi_registry)`)

    await db.close()
}

seed().catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
})
