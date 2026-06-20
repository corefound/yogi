import { Models } from "../models";
import {
    CreatePackageSchema,
    UpdatePackageSchema,
    UpsertPackageSchema,
    GetPackageSchema,
    type CreatePackageInput,
    type UpdatePackageInput,
    type UpsertPackageInput,
} from "../schemas/package.schema";

export class PackageController {
    static async getTrendingPackages(params: { limit?: number } = {}, attributes: any = {}) {
        const { limit } = params;
        const attrs = [...(attributes?.packages || [])];
        const packages = await Models.Packages.findAll({
            ...(attrs.length ? { attributes: attrs } : {}),
            limit: limit ? Math.min(limit, 50) : 10,
            order: [['weeklyDownloads', 'DESC']],
        });
        return { packages };
    }

    static async getAllPackages(params: { limit?: number; offset?: number } = {}, attributes: any = {}) {
        const { limit, offset } = params;
        const attrs = [...(attributes?.package || [])];
        const packages = await Models.Packages.findAll({
            ...(attrs.length ? { attributes: attrs } : {}),
            limit: limit ? Math.min(limit, 100) : undefined,
            offset: offset ?? undefined,
        });

        return { packages };
    }

    static async getPackage(params: unknown, attributes: any = {}) {
        try {
            const parsed = GetPackageSchema.parse(params);
            const pkgAttrs = [...(attributes.package || [])];
            const ownerAttrs = [...(attributes.owner || attributes.user || [])];

            const essential = ['id', 'ownerUserId'].filter(f => !pkgAttrs.includes(f));
            if (essential.length && pkgAttrs.length) {
                pkgAttrs.push(...essential);
            }

            const pkg = await Models.Packages.findOne({
                where: { name: parsed.name },
                ...(pkgAttrs.length ? { attributes: pkgAttrs } : {}),
                include: [{
                    model: Models.Users, as: 'owner',
                    ...(ownerAttrs.length ? { attributes: ownerAttrs } : {}),
                }]
            });
            return { package: pkg };
        } catch (error) {
            return { error };
        }
    }

    static async createPackage(params: unknown) {
        try {
            const parsed = CreatePackageSchema.parse(params);
            const packageData = {
                ...parsed,
                description: parsed.description ?? null,
                readmeText: parsed.readmeText ?? null,
                license: parsed.license ?? null,
                repositoryUrl: parsed.repositoryUrl || null,
                homepageUrl: parsed.homepageUrl || null,
                documentationUrl: parsed.documentationUrl || null,
            };
            const pkg = await Models.Packages.create(packageData as any);
            return { package: pkg };
        } catch (error) {
            return { error };
        }
    }

    static async updatePackage(params: { name: string; input: UpdatePackageInput }) {
        try {
            const { name, input } = params;
            const parsed = UpdatePackageSchema.parse(input);
            const [affected] = await Models.Packages.update(parsed as any, {
                where: { name },
            });
            if (affected === 0) {
                return { error: { message: 'Package not found' } };
            }
            const pkg = await Models.Packages.findOne({ where: { name } });
            return { package: pkg };
        } catch (error) {
            return { error };
        }
    }

    static async upsertPackage(params: UpsertPackageInput) {
        try {
            const parsed = UpsertPackageSchema.parse(params);
            const [pkg, created] = await Models.Packages.findOrCreate({
                where: { name: parsed.name },
                defaults: {
                    ...parsed,
                    description: parsed.description ?? null,
                    readmeText: parsed.readmeText ?? null,
                    license: parsed.license ?? null,
                    repositoryUrl: parsed.repositoryUrl || null,
                    homepageUrl: parsed.homepageUrl || null,
                    documentationUrl: parsed.documentationUrl || null,
                } as any,
            });
            if (!created) {
                await pkg.update({
                    ...parsed,
                    description: parsed.description ?? null,
                    readmeText: parsed.readmeText ?? null,
                    license: parsed.license ?? null,
                    repositoryUrl: parsed.repositoryUrl || null,
                    homepageUrl: parsed.homepageUrl || null,
                    documentationUrl: parsed.documentationUrl || null,
                } as any);
            }
            return { package: pkg, created };
        } catch (error) {
            return { error };
        }
    }

    static async deletePackage(params: { name: string }) {
        try {
            const { name } = params;
            const affected = await Models.Packages.destroy({ where: { name } });
            if (affected === 0) {
                return { error: { message: 'Package not found' } };
            }
            return { success: true };
        } catch (error) {
            return { error };
        }
    }
}

export default PackageController;
