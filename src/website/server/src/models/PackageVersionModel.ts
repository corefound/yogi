import {
    DataTypes,
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    NonAttribute,
} from "sequelize";

import type Packages from "./PackagesModel";
import type InstallationsModel from "./InstallationsModel";
import { db } from "../config/db";

export type PackageVersionStatus = "active" | "draft" | "deprecated" | "yanked";

class PackageVersion extends Model<
    InferAttributes<PackageVersion>,
    InferCreationAttributes<PackageVersion>
> {
    declare id: CreationOptional<number>;

    declare packageId: number;
    declare version: string;
    declare description: string | null;
    declare readmeText: string | null;
    declare license: string | null;

    declare status: CreationOptional<PackageVersionStatus>;

    declare assetSizeBytes: CreationOptional<number>;
    declare minifiedSizeBytes: number | null;
    declare installCount: CreationOptional<number>;

    declare checksum: string | null;
    declare tarballUrl: string | null;
    declare githubReleaseId: number | null;
    declare githubReleaseTag: string | null;

    declare publishedByUserId: number | null;
    declare publishedAt: CreationOptional<Date>;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    declare dependencies: object[];
    declare assets: object[];

    declare package?: NonAttribute<Packages>;
    declare installations?: NonAttribute<InstallationsModel[]>;
}

PackageVersion.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },

        packageId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            field: "package_id",
        },

        version: {
            type: DataTypes.STRING(50),
            allowNull: false,
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

        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: "active",
        },

        assetSizeBytes: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            field: "asset_size_bytes",
        },

        minifiedSizeBytes: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: true,
            field: "minified_size_bytes",
        },

        installCount: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            field: "install_count",
        },

        checksum: {
            type: DataTypes.STRING(128),
            allowNull: true,
        },

        tarballUrl: {
            type: DataTypes.STRING(1024),
            allowNull: true,
            field: "tarball_url",
        },

        githubReleaseId: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: true,
            field: "github_release_id",
        },

        githubReleaseTag: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: "github_release_tag",
        },

        publishedByUserId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            field: "published_by_user_id",
        },

        publishedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: "published_at",
        },

        dependencies: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
        },

        assets: {
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
        modelName: "PackageVersion",
        tableName: "package_versions",
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ["package_id", "version"],
            },
            {
                fields: ["package_id"],
            },
            {
                fields: ["status"],
            },
        ],
    }
);

export default PackageVersion;
