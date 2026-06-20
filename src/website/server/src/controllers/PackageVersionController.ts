import { Op } from "sequelize";
import { Models } from "../models";
import {
    CreatePackageVersionSchema,
    GetPackageVersionSchema,
    UpdatePackageVersionSchema,
    type CreatePackageVersionInput,
    type UpdatePackageVersionInput,
} from "../schemas/packageVersion.schema";

export class PackageVersionController {
    static async getPackageUpdates(params: { days: number }) {
        try {
            const { days } = params;
            const since = new Date(Date.now() - days * 86400000);
            const count = await Models.PackageVersion.count({
                where: { publishedAt: { [Op.gte]: since } },
            });
            return { count };
        } catch (error) {
            return { error };
        }
    }


    static async getVersions(params: { packageName?: string; limit?: number; offset?: number }, attributes: any = {}) {
        const { packageName, limit, offset } = params;
        const where = packageName
            ? { '$package.name$': packageName }
            : {};
        const attrs = [...(attributes.version || [])];
        const versions = await Models.PackageVersion.findAll({
            where,
            ...(attrs.length ? { attributes: attrs } : {}),
            limit: limit ? Math.min(limit, 100) : undefined,
            offset: offset ?? undefined,
            order: [['publishedAt', 'DESC']],
            include: [{
                model: Models.Packages, as: 'package',
                attributes: ['name'],
            }]
        });
        return { versions };
    }

    static async getVersion(params: unknown, attributes: any = {}) {
        try {
            const parsed = GetPackageVersionSchema.parse(params);
            const verAttrs = [...(attributes.version || [])];
            const pkgAttrs = [...(attributes.package || [])];
            const version = await Models.PackageVersion.findOne({
                where: { version: parsed.version },
                ...(verAttrs.length ? { attributes: verAttrs } : {}),
                include: [{
                    model: Models.Packages, as: 'package',
                    where: { name: parsed.packageName },
                    ...(pkgAttrs.length ? { attributes: pkgAttrs } : {}),
                }]
            });
            return { version };
        } catch (error) {
            return { error };
        }
    }

    static async createVersion(params: unknown) {
        try {
            const parsed = CreatePackageVersionSchema.parse(params);
            const versionData = {
                ...parsed,
                description: parsed.description ?? "",
                readmeText: parsed.readmeText ?? "",
                license: parsed.license ?? "MIT",
            };
            const version = await Models.PackageVersion.create(versionData as any);
            return { version };
        } catch (error) {
            return { error };
        }
    }

    static async updateVersion(params: { packageName: string; version: string; input: UpdatePackageVersionInput }) {
        try {
            const { packageName, version, input } = params;
            const parsed = UpdatePackageVersionSchema.parse(input);
            const ver = await Models.PackageVersion.findOne({
                include: [{
                    model: Models.Packages, as: 'package',
                    where: { name: packageName },
                }],
                where: { version },
            });
            if (!ver) {
                return { error: { message: 'Package version not found' } };
            }
            await ver.update(parsed as any);
            return { version: ver };
        } catch (error) {
            return { error };
        }
    }

    static async deleteVersion(params: { packageName: string; version: string }) {
        try {
            const { packageName, version } = params;
            const ver = await Models.PackageVersion.findOne({
                include: [{
                    model: Models.Packages, as: 'package',
                    where: { name: packageName },
                }],
                where: { version },
            });
            if (!ver) {
                return { error: { message: 'Package version not found' } };
            }
            await ver.destroy();
            return { success: true };
        } catch (error) {
            return { error };
        }
    }

    static async versionsByPackage(packageName: string, attributes?: string[]) {
        try {
            const versions = await Models.PackageVersion.findAll({
                include: [{
                    model: Models.Packages, as: 'package',
                    where: { name: packageName },
                    attributes: [],
                }],
                attributes,
                order: [['publishedAt', 'DESC']],
            });
            return { versions };
        } catch (error) {
            return { error: String(error) };
        }
    }
}

export default PackageVersionController;
