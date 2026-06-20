import { Models } from "../models";
import {
    CreateMetricSchema,
    UpdateMetricSchema,
    type CreateMetricInput,
    type UpdateMetricInput,
} from "../schemas/metrics.schema";

export class MetricsController {
    static async getAllMetrics() {
        const metrics = await Models.Metrics.findAll({
            order: [['key', 'ASC']],
        });
        return { metrics };
    }

    static async getMetric(key: string) {
        try {
            const metric = await Models.Metrics.findOne({
                where: { key },
            });
            return { metric };
        } catch (error) {
            return { error };
        }
    }

    static async createMetric(params: unknown) {
        try {
            const parsed = CreateMetricSchema.parse(params);
            const metric = await Models.Metrics.create(parsed as any);
            return { metric };
        } catch (error) {
            return { error };
        }
    }

    static async updateMetric(params: { key: string; input: UpdateMetricInput }) {
        try {
            const { key, input } = params;
            const parsed = UpdateMetricSchema.parse(input);
            const [affected] = await Models.Metrics.update(parsed as any, {
                where: { key },
            });
            if (affected === 0) {
                return { error: { message: 'Metric not found' } };
            }
            const metric = await Models.Metrics.findOne({ where: { key } });
            return { metric };
        } catch (error) {
            return { error };
        }
    }

    static async upsertMetric(params: CreateMetricInput) {
        try {
            const parsed = CreateMetricSchema.parse(params);
            const [metric] = await Models.Metrics.upsert(parsed as any);
            return { metric };
        } catch (error) {
            return { error };
        }
    }

    static async deleteMetric(key: string) {
        try {
            const affected = await Models.Metrics.destroy({ where: { key } });
            if (affected === 0) {
                return { error: { message: 'Metric not found' } };
            }
            return { success: true };
        } catch (error) {
            return { error };
        }
    }

    static async refreshMetrics() {
        try {
            const totalPackages = await Models.Packages.count();
            const totalVersions = await Models.PackageVersion.count();
            const totalOrganizations = await Models.Organizations.count();
            const totalDownloads = await Models.Packages.sum('totalDownloads');

            const metrics = [
                { key: 'total_packages', value: totalPackages, label: 'Total Packages' },
                { key: 'total_versions', value: totalVersions, label: 'Total Versions' },
                { key: 'total_organizations', value: totalOrganizations, label: 'Total Organizations' },
                { key: 'total_downloads', value: totalDownloads || 0, label: 'Total Downloads' },
                { key: 'weekly_downloads', value: 0, label: 'Weekly Downloads' },
                { key: 'package_updates', value: 0, label: 'Package Updates' },
                { key: 'verified_organizations', value: 0, label: 'Verified Organizations' },
            ];

            for (const m of metrics) {
                await Models.Metrics.upsert(m as any);
            }

            const all = await Models.Metrics.findAll({ order: [['key', 'ASC']] });
            return { metrics: all };
        } catch (error) {
            return { error };
        }
    }
}

export default MetricsController;
