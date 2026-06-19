import { Models } from "../models";
import { CreatePackageVersionSchema, GetPackageVersionSchema } from "../schemas/packageVersion.schema";

export class PackageVersionController {
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

    static async version(params: unknown, attributes: any = {}) {
        try {
            const parsed = GetPackageVersionSchema.parse(params);
            const version = await Models.PackageVersion.findOne({
                where: { packageName: parsed.packageName },
                attributes: [...attributes.version || []],
                include: [{
                    model: Models.Packages, as: 'package',
                    attributes: [...(attributes.package || [])],
                }]
            });
            return { version };
        } catch (error) {
            return { error };
        }
    }

    static async versionsByPackage(packageName: string, attributes?: string[]) {
        try {
            const versions = await Models.PackageVersion.findAll({
                where: { packageName },
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