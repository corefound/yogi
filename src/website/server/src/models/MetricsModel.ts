import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from "sequelize";
import { db } from "../config/db";

class Metrics extends Model<InferAttributes<Metrics>, InferCreationAttributes<Metrics>> {
    declare id: CreationOptional<number>;
    declare key: string;
    declare value: number;
    declare label: string | null;
    declare body: object | null;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

Metrics.init({
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
    },
    value: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
    },
    label: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    body: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
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
    modelName: "Metrics",
    tableName: "metrics",
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ["key"],
        },
    ],
});

export default Metrics;
