import {
    DataTypes,
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    NonAttribute,
} from "sequelize";

import type Users from "./UsersModel";
import { db } from "../config/db";

class Sessions extends Model<InferAttributes<Sessions>, InferCreationAttributes<Sessions>> {
    declare id: CreationOptional<number>;
    declare sid: string;
    declare userId: number;
    declare token: string;
    declare userAgent: string | null;
    declare ipAddress: string | null;
    declare expiresAt: Date;
    declare lastActivityAt: Date | null;
    declare revokedAt: Date | null;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    declare user?: NonAttribute<Users>;
}

Sessions.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },

        sid: {
            type: DataTypes.STRING(36),
            allowNull: false,
            unique: true,
        },

        userId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            field: "user_id",
        },

        token: {
            type: DataTypes.TEXT,
            allowNull: false,
        },

        userAgent: {
            type: DataTypes.STRING(512),
            allowNull: true,
            field: "user_agent",
        },

        ipAddress: {
            type: DataTypes.STRING(45),
            allowNull: true,
            field: "ip_address",
        },

        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
            field: "expires_at",
        },

        lastActivityAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "last_activity_at",
        },

        revokedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "revoked_at",
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
        modelName: "Session",
        tableName: "sessions",
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ["sid"],
            },
            {
                fields: ["user_id"],
            },
            {
                fields: ["expires_at"],
            },
        ],
    }
);

export default Sessions;
