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
export type PackageStatus = "active" | "suspended" | "deleted" | "deprecated";

class Packages extends Model<InferAttributes<Packages>, InferCreationAttributes<Packages>> {
    declare id: CreationOptional<number>;

    declare name: string;
    declare repoFullName: string;
    declare githubRepoId: number;

    declare description: string | null;
    declare readmeText: string | null;
    declare license: string | null;
    declare homepage: string | null;

    declare visibility: CreationOptional<PackageVisibility>;
    declare status: CreationOptional<PackageStatus>;

    declare totalInstalls: CreationOptional<number>;
    declare totalVersions: CreationOptional<number>

    // Association mixins
    declare owner?: NonAttribute<Users>;
    declare versions?: NonAttribute<PackageVersion[]>;
}

Packages.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },

        name: {
            type: DataTypes.STRING(214),
            allowNull: false,
            unique: true,
        },

        repoFullName: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: "repo_full_name",
        },

        githubRepoId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: "github_repo_id",
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

        homepage: {
            type: DataTypes.STRING(512),
            allowNull: true,
        },

        visibility: {
            type: DataTypes.ENUM("public", "private"),
            allowNull: false,
            defaultValue: "public",
        },

        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: "active",
        },

        totalInstalls: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
            field: "total_installs",
        },

        totalVersions: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: "total_versions",
        }
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
                fields: ["name"],
            },
            {
                fields: ["repo_full_name"],
            },
            {
                fields: ["visibility"],
            },
            {
                fields: ["status"],
            },
        ],
    }
);

export default Packages;