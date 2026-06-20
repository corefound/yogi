import { Models } from "../models";
import { CreateInstallationSchema, UpdateInstallationSchema, type UpdateInstallationInput } from "../schemas/installation.schema";

export class InstallationsController {
    static async getInstallations(params: { limit?: number; offset?: number } = {}, attributes: any = {}) {
        const { limit, offset } = params;
        const attrs = [...(attributes.installation || [])];
        const installations = await Models.InstallationsModel.findAll({
            ...(attrs.length ? { attributes: attrs } : {}),
            limit: limit ? Math.min(limit, 100) : undefined,
            offset: offset ?? undefined,
            order: [['createdAt', 'DESC']],
        });
        return { installations };
    }

    static async createInstallation(params: unknown) {
        try {
            const parsed = CreateInstallationSchema.parse(params);
            const installation = await Models.InstallationsModel.create(parsed as any);
            return { installation };
        } catch (error) {
            return { error };
        }
    }

    static async getInstallation(installationId: number, attributes: any = {}) {
        try {
            const instAttrs = [...(attributes.installation || [])];
            const verAttrs = [...(attributes.packageVersion || [])];
            const installation = await Models.InstallationsModel.findByPk(installationId, {
                ...(instAttrs.length ? { attributes: instAttrs } : {}),
                include: [{
                    model: Models.PackageVersion, as: 'version',
                    ...(verAttrs.length ? { attributes: verAttrs } : {}),
                }]
            });
            return { installation };
        } catch (error) {
            return { error: String(error) };
        }
    }

    static async updateInstallation(params: { id: number; input: UpdateInstallationInput }) {
        try {
            const { id, input } = params;
            const parsed = UpdateInstallationSchema.parse(input);
            const [affected] = await Models.InstallationsModel.update(parsed as any, {
                where: { id },
            });
            if (affected === 0) {
                return { error: { message: 'Installation not found' } };
            }
            const installation = await Models.InstallationsModel.findByPk(id);
            return { installation };
        } catch (error) {
            return { error };
        }
    }

    static async deleteInstallation(params: { id: number }) {
        try {
            const { id } = params;
            const affected = await Models.InstallationsModel.destroy({ where: { id } });
            if (affected === 0) {
                return { error: { message: 'Installation not found' } };
            }
            return { success: true };
        } catch (error) {
            return { error };
        }
    }

    static async installationsByVersion(packageVersionId: number) {
        try {
            const installations = await Models.InstallationsModel.findAll({
                where: { packageVersionId },
                order: [['createdAt', 'DESC']]
            });
            return { installations };
        } catch (error) {
            return { error: String(error) };
        }
    }
}

export default InstallationsController;
