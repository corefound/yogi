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

    // Foreign key hacia Packages.name
    declare packageName: string;

    declare version: string;
    declare description: string | null;
    declare readmeText: string | null;
    declare license: string | null;
    declare assetSizeBytes: CreationOptional<number>;
    declare installCount: CreationOptional<number>;
    declare status: CreationOptional<PackageVersionStatus>;
    declare publishedAt: CreationOptional<Date>;

    // Associations
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

        packageName: {
            type: DataTypes.STRING(214),
            allowNull: false,
            field: "package_name",
            references: {
                model: "packages",
                key: "name",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
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

        assetSizeBytes: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
            field: "asset_size_bytes",
        },

        installCount: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
            field: "install_count",
        },

        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: "active",
        },

        publishedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: "published_at",
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
                fields: ["package_name", "version"],
            },
            {
                fields: ["package_name"],
            },
            {
                fields: ["status"],
            },
        ],
    }
);

export default PackageVersion;