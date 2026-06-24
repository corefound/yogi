import { Models } from "../models";
import {
    CreateOrganizationSchema,
    UpdateOrganizationSchema,
    GetOrganizationSchema,
    type CreateOrganizationInput,
    type UpdateOrganizationInput,
} from "../schemas/organization.schema";

export class OrganizationController {
    static async getAllOrganizations(params: { limit?: number; offset?: number } = {}, attributes: any = {}) {
        const { limit, offset } = params;
        const attrs = [...(attributes.organization || [])];
        const organizations = await Models.Organizations.findAll({
            ...(attrs.length ? { attributes: attrs } : {}),
            limit: limit ? Math.min(limit, 100) : undefined,
            offset: offset ?? undefined,
            order: [['createdAt', 'DESC']],
        });
        return { organizations };
    }

    static async getPopularOrganizations(params: { limit?: number } = {}, attributes: any = {}) {
        const { limit } = params;

        const orgs = await Models.Organizations.findAll({
            include: [{
                model: Models.Packages,
                as: 'packages',
                attributes: ['weeklyDownloads', 'totalDownloads'],
                required: false,
            }],
        });

        const sorted = orgs
            .map(org => ({
                ...org.toJSON(),
                totalWeeklyDownloads: (org.packages || []).reduce((sum, p: any) => sum + (p.weeklyDownloads || 0), 0),
            }))
            .sort((a, b) => b.totalWeeklyDownloads - a.totalWeeklyDownloads)
            .slice(0, limit || 3);

        return { organizations: sorted };
    }

    static async getOrganization(params: unknown, attributes: any = {}) {
        try {
            const parsed = GetOrganizationSchema.parse(params);
            const orgAttrs = [...(attributes.organization || [])];
            const ownerAttrs = [...(attributes.owner || attributes.user || [])];

            const essential = ['id', 'ownerUserId'].filter(f => !orgAttrs.includes(f));
            if (essential.length && orgAttrs.length) {
                orgAttrs.push(...essential);
            }

            const org = await Models.Organizations.findOne({
                where: { name: parsed.name },
                ...(orgAttrs.length ? { attributes: orgAttrs } : {}),
                include: [{
                    model: Models.Users, as: 'owner',
                    ...(ownerAttrs.length ? { attributes: ownerAttrs } : {}),
                }]
            });
            return { organization: org };
        } catch (error) {
            return { error };
        }
    }

    static async getOrganizationPackages(params: { orgId: number }, attributes: any = {}) {
        try {
            const { orgId } = params;
            const pkgAttrs = [...(attributes.packages || [])];
            const org = await Models.Organizations.findByPk(orgId, {
                attributes: ['id'],
                include: [{
                    model: Models.Packages, as: 'packages',
                    ...(pkgAttrs.length ? { attributes: pkgAttrs } : {}),
                }]
            });
            return { packages: org?.packages || [] };
        } catch (error) {
            return { error };
        }
    }

    static async createOrganization(params: unknown) {
        try {
            const parsed = CreateOrganizationSchema.parse(params);
            const org = await Models.Organizations.create(parsed as any);
            return { organization: org };
        } catch (error) {
            return { error };
        }
    }

    static async updateOrganization(params: { orgId: number; input: UpdateOrganizationInput }) {
        try {
            const { orgId, input } = params;
            const parsed = UpdateOrganizationSchema.parse(input);
            const [affected] = await Models.Organizations.update(parsed as any, {
                where: { id: orgId },
            });
            if (affected === 0) {
                return { error: { message: 'Organization not found' } };
            }
            const org = await Models.Organizations.findByPk(orgId);
            return { organization: org };
        } catch (error) {
            return { error };
        }
    }

    static async deleteOrganization(params: { orgId: number }) {
        try {
            const { orgId } = params;
            const affected = await Models.Organizations.destroy({ where: { id: orgId } });
            if (affected === 0) {
                return { error: { message: 'Organization not found' } };
            }
            return { success: true };
        } catch (error) {
            return { error };
        }
    }
}

export default OrganizationController;
