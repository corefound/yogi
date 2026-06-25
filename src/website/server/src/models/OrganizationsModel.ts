import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute } from "sequelize";
import type Users from "./UsersModel";
import type Packages from "./PackagesModel";
import { db } from "../config/db";

export type OrgStatus = "active" | "suspended";

class Organizations extends Model<InferAttributes<Organizations>, InferCreationAttributes<Organizations>> {
    declare id: CreationOptional<number>;
    declare name: string;
    declare displayName: string | null;
    declare description: string | null;
    declare avatarUrl: string | null;
    declare members: string[];
    declare ownerUserId: number;
    declare status: CreationOptional<OrgStatus>;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    declare owner?: NonAttribute<Users>;
    declare packages?: NonAttribute<Packages[]>;
}

Organizations.init({
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
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
    avatarUrl: {
        type: DataTypes.STRING(512),
        allowNull: true,
        field: "avatar_url",
    },
    members: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
    },
    ownerUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "owner_user_id",
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "active",
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
}, {
    sequelize: db,
    modelName: "Organization",
    tableName: "organizations",
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ["name"],
        },
        {
            fields: ["owner_user_id"],
        },
    ],
});

export default Organizations;
