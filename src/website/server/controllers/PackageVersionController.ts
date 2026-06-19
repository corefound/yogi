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

    static async version(params: unknown) {
        try {
            const parsed = GetPackageVersionSchema.parse(params);
            const pkg = await Models.Packages.findOne({
                where: { name: parsed.packageName }
            });
            if (!pkg) {
                return { error: { message: `Package "${parsed.packageName}" not found` } };
            }
            const version = await Models.PackageVersion.findOne({
                where: { packageId: pkg.id, version: parsed.version }
            });
            if (!version) {
                return { error: { message: `Version "${parsed.version}" not found for package "${parsed.packageName}"` } };
            }
            return { version };
        } catch (error) {
            return { error };
        }
    }

    static async versionsByPackage(packageId: number) {
        try {
            const versions = await Models.PackageVersion.findAll({
                where: { packageId },
                order: [['publishedAt', 'DESC']]
            });
            return { versions };
        } catch (error) {
            return { error: String(error) };
        }
    }
}

export default PackageVersionController;