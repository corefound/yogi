import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from "sequelize";
import { db } from "../config/db";

class Categories extends Model<InferAttributes<Categories>, InferCreationAttributes<Categories>> {
    declare id: CreationOptional<number>;
    declare name: string;
    declare slug: string;
    declare packageCount: CreationOptional<number>;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

Categories.init({
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    slug: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
    },
    packageCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        field: "package_count",
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
    modelName: "Categories",
    tableName: "categories",
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ["slug"],
        },
    ],
});

export default Categories;
