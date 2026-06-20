import {
    DataTypes,
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    NonAttribute,
} from "sequelize";

import type Users from "./UsersModel";
import type PackageVersion from "./PackageVersionModel";
import { db } from "../config/db";

export type PackageVisibility = "public" | "private";
export type PackageStatus = "active" | "deprecated" | "yanked" | "unavailable";
export type VerificationStatus = "unverified" | "verified" | "pending" | "failed";

class Packages extends Model<InferAttributes<Packages>, InferCreationAttributes<Packages>> {
    declare id: CreationOptional<number>;

    declare scope: string | null;
    declare name: string;
    declare fullName: string;
    declare displayName: string | null;

    declare description: string | null;
    declare readmeText: string | null;
    declare license: string | null;

    declare ownerUserId: number | null;
    declare ownerOrganizationId: number | null;

    declare visibility: CreationOptional<PackageVisibility>;
    declare status: CreationOptional<PackageStatus>;
    declare verificationStatus: CreationOptional<VerificationStatus>;

    declare repoFullName: string | null;
    declare githubRepoId: number | null;
    declare repositoryUrl: string | null;
    declare homepageUrl: string | null;
    declare documentationUrl: string | null;

    declare latestVersionId: number | null;
    declare latestVersion: string | null;

    declare totalDownloads: CreationOptional<number>;
    declare weeklyDownloads: CreationOptional<number>;
    declare versionsCount: CreationOptional<number>;
    declare dependenciesCount: CreationOptional<number>;
    declare dependentsCount: CreationOptional<number>;

    declare lastPublishedAt: Date | null;
    declare lastCheckedAt: Date | null;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    declare keywords: string[];
    declare platforms: string[];
    declare maintainers: object[];
    declare security: object | null;
    declare downloadTrend: object[];

    declare owner?: NonAttribute<Users>;
    declare versions?: NonAttribute<PackageVersion[]>;
    declare latestVersionRecord?: NonAttribute<PackageVersion>;
}

Packages.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },

        scope: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },

        name: {
            type: DataTypes.STRING(214),
            allowNull: false,
        },

        fullName: {
            type: DataTypes.STRING(320),
            allowNull: false,
            unique: true,
            field: "full_name",
        },

        displayName: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: "display_name",
        },

        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },

        readmeText: {
            type: DataTypes.TEXT("long"),
            allowNull: true,
            field: "readme_text",
        },

        license: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },

        ownerUserId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            field: "owner_user_id",
        },

        ownerOrganizationId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            field: "owner_organization_id",
        },

        visibility: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: "public",
        },

        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: "active",
        },

        verificationStatus: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: "unverified",
            field: "verification_status",
        },

        repoFullName: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: "repo_full_name",
        },

        githubRepoId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            field: "github_repo_id",
        },

        repositoryUrl: {
            type: DataTypes.STRING(1024),
            allowNull: true,
            field: "repository_url",
        },

        homepageUrl: {
            type: DataTypes.STRING(1024),
            allowNull: true,
            field: "homepage_url",
        },

        documentationUrl: {
            type: DataTypes.STRING(1024),
            allowNull: true,
            field: "documentation_url",
        },

        latestVersionId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            field: "latest_version_id",
        },

        latestVersion: {
            type: DataTypes.STRING(50),
            allowNull: true,
            field: "latest_version",
        },

        totalDownloads: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            field: "total_downloads",
        },

        weeklyDownloads: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            field: "weekly_downloads",
        },

        versionsCount: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            field: "versions_count",
        },

        dependenciesCount: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            field: "dependencies_count",
        },

        dependentsCount: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            field: "dependents_count",
        },

        lastPublishedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "last_published_at",
        },

        lastCheckedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "last_checked_at",
        },

        keywords: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
        },

        platforms: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
        },

        maintainers: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
        },

        security: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: null,
        },

        downloadTrend: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
        },

        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            field: "created_at",
        },

        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            field: "updated_at",
        },
    },
    {
        sequelize: db,
        modelName: "Package",
        tableName: "packages",
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ["full_name"],
            },
            {
                unique: true,
                fields: ["scope", "name"],
            },
            {
                fields: ["scope"],
            },
            {
                fields: ["name"],
            },
            {
                fields: ["status"],
            },
            {
                fields: ["weekly_downloads"],
            },
            {
                fields: ["total_downloads"],
            },
            {
                fields: ["last_published_at"],
            },
        ],
    }
);

export default Packages;
