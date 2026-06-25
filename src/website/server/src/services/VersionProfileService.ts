import { Models } from "../models";
import { Op } from "sequelize";

export type VersionProfileDTO = {
    packageId: number;
    fullName: string;
    scope: string | null;
    name: string;
    displayName: string | null;
    description: string | null;
    license: string | null;
    logo: string | null;
    status: string;
    verificationStatus: string;
    repositoryUrl: string | null;
    homepageUrl: string | null;
    documentationUrl: string | null;
    totalDownloads: number;
    weeklyDownloads: number;
    versionsCount: number;
    dependenciesCount: number;
    dependentsCount: number;
    keywords: string[];
    maintainers: Array<{
        userId: number;
        username: string;
        avatarUrl: string | null;
        role: string;
    }>;
    owner: {
        githubLogin: string;
        displayName: string;
        avatarUrl: string;
    } | null;

    versionId: number;
    version: string;
    versionDescription: string | null;
    versionReadmeText: string | null;
    assetSizeBytes: number;
    minifiedSizeBytes: number | null;
    installCount: number;
    checksum: string | null;
    tarballUrl: string | null;
    platforms: string[];
    dependencies: object[];
    assets: object[];
    publishedAt: Date;
    publishedByUserId: number | null;

    security: {
        status: string;
        vulnerabilitiesCount: number;
        malwareScanStatus: string;
        lastScannedAt: Date | null;
        vulnerabilities: Array<{
            id: string;
            severity: string;
            type: string;
            title: string;
            description: string;
            packageName: string;
            versionRange: string;
            fixedIn: string | null;
            reportedAt: string;
            status: string;
        }>;
    } | null;

    downloadTrend: Array<{
        date: string;
        downloads: number;
    }>;

    isLatestVersion: boolean;
    installCommand: string;
    versions: Array<{
        id: number;
        version: string;
        description: string | null;
        assetSizeBytes: number;
        installCount: number;
        platforms: string[];
        publishedAt: Date;
    }>;
};

export async function getVersionProfile(nameOrFullName: string, versionStr: string): Promise<VersionProfileDTO | null> {
    const pkg = await Models.Packages.findOne({
        where: {
            [Op.or]: [
                { name: nameOrFullName },
                { fullName: nameOrFullName },
            ],
        },
        include: [
            {
                model: Models.Users,
                as: "owner",
                attributes: ["githubLogin", "displayName", "avatarUrl"],
                required: false,
            },
        ],
    });

    if (!pkg) return null;

    const version = await Models.PackageVersion.findOne({
        where: { version: versionStr, packageId: pkg.id },
    });

    if (!version) return null;

    const scopePrefix = pkg.scope ? `@${pkg.scope}/` : "";
    const maintainers = (pkg.maintainers || []) as Array<{ userId: number; role: string }>;

    const allVersions = await Models.PackageVersion.findAll({
        where: { packageId: pkg.id },
        attributes: ["id", "version", "description", "assetSizeBytes", "installCount", "platforms", "publishedAt"],
        order: [["publishedAt", "DESC"]],
    });

    return {
        packageId: pkg.id,
        fullName: pkg.fullName,
        scope: pkg.scope,
        name: pkg.name,
        displayName: pkg.displayName,
        description: pkg.description,
        license: version.license || pkg.license,
        logo: pkg.logo,
        status: version.status || pkg.status,
        verificationStatus: pkg.verificationStatus,
        repositoryUrl: pkg.repositoryUrl,
        homepageUrl: pkg.homepageUrl,
        documentationUrl: pkg.documentationUrl,
        totalDownloads: pkg.totalDownloads,
        weeklyDownloads: pkg.weeklyDownloads,
        versionsCount: pkg.versionsCount,
        dependenciesCount: pkg.dependenciesCount,
        dependentsCount: pkg.dependentsCount,
        keywords: pkg.keywords || [],

        maintainers: maintainers.map(m => ({
            userId: m.userId,
            username: "",
            avatarUrl: null as string | null,
            role: m.role,
        })),
        owner: pkg.owner
            ? {
                githubLogin: pkg.owner.githubLogin,
                displayName: pkg.owner.displayName,
                avatarUrl: pkg.owner.avatarUrl,
            }
            : null,

        versionId: version.id,
        version: version.version,
        versionDescription: version.description,
        versionReadmeText: version.readmeText,
        assetSizeBytes: version.assetSizeBytes,
        minifiedSizeBytes: version.minifiedSizeBytes,
        installCount: version.installCount,
        checksum: version.checksum,
        tarballUrl: version.tarballUrl,
        platforms: version.platforms || [],
        dependencies: version.dependencies || [],
        assets: version.assets || [],
        publishedAt: version.publishedAt,
        publishedByUserId: version.publishedByUserId,

        security: pkg.security ? (pkg.security as {
            status: string;
            vulnerabilitiesCount: number;
            malwareScanStatus: string;
            lastScannedAt: Date | null;
            vulnerabilities: Array<{
                id: string;
                severity: string;
                type: string;
                title: string;
                description: string;
                packageName: string;
                versionRange: string;
                fixedIn: string | null;
                reportedAt: string;
                status: string;
            }>;
        }) : null,

        downloadTrend: (pkg.downloadTrend || []) as Array<{
            date: string;
            downloads: number;
        }>,

        isLatestVersion: version.version === pkg.latestVersion,
        installCommand: `yogi add ${scopePrefix}${pkg.name}@${version.version}`,
        versions: allVersions.map(v => ({
            id: v.id,
            version: v.version,
            description: v.description,
            assetSizeBytes: v.assetSizeBytes,
            installCount: v.installCount,
            platforms: v.platforms || [],
            publishedAt: v.publishedAt,
        })),
    };
}
