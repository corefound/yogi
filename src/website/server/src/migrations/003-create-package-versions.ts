import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable("package_versions", {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        package_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: "packages", key: "id" } },
        version: { type: DataTypes.STRING(50), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        readme_text: { type: DataTypes.TEXT, allowNull: true },
        license: { type: DataTypes.STRING(100), allowNull: true },
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "active" },
        asset_size_bytes: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
        minified_size_bytes: { type: DataTypes.BIGINT, allowNull: true },
        install_count: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
        checksum: { type: DataTypes.STRING(128), allowNull: true },
        tarball_url: { type: DataTypes.STRING(1024), allowNull: true },
        github_release_id: { type: DataTypes.BIGINT, allowNull: true },
        github_release_tag: { type: DataTypes.STRING(100), allowNull: true },
        published_by_user_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: "users", key: "id" } },
        published_at: { type: DataTypes.DATE, allowNull: false },
      platforms: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      dependencies: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      assets: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex("package_versions", ["package_id", "version"], { unique: true });
    await queryInterface.addIndex("package_versions", ["package_id"]);
    await queryInterface.addIndex("package_versions", ["status"]);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable("package_versions");
}
