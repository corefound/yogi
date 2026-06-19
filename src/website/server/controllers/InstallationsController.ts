import { Models } from "../models";
import { CreateInstallationSchema } from "../schemas/installation.schema";

export class InstallationsController {
    static async createInstallation(params: unknown) {
        try {
            const parsed = CreateInstallationSchema.parse(params);
            const installation = await Models.InstallationsModel.create(parsed as any);
            return { installation };
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