import { Op } from "sequelize";
import { Models } from "../models";
import {
    RecordDownloadSchema,
    GetDownloadStatsSchema,
} from "../schemas/download.schema";

export class DownloadsController {
    static async recordDownload(params: unknown) {
        try {
            const parsed = RecordDownloadSchema.parse(params);
            const { packageId } = parsed;

            const pkg = await Models.Packages.findByPk(packageId);
            if (!pkg) {
                return { error: { message: 'Package not found' } };
            }

            await pkg.increment('totalDownloads', { by: 1 });
            await pkg.increment('weeklyDownloads', { by: 1 });

            const today = new Date().toISOString().slice(0, 10);
            const trend = pkg.downloadTrend as any[] || [];
            const existingDay = trend.find((d: any) => d.date === today);
            if (existingDay) {
                existingDay.downloads = (existingDay.downloads || 0) + 1;
            } else {
                trend.push({ date: today, downloads: 1 });
            }
            await pkg.update({ downloadTrend: trend } as any);

            return { success: true };
        } catch (error) {
            return { error };
        }
    }

    static async getDownloadStats(params: unknown, attributes: any = {}) {
        try {
            const parsed = GetDownloadStatsSchema.parse(params);
            const { packageId, period } = parsed;

            const pkgAttrs = [...(attributes.package || [])];
            const pkg = await Models.Packages.findByPk(packageId, {
                ...(pkgAttrs.length ? { attributes: pkgAttrs } : {}),
            });
            if (!pkg) {
                return { error: { message: 'Package not found' } };
            }

            const trend = pkg.downloadTrend as any[] || [];
            const now = Date.now();
            let filtered = trend;
            if (period === 'week') {
                const weekAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
                filtered = trend.filter((d: any) => d.date >= weekAgo);
            } else if (period === 'month') {
                const monthAgo = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
                filtered = trend.filter((d: any) => d.date >= monthAgo);
            }

            const totalInPeriod = filtered.reduce((sum: number, d: any) => sum + (d.downloads || 0), 0);

            return {
                totalDownloads: pkg.totalDownloads,
                weeklyDownloads: pkg.weeklyDownloads,
                periodDownloads: totalInPeriod,
                period,
                downloadTrend: filtered,
            };
        } catch (error) {
            return { error };
        }
    }
}

export default DownloadsController;
