import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute } from "sequelize";
import type PackageVersion from "./PackageVersionModel";
import { db } from "../config/db";

class InstallationsModel extends Model<InferAttributes<InstallationsModel>, InferCreationAttributes<InstallationsModel>> {
    declare id: CreationOptional<number>;
    declare packageId: number;
    declare packageVersionId: number;
    declare eventType: string;
    declare platform: string;
    declare arch: string;
    declare os: string;
    declare yogiVersion: string;
    declare status: string;

    declare sha256Matched: boolean;
    declare releaseIdMatched: boolean;
    declare assetNameMatched: boolean;
    declare assetIdMatched: boolean;
    declare assetSizeMatched: boolean;

    declare packageVersion?: NonAttribute<PackageVersion>;
}

InstallationsModel.init({
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
    packageVersionId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "package_version_id",
    },
    eventType: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "event_type",
    },
    platform: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    arch: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    os: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    yogiVersion: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "yogi_version",
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    sha256Matched: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: "sha256_matched",
    },
    releaseIdMatched: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: "release_id_matched",
    },
    assetNameMatched: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: "asset_name_matched",
    },
    assetIdMatched: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: "asset_id_matched",
    },
    assetSizeMatched: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: "asset_size_matched",
    },
}, {
    sequelize: db,
    modelName: "Installations",
    tableName: "installations",
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ["package_id", "package_version_id"],
        },
    ],
})

export default InstallationsModel;
