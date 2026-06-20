import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute } from "sequelize";
import type Packages from "./PackagesModel";
import { db } from "../config/db";

export type UserRole = "user" | "admin";
export type UserStatus = "active" | "suspended" | "deleted";

class Users extends Model<InferAttributes<Users>, InferCreationAttributes<Users>> {
    declare id: CreationOptional<number>;
    declare githubUserId: string;
    declare githubLogin: string;
    declare displayName: string | null;
    declare avatarUrl: string | null;
    declare profileUrl: string | null;
    declare email: string | null;

    declare role: CreationOptional<UserRole>;
    declare status: CreationOptional<UserStatus>;
    declare lastLoginAt: Date | null;

    declare packages?: NonAttribute<Packages[]>;
}

Users.init({
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },

    githubUserId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: "github_user_id",
    },

    githubLogin: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: "github_login",
    },

    displayName: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: "display_name",
    },

    avatarUrl: {
        type: DataTypes.STRING(512),
        allowNull: true,
        field: "avatar_url",
    },

    profileUrl: {
        type: DataTypes.STRING(512),
        allowNull: true,
        field: "profile_url",
    },

    email: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },

    role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "user",
    },

    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "active",
    },

    lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "last_login_at",
    }
}, {
    sequelize: db,
    modelName: "User",
    tableName: "users",
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ["github_user_id"],
        },
        {
            fields: ["github_login"],
        },
        {
            fields: ["email"],
        },
        {
            fields: ["status"],
        },
    ],
}
);

export default Users;
