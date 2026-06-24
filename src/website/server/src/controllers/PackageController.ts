import { Op, Sequelize } from "sequelize";
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
    static slugify(name: string): string {
        return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }

    static async syncCategories(): Promise<void> {
        const packages = await Models.Packages.findAll({
            where: { status: 'active', visibility: 'public' },
            attributes: ['keywords'],
            raw: true,
        });

        const categoryMap = new Map<string, number>();
        for (const pkg of packages) {
            const keywords: string[] = (pkg as any).keywords || [];
            const seen = new Set<string>();
            for (const kw of keywords) {
                if (!seen.has(kw)) {
                    seen.add(kw);
                    categoryMap.set(kw, (categoryMap.get(kw) || 0) + 1);
                }
            }
        }

        const now = new Date();
        const entries = Array.from(categoryMap.entries());

        for (const [name, count] of entries) {
            const slug = this.slugify(name);
            await Models.Categories.upsert({
                name,
                slug,
                packageCount: count,
                createdAt: now,
                updatedAt: now,
            } as any);
        }

        const activeSlugs = entries.map(([name]) => this.slugify(name));
        if (activeSlugs.length > 0) {
            await Models.Categories.destroy({
                where: {
                    slug: { [Op.notIn]: activeSlugs },
                },
            });
        }
    }

    static async getCategories(params: { limit?: number } = {}, attributes: any = {}) {
        const count = await Models.Categories.count();
        if (count === 0) {
            await this.syncCategories();
        }

        const categories = await Models.Categories.findAll({
            order: [['packageCount', 'DESC']],
        });

        let resultCategories = categories.map(c => ({
            name: c.name,
            slug: c.slug,
            packageCount: c.packageCount,
        }));

        let remainingPackageCount = 0;
        if (params.limit && params.limit > 0) {
            remainingPackageCount = resultCategories
                .slice(params.limit)
                .reduce((sum, c) => sum + c.packageCount, 0);
            resultCategories = resultCategories.slice(0, params.limit);
        }

        return {
            categories: resultCategories,
            remainingPackageCount,
        };
    }
    
    static async getTrendingPackages(params: { limit?: number } = {}, attributes: any = {}) {
        const { limit } = params;
        const attrs = [...(attributes?.packages || [])];
        const packages = await Models.Packages.findAll({
            ...(attrs.length ? { attributes: attrs } : {}),
            limit: Math.min(limit ?? 4, 4),
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

    static async getCategory(params: { slug: string }) {
        const category = await Models.Categories.findOne({
            where: { slug: params.slug },
        });
        if (!category) return null;
        return {
            name: category.name,
            slug: category.slug,
            packageCount: category.packageCount,
        };
    }

    static async search(params: { query: string; limit?: number }, attributes: any = {}) {
        const { query, limit } = params;
        const searchLimit = Math.min(limit ?? 5, 10);
        const like = `%${query}%`;

        const packages = await Models.Packages.findAll({
            where: {
                status: 'active',
                visibility: 'public',
                [Op.or]: [
                    { name: { [Op.iLike]: like } },
                    { fullName: { [Op.iLike]: like } },
                    { description: { [Op.iLike]: like } },
                ],
            },
            limit: searchLimit,
            order: [['weeklyDownloads', 'DESC']],
        });

        const organizations = await Models.Organizations.findAll({
            where: {
                status: 'active',
                [Op.or]: [
                    { name: { [Op.iLike]: like } },
                    { displayName: { [Op.iLike]: like } },
                    { description: { [Op.iLike]: like } },
                ],
            },
            limit: searchLimit,
        });

        return { packages, organizations };
    }

    static async getPackagesByCategory(params: { slug: string }, attributes: any = {}) {
        const category = await Models.Categories.findOne({
            where: { slug: params.slug },
        });
        if (!category) return { packages: [], category: null };

        let attrs = [...(attributes?.packagesByCategory || [])];
        const essential = ['id', 'ownerUserId'].filter(f => !attrs.includes(f));
        if (essential.length && attrs.length) {
            attrs.push(...essential);
        }

        const packages = await Models.Packages.findAll({
            ...(attrs.length ? { attributes: attrs } : {}),
            where: {
                status: 'active',
                visibility: 'public',
                [Op.and]: Sequelize.literal(`keywords ? '${category.name.replace(/'/g, "''")}'`),
            },
        });

        return {
            packages,
            category: {
                name: category.name,
                slug: category.slug,
                packageCount: category.packageCount,
            },
        };
    }
}

export default PackageController;
