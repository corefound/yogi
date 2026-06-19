import { Models } from "../models";
import { CreatePackageSchema } from "../schemas";

export class PackageController {
    static async getAllPackages(attributes: any = {}) {
        const packages = await Models.Packages.findAll({
            attributes: [...attributes?.package || []],
        });
        
        return { packages };
    }

    static async createPackage(params: unknown) {
        try {
            const parsed = CreatePackageSchema.parse(params);
            const packageData = {
                ...parsed,
                githubRepoId: parsed.githubRepoId ?? null,
                description: parsed.description ?? null,
                readmeText: parsed.readmeText ?? null,
                license: parsed.license ?? null,
                homepage: parsed.homepage || null,
            };
            const pkg = await Models.Packages.create(packageData as any);
            return { package: pkg };
        } catch (error) {
            return { error };
        }

    }
}

export default PackageController;