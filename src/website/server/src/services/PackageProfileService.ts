import { Models } from "../models";

export type PackageProfileDTO = {
    id: number;
    fullName: string;
    scope: string | null;
    name: string;
    displayName: string | null;
    description: string | null;
    readmeText: string | null;
    installCommand: string;
    latestVersion: string | null;
    license: string | null;
    logo: string | null;
    status: string;
    verificationStatus: string;
    repositoryUrl: string | null;
    homepageUrl: string | null;
    documentationUrl: string | null;
    weeklyDownloads: number;
    totalDownloads: number;
    versionsCount: number;
    dependenciesCount: number;
    dependentsCount: number;
    lastPublishedAt: Date | null;
    keywords: string[];
    maintainers: Array<{
        userId: number;
        username: string;
        avatarUrl: string | null;
        role: string;
    }>;
    security: {
        status: string;
        vulnerabilitiesCount: number;
        malwareScanStatus: string;
        lastScannedAt: Date | null;
    } | null;
    latestVersionRecord: {
        id: number;
        version: string;
        assetSizeBytes: number;
        minifiedSizeBytes: number | null;
        publishedAt: Date;
    } | null;
    downloadTrend: Array<{
        date: string;
        downloads: number;
    }>;
};

export async function getPackageProfile(fullName: string): Promise<PackageProfileDTO | null> {
    const pkg = await Models.Packages.findOne({
        where: { fullName },
        include: [
            {
                model: Models.Users,
                as: "owner",
                attributes: ["id", "githubLogin", "displayName", "avatarUrl"],
                required: false,
            },
            {
                model: Models.PackageVersion,
                as: "latestVersionRecord",
                attributes: ["id", "version", "assetSizeBytes", "minifiedSizeBytes", "publishedAt"],
                required: false,
            },
        ],
    });

    if (!pkg) return null;

    const scopePrefix = pkg.scope ? `@${pkg.scope}/` : "";
    const maintainers = (pkg.maintainers || []) as Array<{ userId: number; role: string }>;

    return {
        id: pkg.id,
        fullName: pkg.fullName,
        scope: pkg.scope,
        name: pkg.name,
        displayName: pkg.displayName,
        description: pkg.description,
        readmeText: pkg.readmeText,
        installCommand: `yogi add ${scopePrefix}${pkg.name}`,
        latestVersion: pkg.latestVersion,
        license: pkg.license,
        logo: pkg.logo,
        status: pkg.status,
        verificationStatus: pkg.verificationStatus,
        repositoryUrl: pkg.repositoryUrl,
        homepageUrl: pkg.homepageUrl,
        documentationUrl: pkg.documentationUrl,
        weeklyDownloads: pkg.weeklyDownloads,
        totalDownloads: pkg.totalDownloads,
        versionsCount: pkg.versionsCount,
        dependenciesCount: pkg.dependenciesCount,
        dependentsCount: pkg.dependentsCount,
        lastPublishedAt: pkg.lastPublishedAt,
        keywords: pkg.keywords || [],
        maintainers: maintainers.map(m => ({
            userId: m.userId,
            username: "",
            avatarUrl: null as string | null,
            role: m.role,
        })),
        security: pkg.security ? (pkg.security as {
            status: string;
            vulnerabilitiesCount: number;
            malwareScanStatus: string;
            lastScannedAt: Date | null;
        }) : null,
        latestVersionRecord: pkg.latestVersionRecord
            ? {
                id: pkg.latestVersionRecord.id,
                version: pkg.latestVersionRecord.version,
                assetSizeBytes: pkg.latestVersionRecord.assetSizeBytes,
                minifiedSizeBytes: pkg.latestVersionRecord.minifiedSizeBytes,
                publishedAt: pkg.latestVersionRecord.publishedAt,
            }
            : null,
        downloadTrend: (pkg.downloadTrend || []) as Array<{
            date: string;
            downloads: number;
        }>,
    };
}
